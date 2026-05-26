/**
 * KevinChatIntegration — Integra KevinRig com o sistema de chat
 *
 * Uso:
 *   const kevinChat = new KevinChatIntegration(
 *     '#kevin-rig-mount',
 *     '/static/css/animations/kevin-rigged.svg'
 *   );
 *   await kevinChat.init();
 *   kevinChat.onUserMessage('Oi Kevin!');
 *   kevinChat.onAssistantMessage('Oi! Como posso ajudar?', 3000);
 */
class KevinChatIntegration {
  constructor(rigMountSelector, svgUrl) {
    this.rigMountSelector = rigMountSelector;
    this.svgUrl = svgUrl;
    this.rig = null;
    this.animations = null;
    this.isInitialized = false;
  }

  /**
   * Inicializa Kevin — carrega SVG e prepara animações
   */
  async init() {
    if (this.isInitialized) return;

    try {
      this.rig = new KevinRig(this.rigMountSelector, this.svgUrl);
      await this.rig.load();
      this.animations = new KevinAnimations(this.rig);
      this.isInitialized = true;

      console.log('[KevinChatIntegration] Kevin carregado e pronto! ✓');
    } catch (error) {
      console.error('[KevinChatIntegration] Erro ao inicializar Kevin:', error);
    }
  }

  /**
   * Usuário enviou mensagem — Kevin escuta
   */
  onUserMessage(messageText) {
    if (!this.isInitialized) return;

    // Simples: Kevin inclina a cabeça enquanto escuta
    const estimatedDuration = Math.max(messageText.length * 50, 1500);
    this.animations.listen(estimatedDuration);
  }

  /**
   * Kevin vai responder — anima a resposta
   * @param {string} responseText - Texto da resposta
   * @param {number} durationMs - Duração em ms (ou auto-calculado)
   */
  onAssistantMessage(responseText, durationMs = null) {
    if (!this.isInitialized) return;

    // Calcula duração automaticamente baseado no comprimento do texto
    if (!durationMs) {
      // ~50ms por caractere (ajuste conforme necessário)
      durationMs = Math.max(responseText.length * 50, 2000);
    }

    // Kevin fala enquanto responde
    this.animations.talk(durationMs);
  }

  /**
   * Kevin recebe uma pergunta — mostra entusiasmo/confusão
   * @param {string} messageText - Texto da pergunta
   */
  onQuestion(messageText) {
    if (!this.isInitialized) return;

    if (messageText.includes('?')) {
      // Pergunta normal — saudação neutra
      this.animations.nodHead(5, 400);
    } else {
      // Comando/afirmação — mostra mais interesse
      this.animations.excited(1500);
    }
  }

  /**
   * Erro ou confusão — Kevin mostra que não entendeu
   */
  onError() {
    if (!this.isInitialized) return;
    this.animations.confused();
  }

  /**
   * Kevin saúda no início da conversa
   * @param {string} greeting - Mensagem de saudação
   */
  async greet(greeting = 'Oi! Eu sou o Kevin. Como posso ajudar?') {
    if (!this.isInitialized) return;
    await this.animations.greet(greeting);
  }

  /**
   * Reset — volta ao estado neutro
   */
  reset() {
    if (!this.isInitialized) return;
    this.animations.reset();
  }
}
