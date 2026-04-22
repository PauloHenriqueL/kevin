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
    currentAudioSource: null,
    stopMonitor: null,
    isRecording: false,
    isSending: false,
    liveMode: false,
  };

  const $ = (sel) => document.querySelector(sel);
  const chatBody = $('#chat-body');
  const input = $('#chat-input');
  const btnSend = $('#btn-send');
  const btnMic = $('#btn-mic');
  const btnMicLive = $('#btn-mic-live');
  const headerKevin = $('#chat-header-kevin');

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
    const avatar = role === 'assistant' ? kevinAvatarHTML() : userAvatarHTML();
    const bubble = `<div class="msg-bubble">${escapeHTML(content)}</div>`;
    const listen = role === 'assistant'
      ? `<button class="btn-listen" type="button" title="Ouvir" data-text="${escapeAttr(content)}">🔊 Ouvir</button>`
      : '';
    const msg = document.createElement('div');
    msg.className = 'message ' + role;
    msg.innerHTML = role === 'assistant'
      ? `${avatar}<div>${bubble}${listen}</div>`
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
  }

  function hideTyping() {
    const t = document.getElementById('typing-indicator');
    if (t) t.remove();
  }

  // ───────────── Envio de texto (async via Celery) ─────────────
  function enviarMensagem() {
    const texto = input.value.trim();
    if (!texto || state.isSending) return;
    appendMessage('user', texto);
    input.value = '';
    input.style.height = 'auto';
    showTyping();

    fetch(cfg.urls.mensagem, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
      body: JSON.stringify({ conteudo: texto, tipo: 'texto' }),
    })
      .then((r) => r.json())
      .then(() => pollResposta());
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
            appendMessage('assistant', msgs[msgs.length - 1].conteudo);
          }
        });
      if (tentativas >= 30) {
        clearInterval(id);
        hideTyping();
        appendMessage('assistant', 'Kevin demorou demais. Tente novamente.');
      }
    }, 2000);
  }

  // ───────────── Gravação com VAD ─────────────
  async function startRecording() {
    if (state.isRecording || state.isSending) return;
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
        if (state.liveMode) setTimeout(() => startRecording(), 400);
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
      if (state.liveMode && !state.isRecording) setTimeout(() => startRecording(), 400);
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
      setMicBtnState('live');
      startRecording();
    }
  }

  function stopAllAudio() {
    if (state.currentAudioSource) {
      try { state.currentAudioSource.stop(); } catch (e) {}
      state.currentAudioSource = null;
    }
  }

  async function playTTS(texto) {
    try {
      const res = await fetch(cfg.urls.tts, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
        body: JSON.stringify({ text: texto }),
      });
      if (!res.ok) { console.warn('TTS falhou:', res.status); return; }
      const buf = await res.arrayBuffer();
      ensureAudioContext();
      const audioBuffer = await state.audioContext.decodeAudioData(buf);
      stopAllAudio();
      const src = state.audioContext.createBufferSource();
      src.buffer = audioBuffer;
      src.connect(state.audioContext.destination);
      state.currentAudioSource = src;
      setMicBtnState(state.liveMode ? 'speaking' : 'idle');
      if (headerKevin) headerKevin.classList.add('talking');
      await new Promise((resolve) => {
        src.onended = () => {
          state.currentAudioSource = null;
          if (headerKevin) headerKevin.classList.remove('talking');
          resolve();
        };
        src.start(0);
      });
      if (state.liveMode) setMicBtnState('live');
    } catch (err) {
      console.error('playTTS:', err);
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

  // Botão "🔊 Ouvir" delegado em todas as mensagens do assistant
  chatBody.addEventListener('click', async (e) => {
    const btn = e.target.closest('.btn-listen');
    if (!btn) return;
    if (btn.disabled) return;
    const texto = btn.dataset.text || btn.closest('.message')?.querySelector('.msg-bubble')?.innerText || '';
    if (!texto) return;
    stopAllAudio();
    btn.disabled = true;
    btn.classList.add('playing');
    const original = btn.innerHTML;
    btn.innerHTML = '▶ Tocando…';
    try {
      await playTTS(texto);
    } finally {
      btn.disabled = false;
      btn.classList.remove('playing');
      btn.innerHTML = original;
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
