/**
 * KevinPuppetIntegration — Facade que conecta o chat ao motor kevin-puppet.
 *
 * Substitui o trio antigo (KevinRig + KevinAnimations + KevinChatIntegration).
 * Preserva a mesma fachada esperada por kevin_chat.js:
 *
 *     init()                          → carrega motor, aplica standby
 *     onUserMessage(text)             → Kevin escuta (continua standby)
 *     onAssistantThinking()           → setMode("thinking")
 *     onAssistantMessage(text)        → opcional; se houver áudio TTS, é o
 *                                       playTTS quem dispara setMode("speaking")
 *     onError()                       → setMode("standby")
 *     setStatus(state, text, autoIdleMs?) → atualiza a pill flutuante
 *     getAudioElement()               → retorna o <audio> compartilhado
 *
 * Carregado como ES module (type="module") por aula_detail.html. Expõe-se em
 * window.KevinChatIntegration por compatibilidade.
 */
import { createKevinPuppet } from './kevin-puppet/kevin-puppet.js';

/**
 * Adapter de áudio para HTMLAudioElement.
 *
 * Cria UMA VEZ o AudioContext / MediaElementSource (chamar createMediaElementSource
 * duas vezes no mesmo elemento lança InvalidStateError) e a partir daí só liga/desliga
 * via flag `enabled`. O motor lê `update()` a cada frame durante o modo "speaking".
 *
 * IMPORTANTE: o source é conectado a ctx.destination — sem isso o áudio fica MUDO
 * (MediaElementSource captura o stream do <audio>). Como o áudio roteia pelo
 * AudioContext, se o ctx ficar "suspended" o usuário NÃO OUVE NADA. Por isso
 * start() falha-loud se resume() não conseguir destravar o contexto.
 *
 * Expõe `unlock()` que pode ser chamado num user gesture pra destravar o contexto
 * antes do primeiro speaking — evita problema de autoplay/iOS Safari.
 */
function createTtsAudioInput(audioEl) {
  let ctx = null;
  let analyser = null;
  let dataArray = null;
  let wired = false;

  function wire() {
    if (wired) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      const source = ctx.createMediaElementSource(audioEl);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.6;
      source.connect(analyser);
      source.connect(ctx.destination);
      dataArray = new Uint8Array(analyser.fftSize);
      wired = true;
      return true;
    } catch (err) {
      console.warn('[KevinPuppet] createMediaElementSource falhou:', err);
      return false;
    }
  }

  return {
    enabled: false,
    level: 0,
    /**
     * Garantir que o AudioContext está "running". Pode ser chamado de qualquer
     * user gesture pra pré-destravar (recomendado: no btn-send/btn-mic-live click).
     * Retorna true se conseguiu ficar (ou já estava) running.
     */
    async unlock() {
      if (!wire()) return false;
      if (ctx.state === 'suspended') {
        try { await ctx.resume(); } catch (e) {
          console.warn('[KevinPuppet] AudioContext.resume() rejeitado no unlock:', e);
          return false;
        }
      }
      return ctx.state === 'running';
    },
    async start() {
      if (!wire()) return false;
      if (ctx.state === 'suspended') {
        try {
          await ctx.resume();
        } catch (e) {
          console.warn('[KevinPuppet] AudioContext.resume() rejeitado em start():', e);
          return false;
        }
      }
      // Double-check: pode ter falhado silenciosamente (Safari).
      if (ctx.state !== 'running') {
        console.warn('[KevinPuppet] AudioContext não está running após resume:', ctx.state);
        return false;
      }
      this.enabled = true;
      return true;
    },
    stop() {
      this.enabled = false;
      this.level = 0;
    },
    update() {
      if (!this.enabled || !analyser) return 0;
      analyser.getByteTimeDomainData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const v = (dataArray[i] - 128) / 128;
        sum += v * v;
      }
      this.level = Math.sqrt(sum / dataArray.length);
      return this.level;
    },
    // Para testes / introspecção
    getContextState() { return ctx ? ctx.state : 'closed'; },
  };
}

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

