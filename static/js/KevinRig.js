/**
 * KevinRig — Carrega e controla o modelo SVG rigged do Kevin
 *
 * Estratégia: tenta carregar inline (fetch + innerHTML) primeiro,
 * pois permite manipular elementos SVG via JS. Se falhar (CORS),
 * faz fallback para <object> e depois <img>.
 *
 * Partes animáveis:
 *   - Boca: 12 formas (Neutral, Aa, Oh, Uh, M, F, L, S, R, D, w-Oo, Surprised)
 *   - Olhos: pupilas movem horizontal/vertical, blinks pra piscar
 *   - Cabeça: rotação em volta do pivô (493, 460.9)
 *   - Braços: Left_Arm e Right_Arm rotacionam
 *   - Cauda: Tail balança
 *   - Corpo todo: sway horizontal via transform no container
 */
class KevinRig {
  constructor(mountSelector, svgUrl) {
    this.mount = document.querySelector(mountSelector);
    this.svgUrl = svgUrl;
    this.puppet = null;
    this.svg = null;
    this.isLoaded = false;
    this.canAnimate = false;

    // Estados
    this.isTalking = false;
    this.talkingUntil = 0;
    this.swayActive = false;
    this.armSwayActive = false;
    this.eyeMovementActive = false;
    this.tailWagActive = false;

    // Pivôs (pontos de rotação) — ombros, cabeça e cauda
    // Os braços rotacionam a partir do ombro para a mão acompanhar
    this.pivots = {
      head: { x: 493, y: 460.9 },
      leftArm: { x: 640, y: 480 },   // ombro esquerdo do Kevin (direito na tela)
      rightArm: { x: 385, y: 480 },  // ombro direito do Kevin (esquerdo na tela)
      tail: { x: 720, y: 760 },
    };

    this.elements = {
      head: null,
      leftArm: null,
      rightArm: null,
      tail: null,
      mouthShapes: {},
      eyes: {},
      blinks: {},
    };

    if (!this.mount) {
      console.error('[KevinRig] Mount element not found:', mountSelector);
    }
  }

