/**
 * Kevin ao vivo — GPT Live / Realtime por WebRTC (TESTE, liga com ?live=1).
 *
 * Por que existe: no modo tradicional cada turno faz três idas e voltas em
 * série, nenhuma em streaming (Whisper → IA → ElevenLabs, MP3 inteiro). Aqui o
 * áudio do professor vai direto do navegador para a OpenAI e a resposta volta
 * em streaming pelo mesmo canal. O nosso servidor só emite o token efêmero,
 * executa as ferramentas e grava a transcrição — Render fora do caminho do áudio.
 *
 * Duas vozes (D69 e a voz do Kevin):
 *   voz=openai → fala a fala, voz da OpenAI (o mais rápido).
 *   voz=kevin  → o modelo responde em texto, e cada pedaço vai para o WebSocket
 *                de streaming da ElevenLabs com a voz do Kevin (PCM 24 kHz).
 *
 * Microfone fechado (D62): o turno abre quando o professor aperta o botão de
 * falar e fecha quando ele solta. "Mãos livres" liga a detecção de turno do
 * servidor, para comparar.
 *
 * kevin_chat.js chama conectar(ganchos) e iniciar(); depois, falarInicio,
 * falarFim, enviarTexto, enviarEvento, dizer, interromper.
 */
(function () {
  const OPENAI_CALLS = 'https://api.openai.com/v1/realtime/calls';
  // Fim do turno: espera os últimos pacotes de áudio chegarem antes do commit,
  // senão a última sílaba do professor fica de fora.
  const CAUDA_DO_TURNO_MS = 150;

  const L = {
    g: null,                 // ganchos do kevin_chat.js
    voz: 'openai',
    pc: null, dc: null, mic: null, track: null, audioOut: null,
    ctx: null, analisador: null,
    ok: false,
    gravando: false, pensando: false, falando: false, maosLivres: false,
    resposta: null,
    el: { tokens: [], ws: null, fila: [], proximo: 0, fontes: [], fimTimer: null, saida: null, voiceId: '', modelId: '' },
  };

  // ── utilitários ──
  function enviar(evento) {
    if (L.dc && L.dc.readyState === 'open') L.dc.send(JSON.stringify(evento));
  }

  async function post(url, corpo) {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': L.g.csrf() },
      body: JSON.stringify(corpo || {}),
    });
    if (!r.ok) throw new Error(url + ' → HTTP ' + r.status);
    return r.json();
  }

  function registrar(role, conteudo) {
    if (!conteudo) return;
    post(L.g.urls.liveRegistrar, { role, conteudo }).catch((e) => console.warn('[Live] registrar', e));
  }

  const kevin = () => (L.g && L.g.kevin()) || null;

  function comecarAFalar(modo) {
    if (L.falando) return;
    L.falando = true;
    L.pensando = false;
    const k = kevin();
    if (k) {
      if (k.usarAnalisadorDeFala) k.usarAnalisadorDeFala(L.analisador);
      if (k.startSpeaking) k.startSpeaking();
    }
    L.g.registrarPrimeiroAudio(modo);
  }

  function pararDeFalar() {
    if (!L.falando) return;
    L.falando = false;
    const k = kevin();
    if (k) {
      if (k.stopSpeaking) k.stopSpeaking();
      if (k.usarAnalisadorDeFala) k.usarAnalisadorDeFala(null);
    }
    executarAcoesDepois();
  }

  // ── conexão ──
  async function iniciar() {
    const cfgLive = L.g.cfg;
    L.voz = cfgLive.voz;
    try {
      const t0 = performance.now();
      const sessao = await post(L.g.urls.liveSessao, {
        voz: cfgLive.voz, modelo: cfgLive.modelo || undefined, voz_openai: cfgLive.voz_openai || undefined,
      });
      if (sessao.elevenlabs) {
        L.el.tokens.push(sessao.elevenlabs.token);
        L.el.voiceId = sessao.elevenlabs.voice_id;
        L.el.modelId = sessao.elevenlabs.model_id;
      }

      L.ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (L.ctx.state === 'suspended') await L.ctx.resume().catch(() => {});
      L.analisador = L.ctx.createAnalyser();
      L.analisador.fftSize = 512;
      L.analisador.smoothingTimeConstant = 0.6;

      L.pc = new RTCPeerConnection();
      L.audioOut = document.createElement('audio');
      L.audioOut.autoplay = true;
      L.pc.ontrack = (e) => {
        L.audioOut.srcObject = e.streams[0];
        // Lipsync: lê o nível do áudio remoto (o <audio> acima é quem toca).
        L.ctx.createMediaStreamSource(e.streams[0]).connect(L.analisador);
      };
      L.pc.onconnectionstatechange = () => {
        if (['failed', 'closed', 'disconnected'].includes(L.pc.connectionState)) {
          console.warn('[Live] conexão', L.pc.connectionState, '→ volta ao modo normal');
          L.ok = false;
        }
      };

      L.mic = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      L.track = L.mic.getAudioTracks()[0];
      L.track.enabled = false;  // microfone fechado até o professor apertar
      L.pc.addTrack(L.track, L.mic);

      L.dc = L.pc.createDataChannel('oai-events');
      L.dc.onmessage = (e) => { try { aoEvento(JSON.parse(e.data)); } catch (err) { console.error('[Live] evento', err); } };
      const aberto = new Promise((res, rej) => {
        L.dc.onopen = res;
        setTimeout(() => rej(new Error('canal de eventos não abriu')), 10000);
      });

      const oferta = await L.pc.createOffer();
      await L.pc.setLocalDescription(oferta);
      const r = await fetch(OPENAI_CALLS, {
        method: 'POST',
        body: oferta.sdp,
        headers: { Authorization: 'Bearer ' + sessao.openai.value, 'Content-Type': 'application/sdp' },
      });
      if (!r.ok) throw new Error('OpenAI recusou a chamada WebRTC: HTTP ' + r.status);
      await L.pc.setRemoteDescription({ type: 'answer', sdp: await r.text() });
      await aberto;

      // Continuidade: o que já foi dito nesta conversa entra no contexto.
      (sessao.historico || []).forEach((m) => enviar({
        type: 'conversation.item.create',
        item: {
          type: 'message', role: m.role,
          content: [{ type: m.role === 'assistant' ? 'output_text' : 'input_text', text: m.conteudo }],
        },
      }));

      L.ok = true;
      window.__kevinLiveConexaoMs = Math.round(performance.now() - t0);
      console.info('[Live] conectado em', window.__kevinLiveConexaoMs, 'ms', sessao.openai.model, 'voz', L.voz);
      return true;
    } catch (err) {
      console.error('[Live] não conectou:', err);
      L.ok = false;
      return false;
    }
  }

  // ── turnos ──
  function falarInicio() {
    if (!L.ok) return;
    interromper();
    enviar({ type: 'input_audio_buffer.clear' });
    L.track.enabled = true;
    L.gravando = true;
    const k = kevin();
    if (k && k.startListeningPose) k.startListeningPose();
  }

  function falarFim() {
    if (!L.ok || !L.gravando) return;
    L.gravando = false;
    L.pensando = true;
    L.g.marcarFimFala();
    const k = kevin();
    if (k && k.onAssistantThinking) k.onAssistantThinking();
    setTimeout(() => {
      L.track.enabled = L.maosLivres;
      enviar({ type: 'input_audio_buffer.commit' });
      enviar({ type: 'response.create' });
    }, CAUDA_DO_TURNO_MS);
  }

  function itemUsuario(texto) {
    enviar({
      type: 'conversation.item.create',
      item: { type: 'message', role: 'user', content: [{ type: 'input_text', text: texto }] },
    });
  }

  function enviarTexto(texto) {
    if (!L.ok) return;
    interromper();
    L.g.marcarFimFala();
    L.pensando = true;
    itemUsuario(texto);
    enviar({ type: 'response.create' });
    registrar('user', texto);
  }

  function enviarEvento(texto) {
    if (!L.ok) return;
    interromper();
    L.g.marcarFimFala();
    L.pensando = true;
    itemUsuario('[EVENTO] ' + texto);
    enviar({ type: 'response.create' });
    registrar('evento', texto);
  }

  /** Fala fixa (abertura do Playground, D53): entra no contexto e é dita literalmente. */
  function dizer(texto) {
    if (!L.ok) return;
    enviar({
      type: 'conversation.item.create',
      item: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: texto }] },
    });
    L.g.marcarFimFala();
    if (L.voz === 'kevin') {
      elAbrir();
      elTexto(texto);
      elFechar();
    } else {
      L.pensando = true;
      enviar({
        type: 'response.create',
        response: {
          conversation: 'none',
          instructions: 'Diga exatamente esta frase, palavra por palavra, sem acrescentar nada: "' + texto + '"',
        },
      });
    }
  }

  function interromper() {
    const r = L.resposta;
    if (r && !r.terminou) {
      r.cancelada = true;
      enviar({ type: 'response.cancel' });
    }
    if (L.voz === 'openai' && L.falando) enviar({ type: 'output_audio_buffer.clear' });
    elParar();
    pararDeFalar();
    L.pensando = false;
  }

  function alternarMaosLivres() {
    if (!L.ok) return false;
    L.maosLivres = !L.maosLivres;
    enviar({
      type: 'session.update',
      session: {
        type: 'realtime',
        audio: {
          input: {
            turn_detection: L.maosLivres
              ? { type: 'semantic_vad', eagerness: 'high', create_response: true, interrupt_response: true }
              : null,
          },
        },
      },
    });
    L.track.enabled = L.maosLivres;
    return L.maosLivres;
  }

  // ── eventos da OpenAI ──
  function aoEvento(e) {
    const r = L.resposta;
    switch (e.type) {
      case 'input_audio_buffer.speech_stopped':
        if (L.maosLivres) { L.g.marcarFimFala(); L.pensando = true; }
        break;

      case 'conversation.item.input_audio_transcription.completed': {
        const t = (e.transcript || '').trim();
        if (t) { L.g.appendMessage('user', '🎤 ' + t); registrar('user', t); }
        break;
      }

      case 'response.created':
        L.resposta = { id: e.response && e.response.id, chamadas: [], acoesDepois: [], texto: '',
          temFala: false, precisaContinuar: false, cancelada: false, terminou: false };
        if (L.voz === 'kevin') elAbrir();
        break;

      case 'response.output_text.delta':
        if (!r) break;
        if (!r.temFala) L.g.marcarEtapa('1o_texto');
        r.temFala = true;
        r.texto += e.delta || '';
        if (L.voz === 'kevin') elTexto(e.delta || '');
        break;

      case 'response.output_audio_transcript.delta':
        if (!r) break;
        if (!r.temFala) L.g.marcarEtapa('1o_texto');
        r.temFala = true;
        r.texto += e.delta || '';
        break;

      case 'response.output_text.done':
      case 'response.output_audio_transcript.done': {
        const texto = (e.text || e.transcript || (r && r.texto) || '').trim();
        if (L.voz === 'kevin') elFechar();
        if (texto && !(r && r.cancelada)) { L.g.appendMessage('assistant', texto); registrar('assistant', texto); }
        break;
      }

      case 'output_audio_buffer.started':
        comecarAFalar('live-openai');
        break;

      case 'output_audio_buffer.stopped':
      case 'output_audio_buffer.cleared':
        pararDeFalar();
        break;

      case 'response.function_call_arguments.done':
        if (r) r.chamadas.push(executarFerramenta(e.call_id, e.name, e.arguments, r));
        break;

      case 'response.done':
        if (r) aoTerminarResposta(r, e.response || {});
        break;

      case 'error':
        console.warn('[Live] erro da OpenAI:', e.error);
        if (e.error && /buffer/i.test(e.error.code || '')) {  // apertou e soltou sem falar
          L.pensando = false;
          const k = kevin();
          if (k && k.onError) k.onError();
        }
        break;
    }
  }

  async function executarFerramenta(callId, nome, argumentos, r) {
    try {
      const res = await post(L.g.urls.liveFerramenta, { nome, argumentos });
      if (res.acao) {
        // Música toca DEPOIS da fala (o <audio> é o mesmo); o resto, já.
        if (res.acao.tipo === 'musica') r.acoesDepois.push(res.acao);
        else await L.g.executarAntes([res.acao]);
      }
      if (res.precisa_continuar) r.precisaContinuar = true;
      enviar({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: callId, output: res.saida } });
    } catch (err) {
      console.error('[Live] ferramenta', nome, err);
      enviar({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: callId, output: 'Não funcionou agora.' } });
    }
  }

  async function aoTerminarResposta(r, resposta) {
    await Promise.all(r.chamadas);
    r.terminou = true;
    if (r.cancelada || resposta.status === 'cancelled') return;
    // Ferramenta cujo resultado a IA precisa ler (regras do jogo), ou chamou
    // ferramenta sem dizer nada: pede a continuação da fala.
    if (r.chamadas.length && (r.precisaContinuar || !r.temFala)) {
      enviar({ type: 'response.create' });
      return;
    }
    if (!r.temFala) {
      L.pensando = false;
      const k = kevin();
      if (k && k.onAssistantMessage) k.onAssistantMessage('');
      executarAcoesDepois();
    }
  }

  function executarAcoesDepois() {
    const r = L.resposta;
    if (!r || !r.acoesDepois.length) return;
    const acoes = r.acoesDepois.splice(0);
    L.g.executarDepois(acoes);
  }

  // ── voz do Kevin: WebSocket de streaming da ElevenLabs ──
  function proximoTokenVoz() {
    post(L.g.urls.liveTokenVoz).then((d) => L.el.tokens.push(d.token)).catch((e) => console.warn('[Live] token voz', e));
  }

  function elAbrir() {
    elParar();
    const token = L.el.tokens.shift();
    proximoTokenVoz();  // o token é de uso único: já pede o da próxima fala
    if (!token) { console.warn('[Live] sem token da ElevenLabs para esta fala'); return; }
    const url = 'wss://api.elevenlabs.io/v1/text-to-speech/' + L.el.voiceId + '/stream-input'
      + '?model_id=' + encodeURIComponent(L.el.modelId) + '&output_format=pcm_24000&single_use_token=' + encodeURIComponent(token);
    const ws = new WebSocket(url);
    L.el.ws = ws;
    L.el.fila = [{ text: ' ', voice_settings: { stability: 0.5, similarity_boost: 0.75 } }];
    if (!L.el.saida) {
      L.el.saida = L.ctx.createGain();
      L.el.saida.connect(L.ctx.destination);
      L.el.saida.connect(L.analisador);
    }
    ws.onopen = () => { L.el.fila.forEach((m) => ws.send(JSON.stringify(m))); L.el.fila = []; };
    ws.onmessage = (ev) => {
      if (ws !== L.el.ws) return;
      const d = JSON.parse(ev.data);
      if (d.audio) tocarPcm(d.audio);
    };
    ws.onerror = (ev) => console.warn('[Live] WebSocket da ElevenLabs', ev);
  }

  function elMandar(msg) {
    const ws = L.el.ws;
    if (!ws) return;
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
    else if (ws.readyState === WebSocket.CONNECTING) L.el.fila.push(msg);
  }

  function elTexto(pedaco) {
    if (!pedaco) return;
    elMandar({ text: pedaco });
    // Fim de frase: gera já, sem esperar acumular mais texto.
    if (/[.!?…]\s*$/.test(pedaco)) elMandar({ text: ' ', flush: true });
  }

  function elFechar() {
    elMandar({ text: ' ', flush: true });
    elMandar({ text: '' });
  }

  function tocarPcm(b64) {
    const bin = atob(b64);
    const n = bin.length >> 1;
    if (!n) return;
    const buffer = L.ctx.createBuffer(1, n, 24000);
    const canal = buffer.getChannelData(0);
    for (let i = 0; i < n; i++) {
      let v = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8);
      if (v >= 32768) v -= 65536;
      canal[i] = v / 32768;
    }
    const fonte = L.ctx.createBufferSource();
    fonte.buffer = buffer;
    fonte.connect(L.el.saida);
    const agora = L.ctx.currentTime;
    const quando = Math.max(agora + 0.03, L.el.proximo);
    fonte.start(quando);
    L.el.proximo = quando + buffer.duration;
    L.el.fontes.push(fonte);
    fonte.onended = () => { L.el.fontes = L.el.fontes.filter((f) => f !== fonte); };
    comecarAFalar('live-kevin');
    clearTimeout(L.el.fimTimer);
    L.el.fimTimer = setTimeout(pararDeFalar, (L.el.proximo - agora) * 1000 + 150);
  }

  function elParar() {
    if (L.el.ws) { try { L.el.ws.close(); } catch (e) { /* já fechado */ } }
    L.el.ws = null;
    L.el.fila = [];
    L.el.fontes.forEach((f) => { try { f.stop(); } catch (e) { /* já parou */ } });
    L.el.fontes = [];
    L.el.proximo = 0;
    clearTimeout(L.el.fimTimer);
  }

  window.KevinLive = {
    conectar(ganchos) { L.g = ganchos; },
    iniciar,
    conectado: () => L.ok,
    gravando: () => L.gravando,
    fase: () => (L.gravando ? 'gravando' : L.falando ? 'falando' : L.pensando ? 'pensando' : 'ocioso'),
    falarInicio,
    falarFim,
    enviarTexto,
    enviarEvento,
    dizer,
    interromper,
    alternarMaosLivres,
  };
})();