class KevinPuppetIntegration {
  /**
   * Mantém a mesma assinatura posicional do antigo KevinChatIntegration
   * (kevin_chat.js chama: `new KevinChatIntegration(rigMountSelector, svgUrl)`).
   *
   * @param {string} containerSelector — onde o motor cria a stage (ex: "#kevin-rig-mount")
   * @param {string} svgUrl            — URL do SVG do Kevin (via Django static)
   * @param {object} options           — { backgroundUrl? }
   */
  constructor(containerSelector, svgUrl, options = {}) {
    this.containerSelector = containerSelector;
    this.svgUrl = svgUrl;
    this.backgroundUrl = options.backgroundUrl || null;
    this.kevin = null;
    this.audioEl = null;
    this.audioInput = null;
    this.statusPill = document.getElementById('kevin-status-pill');
    this._statusTimer = null;
    this._initialized = false;
    this._initError = null;

    // ── Loop de ociosidade (Demanda 9A / D15) ──
    // Enquanto o Kevin está em standby: mosca aparece a cada 40-90s; se ninguém
    // interage por ~5 min, ele dorme. Qualquer atividade (msg, fala) reseta.
    this._idleTimer = null;      // agenda a próxima mosca
    this._sleepTimer = null;     // agenda o sono
    this._idleActive = false;    // loop rodando?
    this.MOSCA_MIN_MS = 40_000;
    this.MOSCA_MAX_MS = 90_000;
    this.SLEEP_AFTER_MS = 5 * 60_000;
  }

  // ── Ociosidade ──────────────────────────────────────────────────────────

  /** Começa a contar ociosidade a partir de agora (Kevin em standby). */
  _startIdleLoop() {
    if (!this._initialized || prefersReducedMotion()) return;
    this._idleActive = true;
    this._scheduleMosca();
    this._scheduleSleep();
  }

  /** Para o loop e limpa timers. Chamado a cada interação e no destroy. */
  _stopIdleLoop() {
    this._idleActive = false;
    clearTimeout(this._idleTimer);
    clearTimeout(this._sleepTimer);
    this._idleTimer = null;
    this._sleepTimer = null;
  }

  _scheduleMosca() {
    clearTimeout(this._idleTimer);
    const espera = this.MOSCA_MIN_MS
      + Math.floor((this.MOSCA_MAX_MS - this.MOSCA_MIN_MS) * Math.random());
    this._idleTimer = setTimeout(() => {
      // Só solta a mosca se ainda estiver ocioso e acordado.
      if (this._idleActive && this.kevin && this.kevin.getMode() === 'standby'
          && !this.kevin.isMoscaActive()) {
        this.kevin.startMosca();
      }
      if (this._idleActive) this._scheduleMosca();  // reagenda a próxima
    }, espera);
  }

  _scheduleSleep() {
    clearTimeout(this._sleepTimer);
    this._sleepTimer = setTimeout(() => {
      if (this._idleActive && this.kevin && this.kevin.getMode() === 'standby') {
        this.kevin.setMode('sleeping');
        this.setStatus('idle', 'Kevin cochilando… fale para acordar');
      }
    }, this.SLEEP_AFTER_MS);
  }

  /**
   * Marca que houve interação: acorda o Kevin se estiver dormindo e zera a
   * contagem de ociosidade. Ponto único chamado por todos os eventos de chat.
   */
  _kickActivity() {
    this._stopIdleLoop();
    if (this.kevin && this.kevin.isMoscaActive()) {
      this.kevin.dismissMosca();
    }
  }

  async init() {
    if (this._initialized) return;
    const container = document.querySelector(this.containerSelector);
    if (!container) {
      console.error('[KevinPuppet] container não encontrado:', this.containerSelector);
      return;
    }

    // <audio> compartilhado. Como nosso TTS é same-origin, crossorigin é apenas
    // defensivo (caso o endpoint vire CDN no futuro). Blob URLs ignoram CORS,
    // então o atributo não interfere com nosso fluxo atual.
    if (!this.audioEl) {
      this.audioEl = document.createElement('audio');
      this.audioEl.setAttribute('crossorigin', 'anonymous');
      this.audioEl.preload = 'auto';
      this.audioEl.style.display = 'none';
      container.appendChild(this.audioEl);
    }

    try {
      this.kevin = await createKevinPuppet(container, {
        svgUrl: this.svgUrl,
        backgroundUrl: this.backgroundUrl,
        onError: (msg) => console.error('[KevinPuppet]', msg),
      });
      // Plugar o áudio do TTS no lipsync (substituindo o mic default).
      this.audioInput = createTtsAudioInput(this.audioEl);
      await this.kevin.setAudioInput(this.audioInput);
      // Respeita preferência de "reduced motion": Kevin parado.
      const initialMode = prefersReducedMotion() ? 'off' : 'standby';
      await this.kevin.setMode(initialMode);
      this._initialized = true;
      this.setStatus('idle', 'Pronto pra conversar');
      this._startIdleLoop();
      console.log('[KevinPuppet] ✓ pronto (mode=' + initialMode + ')');
    } catch (err) {
      this._initError = err;
      console.error('[KevinPuppet] erro ao inicializar:', err);
      this._showFallback(container);
    }
  }

