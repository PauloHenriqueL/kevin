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
// Cache-buster no import: sem isso, o navegador pode continuar servindo o
// kevin-puppet.js antigo mesmo depois de bumpar o ?v= deste arquivo (o
// import do módulo é cacheado pela própria URL, sem query string por padrão).
import { createKevinPuppet } from './kevin-puppet/kevin-puppet.js?v=2';

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
   * @param {object} options           — o KEVIN_RIG_CONFIG inteiro
   */
  constructor(containerSelector, svgUrl, options = {}) {
    this.containerSelector = containerSelector;
    this.svgUrl = svgUrl;
    this.backgroundUrl = options.backgroundUrl || null;
    // URLs dos demais assets do motor. Precisam ser REPASSADAS: sem elas o
    // motor cai em caminho relativo ao próprio .js, que aponta para
    // static/js/kevin-puppet/assets/ — pasta que não existe em produção,
    // porque a mídia é gitignored e mora no bucket. Eram 5 arquivos em 404
    // (entrada, transição, trilha, ronco e celebrate) e, por tabela, nem a
    // animação de entrada nem a música aconteciam.
    this.assetOptions = {};
    for (const chave of [
      'entradaVideoUrl', 'transitionVideoUrl', 'backsoundMusicUrl',
      'celebrateAudioUrl', 'snoreAudioUrl', 'teachingBoardUrl',
      'vocabularyItems',
    ]) {
      if (options[chave]) this.assetOptions[chave] = options[chave];
    }
    this.kevin = null;
    this.audioEl = null;
    this.audioInput = null;
    this.statusPill = document.getElementById('kevin-status-pill');
    this._statusTimer = null;
    this._freezeEl = null;
    this._entradaPronta = null;   // pré-carregamento do vídeo de entrada
    this._initialized = false;
    this._initError = null;

    // ── Loop de ociosidade (Demanda 9A / D15) ──
    // Enquanto o Kevin está em standby: mosca aparece a cada 40-90s; se ninguém
    // interage por ~5 min, ele dorme. Qualquer atividade (msg, fala) reseta.
    this._idleTimer = null;      // agenda a próxima mosca
    this._sleepTimer = null;     // agenda o sono
    this._camuflageTimer = null; // agenda o próximo camuflage
    this._idleActive = false;    // loop rodando?
    this.MOSCA_MIN_MS = 40_000;
    this.MOSCA_MAX_MS = 90_000;
    // Camuflage é a mesma ideia da mosca (variação de standby, mesma cadência)
    // — só troca a cor do Kevin por alguns instantes, sem exigir nada do
    // professor.
    this.CAMUFLAGE_MIN_MS = 40_000;
    this.CAMUFLAGE_MAX_MS = 90_000;
    this.SLEEP_AFTER_MS = 5 * 60_000;
  }

  // ── Ociosidade ──────────────────────────────────────────────────────────

  /** Começa a contar ociosidade a partir de agora (Kevin em standby). */
  _startIdleLoop() {
    if (!this._initialized || prefersReducedMotion()) return;
    this._idleActive = true;
    this._scheduleMosca();
    this._scheduleCamuflage();
    this._scheduleSleep();
  }

  /** Para o loop e limpa timers. Chamado a cada interação e no destroy. */
  _stopIdleLoop() {
    this._idleActive = false;
    clearTimeout(this._idleTimer);
    clearTimeout(this._sleepTimer);
    clearTimeout(this._camuflageTimer);
    this._idleTimer = null;
    this._sleepTimer = null;
    this._camuflageTimer = null;
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

  /** Camuflage como variação de standby — mesma lógica da mosca (§9.2). */
  _scheduleCamuflage() {
    clearTimeout(this._camuflageTimer);
    const espera = this.CAMUFLAGE_MIN_MS
      + Math.floor((this.CAMUFLAGE_MAX_MS - this.CAMUFLAGE_MIN_MS) * Math.random());
    this._camuflageTimer = setTimeout(() => {
      // Só dispara se ainda estiver ocioso, acordado, e a mosca não estiver
      // rolando (evita as duas variações competindo pela atenção ao mesmo tempo).
      if (this._idleActive && this.kevin && this.kevin.getMode() === 'standby'
          && !this.kevin.isMoscaActive() && this.kevin.playCamuflage) {
        this.kevin.playCamuflage();
      }
      if (this._idleActive) this._scheduleCamuflage();  // reagenda o próximo
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
        ...this.assetOptions,
        // O motor (a partir desta versão do export) tem uma sequência de
        // abertura própria (popup "Iniciar" + entrada + tchau automático),
        // ligada por padrão. Aqui já existe a nossa própria tela de espera
        // (#call-standby / #btn-iniciar-aula) e o próprio fluxo de abertura
        // (iniciarAula() em kevin_chat.js), então DESATIVAMOS a do motor —
        // sem isso, o popup interno dele nunca fecha (nada aqui clica nele)
        // e fica preso por cima do Kevin depois que a nossa tela some.
        autoOpening: false,
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

  /**
   * Mostra o 1º frame do vídeo de entrada, CONGELADO, por cima do puppet —
   * o mesmo truque que a sequência autoOpening nativa do motor faria sozinha
   * (ver kevin-puppet.js), só que orquestrado por nós, já que rodamos com
   * autoOpening:false. Chamado logo após init(), enquanto a nossa tela de
   * espera (#call-standby) ainda cobre tudo — sem isso, o que aparece atrás
   * do popup é o Kevin já animando em standby, em vez da "cortina fechada".
   *
   * Reaproveita a classe `kevin-transition-overlay` que o próprio motor usa
   * pro vídeo de transição/entrada, então herda o mesmo posicionamento
   * (position:absolute, inset:0, object-fit:cover) sem CSS novo.
   */
  freezeEntrada(entradaVideoUrl) {
    if (!entradaVideoUrl || this._freezeEl) return;
    const container = document.querySelector(this.containerSelector);
    const stage = container && container.querySelector('.kevin-stage');
    if (!stage) return;
    const video = document.createElement('video');
    video.className = 'kevin-transition-overlay';
    video.muted = true;
    video.setAttribute('playsinline', '');
    video.preload = 'auto';
    // Aparece DE IMEDIATO, com o cenário da aula como `poster`. Enquanto o
    // vídeo não chega (~1s vindo do bucket), o poster é o que se vê — e ele
    // já está em cache, porque é o mesmo arquivo que o palco usa de fundo.
    //
    // Duas tentativas anteriores falharam por não cobrir o palco desde o
    // primeiro quadro: exibir o <video> vazio dava um retângulo BRANCO;
    // esperar o `loadeddata` deixava o Kevin de pé aparecer por baixo e
    // depois ser tapado — o "pisca" relatado em 30/09/2026. Com o poster
    // não há instante nenhum em que o palco fique à mostra.
    if (this.backgroundUrl) video.poster = this.backgroundUrl;
    video.style.display = 'block';
    // Assim que houver dados, mostra o quadro 0 de verdade (a "cortina
    // fechada"), que substitui o poster sem troca perceptível.
    video.addEventListener('loadeddata', () => {
      video.currentTime = 0;
    }, { once: true });
    const source = document.createElement('source');
    source.src = entradaVideoUrl;
    source.type = 'video/webm';
    video.appendChild(source);
    stage.appendChild(video);
    this._freezeEl = video;

    // Aquece o cache HTTP para o elemento de vídeo do MOTOR, que é outro
    // elemento com a mesma URL. O motor chama play() sem esperar buffer
    // (runEntradaAnimation em kevin-puppet.js), então sem o arquivo em cache
    // no clique de "Iniciar aula" a animação simplesmente não acontece — e
    // a música de fundo, que começa dentro dela, também não.
    this._entradaPronta = fetch(entradaVideoUrl, { cache: 'force-cache' })
      .then((r) => r.blob())
      .catch(() => null);
  }

  /** Remove o quadro congelado. playEntrada() chama isso antes de tocar. */
  dismissFreeze() {
    if (this._freezeEl) {
      this._freezeEl.remove();
      this._freezeEl = null;
    }
  }

  /**
   * Toca a animação de entrada ("abre a cortina" e revela o Kevin), chamada
   * no clique de "Iniciar aula". O Kevin já deve estar no modo desejado por
   * baixo do vídeo — init() já deixa em "standby", então não precisa setar
   * nada aqui antes de chamar.
   */
  async playEntrada() {
    if (!this._initialized || !this.kevin.playEntrada) return false;
    // Espera o vídeo estar em cache antes de entregar ao motor, que toca sem
    // verificar buffer. Teto de 3s: passou disso, segue sem a animação em vez
    // de deixar o professor esperando na frente da turma.
    if (this._entradaPronta) {
      await Promise.race([
        this._entradaPronta,
        new Promise((r) => setTimeout(r, 3000)),
      ]);
    }
    // Tira o congelado bem no instante em que o vídeo de verdade vai tocar —
    // como é o MESMO frame (frame 0 do mesmo arquivo), a troca é invisível.
    this.dismissFreeze();
    return this.kevin.playEntrada();
  }

  /**
   * Aceno de "oi" ao entrar na aula — chamado depois do vídeo de entrada e
   * ANTES do kickoff, pra o Kevin acenar antes de entrar em "thinking". O
   * motor só tem um gesto de aceno de disparo único (o modo "tchau" — serve
   * igual pra cumprimentar). Não há Promise que resolva ao fim do aceno (3
   * ciclos a 1.5Hz + entrada/saída, ~2.6s no total — ver TCHAU_WAVE_* em
   * kevin-puppet.js), então usamos um delay fixo, como no celebrate.
   */
  async waveHello() {
    if (!this._initialized) return false;
    this._kickActivity();
    const ok = await this.kevin.setMode('tchau');
    if (!ok) return false;
    await new Promise((r) => setTimeout(r, 2600));
    return true;
  }

  /**
   * Dispara o pulo comemorativo (D38, docs/demandas.md) — chamado quando a
   * IA sinaliza (via tool-calling) que a resposta celebra um acerto do
   * Teacher/turma. Disparo único; o motor volta pra "standby" sozinho.
   */
  async celebrate() {
    if (!this._initialized) return false;
    this._kickActivity();
    return this.kevin.setMode('celebrate');
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
    this.dismissFreeze();
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
