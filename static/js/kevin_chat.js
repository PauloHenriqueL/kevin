/**
 * Kevin Chat — mensagens, áudio (STT/TTS), modo hands-free.
 *
 * Expects window.KEVIN_CHAT_CONFIG set before this script loads:
 *   {
 *     conversaId: <int>,
 *     userInitial: '<letra>',
 *     kevinSvg: '<URL absoluta ou relativa do SVG do Kevin>',
 *     urls: { mensagem, mensagemSync, conversa, stt, tts }
 *   }
 *
 * Ganchos DOM obrigatórios (IDs):
 *   #chat-body (.chat-body)      — container das mensagens
 *   #chat-input                  — textarea
 *   #btn-send                    — botão enviar
 *   #btn-mic                     — mic click-to-record
 *   #btn-mic-live                — mic hands-free
 *   #chat-header-kevin-expr      — opcional, slot pra trocar expressão do Kevin no header
 */
(function () {
  const cfg = window.KEVIN_CHAT_CONFIG;
  if (!cfg) {
    console.error('[Kevin] KEVIN_CHAT_CONFIG não definido.');
    return;
  }

  const SILENCE_THRESHOLD = 0.015;
  const SILENCE_TIMEOUT_MS = 2500;
  const MAX_RECORD_MS = 30000;

  const state = {
    mediaRecorder: null,
    micStream: null,
    audioContext: null,
    analyser: null,
    stopMonitor: null,
    isRecording: false,
    isSending: false,
    liveMode: false,
    liveErros: 0,               // erros consecutivos no modo ao vivo — desliga após o limite
    // TTS playback control:
    ttsSeq: 0,                  // incrementado a cada playTTS — invalida anteriores
    ttsAbortController: null,   // aborta o fetch do TTS atual
    currentTtsBlobUrl: null,    // URL.revokeObjectURL pra liberar memória
    kevinReady: false,          // true quando kevinChat.init() resolve
  };

  // Playground (Demanda 20): sessão sem aula. Todo caminho novo fica atrás
  // deste flag — a aula estruturada não executa nada do que vem abaixo.
  const MODO_PLAYGROUND = window.KEVIN_MODO === 'playground';
  const pg = {
    estado: Object.assign(
      { whisper: false, so_ingles: false, cenario: 'floresta', quadro: '' },
      window.KEVIN_ESTADO_INICIAL || {}
    ),
    temContexto: !!window.KEVIN_TEM_CONTEXTO,
    respondendo: false,         // ações + fala de uma resposta em andamento
    encerrando: false,          // Encerrar clicado: respostas pendentes não falam mais
    musicaTocando: false,
    musicaUrl: '',
    onMusicaEnded: null,
    liveAntesDaMusica: false,
  };

  const $ = (sel) => document.querySelector(sel);
  const chatBody = $('#chat-body');
  const input = $('#chat-input');
  const btnSend = $('#btn-send');
  const btnMic = $('#btn-mic');
  const btnMicLive = $('#btn-mic-live');

  // ───────────── Kevin Animado (motor kevin-puppet) ─────────────
  let kevinChat = null;

  function setInteractionDisabled(disabled) {
    // Desabilita botões de interação enquanto Kevin não carrega.
    // O input de texto continua editável — só o envio fica gated.
    if (btnSend) btnSend.disabled = disabled;
    if (btnMic) btnMic.disabled = disabled;
    if (btnMicLive) btnMicLive.disabled = disabled;
    document.querySelectorAll('.suggestion-chip').forEach((chip) => {
      chip.disabled = disabled;
      chip.style.opacity = disabled ? '0.55' : '';
      chip.style.cursor = disabled ? 'wait' : '';
    });
  }

  async function initializeKevin() {
    if (!window.KevinChatIntegration || !window.KEVIN_RIG_CONFIG) {
      // O motor não carregou (módulo 404 / parse error / extensão bloqueando).
      // Habilita a UI mesmo assim — chat de texto continua funcional sem o puppet.
      console.warn('[Chat] Kevin não inicializado (config ou integração ausente)');
      setInteractionDisabled(false);
      return;
    }
    setInteractionDisabled(true);
    try {
      kevinChat = new KevinChatIntegration(
        window.KEVIN_RIG_CONFIG.rigMountSelector,
        window.KEVIN_RIG_CONFIG.svgUrl,
        // O config inteiro, não só o background: o motor precisa das URLs
        // de vídeo, áudio, quadro-negro e vocabulário (ver assetOptions).
        window.KEVIN_RIG_CONFIG
      );
      await kevinChat.init();
      state.kevinReady = !!(kevinChat.isReady && kevinChat.isReady());
      // Congela o 1º frame da entrada atrás da tela de espera (#call-standby)
      // em vez de deixar o Kevin em standby já visível por trás do popup.
      if (state.kevinReady && kevinChat.freezeEntrada && window.KEVIN_RIG_CONFIG.entradaVideoUrl) {
        kevinChat.freezeEntrada(window.KEVIN_RIG_CONFIG.entradaVideoUrl);
      }
    } catch (error) {
      console.error('[Chat] Erro ao inicializar Kevin:', error);
    } finally {
      setInteractionDisabled(false);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeKevin);
  } else {
    initializeKevin();
  }

  // ───────────── CSRF ─────────────
  function getCookie(name) {
    const m = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return m ? m[2] : '';
  }

  // ───────────── Audio context ─────────────
  function ensureAudioContext() {
    if (!state.audioContext) {
      state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (state.audioContext.state === 'suspended') state.audioContext.resume();
  }

  // ───────────── UI: mensagens ─────────────
  function kevinAvatarHTML() {
    return `
      <div class="msg-avatar kevin-avatar">
        <img class="kevin-mascot" src="${cfg.kevinSvg}" alt="Kevin">
      </div>`;
  }

  function userAvatarHTML() {
    return `<div class="msg-avatar user-avatar">${cfg.userInitial}</div>`;
  }

  function appendMessage(role, content) {
    // Primeira mensagem: remove o empty state, se existir
    const empty = document.getElementById('chat-empty-state');
    if (empty) empty.remove();

    const avatar = role === 'assistant' ? kevinAvatarHTML() : userAvatarHTML();
    const bubble = `<div class="msg-bubble">${escapeHTML(content)}</div>`;
    const listen = role === 'assistant'
      ? `<button class="btn-listen" type="button" aria-label="Ouvir resposta do Kevin" data-text="${escapeAttr(content)}">
           <svg class="icon-play" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 22V2l18 10z"/></svg>
           <svg class="icon-pause" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>
           <span class="btn-listen-label">Ouvir</span>
         </button>`
      : '';
    const msg = document.createElement('div');
    msg.className = 'message ' + role;
    msg.innerHTML = role === 'assistant'
      ? `${avatar}<div class="msg-content">${bubble}${listen}</div>`
      : `${avatar}${bubble}`;
    chatBody.appendChild(msg);
    chatBody.scrollTop = chatBody.scrollHeight;
    return msg;
  }

  function escapeAttr(s) {
    return String(s).replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function showTyping() {
    if (document.getElementById('typing-indicator')) return;
    const t = document.createElement('div');
    t.className = 'typing-indicator';
    t.id = 'typing-indicator';
    t.innerHTML = `${kevinAvatarHTML()}<div class="typing-dots"><span></span><span></span><span></span></div>`;
    chatBody.appendChild(t);
    chatBody.scrollTop = chatBody.scrollHeight;

    // Kevin pensando enquanto IA processa
    if (kevinChat) kevinChat.onAssistantThinking();
  }

  function hideTyping() {
    const t = document.getElementById('typing-indicator');
    if (t) t.remove();
  }

  // ───────────── Modo Demo (sem IA) ─────────────
  const DEMO_REPLIES = [
    'Que pergunta interessante! Deixa eu te ajudar com isso.',
    'Sim, claro! Posso te dar várias dicas sobre essa aula.',
    'Boa! Esse é um tema muito importante para os alunos pequenos.',
    'Olha só, eu sugiro começar com uma música para engajar a turma.',
    'Pode contar comigo! Vamos pensar juntos como fazer essa atividade.',
    'Excelente ideia! As crianças vão adorar isso.',
    'Para essa idade, o ideal é usar muitas imagens e gestos.',
    'Dica: repetir o vocabulário várias vezes em contextos diferentes ajuda na memorização.',
  ];

  function demoReply(userText) {
    const t = userText.toLowerCase();
    if (t.match(/\b(oi|olá|hello|hi)\b/)) return 'Oi! Tudo bem? Em que posso ajudar com a aula de hoje?';
    if (t.includes('?')) return DEMO_REPLIES[Math.floor(Math.random() * 4)];
    if (t.includes('obrigad')) return 'Por nada! Estou aqui sempre que precisar.';
    return DEMO_REPLIES[Math.floor(Math.random() * DEMO_REPLIES.length)];
  }

  // ───────────── Envio de texto ─────────────
  function enviarMensagem() {
    const texto = input.value.trim();
    if (!texto || state.isSending) return;

    if (MODO_PLAYGROUND) {
      // Sala barulhenta: o professor digita e o Kevin fala E age, como na voz.
      input.value = '';
      input.style.height = 'auto';
      if (kevinChat && kevinChat.unlockAudio) {
        kevinChat.unlockAudio().catch(() => {/* já logado pelo adapter */});
      }
      pgAntesDeInteragir();
      sendTextAndSpeak(texto);
      return;
    }

    // Aproveita esse user gesture pra destravar o AudioContext do TTS.
    // Sem isso, o primeiro play() pode rodar com ctx suspended (Safari/iOS).
    if (kevinChat && kevinChat.unlockAudio) {
      kevinChat.unlockAudio().catch(() => {/* já logado pelo adapter */});
    }

    appendMessage('user', texto);
    input.value = '';
    input.style.height = 'auto';

    if (kevinChat) kevinChat.onUserMessage(texto);

    showTyping();

    // Modo demo: resposta local com animação
    if (window.KEVIN_DEMO_MODE) {
      setTimeout(() => {
        hideTyping();
        const resposta = demoReply(texto);
        appendMessage('assistant', resposta);
        if (kevinChat) kevinChat.onAssistantMessage(resposta);
      }, 1500 + Math.random() * 1000);
      return;
    }

    // Modo normal: chama backend
    fetch(cfg.urls.mensagem, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
      body: JSON.stringify({ conteudo: texto, tipo: 'texto' }),
    })
      .then((r) => r.json())
      .then(() => pollResposta())
      .catch((err) => {
        console.error('[Chat] Erro no envio:', err);
        hideTyping();
        appendMessage('assistant', 'Ops, tive um problema. Tente de novo!');
        if (kevinChat) kevinChat.onError();
      });
  }

  // ───────────── Envio síncrono (live mode) ─────────────
  async function enviarMensagemSync(texto) {
    const r = await fetch(cfg.urls.mensagemSync, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
      body: JSON.stringify({ conteudo: texto, tipo: 'texto' }),
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }

  function pollResposta() {
    let tentativas = 0;
    const id = setInterval(() => {
      tentativas++;
      fetch(cfg.urls.conversa)
        .then((r) => r.json())
        .then((data) => {
          const msgs = data.mensagens || [];
          const ultima = msgs[msgs.length - 1];
          if (ultima && ultima.role === 'assistant') {
            clearInterval(id);
            hideTyping();
            appendMessage('assistant', ultima.conteudo);

            if (ultima.celebrar) {
              // Não chama onAssistantMessage aqui: ele forçaria "standby" e
              // cortaria o gesto do celebrate no meio.
              celebrarSeNecessario(true);
            } else if (kevinChat) {
              kevinChat.onAssistantMessage(ultima.conteudo);
            }
          }
        });
      if (tentativas >= 30) {
        clearInterval(id);
        hideTyping();
        appendMessage('assistant', 'Kevin demorou demais. Tente novamente.');
        if (kevinChat) {
          kevinChat.onError();
        }
      }
    }, 2000);
  }

  // ───────────── Gravação com VAD ─────────────
  async function startRecording() {
    if (state.isRecording || state.isSending) return;
    if (MODO_PLAYGROUND) pgAntesDeInteragir();
    // Destrava o AudioContext do TTS enquanto ainda há user gesture do clique
    // do mic (será usado pra falar a resposta depois). Só faz sentido na
    // PRIMEIRA chamada do gesture; chamadas em loop do live mode já não
    // têm gesture mas o ctx já fica destravado.
    if (kevinChat && kevinChat.unlockAudio) {
      kevinChat.unlockAudio().catch(() => {/* já logado */});
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      state.micStream = stream;
      state.mediaRecorder = new MediaRecorder(stream);
      const chunks = [];

      state.mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      state.mediaRecorder.onstop = () => handleRecordingStop(stream, chunks);
      state.mediaRecorder.start();
      state.mediaRecorder._hasSpeech = false;
      state.isRecording = true;
      setMicBtnState('recording');
      if (kevinChat) kevinChat.setStatus('listening', 'Te gravando…');
      // Pose de ouvir enquanto grava; showTyping() troca pra "thinking"
      // quando o áudio sai, e endListeningPose() desfaz se não houver fala.
      if (kevinChat && kevinChat.startListeningPose) kevinChat.startListeningPose();

      ensureAudioContext();
      const src = state.audioContext.createMediaStreamSource(stream);
      const analyser = state.audioContext.createAnalyser();
      analyser.fftSize = 2048;
      src.connect(analyser);
      state.analyser = analyser;

      const dataArray = new Uint8Array(analyser.fftSize);
      let silenceStart = null;
      let speechDetected = false;
      let monitorRunning = true;

      const hardTimeout = setTimeout(() => {
        if (state.isRecording) {
          state.mediaRecorder._hasSpeech = speechDetected;
          stopRecording();
        }
      }, MAX_RECORD_MS);

      function monitor() {
        if (!monitorRunning || !state.isRecording) {
          clearTimeout(hardTimeout);
          return;
        }
        analyser.getByteTimeDomainData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const v = (dataArray[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / dataArray.length);

        if (rms > SILENCE_THRESHOLD) {
          speechDetected = true;
          silenceStart = null;
        } else if (speechDetected) {
          if (silenceStart === null) silenceStart = Date.now();
          if (Date.now() - silenceStart >= SILENCE_TIMEOUT_MS) {
            state.mediaRecorder._hasSpeech = true;
            clearTimeout(hardTimeout);
            stopRecording();
            return;
          }
        } else {
          if (silenceStart === null) silenceStart = Date.now();
          if (Date.now() - silenceStart >= SILENCE_TIMEOUT_MS * 2) {
            clearTimeout(hardTimeout);
            stopRecording();
            return;
          }
        }
        requestAnimationFrame(monitor);
      }
      state.stopMonitor = () => { monitorRunning = false; clearTimeout(hardTimeout); };
      requestAnimationFrame(monitor);
    } catch (err) {
      console.error('Mic error:', err);
      alert('Não foi possível acessar o microfone. Verifique as permissões.');
      state.liveMode = false;
      setMicBtnState('idle');
    }
  }

  function stopRecording() {
    if (state.mediaRecorder && state.mediaRecorder.state !== 'inactive') state.mediaRecorder.stop();
    if (state.stopMonitor) { state.stopMonitor(); state.stopMonitor = null; }
    state.isRecording = false;
  }

  async function handleRecordingStop(stream, chunks) {
    stream.getTracks().forEach((t) => t.stop());
    state.micStream = null;
    const hasSpeech = !!state.mediaRecorder._hasSpeech;

    if (!hasSpeech) {
      if (kevinChat && kevinChat.endListeningPose) kevinChat.endListeningPose();
      setMicBtnState(state.liveMode ? 'live' : 'idle');
      if (state.liveMode && !state.isSending) {
        setTimeout(() => { if (state.liveMode && !state.isRecording) startRecording(); }, 500);
      }
      return;
    }

    const blob = new Blob(chunks, { type: 'audio/webm' });
    setMicBtnState('thinking');
    showTyping();

    try {
      const fd = new FormData();
      fd.append('audio', blob, 'audio.webm');
      const sttRes = await fetch(cfg.urls.stt, {
        method: 'POST',
        headers: { 'X-CSRFToken': getCookie('csrftoken') },
        body: fd,
      });
      if (!sttRes.ok) throw new Error('STT ' + sttRes.status);
      const sttData = await sttRes.json();
      const texto = (sttData.text || '').trim();
      if (!texto) {
        hideTyping();
        // showTyping() deixou o Kevin em "thinking"; sem texto, nada responde.
        if (kevinChat && kevinChat.endListeningPose) kevinChat.endListeningPose();
        setMicBtnState(state.liveMode ? 'live' : 'idle');
        // Re-checa liveMode DENTRO do callback: usuário pode ter desligado
        // live mode no meio do flow (privacy: senão o mic abre de novo sem permissão).
        setTimeout(() => { if (state.liveMode && !state.isRecording) startRecording(); }, 400);
        return;
      }

      // Áudio (manual ou live) sempre faz IA + TTS síncronos,
      // só o live re-abre o mic automaticamente depois.
      state.isSending = true;
      appendMessage('user', '🎤 ' + texto);
      const data = MODO_PLAYGROUND ? await pgEnviarTeacher(texto) : await enviarMensagemSync(texto);
      state.isSending = false;
      state.liveErros = 0;  // turno OK: zera a contagem de erros consecutivos
      hideTyping();
      if (MODO_PLAYGROUND) {
        await pgResponder(data);
      } else {
        const resp = data.resposta && data.resposta.conteudo;
        const celebrar = !!(data.resposta && data.resposta.celebrar);
        if (resp) {
          appendMessage('assistant', resp);
          await celebrarSeNecessario(celebrar);
          await playTTS(resp);
        }
      }
      setMicBtnState(state.liveMode ? 'live' : 'idle');
      // Re-checa liveMode DENTRO do callback (privacy: ver acima).
      setTimeout(() => { if (state.liveMode && !state.isRecording) startRecording(); }, 400);
    } catch (err) {
      // Erro transitório (rede/STT/IA/TTS). NÃO abrir alert bloqueante no meio
      // de uma conversa hands-free, e NÃO deixar o loop morrer: no modo ao vivo
      // reabre o mic pra continuar — igual aos caminhos de sucesso e de silêncio.
      console.error('Audio flow error:', err);
      hideTyping();
      state.isSending = false;
      if (kevinChat) kevinChat.onError();

      if (state.liveMode) {
        state.liveErros += 1;
        if (state.liveErros >= 3) {
          // Falha persistente: desliga o modo ao vivo pra não ficar em loop mudo.
          state.liveMode = false;
          state.liveErros = 0;
          setMicBtnState('idle');
          appendMessage('assistant', 'Tive problemas seguidos pra te ouvir — desliguei a conversa ao vivo. Toque no microfone pra tentar de novo.');
        } else {
          setMicBtnState('live');
          setTimeout(() => { if (state.liveMode && !state.isRecording) startRecording(); }, 600);
        }
      } else {
        setMicBtnState('idle');
        appendMessage('assistant', 'Tive um probleminha pra te ouvir. Pode tentar de novo?');
      }
    }
  }

  function toggleRecording() {
    if (state.liveMode) return;
    if (state.isRecording) stopRecording();
    else startRecording();
  }

  // ───────────── Live mode ─────────────
  function toggleLiveMode() {
    if (state.liveMode) {
      state.liveMode = false;
      stopRecording();
      stopAllAudio();
      setMicBtnState('idle');
    } else {
      state.liveMode = true;
      ensureAudioContext();
      // Destrava o AudioContext do TTS AGORA — depois do loop de gravação
      // não tem user gesture pra fazer isso. Sem unlock, o primeiro speaking
      // depois da resposta da IA falha silenciosamente.
      if (kevinChat && kevinChat.unlockAudio) {
        kevinChat.unlockAudio().catch(() => {/* já logado */});
      }
      setMicBtnState('live');
      startRecording();
    }
  }

  /**
   * Para QUALQUER reprodução de TTS em andamento e invalida invocações pendentes
   * de playTTS (qualquer await que retomar depois deste call vai abortar pelo
   * mismatch de token). Limpa o blob URL e devolve o puppet pra standby.
   */
  function stopAllAudio() {
    // Invalida invocações pendentes — qualquer playTTS que tiver capturado
    // um seq mais antigo vai sair na próxima checagem.
    state.ttsSeq++;
    // Aborta o fetch do TTS em andamento, se houver.
    if (state.ttsAbortController) {
      try { state.ttsAbortController.abort(); } catch (e) {}
      state.ttsAbortController = null;
    }
    // Para o áudio em reprodução.
    const audioEl = kevinChat && kevinChat.getAudioElement && kevinChat.getAudioElement();
    if (audioEl && !audioEl.paused) {
      try { audioEl.pause(); audioEl.currentTime = 0; } catch (e) {}
    }
    // Libera o blob URL.
    if (state.currentTtsBlobUrl) {
      try { URL.revokeObjectURL(state.currentTtsBlobUrl); } catch (e) {}
      state.currentTtsBlobUrl = null;
    }
    // Tira o puppet do speaking.
    if (kevinChat && kevinChat.stopSpeaking) kevinChat.stopSpeaking();
  }

  /**
   * Se a resposta pediu celebrate (Mensagem.celebrar, D38), dispara o gesto
   * e espera ele terminar antes de seguir pro TTS — o celebrate agora fala
   * "yeah, you got it", e a resposta da IA por cima embolaria as duas falas.
   * kevinChat.celebrate() só resolve quando o Kevin volta ao standby.
   */
  async function celebrarSeNecessario(celebrar) {
    if (!celebrar || !kevinChat || !kevinChat.celebrate) return;
    try {
      await kevinChat.celebrate();
    } catch (e) { /* segue sem celebrar */ }
  }

  /**
   * Toca o TTS no <audio> compartilhado do adapter e ativa o lipsync.
   * Serializa invocações concorrentes via state.ttsSeq (token); só a última
   * efetivamente toca — as anteriores são abortadas em qualquer await.
   */
  /** Pede o áudio do texto ao TTS (ElevenLabs). Devolve o Blob, ou null se falhar. */
  async function buscarTTS(texto, signal) {
    const res = await fetch(cfg.urls.tts, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
      body: JSON.stringify(Object.assign({ text: texto }, pgEstiloVoz())),
      signal,
    });
    if (!res.ok) { console.warn('TTS falhou:', res.status); return null; }
    return res.blob();
  }

  async function playTTS(texto, blobPronto) {
    if (!kevinChat || !kevinChat.getAudioElement) {
      console.warn('[Chat] playTTS: adapter ainda não inicializado.');
      return;
    }
    const audioEl = kevinChat.getAudioElement();
    // Cancela qualquer playback/fetch anterior ANTES de capturar o token.
    stopAllAudio();
    const mySeq = ++state.ttsSeq;
    const isStale = () => state.ttsSeq !== mySeq;

    const abortController = new AbortController();
    state.ttsAbortController = abortController;

    let url = null;
    try {
      // `blobPronto`: áudio já pedido antes (Playground pré-carrega a abertura
      // durante a animação de entrada). Sem ele, busca agora — como sempre.
      const blob = blobPronto ? await blobPronto : await buscarTTS(texto, abortController.signal);
      if (isStale() || !blob) return;

      url = URL.createObjectURL(blob);
      state.currentTtsBlobUrl = url;
      audioEl.src = url;
      // Whisper: reforço de volume baixo para qualquer provider de TTS (D52).
      if (MODO_PLAYGROUND) audioEl.volume = pg.estado.whisper ? 0.55 : 1;

      // Ativa o lipsync ANTES do play.
      const speakingOk = await kevinChat.startSpeaking();
      if (isStale()) return;
      if (!speakingOk) {
        // Adapter não conseguiu entrar em speaking (audio context travado).
        // Tenta tocar mesmo assim — o usuário ouve, só fica sem lipsync.
        console.warn('[Chat] lipsync indisponível, tocando sem animação de boca.');
      }

      setMicBtnState(state.liveMode ? 'speaking' : 'idle');

      try {
        await audioEl.play();
      } catch (playErr) {
        // Autoplay bloqueado ou aborto (stopAllAudio dispara pause).
        if (!isStale()) {
          console.warn('[Chat] play() rejeitado:', playErr);
        }
        return;
      }
      if (isStale()) return;

      // Espera o áudio terminar (ou erro / abort).
      await new Promise((resolve) => {
        const cleanup = () => {
          audioEl.removeEventListener('ended', cleanup);
          audioEl.removeEventListener('error', cleanup);
          audioEl.removeEventListener('pause', onPause);
          resolve();
        };
        // Resolve também se algo PAUSAR (ex: stopAllAudio chamado externamente).
        const onPause = () => { if (isStale()) cleanup(); };
        audioEl.addEventListener('ended', cleanup);
        audioEl.addEventListener('error', cleanup);
        audioEl.addEventListener('pause', onPause);
      });

      if (!isStale()) {
        kevinChat.stopSpeaking();
        if (state.liveMode) setMicBtnState('live');
      }
    } catch (err) {
      if (err && err.name === 'AbortError') return; // esperado em stopAllAudio
      console.error('playTTS:', err);
      if (!isStale()) kevinChat.stopSpeaking();
    } finally {
      // Cleanup do blob URL: só revoga se ESTE invocation criou e ainda é o atual.
      if (url && state.currentTtsBlobUrl === url) {
        try { URL.revokeObjectURL(url); } catch (e) {}
        state.currentTtsBlobUrl = null;
      } else if (url && state.currentTtsBlobUrl !== url) {
        // Eu não sou mais o atual mas criei um url próprio que ninguém revogou.
        try { URL.revokeObjectURL(url); } catch (e) {}
      }
      // Limpa abort controller se ainda for o nosso.
      if (state.ttsAbortController === abortController) {
        state.ttsAbortController = null;
      }
    }
  }

  // ───────────── Estado visual dos botões ─────────────
  function setMicBtnState(s) {
    btnMic.classList.remove('recording');
    btnMicLive.classList.remove('active', 'recording');
    switch (s) {
      case 'recording': btnMic.classList.add('recording'); break;
      case 'live': btnMicLive.classList.add('active'); break;
      case 'speaking': btnMicLive.classList.add('active'); break;
    }
  }

  // ───────────── Bindings ─────────────
  btnSend.addEventListener('click', enviarMensagem);
  btnMic.addEventListener('click', toggleRecording);
  btnMicLive.addEventListener('click', toggleLiveMode);

  // Botão "Ouvir" delegado em todas as mensagens do assistant.
  // Preserva ícones SVG; só troca o label de texto (Ouvir → Tocando…).
  chatBody.addEventListener('click', async (e) => {
    // Suggestion chip (empty state) → injeta texto e envia
    const chip = e.target.closest('.suggestion-chip');
    if (chip) {
      const sugg = chip.dataset.suggestion || chip.textContent.trim();
      if (sugg) {
        input.value = sugg;
        input.focus();
        enviarMensagem();
      }
      return;
    }

    const btn = e.target.closest('.btn-listen');
    if (!btn) return;
    if (btn.disabled) return;
    const texto = btn.dataset.text || btn.closest('.message')?.querySelector('.msg-bubble')?.innerText || '';
    if (!texto) return;
    stopAllAudio();
    btn.disabled = true;
    btn.classList.add('playing');
    const label = btn.querySelector('.btn-listen-label');
    const originalLabel = label ? label.textContent : null;
    if (label) label.textContent = 'Tocando…';
    try {
      await playTTS(texto);
    } finally {
      btn.disabled = false;
      btn.classList.remove('playing');
      if (label && originalLabel !== null) label.textContent = originalLabel;
    }
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviarMensagem();
    }
  });
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  });

  // ───────────── Modo chamada (TV): standby + kickoff + drawer ─────────────
  const callRoot    = document.getElementById('aula-call');
  const btnIniciar  = document.getElementById('btn-iniciar-aula');
  const chatFab     = document.getElementById('chat-fab');
  const chatDrawer  = document.getElementById('chat-drawer');
  const drawerClose = document.getElementById('chat-drawer-close');

  /**
   * Envia um texto e faz o Kevin FALAR a resposta (TTS), como no fluxo de
   * áudio. Funciona em modo demo (resposta local) e em modo normal (backend
   * síncrono). O TTS é opcional: se não houver chave configurada, o endpoint
   * falha e seguimos só com o texto.
   */
  async function sendTextAndSpeak(texto) {
    appendMessage('user', texto);
    if (kevinChat) kevinChat.onUserMessage(texto);
    showTyping();

    let resp = null;
    let celebrar = false;
    try {
      if (window.KEVIN_DEMO_MODE) {
        await new Promise((r) => setTimeout(r, 1300 + Math.random() * 700));
        resp = demoReply(texto);
      } else if (MODO_PLAYGROUND) {
        state.isSending = true;
        const data = await pgEnviarTeacher(texto);
        state.isSending = false;
        hideTyping();
        if (await pgResponder(data)) return;
      } else {
        const data = await enviarMensagemSync(texto);
        resp = data && data.resposta && data.resposta.conteudo;
        celebrar = !!(data && data.resposta && data.resposta.celebrar);
      }
    } catch (err) {
      console.error('[Chat] sendTextAndSpeak:', err);
    }
    state.isSending = false;

    hideTyping();
    if (!resp) {
      appendMessage('assistant', 'Ops, tive um problema pra começar. Tenta o microfone!');
      if (kevinChat) kevinChat.onError();
      return;
    }
    appendMessage('assistant', resp);
    if (celebrar) {
      await celebrarSeNecessario(true);
    } else if (kevinChat) {
      kevinChat.onAssistantMessage(resp);
    }
    try { await playTTS(resp); } catch (e) { /* TTS é opcional */ }
  }

  /** Clique em "Iniciar aula": destrava o áudio (gesture) e dispara o kickoff. */
  async function iniciarAula() {
    if (!callRoot || callRoot.dataset.state === 'live') return;
    // Esse clique é o user gesture — destrava o AudioContext pro TTS tocar sozinho.
    if (kevinChat && kevinChat.unlockAudio) {
      try { await kevinChat.unlockAudio(); } catch (e) {/* já logado */}
    }
    callRoot.dataset.state = 'live';
    // Vídeo de entrada ("abre a cortina" e revela o Kevin) antes do kickoff.
    if (kevinChat && kevinChat.playEntrada) {
      try { await kevinChat.playEntrada(); } catch (e) {/* segue sem a entrada animada */}
    }
    // Open class (cumprimento + "como estão se sentindo" com a turma) —
    // precisa terminar ANTES do kickoff entrar em "thinking"
    // (sendTextAndSpeak → showTyping() já dispara o modo pensando).
    // Se o professor interromper (mic/mensagem), a sequência resolve false
    // e o kickoff não roda por cima da interação dele.
    if (kevinChat && kevinChat.openClass) {
      let completa = true;
      try { completa = await kevinChat.openClass(); } catch (e) {/* segue sem a abertura */}
      if (completa === false) return;
    }
    const kickoff = window.KEVIN_KICKOFF || 'Olá Kevin, o que vamos fazer hoje? Por onde começamos?';
    sendTextAndSpeak(kickoff);
  }

  function toggleDrawer(force) {
    if (!chatDrawer) return;
    const open = (force !== undefined) ? force : !chatDrawer.classList.contains('open');
    chatDrawer.classList.toggle('open', open);
    chatDrawer.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (chatFab) chatFab.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (callRoot) callRoot.classList.toggle('drawer-open', open);
    if (open) { chatBody.scrollTop = chatBody.scrollHeight; input.focus(); }
  }

  if (btnIniciar) btnIniciar.addEventListener('click', iniciarAula);
  if (chatFab) chatFab.addEventListener('click', () => toggleDrawer());
  if (drawerClose) drawerClose.addEventListener('click', () => toggleDrawer(false));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && chatDrawer && chatDrawer.classList.contains('open')) {
      toggleDrawer(false);
    }
  });

  // ── Modal de conclusão (Demanda 11) ──
  const btnAbrirConcluir = document.getElementById('btn-abrir-concluir');
  const modalConcluir = document.getElementById('modal-concluir');
  const modalConcluirClose = document.getElementById('modal-concluir-close');
  const modalConcluirCancelar = document.getElementById('modal-concluir-cancelar');
  function toggleModalConcluir(abrir) {
    if (!modalConcluir) return;
    modalConcluir.hidden = !abrir;
  }
  if (btnAbrirConcluir) btnAbrirConcluir.addEventListener('click', () => toggleModalConcluir(true));
  if (modalConcluirClose) modalConcluirClose.addEventListener('click', () => toggleModalConcluir(false));
  if (modalConcluirCancelar) modalConcluirCancelar.addEventListener('click', () => toggleModalConcluir(false));
  if (modalConcluir) {
    modalConcluir.addEventListener('click', (e) => { if (e.target === modalConcluir) toggleModalConcluir(false); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modalConcluir.hidden) toggleModalConcluir(false);
    });

    // Despedida: com a aula em andamento, o Kevin diz "bye / kids bye"
    // acenando antes de a página sair. Aula nem iniciada = envia direto.
    const formConcluir = modalConcluir.querySelector('form');
    let despedindo = false;
    if (formConcluir) {
      formConcluir.addEventListener('submit', async (e) => {
        const aoVivo = callRoot && callRoot.dataset.state === 'live';
        if (despedindo || !aoVivo || !kevinChat || !kevinChat.sayBye) return;
        e.preventDefault();
        despedindo = true;
        toggleModalConcluir(false);
        try { await kevinChat.sayBye(); } catch (err) { /* sai mesmo assim */ }
        formConcluir.submit();
      });
    }
  }

  // ── Botão Pay attention ──
  // Sequência gravada para chamar a atenção da turma. Clicar de novo enquanto
  // roda interrompe.
  const btnPayAttention = document.getElementById('btn-pay-attention');
  // No Playground o botão vira evento para a IA (ver bloco do Playground): a
  // sequência gravada do motor fala com outra voz (D54).
  if (btnPayAttention && kevinChat && !MODO_PLAYGROUND) {
    btnPayAttention.addEventListener('click', async () => {
      if (btnPayAttention.dataset.playing === 'true') {
        kevinChat.cancelSequence();
        return;
      }
      if (!kevinChat.payAttention) return;
      if (kevinChat.unlockAudio) {
        try { await kevinChat.unlockAudio(); } catch (e) { /* já logado */ }
      }
      btnPayAttention.dataset.playing = 'true';
      try { await kevinChat.payAttention(); } catch (e) { /* segue */ }
      btnPayAttention.dataset.playing = 'false';
    });
  }

  // ── Botão de música (Demanda 9A) ──
  // Toggle: Kevin pega o ukulele e canta / guarda o ukulele. A saída da música
  // é animada pelo próprio motor (integração cuida disso).
  const btnMusica = document.getElementById('btn-musica');
  if (btnMusica && kevinChat) {
    btnMusica.addEventListener('click', async () => {
      const tocando = btnMusica.dataset.playing === 'true';
      if (tocando) {
        if (kevinChat.stopMusica) kevinChat.stopMusica();
        btnMusica.dataset.playing = 'false';
      } else {
        // window.KEVIN_MUSICA_URL pode trazer uma faixa; senão, só a animação.
        if (kevinChat.playMusica) await kevinChat.playMusica(window.KEVIN_MUSICA_URL);
        btnMusica.dataset.playing = 'true';
      }
    });
  }

  // ── Botão de listening (atividade de escuta) ──
  // Toggle simples: toca/para o áudio de listening. Sem ukulele, sem lipsync —
  // é a turma escutando um áudio de compreensão.
  const btnListening = document.getElementById('btn-listening');
  if (btnListening && kevinChat) {
    btnListening.addEventListener('click', async () => {
      const tocando = btnListening.dataset.playing === 'true';
      if (tocando) {
        if (kevinChat.stopListening) kevinChat.stopListening();
        btnListening.dataset.playing = 'false';
      } else {
        if (kevinChat.playListening) await kevinChat.playListening(window.KEVIN_LISTENING_URL);
        btnListening.dataset.playing = 'true';
      }
    });
  }

  // ───────────── Playground (Demanda 20) ─────────────
  // Sessão sem aula cadastrada: o Kevin pergunta o tema e conduz a partir da
  // resposta do Teacher, acionando recursos por tool calling (D51). Tudo aqui
  // só roda com MODO_PLAYGROUND.

  /** Estilo de voz do TTS: sussurro enquanto o Everybody Whisper estiver ativo. */
  function pgEstiloVoz() {
    return (MODO_PLAYGROUND && pg.estado.whisper) ? { estilo: 'sussurro' } : {};
  }

  function pgMostrarContexto(texto) {
    const el = document.getElementById('pg-contexto');
    if (!el || !texto) return;
    el.textContent = texto.length > 60 ? texto.slice(0, 59) + '…' : texto;
    el.hidden = false;
  }

  /**
   * Envia a fala do Teacher. A 1ª resposta vira o contexto da sessão (D49).
   *
   * Sem Open class aqui, de propósito (D54): as sequências do motor são MP3
   * gravados com OUTRA voz. No Playground o Kevin só fala pela ElevenLabs.
   */
  async function pgEnviarTeacher(texto) {
    if (!pg.temContexto) {
      pg.temContexto = true;
      pgMostrarContexto(texto);
    }
    return enviarMensagemSync(texto);
  }

  /**
   * Fato da sala para o Kevin ("a música terminou", "o Teacher ligou o
   * Whisper"): vai como evento, sem bolha de usuário, e a resposta é tratada
   * como qualquer outra. Espera a vez: não corta a resposta em andamento.
   */
  async function enviarEvento(texto) {
    if (!MODO_PLAYGROUND || window.KEVIN_DEMO_MODE) return;
    await pgEsperarVez();
    // Ao vivo gravando: descarta o trecho (o professor apertou um botão) e
    // não deixa o mic gravar a própria resposta do Kevin.
    const reabrirAoVivo = state.liveMode;
    if (state.isRecording) {
      state.isSending = true;
      if (state.mediaRecorder) state.mediaRecorder._hasSpeech = false;
      stopRecording();
    }
    state.isSending = true;
    showTyping();
    try {
      const r = await fetch(cfg.urls.mensagemSync, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
        body: JSON.stringify({ conteudo: texto, tipo: 'evento' }),
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const data = await r.json();
      hideTyping();
      await pgResponder(data);
    } catch (err) {
      console.error('[Playground] evento:', err);
      hideTyping();
      if (kevinChat) kevinChat.onError();
    } finally {
      state.isSending = false;
      if (reabrirAoVivo && state.liveMode && !state.isRecording) {
        setMicBtnState('live');
        setTimeout(() => { if (state.liveMode && !state.isRecording) startRecording(); }, 400);
      }
    }
  }

  /**
   * Um caminho só para a resposta do Kevin no Playground (voz, texto e
   * evento): ações de antes da fala → fala (TTS) → ações de depois.
   * Devolve false se não veio nada para falar nem fazer.
   */
  async function pgResponder(data) {
    const resposta = data && data.resposta;
    const texto = resposta && resposta.conteudo;
    const acoes = (resposta && resposta.acoes) || [];
    if (!texto && !acoes.length) return false;
    pg.respondendo = true;
    try {
      if (texto) appendMessage('assistant', texto);
      if (kevinChat) kevinChat.onAssistantMessage(texto || '');
      await pgExecutarAntes(acoes);
      // Encerrar no meio (ex.: durante o celebrate): não corta a despedida.
      if (texto && !pg.encerrando) await playTTS(texto);
    } finally {
      pg.respondendo = false;
    }
    if (!pg.encerrando) pgExecutarDepois(acoes);
    return true;
  }

  /** Espera o Kevin terminar o turno atual (requisição, ações e fala). Teto de 60s. */
  async function pgEsperarVez() {
    const limite = Date.now() + 60000;
    while ((state.isSending || pg.respondendo || state.currentTtsBlobUrl) && Date.now() < limite) {
      await new Promise((r) => setTimeout(r, 250));
    }
  }

  // Ordem FIXA, independente da ordem em que a IA chamou as ferramentas.
  const PG_ORDEM_ANTES = ['whisper', 'so_ingles', 'cenario', 'pay_attention', 'celebrar', 'quadro'];

  async function pgExecutarAntes(acoes) {
    for (const tipo of PG_ORDEM_ANTES) {
      for (const acao of acoes.filter((a) => a.tipo === tipo)) {
        try { await pgExecutar(acao); } catch (e) { console.warn('[Playground] ação', acao, e); }
      }
    }
  }

  function pgExecutarDepois(acoes) {
    const musica = acoes.find((a) => a.tipo === 'musica');
    if (musica) pgTocarMusica(musica.url || '', musica.nome || '');
  }

  async function pgExecutar(acao) {
    switch (acao.tipo) {
      case 'whisper':
        pgAplicarModo('whisper', !!acao.ativo);
        break;
      case 'so_ingles':
        pgAplicarModo('so_ingles', !!acao.ativo);
        break;
      case 'cenario':
        await pgTrocarCenario(acao.cenario);
        break;
      case 'pay_attention':
        // Só o gesto (aceno), em silêncio: no Playground as falas gravadas do
        // motor estão desligadas (hiVoiceUrls vazio, D54). A frase de atenção
        // é o texto da resposta, falado em seguida pela ElevenLabs.
        if (kevinChat && kevinChat.waveHello) await kevinChat.waveHello();
        break;
      case 'celebrar':
        await celebrarSeNecessario(true);
        break;
      case 'quadro':
        pgMostrarNoQuadro(acao.texto || '');
        break;
    }
  }

  /** Liga/desliga o overlay e o botão de um modo (Whisper / Só inglês). */
  function pgAplicarModo(chave, ativo) {
    pg.estado[chave] = ativo;
    if (callRoot) {
      callRoot.dataset[chave === 'whisper' ? 'whisper' : 'soIngles'] = ativo ? 'on' : 'off';
    }
    const btn = document.getElementById(chave === 'whisper' ? 'btn-whisper' : 'btn-so-ingles');
    if (btn) btn.setAttribute('aria-pressed', ativo ? 'true' : 'false');
  }

  async function pgTrocarCenario(chave) {
    const url = window.KEVIN_BACKGROUNDS && window.KEVIN_BACKGROUNDS[chave];
    if (!url || chave === pg.estado.cenarioNaTela) return;
    const puppet = kevinChat && kevinChat.getPuppet && kevinChat.getPuppet();
    if (!puppet || !puppet.setBackground) return;
    pg.estado.cenarioNaTela = chave;
    // Teto de 5s: se o vídeo de transição falhar (404, autoplay), a Promise do
    // motor nunca resolve — e a fala do Kevin ficaria presa esperando.
    await Promise.race([
      puppet.setBackground(url),
      new Promise((r) => setTimeout(r, 5000)),
    ]);
  }

  /**
   * Palavra no quadro. O motor só renderiza item FORA da lista se o quadro já
   * estiver ativo; enquanto ele entra, guarda só o id e procura na lista — e
   * a palavra não aparece. Por isso o item entra na lista antes. Palavra que
   * já tem imagem (KEVIN_VOCABULARIO) usa o item existente.
   */
  function pgMostrarNoQuadro(texto) {
    const puppet = kevinChat && kevinChat.getPuppet && kevinChat.getPuppet();
    if (!puppet || !puppet.showTeachingVocabulary) return;
    if (texto === pg.estado.quadroNaTela) return;
    pg.estado.quadroNaTela = texto;
    if (!texto) {
      puppet.hideTeachingVocabulary();
      return;
    }
    const itens = puppet.getVocabularyItems();
    const alvo = texto.trim().toLowerCase();
    let item = itens.find((i) => (i.words || '').toLowerCase() === alvo);
    if (!item) {
      item = { id: 'pg-' + alvo.replace(/[^a-z0-9]+/g, '-'), words: texto.trim() };
      puppet.setVocabularyItems(itens.filter((i) => i.id !== item.id).concat([item]));
    }
    puppet.showTeachingVocabulary(item.id);
  }

  // ── Música ──
  // playMusica() toca a faixa no MESMO <audio> do TTS. Por isso o modo ao
  // vivo pausa enquanto a música toca (senão o mic grava a música e a
  // próxima resposta do Kevin corta a faixa), e no fim o Kevin é avisado.
  const btnMusicaPg = document.getElementById('btn-musica-pg');
  const btnMusicaPgLabel = document.getElementById('btn-musica-pg-label');

  function pgMarcarMusica(tocando) {
    pg.musicaTocando = tocando;
    if (btnMusicaPg) btnMusicaPg.dataset.playing = tocando ? 'true' : 'false';
    if (btnMusicaPgLabel) btnMusicaPgLabel.textContent = tocando ? 'Parar' : 'Música';
  }

  async function pgTocarMusica(url, nome) {
    if (!kevinChat || !kevinChat.playMusica) return;
    pg.liveAntesDaMusica = state.liveMode;
    if (state.liveMode) toggleLiveMode();  // desliga: stopRecording + stopAllAudio
    const audioEl = kevinChat.getAudioElement && kevinChat.getAudioElement();
    if (audioEl) audioEl.volume = 1;
    pg.musicaUrl = url;
    pgMarcarMusica(true);
    await kevinChat.playMusica(url);
    if (url && audioEl) {
      pg.onMusicaEnded = () => {
        // O <audio> é compartilhado: só conta o fim se ainda for a música.
        if (pg.musicaTocando && audioEl.src === pg.musicaUrl) pgFinalizarMusica('A música terminou.');
      };
      audioEl.addEventListener('ended', pg.onMusicaEnded, { once: true });
    }
  }

  /** Encerra a música. `evento` avisa o Kevin para retomar o tema; null = silêncio. */
  async function pgFinalizarMusica(evento) {
    if (!pg.musicaTocando) return;
    const audioEl = kevinChat && kevinChat.getAudioElement && kevinChat.getAudioElement();
    if (audioEl && pg.onMusicaEnded) audioEl.removeEventListener('ended', pg.onMusicaEnded);
    pg.onMusicaEnded = null;
    pgMarcarMusica(false);
    if (kevinChat && kevinChat.stopMusica) kevinChat.stopMusica();
    const reabrir = pg.liveAntesDaMusica;
    pg.liveAntesDaMusica = false;
    // O evento primeiro (o Kevin responde e fala); o ao vivo só reabre depois,
    // para o mic não gravar a fala dele.
    if (evento) await enviarEvento(evento);
    if (reabrir && !state.liveMode) toggleLiveMode();
  }

  /** O professor vai falar/digitar: música em andamento para, sem evento. */
  function pgAntesDeInteragir() {
    if (MODO_PLAYGROUND && pg.musicaTocando) pgFinalizarMusica(null);
  }

  // ── Início, botões e encerramento ──
  const btnIniciarPg = document.getElementById('btn-iniciar-playground');
  const PG_DESPEDIDA = 'Bye bye, kids! See you next time!';

  /** "Começar": destrava o áudio, toca a entrada e fala a abertura fixa (D53). */
  async function iniciarPlayground() {
    if (!callRoot || callRoot.dataset.state === 'live') return;
    if (kevinChat && kevinChat.unlockAudio) {
      try { await kevinChat.unlockAudio(); } catch (e) {/* já logado */}
    }
    callRoot.dataset.state = 'live';
    const abertura = pg.temContexto ? '' : (window.KEVIN_ABERTURA || '');
    // A voz da abertura é pedida JÁ, em paralelo com a animação de entrada:
    // quando a cortina abre, o áudio está pronto e o Kevin fala na hora.
    const audioAbertura = abertura ? buscarTTS(abertura).catch(() => null) : null;
    if (kevinChat && kevinChat.playEntrada) {
      // Teto de 8s: se o vídeo de entrada não terminar (falha de rede/decodificação),
      // a Promise do motor nunca resolve e a abertura nunca seria falada.
      try {
        await Promise.race([kevinChat.playEntrada(), new Promise((r) => setTimeout(r, 8000))]);
      } catch (e) {/* segue sem a entrada animada */}
    }
    // Página recarregada no meio da sessão: restaura o quadro e não repete a abertura.
    if (pg.temContexto) {
      if (pg.estado.quadro) pgMostrarNoQuadro(pg.estado.quadro);
      return;
    }
    if (abertura) {
      try { await playTTS(abertura, audioAbertura); } catch (e) { /* TTS é opcional */ }
    }
  }

  /** Botões Whisper / Só inglês: grava o estado, mostra o overlay e avisa o Kevin. */
  async function pgAlternarModo(chave) {
    const ativo = !pg.estado[chave];
    pgAplicarModo(chave, ativo);
    if (!window.KEVIN_DEMO_MODE) {
      try {
        const r = await fetch(cfg.urls.estado, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
          body: JSON.stringify({ [chave]: ativo }),
        });
        if (!r.ok) throw new Error('HTTP ' + r.status);
      } catch (err) {
        console.error('[Playground] estado:', err);
        pgAplicarModo(chave, !ativo);  // não salvou: desfaz na tela
        return;
      }
    }
    const nome = chave === 'whisper' ? 'o Everybody Whisper' : 'o No Portuguese Allowed';
    enviarEvento(`O Teacher ${ativo ? 'ativou' : 'desativou'} ${nome} pelo botão.`);
  }

  const modalMusicas = document.getElementById('modal-musicas');
  function pgToggleModalMusicas(abrir) {
    if (modalMusicas) modalMusicas.hidden = !abrir;
  }

  if (MODO_PLAYGROUND) {
    pg.estado.cenarioNaTela = pg.estado.cenario || window.KEVIN_BACKGROUND;
    if (btnIniciarPg) btnIniciarPg.addEventListener('click', iniciarPlayground);

    // Atenção: o Kevin chama a turma com a própria voz (ElevenLabs), via IA.
    const btnAtencao = document.getElementById('btn-pay-attention');
    if (btnAtencao) {
      btnAtencao.addEventListener('click', () => {
        if (kevinChat && kevinChat.unlockAudio) kevinChat.unlockAudio().catch(() => {});
        enviarEvento('O Teacher apertou o botão Atenção: use pay_attention e chame a atenção da turma, numa frase curta e animada.');
      });
    }

    const btnWhisper = document.getElementById('btn-whisper');
    if (btnWhisper) btnWhisper.addEventListener('click', () => pgAlternarModo('whisper'));
    const btnSoIngles = document.getElementById('btn-so-ingles');
    if (btnSoIngles) btnSoIngles.addEventListener('click', () => pgAlternarModo('so_ingles'));

    if (btnMusicaPg) {
      btnMusicaPg.addEventListener('click', () => {
        if (pg.musicaTocando) pgFinalizarMusica('O Teacher parou a música.');
        else pgToggleModalMusicas(true);
      });
    }
    if (modalMusicas) {
      modalMusicas.addEventListener('click', (e) => {
        if (e.target === modalMusicas || e.target.closest('#modal-musicas-close')) {
          pgToggleModalMusicas(false);
          return;
        }
        const opcao = e.target.closest('.pg-musica-opcao');
        if (!opcao) return;
        pgToggleModalMusicas(false);
        const nome = opcao.dataset.nome || '';
        if (window.KEVIN_DEMO_MODE) {
          // Sem IA: toca direto, sem o Kevin anunciar.
          const musica = (window.KEVIN_MUSICAS || []).find((m) => m.nome === nome);
          pgTocarMusica(musica ? musica.url : '', nome);
          return;
        }
        enviarEvento(nome
          ? `O Teacher escolheu a música "${nome}".`
          : 'O Teacher vai cantar uma música com a turma; acompanhe só com o ukulele.');
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modalMusicas.hidden) pgToggleModalMusicas(false);
      });
    }

    const btnEncerrar = document.getElementById('btn-encerrar-playground');
    let encerrando = false;
    if (btnEncerrar) {
      btnEncerrar.addEventListener('click', async () => {
        if (encerrando) return;
        encerrando = true;
        pg.encerrando = true;
        state.liveMode = false;
        stopRecording();
        stopAllAudio();
        if (pg.musicaTocando) pgFinalizarMusica(null);
        const aoVivo = callRoot && callRoot.dataset.state === 'live';
        if (aoVivo && !window.KEVIN_DEMO_MODE) {
          // Despedida com a voz do Kevin (ElevenLabs), não o "bye" gravado (D54).
          // Teto de 8s: o professor está esperando a tela fechar.
          try {
            await Promise.race([playTTS(PG_DESPEDIDA), new Promise((r) => setTimeout(r, 8000))]);
          } catch (err) { /* sai mesmo assim */ }
        }
        window.location.href = cfg.urls.sair;
      });
    }
  }

  chatBody.scrollTop = chatBody.scrollHeight;
})();
