/**
 * KevinAnimations — Animações e efeitos do Kevin reutilizáveis
 * Usa KevinRig para controlar o SVG
 */
class KevinAnimations {
  constructor(rig) {
    this.rig = rig;
  }

  /**
   * Faz Kevin "falar" — anima boca enquanto responde
   * @param {number} durationMs - Duração da fala em ms
   */
  talk(durationMs = 3000) {
    this.rig.animateTalkingSequence(durationMs);
  }

  /**
   * Pisca os olhos com intervalo
   * @param {number} count - Quantas vezes piscar
   * @param {number} intervalMs - Intervalo entre piscadas
   */
  async blinkMultiple(count = 2, intervalMs = 300) {
    for (let i = 0; i < count; i++) {
      this.rig.blink();
      await this.sleep(intervalMs);
    }
  }

  /**
   * Movimento da cabeça (balançar/inclinar)
   * @param {number} degrees - Ângulo de rotação (-35 a 35)
   * @param {number} durationMs - Duração do movimento
   */
  nodHead(degrees = 15, durationMs = 600) {
    const startTime = performance.now();
    const startDegrees = 0;

    const animate = (time) => {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / durationMs, 1);

      // Easing ease-in-out
      const easeProgress =
        progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;

      const currentDegrees = startDegrees + (degrees - startDegrees) * easeProgress;
      this.rig.rotateHead(currentDegrees);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.rig.rotateHead(0); // Volta ao estado neutro
      }
    };

    requestAnimationFrame(animate);
  }

  /**
   * Kevin escuta o usuário (cabeça inclinada, pisca ocasionalmente)
   * @param {number} durationMs - Quanto tempo Kevin escuta
   */
  listen(durationMs = 3000) {
    this.nodHead(10, 800);

    const startTime = performance.now();
    const blink = () => {
      const elapsed = performance.now() - startTime;
      if (elapsed < durationMs) {
        if (Math.random() > 0.7) {
          this.rig.blink();
        }
        setTimeout(blink, Math.random() * 1000 + 500);
      }
    };

    blink();
  }

  /**
   * Kevin saúda (piscadas rápidas + balanço de cabeça + fala)
   */
  async greet(greeting = 'Oi! Como posso ajudar?') {
    // Piscadas de saudação
    await this.blinkMultiple(2, 200);

    // Balanço de cabeça amigável
    this.nodHead(10, 500);

    // Fala
    const durationMs = Math.max(greeting.length * 50, 2000);
    this.talk(durationMs);
  }

  /**
   * Kevin mostra confusão (piscadas, cabeça de lado)
   */
  confused() {
    this.nodHead(20, 400);
    this.rig.blink();
  }

  /**
   * Kevin mostra entusiasmo (piscadas rápidas + fala animada)
   * @param {number} durationMs - Duração do entusiasmo
   */
  excited(durationMs = 2000) {
    this.talk(durationMs);
    // Pisca com mais frequência
    for (let i = 0; i < 3; i++) {
      setTimeout(() => this.rig.blink(), i * 300);
    }
  }

  /**
   * Utilitário: dormir (promise)
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Reset — volta ao estado neutro
   */
  reset() {
    this.rig.reset();
  }
}