  /** Coloca uma imagem estática + mensagem amigável quando o motor falha. */
  _showFallback(container) {
    try {
      container.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:var(--azul-escuro);text-align:center;padding:24px;height:100%;">'
        + '<div style="font-size:0.85rem;font-weight:700;opacity:0.7;">Não consegui carregar a animação do Kevin.</div>'
        + '<div style="font-size:0.75rem;opacity:0.55;">Você pode continuar conversando — só sem o personagem animado.</div>'
        + '</div>';
    } catch (e) { /* nada a fazer */ }
  }

  /** Pré-destrava o AudioContext num user gesture. Idempotente. */
  async unlockAudio() {
    if (!this.audioInput) return false;
    return this.audioInput.unlock();
  }

  /** True se init concluiu com sucesso. */
  isReady() { return this._initialized; }

  /** Devolve o <audio> compartilhado; kevin_chat.js usa pra playTTS. */
  getAudioElement() {
    return this.audioEl;
  }

  /**
   * Para a reprodução de TTS sem trocar o modo. Usado pelo kevin_chat.js
   * quando o usuário inicia uma nova interação enquanto o Kevin está falando.
   */
  stopAudio() {
    if (this.audioEl && !this.audioEl.paused) {
      try { this.audioEl.pause(); this.audioEl.currentTime = 0; } catch (e) { /* ignore */ }
    }
  }

  /** Devolve o puppet (raw) — útil pra setMode externo. */
  getPuppet() {
    return this.kevin;
  }

  /** Atualiza pill com estado + texto. autoIdleMs reverte para "idle" depois. */
  setStatus(state, text, autoIdleMs = null) {
    if (!this.statusPill) return;
    clearTimeout(this._statusTimer);
    this.statusPill.setAttribute('data-state', state);
    const label = this.statusPill.querySelector('.status-text');
    if (label && text) label.textContent = text;
    if (autoIdleMs) {
      this._statusTimer = setTimeout(() => {
        this.statusPill.setAttribute('data-state', 'idle');
        if (label) label.textContent = 'Pronto pra conversar';
      }, autoIdleMs);
    }
  }

  /** Usuário enviou mensagem — Kevin escuta. Interrompe TTS anterior. */
  onUserMessage(_text) {
    if (!this._initialized) return;
    this._kickActivity();  // acorda de sleeping / espanta a mosca, zera ociosidade
    this.stopAudio();
    // sleeping → corte seco (D16). musica: o motor anima a saída sozinho.
    this.kevin.setMode('standby');
    this.setStatus('listening', 'Ouvindo você…');
  }

  /** IA está gerando a resposta. Interrompe TTS anterior. */
  onAssistantThinking() {
    if (!this._initialized) return;
    this._kickActivity();
    this.stopAudio();
    this.kevin.setMode('thinking');
    this.setStatus('thinking', 'Pensando…');
  }

  /**
   * Resposta da IA chegou. NÃO ativa o "speaking" sozinho — só atualiza a pill
   * e volta pra standby. Quem ativa o lipsync é o playTTS em kevin_chat.js,
   * que controla audioEl.play() + kevin.setMode('speaking').
   */
  onAssistantMessage(_text) {
    if (!this._initialized) return;
    this.kevin.setMode('standby');
    this.setStatus('idle', 'Pronto pra conversar');
    this._startIdleLoop();  // resposta entregue → volta a contar ociosidade
  }

  /** Modo "falando" — chamado pelo playTTS quando o áudio vai começar. */
  async startSpeaking() {
    if (!this._initialized) return false;
    const ok = await this.kevin.setMode('speaking');
    if (ok) this.setStatus('speaking', 'Respondendo…');
    return ok;
  }

