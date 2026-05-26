/**
 * KevinRig — Carrega e controla o modelo SVG rigged do Kevin
 * Expõe métodos para animar boca, piscadas, movimento de cabeça
 */
class KevinRig {
  constructor(mountSelector, svgUrl) {
    this.mount = document.querySelector(mountSelector);
    this.svgUrl = svgUrl;
    this.puppet = null;
    this.svg = null;
    this.isLoaded = false;

    // Estados de animação
    this.isBlinking = false;
    this.nextBlinkAt = 0;
    this.blinkUntil = 0;
    this.isTalking = false;
    this.talkingUntil = 0;

    // IDs dos elementos SVG para pose frontal (padrão do chat)
    this.elements = {
      head: null,
      mouthShapes: {
        neutral: null,
        m: null,
        aa: null,
        oh: null,
        uh: null,
        f: null,
        l: null,
        s: null,
        r: null,
        d: null,
        wOo: null,
        surprised: null,
      },
      eyes: {
        leftEyeball: null,
        rightEyeball: null,
        leftPupil: null,
        rightPupil: null,
      },
      blinks: {
        leftBlink: null,
        rightBlink: null,
      },
    };
  }

  async load() {
    if (this.isLoaded) return;
    try {
      const response = await fetch(this.svgUrl);
      const svgText = await response.text();
      this.mount.innerHTML = svgText;
      this.svg = this.mount.querySelector('svg');
      this.puppet = this.mount.querySelector('[id*="Puppet"]') || this.svg;

      // Cache dos elementos SVG (pose frontal)
      this.cacheElements();
      this.isLoaded = true;

      // Inicia loop de animação
      this.startAnimationLoop();
    } catch (error) {
      console.error('[KevinRig] Erro ao carregar SVG:', error);
    }
  }

  cacheElements() {
    // Boca (pose frontal)
    this.elements.mouthShapes = {
      neutral: this.getElementBy('Neutral'),
      m: this.getElementBy('M'),
      aa: this.getElementBy('Aa'),
      oh: this.getElementBy('Oh'),
      uh: this.getElementBy('Uh'),
      f: this.getElementBy('F'),
      l: this.getElementBy('L'),
      s: this.getElementBy('S'),
      r: this.getElementBy('R'),
      d: this.getElementBy('D'),
      wOo: this.getElementBy('w-Oo'),
      surprised: this.getElementBy('Surprised'),
    };

    // Olhos (pose frontal)
    this.elements.eyes = {
      leftEyeball: this.getElementBy('Left_Eyeball2'),
      rightEyeball: this.getElementBy('Right_Eyeball2'),
      leftPupil: this.getElementBy('_x2B_Left_Pupil2'),
      rightPupil: this.getElementBy('_x2B_Right_Pupil2'),
    };

    // Piscadas (pose frontal)
    this.elements.blinks = {
      leftBlink: this.getElementBy('Left_Blink'),
      rightBlink: this.getElementBy('Right_Blink'),
    };

    // Cabeça
    this.elements.head = this.getElementBy('Head');
  }

  getElementBy(id) {
    if (!this.puppet) return null;
    return this.puppet.querySelector(`[id="${id}"]`);
  }

  // ──── Animação de boca ────
  setMouthShape(shapeKey) {
    if (!this.isLoaded) return;

    // Esconde todas as formas
    Object.values(this.elements.mouthShapes).forEach((el) => {
      if (el) el.style.display = 'none';
    });

    // Mostra apenas a forma selecionada
    const selectedShape = this.elements.mouthShapes[shapeKey];
    if (selectedShape) {
      selectedShape.style.display = '';
    }
  }

  // Sequência de fala (boca abrindo/fechando)
  animateTalkingSequence(durationMs = 3000) {
    if (!this.isLoaded) return;

    const sequence = ['m', 'aa', 'oh', 'uh', 'f', 'l', 's', 'r', 'd', 'wOo'];
    const startTime = performance.now();
    const frameDuration = durationMs / (sequence.length * 3); // 3 ciclos

    const animate = (time) => {
      const elapsed = time - startTime;
      if (elapsed > durationMs) {
        this.setMouthShape('neutral');
        this.isTalking = false;
        return;
      }

      const frameIndex = Math.floor((elapsed / frameDuration) % sequence.length);
      this.setMouthShape(sequence[frameIndex]);

      if (this.isTalking) {
        requestAnimationFrame(animate);
      }
    };

    this.isTalking = true;
    this.talkingUntil = performance.now() + durationMs;
    requestAnimationFrame(animate);
  }

  // ──── Animação de piscada ────
  blink() {
    if (!this.isLoaded) return;

    const blinkDuration = 150; // ms

    // Fecha
    if (this.elements.blinks.leftBlink) {
      this.elements.blinks.leftBlink.style.display = '';
    }
    if (this.elements.blinks.rightBlink) {
      this.elements.blinks.rightBlink.style.display = '';
    }

    // Abre
    setTimeout(() => {
      if (this.elements.blinks.leftBlink) {
        this.elements.blinks.leftBlink.style.display = 'none';
      }
      if (this.elements.blinks.rightBlink) {
        this.elements.blinks.rightBlink.style.display = 'none';
      }
    }, blinkDuration);
  }

  // ──── Animação de cabeça ────
  rotateHead(degrees) {
    if (!this.isLoaded || !this.elements.head) return;

    const headPivot = { x: 493, y: 460.9 };
    const transform = `rotate(${degrees.toFixed(1)} ${headPivot.x} ${headPivot.y})`;
    this.elements.head.setAttribute('transform', transform);
  }

  // ──── Loop de animação (piscadas, movimentos contínuos) ────
  startAnimationLoop() {
    const loop = (time) => {
      // Piscadas aleatórias
      if (time > this.nextBlinkAt && !this.isBlinking) {
        this.isBlinking = true;
        this.blinkUntil = time + 200; // duração da piscada
        this.blink();
        this.nextBlinkAt = time + (Math.random() * 3000 + 3000); // próxima piscada em 3-6s
      }

      if (time > this.blinkUntil) {
        this.isBlinking = false;
      }

      requestAnimationFrame(loop);
    };

    this.nextBlinkAt = performance.now() + (Math.random() * 3000 + 3000);
    requestAnimationFrame(loop);
  }

  // Método para resetar Kevin ao estado neutro
  reset() {
    this.setMouthShape('neutral');
    this.rotateHead(0);
    this.isTalking = false;
  }
}