  async load() {
    if (this.isLoaded) return;
    if (!this.mount) return;

    try {
      console.log('[KevinRig] Carregando SVG inline:', this.svgUrl);
      const response = await fetch(this.svgUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const svgText = await response.text();
      this.mount.innerHTML = svgText;
      this.svg = this.mount.querySelector('svg');
      if (!this.svg) throw new Error('SVG element not found');

      this.svg.setAttribute('width', '100%');
      this.svg.setAttribute('height', '100%');
      this.svg.style.maxWidth = '100%';
      this.svg.style.maxHeight = '100%';

      this.puppet = this.mount.querySelector('[id*="Puppet"]') || this.svg;
      this.cacheElements();
      this.canAnimate = true;
      this.isLoaded = true;

      this.setMouthShape('neutral');
      this.startBlinkLoop();
      this.startIdleEyeMovement(); // olhos vivos quando ocioso

      console.log('[KevinRig] ✓ SVG carregado, animações ativas');
    } catch (error) {
      console.warn('[KevinRig] Inline falhou, fallback <object>:', error.message);
      await this.loadAsObject();
    }
  }

  async loadAsObject() {
    try {
      const obj = document.createElement('object');
      obj.data = this.svgUrl;
      obj.type = 'image/svg+xml';
      obj.style.width = '100%';
      obj.style.height = '100%';
      this.mount.innerHTML = '';
      this.mount.appendChild(obj);

      await new Promise((resolve) => {
        obj.addEventListener('load', resolve);
        setTimeout(resolve, 2000);
      });

      const innerDoc = obj.contentDocument;
      if (innerDoc) {
        this.svg = innerDoc.documentElement;
        this.puppet = innerDoc.querySelector('[id*="Puppet"]') || this.svg;
        this.cacheElements();
        this.canAnimate = !!this.elements.mouthShapes.neutral;
      }
      this.isLoaded = true;
      if (this.canAnimate) {
        this.setMouthShape('neutral');
        this.startBlinkLoop();
        this.startIdleEyeMovement();
        console.log('[KevinRig] ✓ <object> carregado, animações ativas');
      }
    } catch (err) {
      console.error('[KevinRig] Fallback erro:', err);
      this.loadAsImage();
    }
  }

  loadAsImage() {
    const img = document.createElement('img');
    img.src = this.svgUrl;
    img.alt = 'Kevin';
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'contain';
    this.mount.innerHTML = '';
    this.mount.appendChild(img);
    this.isLoaded = true;
    console.log('[KevinRig] ✓ <img> (sem animação)');
  }

  cacheElements() {
    const get = (id) => this.puppet?.querySelector(`[id="${id}"]`);

    this.elements.mouthShapes = {
      neutral: get('Neutral'),
      m: get('M'),
      aa: get('Aa'),
      oh: get('Oh'),
      uh: get('Uh'),
      f: get('F'),
      l: get('L'),
      s: get('S'),
      r: get('R'),
      d: get('D'),
      wOo: get('w-Oo'),
      surprised: get('Surprised'),
    };

    this.elements.eyes = {
      leftPupil: get('_x2B_Left_Pupil2'),
      rightPupil: get('_x2B_Right_Pupil2'),
    };

    this.elements.blinks = {
      leftBlink: get('Left_Blink'),
      rightBlink: get('Right_Blink'),
    };

    this.elements.head = get('Head');
    // Usar o grupo PAI (_x2B_*_Arm) que contém braço + mão juntos
    this.elements.leftArm = get('_x2B_Left_Arm') || get('Left_Arm');
    this.elements.rightArm = get('_x2B_Right_Arm') || get('Right_Arm');
    this.elements.tail = get('Tail');

    const mouthFound = Object.values(this.elements.mouthShapes).filter(Boolean).length;
    console.log(
      `[KevinRig] Elementos: boca ${mouthFound}/12, ` +
      `olhos ${this.elements.eyes.leftPupil ? '✓' : '✗'}, ` +
      `braços ${this.elements.leftArm ? '✓' : '✗'}, ` +
      `cauda ${this.elements.tail ? '✓' : '✗'}`
    );
  }

  // ──── Boca ────
  setMouthShape(shapeKey) {
    if (!this.canAnimate) return;
    Object.values(this.elements.mouthShapes).forEach((el) => {
      if (el) el.style.display = 'none';
    });
    const shape = this.elements.mouthShapes[shapeKey];
    if (shape) shape.style.display = '';
  }

  /** Boca alterna entre vogais e neutra durante a fala */
  animateTalkingSequence(durationMs = 3000) {
    if (!this.canAnimate) return;
    const openShapes = ['aa', 'oh', 'aa', 'uh', 'oh', 'aa', 'wOo'];
    let frameIdx = 0;
    const startTime = performance.now();
    this.isTalking = true;
    this.talkingUntil = startTime + durationMs;

    const tick = () => {
      const now = performance.now();
      if (now >= this.talkingUntil || !this.isTalking) {
        this.setMouthShape('neutral');
        this.isTalking = false;
        return;
      }
      const cycleMs = 170;
      const phase = Math.floor((now - startTime) / cycleMs) % 2;
      if (phase === 0) {
        this.setMouthShape(openShapes[frameIdx % openShapes.length]);
        frameIdx++;
      } else {
        this.setMouthShape('neutral');
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // ──── Piscar ────
  blink() {
    if (!this.canAnimate) return;
    const { leftBlink, rightBlink } = this.elements.blinks;
    if (leftBlink) leftBlink.style.display = '';
    if (rightBlink) rightBlink.style.display = '';
    setTimeout(() => {
      if (leftBlink) leftBlink.style.display = 'none';
      if (rightBlink) rightBlink.style.display = 'none';
    }, 140);
  }

  startBlinkLoop() {
    const schedule = () => {
      const delay = 3000 + Math.random() * 3000;
      setTimeout(() => {
        this.blink();
        schedule();
      }, delay);
    };
    schedule();
  }

  // ──── Olhos (pupilas se movem) ────
  movePupils(dx, dy) {
    if (!this.canAnimate) return;
    const { leftPupil, rightPupil } = this.elements.eyes;
    const tx = Math.max(-6, Math.min(6, dx));
    const ty = Math.max(-4, Math.min(4, dy));
    const transform = `translate(${tx.toFixed(1)} ${ty.toFixed(1)})`;
    if (leftPupil) leftPupil.setAttribute('transform', transform);
    if (rightPupil) rightPupil.setAttribute('transform', transform);
  }

  /** Olhos vivos: pupilas vagam suavemente quando ocioso */
  startIdleEyeMovement() {
    if (this.eyeMovementActive) return;
    this.eyeMovementActive = true;

    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    const pickNewTarget = () => {
      targetX = (Math.random() - 0.5) * 8;
      targetY = (Math.random() - 0.5) * 4;
    };

    pickNewTarget();
    setInterval(pickNewTarget, 2500 + Math.random() * 1500);

    const tick = () => {
      if (!this.eyeMovementActive) return;
      // Interpolação suave (LERP)
      currentX += (targetX - currentX) * 0.04;
      currentY += (targetY - currentY) * 0.04;
      this.movePupils(currentX, currentY);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // ──── Sway corporal (container inteiro se move) ────
  startSway(durationMs = 3000, amplitude = 14) {
    if (this.swayActive) return;
    this.swayActive = true;
    const startTime = performance.now();
    this.mount.style.transition = 'transform 0.3s ease-out';

    const tick = () => {
      const elapsed = performance.now() - startTime;
      if (elapsed >= durationMs) {
        this.mount.style.transform = '';
        this.swayActive = false;
        return;
      }
      // Senoidal suave, período 1.8s — sensação de andar/balançar
      const x = Math.sin((elapsed / 1800) * Math.PI * 2) * amplitude;
      this.mount.style.transform = `translateX(${x.toFixed(2)}px)`;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  stopSway() {
    this.swayActive = false;
    this.mount.style.transform = '';
  }

  // ──── Cabeça ────
  rotateHead(degrees) {
    if (!this.canAnimate || !this.elements.head) return;
    const { x, y } = this.pivots.head;
    this.elements.head.setAttribute('transform', `rotate(${degrees.toFixed(1)} ${x} ${y})`);
  }

  // ──── Braços ────
  rotateArm(side, degrees) {
    if (!this.canAnimate) return;
    const arm = side === 'left' ? this.elements.leftArm : this.elements.rightArm;
    const pivot = side === 'left' ? this.pivots.leftArm : this.pivots.rightArm;
    if (!arm) return;
    arm.setAttribute('transform', `rotate(${degrees.toFixed(1)} ${pivot.x} ${pivot.y})`);
  }

  /** Braços (com mãos) gesticulam alternados durante a fala */
  startArmGestures(durationMs = 3000) {
    if (this.armSwayActive) return;
    this.armSwayActive = true;
    const startTime = performance.now();

    const tick = () => {
      const elapsed = performance.now() - startTime;
      if (elapsed >= durationMs) {
        this.rotateArm('left', 0);
        this.rotateArm('right', 0);
        this.armSwayActive = false;
        return;
      }
      // Braços oscilam em fases opostas, mais amplo agora (mãos visíveis)
      const t = elapsed / 1400; // mais lento, mais natural
      const leftDeg = Math.sin(t * Math.PI * 2) * 18;
      const rightDeg = -Math.sin(t * Math.PI * 2) * 18;
      this.rotateArm('left', leftDeg);
      this.rotateArm('right', rightDeg);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /** Aceno animado da mão direita (saudação) */
  async waveHand() {
    if (!this.canAnimate) return;
    const arm = this.elements.rightArm;
    if (!arm) return;

    const wave = (deg, duration) => new Promise((resolve) => {
      const start = performance.now();
      const startDeg = this.currentArmDeg || 0;
      const animate = (time) => {
        const p = Math.min((time - start) / duration, 1);
        const eased = p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p;
        const current = startDeg + (deg - startDeg) * eased;
        this.rotateArm('right', current);
        this.currentArmDeg = current;
        if (p < 1) requestAnimationFrame(animate);
        else resolve();
      };
      requestAnimationFrame(animate);
    });

    await wave(-45, 350);
    await wave(-20, 200);
    await wave(-45, 200);
    await wave(-20, 200);
    await wave(-45, 200);
    await wave(0, 350);
    this.currentArmDeg = 0;
  }

  // ──── Cauda ────
  startTailWag(durationMs = 3000) {
    if (!this.canAnimate || !this.elements.tail || this.tailWagActive) return;
    this.tailWagActive = true;
    const startTime = performance.now();
    const { x, y } = this.pivots.tail;

    const tick = () => {
      const elapsed = performance.now() - startTime;
      if (elapsed >= durationMs) {
        this.elements.tail.setAttribute('transform', '');
        this.tailWagActive = false;
        return;
      }
      const deg = Math.sin((elapsed / 600) * Math.PI * 2) * 5;
      this.elements.tail.setAttribute('transform', `rotate(${deg.toFixed(1)} ${x} ${y})`);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  reset() {
    this.setMouthShape('neutral');
    this.rotateHead(0);
    this.rotateArm('left', 0);
    this.rotateArm('right', 0);
    this.stopSway();
    this.isTalking = false;
    this.armSwayActive = false;
    this.tailWagActive = false;
  }
}

if (typeof window !== 'undefined') {
  window.KevinRig = KevinRig;
}