  /** Fim da fala — chamado quando o áudio terminou ou foi interrompido. */
  stopSpeaking() {
    if (!this._initialized) return;
    this.kevin.setMode('standby');
    this.setStatus('idle', 'Pronto pra conversar');
    this._startIdleLoop();
  }

  /** Erro/timeout — Kevin volta pra standby. Interrompe TTS se estiver tocando. */
  onError() {
    if (!this._initialized) return;
    this.stopAudio();
    this.kevin.setMode('standby');
    this.setStatus('idle', 'Pronto pra conversar');
    this._startIdleLoop();
  }

  // ── Música (Demanda 9A / D17, fase 1: botão manual) ──────────────────────

  /**
   * Kevin pega o ukulele e canta, com lipsync do áudio ativo. Chamado pelo
   * botão "Kevin, canta!" no telão. Se houver uma faixa, toca junto.
   * @param {string} [audioUrl] URL de uma música para tocar com lipsync.
   */
  async playMusica(audioUrl) {
    if (!this._initialized) return false;
    this._kickActivity();
    if (audioUrl && this.audioEl) {
      try {
        await this.unlockAudio();
        this.audioEl.src = audioUrl;
        this.audioEl.play().catch(() => {/* autoplay pode falhar sem gesture */});
      } catch (e) { /* segue sem áudio — a animação toca mesmo assim */ }
    }
    const ok = await this.kevin.setMode('musica');
    if (ok) this.setStatus('speaking', 'Cantando 🎵');
    return ok;
  }

  /** Encerra a música: o motor anima a saída (devolve o ukulele) sozinho. */
  stopMusica() {
    if (!this._initialized) return;
    this.stopAudio();
    this.kevin.setMode('standby');
    this.setStatus('idle', 'Pronto pra conversar');
    this._startIdleLoop();
  }

  // ── Listening (atividade de escuta) ──────────────────────────────────────
  // Diferente da música: só toca o áudio, sem o Kevin pegar o ukulele nem
  // fazer lipsync. É a turma escutando um áudio de compreensão. Usa um <audio>
  // próprio para não interferir no elemento de lipsync da fala/música.

  /** Toca o áudio de listening. @param {string} audioUrl URL do áudio. */
  async playListening(audioUrl) {
    if (!this._initialized || !audioUrl) return false;
    this._kickActivity();
    if (!this._listeningEl) {
      this._listeningEl = document.createElement('audio');
      this._listeningEl.preload = 'auto';
      this._listeningEl.style.display = 'none';
      document.body.appendChild(this._listeningEl);
      // Ao acabar, volta o status para ocioso.
      this._listeningEl.addEventListener('ended', () => {
        this.setStatus('idle', 'Pronto pra conversar');
      });
    }
    try {
      this._listeningEl.src = audioUrl;
      await this._listeningEl.play();
      this.setStatus('speaking', 'Ouvindo 🎧');
      return true;
    } catch (e) {
      return false;  // autoplay bloqueado sem gesto; o clique real resolve
    }
  }

  /** Para o áudio de listening. */
  stopListening() {
    if (this._listeningEl && !this._listeningEl.paused) {
      try { this._listeningEl.pause(); this._listeningEl.currentTime = 0; } catch (e) { /* ignore */ }
    }
    this.setStatus('idle', 'Pronto pra conversar');
  }

  destroy() {
    this._stopIdleLoop();
    clearTimeout(this._statusTimer);
    if (this.kevin) this.kevin.destroy();
    if (this.audioEl && this.audioEl.parentNode) {
      this.audioEl.parentNode.removeChild(this.audioEl);
    }
    if (this._listeningEl && this._listeningEl.parentNode) {
      this._listeningEl.parentNode.removeChild(this._listeningEl);
    }
    this._initialized = false;
  }
}

// Compatibilidade: kevin_chat.js procura window.KevinChatIntegration.
if (typeof window !== 'undefined') {
  window.KevinChatIntegration = KevinPuppetIntegration;
  window.KevinPuppetIntegration = KevinPuppetIntegration;
}

export default KevinPuppetIntegration;
export { KevinPuppetIntegration, createTtsAudioInput };
