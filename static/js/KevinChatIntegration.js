/**
 * KevinChatIntegration — Conecta animações do Kevin aos eventos do chat
 *
 * Ciclo realista:
 *   onUserMessage()       → Kevin escuta (cabeça inclinada)
 *   onAssistantThinking() → Kevin pensa (piscadas)
 *   onAssistantMessage()  → Kevin fala (boca + sway)
 */
class KevinChatIntegration {
  constructor(rigMountSelector, svgUrl) {
    this.rigMountSelector = rigMountSelector;
    this.svgUrl = svgUrl;
    this.rig = null;
    this.animations = null;
    this.isInitialized = false;
  }

  async init() {
    if (this.isInitialized) return;
    try {
      this.rig = new KevinRig(this.rigMountSelector, this.svgUrl);
      await this.rig.load();
      this.animations = new KevinAnimations(this.rig);
      this.isInitialized = true;
      console.log('[KevinChat] ✓ pronto');
    } catch (err) {
      console.error('[KevinChat] erro ao inicializar:', err);
    }
  }

  /** Usuário enviou mensagem → Kevin escuta */
  onUserMessage(text) {
    if (!this.isInitialized) return;
    const duration = Math.max(text.length * 50, 1500);
    this.animations.listen(duration);
  }

  /** Kevin pensando enquanto IA gera resposta */
  onAssistantThinking() {
    if (!this.isInitialized) return;
    this.animations.thinking(1500);
  }

  /** Kevin recebeu resposta → fala */
  onAssistantMessage(text, durationMs = null) {
    if (!this.isInitialized) return;
    // ~60ms por caractere (ritmo de fala natural em pt-BR)
    const duration = durationMs || Math.max(text.length * 60, 2000);
    this.animations.talk(duration);
  }

  /** Erro/timeout → Kevin reseta */
  onError() {
    if (!this.isInitialized) return;
    this.animations.reset();
  }

  /** Saudação inicial */
  async greet(text = 'Oi! Como posso ajudar?') {
    if (!this.isInitialized) return;
    await this.animations.greet(text);
  }

  reset() {
    if (!this.isInitialized) return;
    this.animations.reset();
  }
}

// Disponibilizar globalmente
if (typeof window !== 'undefined') {
  window.KevinChatIntegration = KevinChatIntegration;
}
