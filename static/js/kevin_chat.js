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
    // TTS playback control:
    ttsSeq: 0,                  // incrementado a cada playTTS — invalida anteriores
    ttsAbortController: null,   // aborta o fetch do TTS atual
    currentTtsBlobUrl: null,    // URL.revokeObjectURL pra liberar memória
    kevinReady: false,          // true quando kevinChat.init() resolve
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
        { backgroundUrl: window.KEVIN_RIG_CONFIG.backgroundUrl }
      );
      await kevinChat.init();
      state.kevinReady = !!(kevinChat.isReady && kevinChat.isReady());
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
          if (msgs.length && msgs[msgs.length - 1].role === 'assistant') {
            clearInterval(id);
            hideTyping();
            const resposta = msgs[msgs.length - 1].conteudo;
            appendMessage('assistant', resposta);

            // Kevin fala enquanto responde
            if (kevinChat) {
              kevinChat.onAssistantMessage(resposta);
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
      const data = await enviarMensagemSync(texto);
      state.isSending = false;
      hideTyping();
      const resp = data.resposta && data.resposta.conteudo;
      if (resp) {
        appendMessage('assistant', resp);
        await playTTS(resp);
      }
      setMicBtnState(state.liveMode ? 'live' : 'idle');
      // Re-checa liveMode DENTRO do callback (privacy: ver acima).
      setTimeout(() => { if (state.liveMode && !state.isRecording) startRecording(); }, 400);
    } catch (err) {
      console.error('Audio flow error:', err);
      hideTyping();
      state.isSending = false;
      setMicBtnState(state.liveMode ? 'live' : 'idle');
      alert('Erro no áudio: ' + err.message);
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
   * Toca o TTS no <audio> compartilhado do adapter e ativa o lipsync.
   * Serializa invocações concorrentes via state.ttsSeq (token); só a última
   * efetivamente toca — as anteriores são abortadas em qualquer await.
   */
  async function playTTS(texto) {
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
      const res = await fetch(cfg.urls.tts, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
        body: JSON.stringify({ text: texto }),
        signal: abortController.signal,
      });
      if (isStale()) return;
      if (!res.ok) { console.warn('TTS falhou:', res.status); return; }
      const blob = await res.blob();
      if (isStale()) return;

      url = URL.createObjectURL(blob);
      state.currentTtsBlobUrl = url;
      audioEl.src = url;

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

  chatBody.scrollTop = chatBody.scrollHeight;
})();
