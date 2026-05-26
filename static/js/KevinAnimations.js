/**
 * KevinAnimations — Animações compostas (estilo realista)
 *
 *   talk(ms)   → boca + sway + braços gesticulando + cauda balançando
 *   listen(ms) → cabeça inclinada, olhos focam no usuário
 *   thinking() → cabeça pro outro lado + olhos pra cima + piscadas
 *   greet()    → acenar com a mão + piscar + nod + fala curta
 */
class KevinAnimations {
  constructor(rig) {
    this.rig = rig;
  }

  /** Kevin fala: boca + sway + braços + cauda + olhos vivos */
  talk(durationMs = 3000) {
    if (!this.rig.canAnimate) return;
    this.rig.animateTalkingSequence(durationMs);
    this.rig.startSway(durationMs, 14);
    this.rig.startArmGestures(durationMs);
    this.rig.startTailWag(durationMs);
    // Pisca uma vez no meio
    setTimeout(() => this.rig.blink(), durationMs / 2);
  }

  /** Kevin escuta: cabeça inclinada, olhos focam no chat (lado direito) */
  listen(durationMs = 3000) {
    if (!this.rig.canAnimate) return;
    this.nodHead(7, 500);
    // Olhos olham levemente pra direita (em direção ao chat)
    this.rig.eyeMovementActive = false; // pausa movimento idle
    this.rig.movePupils(4, 1);
    setTimeout(() => {
      this.nodHead(0, 400);
      this.rig.eyeMovementActive = true; // retoma
      this.rig.startIdleEyeMovement();
    }, durationMs);
  }

  /** Kevin pensa: cabeça pro outro lado + olhos pra cima + piscadas */
  thinking(durationMs = 1500) {
    if (!this.rig.canAnimate) return;
    this.nodHead(-8, 400);
    this.rig.eyeMovementActive = false;
    this.rig.movePupils(-3, -3); // olhos pra cima e esquerda (pensativo)
    this.blinkMultiple(2, 300);
    setTimeout(() => {
      this.nodHead(0, 400);
      this.rig.startIdleEyeMovement();
    }, durationMs);
  }

  /** Movimento suave da cabeça com easing */
  nodHead(targetDegrees = 10, durationMs = 500) {
    if (!this.rig.canAnimate) return;
    const startTime = performance.now();
    const headTransform = this.rig.elements.head?.getAttribute('transform') || '';
    const match = headTransform.match(/rotate\(([-\d.]+)/);
    const startDegrees = match ? parseFloat(match[1]) : 0;

    const animate = (time) => {
      const elapsed = time - startTime;
      const p = Math.min(elapsed / durationMs, 1);
      const eased = p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p;
      const current = startDegrees + (targetDegrees - startDegrees) * eased;
      this.rig.rotateHead(current);
      if (p < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }

  async blinkMultiple(count = 2, intervalMs = 250) {
    for (let i = 0; i < count; i++) {
      this.rig.blink();
      await this.sleep(intervalMs);
    }
  }

  /** Saudação completa: acena + pisca + nod + fala */
  async greet(text = 'Olá!') {
    if (!this.rig.canAnimate) return;
    // Acena com a mão direita
    this.rig.waveHand();
    await this.blinkMultiple(2, 200);
    this.nodHead(5, 400);
    const duration = Math.max(text.length * 60, 1500);
    this.talk(duration);
    setTimeout(() => this.nodHead(0, 300), duration + 100);
  }

  reset() {
    this.rig.reset();
  }

  sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }
}

if (typeof window !== 'undefined') {
  window.KevinAnimations = KevinAnimations;
}
