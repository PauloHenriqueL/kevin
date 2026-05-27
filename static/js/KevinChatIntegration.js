/**
 * KevinChatIntegration — Conecta animações do Kevin aos eventos do chat
 *
 * Ciclo realista:
 *   onUserMessage()       → Kevin escuta (cabeça inclinada)
 *   onAssistantThinking() → Kevin pensa (piscadas)
 *   onAssistantMessage()  → Kevin fala (boca + sway)
 *
 * Também controla o status pill (#kevin-status-pill) com os textos
 * apropriados em pt-BR pra dar feedback visual claro ao professor.
 */
class KevinChatIntegration {
  constructor(rigMountSelector, svgUrl) {
    this.rigMountSelector = rigMountSelector;
    this.svgUrl = svgUrl;
    this.rig = null;
    this.animations = null;
    this.isInitialized = false;
    this.statusPill = document.getElementById('kevin-status-pill');
    this._statusTimer = null;
  }

  async init() {
    if (this.isInitialized) return;
    try {
      this.rig = new KevinRig(this.rigMountSelector, this.svgUrl);
      await this.rig.load();
      this.animations = new KevinAnimations(this.rig);
      this.isInitialized = true;
      this.setStatus('idle', 'Pronto pra conversar');
      console.log('[KevinChat] ✓ pronto');
    } catch (err) {
      console.error('[KevinChat] erro ao inicializar:', err);
    }
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

  /** Usuário enviou mensagem → Kevin escuta */
  onUserMessage(text) {
    if (!this.isInitialized) return;
    const duration = Math.max(text.length * 50, 1500);
    this.animations.listen(duration);
    this.setStatus('listening', 'Ouvindo você…');
  }

  /** Kevin pensando enquanto IA gera resposta */
  onAssistantThinking() {
    if (!this.isInitialized) return;
    this.animations.thinking(1500);
    this.setStatus('thinking', 'Pensando…');
  }

  /** Kevin recebeu resposta → fala */
  onAssistantMessage(text, durationMs = null) {
    if (!this.isInitialized) return;
    // ~60ms por caractere (ritmo de fala natural em pt-BR)
    const duration = durationMs || Math.max(text.length * 60, 2000);
    this.animations.talk(duration);
    this.setStatus('speaking', 'Respondendo…', duration + 400);
  }

  /** Erro/timeout → Kevin reseta */
  onError() {
    if (!this.isInitialized) return;
    this.animations.reset();
    this.setStatus('idle', 'Pronto pra conversar');
  }

  /** Saudação inicial */
  async greet(text = 'Oi! Como posso ajudar?') {
    if (!this.isInitialized) return;
    this.setStatus('speaking', 'Te dando oi…', 2200);
    await this.animations.greet(text);
  }

  reset() {
    if (!this.isInitialized) return;
    this.animations.reset();
    this.setStatus('idle', 'Pronto pra conversar');
  }
}

// Disponibilizar globalmente
if (typeof window !== 'undefined') {
  window.KevinChatIntegration = KevinChatIntegration;
}
