/*!
 * Kevin Widget — Mascote animado para plataforma de inglês
 * Uso: Kevin.init({ size, position }) + Kevin.show('happy')
 * Expressões: happy | surprised | thinking | laughing | talking
 */
(function () {
  'use strict';

  /* ── Paleta ── */
  const SKIN  = '#FDDBB4';
  const HAIR  = '#5C3317';
  const LINE  = '#2C1A0E';
  const CHEEK = '#F4A0A0';
  const WHITE = '#FFFFFF';

  /* ── Desenho SVG de cada expressão ── */
  function baseFace(S, extras) {
    const cx = S / 2, cy = S * 0.52;
    return `
      <path d="M${cx-S*.3},${cy-S*.3} Q${cx},${cy-S*.55} ${cx+S*.3},${cy-S*.3}
               Q${cx+S*.38},${cy-S*.15} ${cx+S*.35},${cy-S*.05}
               Q${cx},${cy-S*.45} ${cx-S*.35},${cy-S*.05}
               Q${cx-S*.38},${cy-S*.15} ${cx-S*.3},${cy-S*.3}Z"
            fill="${HAIR}"/>
      <ellipse cx="${cx}" cy="${cy}" rx="${S*.34}" ry="${S*.36}"
               fill="${SKIN}" stroke="${LINE}" stroke-width="${S*.022}"/>
      <ellipse cx="${cx-S*.34}" cy="${cy+S*.02}" rx="${S*.055}" ry="${S*.07}"
               fill="${SKIN}" stroke="${LINE}" stroke-width="${S*.02}"/>
      <ellipse cx="${cx+S*.34}" cy="${cy+S*.02}" rx="${S*.055}" ry="${S*.07}"
               fill="${SKIN}" stroke="${LINE}" stroke-width="${S*.02}"/>
      ${extras(cx, cy, S)}
    `;
  }

  const expressions = {

    happy: {
      label: 'Feliz',
      animClass: 'kv-bounce',
      svg(S) {
        return baseFace(S, (cx, cy) => `
          <ellipse cx="${cx-S*.18}" cy="${cy+S*.1}" rx="${S*.09}" ry="${S*.055}" fill="${CHEEK}" opacity=".55"/>
          <ellipse cx="${cx+S*.18}" cy="${cy+S*.1}" rx="${S*.09}" ry="${S*.055}" fill="${CHEEK}" opacity=".55"/>
          <ellipse cx="${cx-S*.13}" cy="${cy-S*.06}" rx="${S*.07}" ry="${S*.077}" fill="${WHITE}" stroke="${LINE}" stroke-width="${S*.022}"/>
          <ellipse cx="${cx+S*.13}" cy="${cy-S*.06}" rx="${S*.07}" ry="${S*.077}" fill="${WHITE}" stroke="${LINE}" stroke-width="${S*.022}"/>
          <circle cx="${cx-S*.13}" cy="${cy-S*.055}" r="${S*.042}" fill="${LINE}"/>
          <circle cx="${cx+S*.13}" cy="${cy-S*.055}" r="${S*.042}" fill="${LINE}"/>
          <circle cx="${cx-S*.115}" cy="${cy-S*.075}" r="${S*.016}" fill="${WHITE}"/>
          <circle cx="${cx+S*.115}" cy="${cy-S*.075}" r="${S*.016}" fill="${WHITE}"/>
          <path d="M${cx-S*.17},${cy+S*.1} Q${cx},${cy+S*.28} ${cx+S*.17},${cy+S*.1}"
                stroke="${LINE}" stroke-width="${S*.028}" fill="none" stroke-linecap="round"/>
          <path d="M${cx-S*.13},${cy+S*.12} Q${cx},${cy+S*.26} ${cx+S*.13},${cy+S*.12}" fill="${WHITE}"/>
        `);
      }
    },

    surprised: {
      label: 'Surpreso',
      animClass: 'kv-shake',
      svg(S) {
        return baseFace(S, (cx, cy) => `
          <ellipse cx="${cx-S*.19}" cy="${cy+S*.08}" rx="${S*.075}" ry="${S*.048}" fill="${CHEEK}" opacity=".4"/>
          <ellipse cx="${cx+S*.19}" cy="${cy+S*.08}" rx="${S*.075}" ry="${S*.048}" fill="${CHEEK}" opacity=".4"/>
          <path d="M${cx-S*.2},${cy-S*.19} Q${cx-S*.13},${cy-S*.27} ${cx-S*.06},${cy-S*.2}"
                stroke="${LINE}" stroke-width="${S*.025}" fill="none" stroke-linecap="round"/>
          <path d="M${cx+S*.06},${cy-S*.2} Q${cx+S*.13},${cy-S*.27} ${cx+S*.2},${cy-S*.19}"
                stroke="${LINE}" stroke-width="${S*.025}" fill="none" stroke-linecap="round"/>
          <ellipse cx="${cx-S*.13}" cy="${cy-S*.055}" rx="${S*.082}" ry="${S*.09}" fill="${WHITE}" stroke="${LINE}" stroke-width="${S*.022}"/>
          <ellipse cx="${cx+S*.13}" cy="${cy-S*.055}" rx="${S*.082}" ry="${S*.09}" fill="${WHITE}" stroke="${LINE}" stroke-width="${S*.022}"/>
          <circle cx="${cx-S*.13}" cy="${cy-S*.05}" r="${S*.048}" fill="${LINE}"/>
          <circle cx="${cx+S*.13}" cy="${cy-S*.05}" r="${S*.048}" fill="${LINE}"/>
          <circle cx="${cx-S*.11}" cy="${cy-S*.075}" r="${S*.018}" fill="${WHITE}"/>
          <circle cx="${cx+S*.11}" cy="${cy-S*.075}" r="${S*.018}" fill="${WHITE}"/>
          <ellipse cx="${cx}" cy="${cy+S*.18}" rx="${S*.09}" ry="${S*.1}" fill="${LINE}"/>
          <ellipse cx="${cx}" cy="${cy+S*.185}" rx="${S*.065}" ry="${S*.073}" fill="#D44"/>
        `);
      }
    },

    thinking: {
      label: 'Pensativo',
      animClass: 'kv-sway',
      svg(S) {
        return baseFace(S, (cx, cy) => `
          <ellipse cx="${cx-S*.19}" cy="${cy+S*.1}" rx="${S*.08}" ry="${S*.05}" fill="${CHEEK}" opacity=".45"/>
          <ellipse cx="${cx+S*.19}" cy="${cy+S*.1}" rx="${S*.08}" ry="${S*.05}" fill="${CHEEK}" opacity=".45"/>
          <path d="M${cx-S*.2},${cy-S*.21} Q${cx-S*.13},${cy-S*.28} ${cx-S*.06},${cy-S*.22}"
                stroke="${LINE}" stroke-width="${S*.028}" fill="none" stroke-linecap="round"/>
          <path d="M${cx+S*.06},${cy-S*.17} Q${cx+S*.13},${cy-S*.2} ${cx+S*.2},${cy-S*.17}"
                stroke="${LINE}" stroke-width="${S*.022}" fill="none" stroke-linecap="round"/>
          <ellipse cx="${cx-S*.13}" cy="${cy-S*.055}" rx="${S*.07}" ry="${S*.077}" fill="${WHITE}" stroke="${LINE}" stroke-width="${S*.022}"/>
          <ellipse cx="${cx+S*.13}" cy="${cy-S*.055}" rx="${S*.07}" ry="${S*.077}" fill="${WHITE}" stroke="${LINE}" stroke-width="${S*.022}"/>
          <circle cx="${cx-S*.1}"  cy="${cy-S*.04}" r="${S*.042}" fill="${LINE}"/>
          <circle cx="${cx+S*.16}" cy="${cy-S*.04}" r="${S*.042}" fill="${LINE}"/>
          <circle cx="${cx-S*.086}" cy="${cy-S*.06}" r="${S*.015}" fill="${WHITE}"/>
          <circle cx="${cx+S*.174}" cy="${cy-S*.06}" r="${S*.015}" fill="${WHITE}"/>
          <path d="M${cx-S*.08},${cy+S*.13} Q${cx+S*.06},${cy+S*.2} ${cx+S*.18},${cy+S*.13}"
                stroke="${LINE}" stroke-width="${S*.026}" fill="none" stroke-linecap="round"/>
          <circle cx="${cx+S*.32}" cy="${cy-S*.26}" r="${S*.025}" fill="none" stroke="#7B9FD4" stroke-width="${S*.018}"/>
          <circle cx="${cx+S*.37}" cy="${cy-S*.36}" r="${S*.035}" fill="none" stroke="#7B9FD4" stroke-width="${S*.018}"/>
          <circle cx="${cx+S*.41}" cy="${cy-S*.47}" r="${S*.045}" fill="none" stroke="#7B9FD4" stroke-width="${S*.018}"/>
        `);
      }
    },

    laughing: {
      label: 'Rindo',
      animClass: 'kv-laughing',
      svg(S) {
        return baseFace(S, (cx, cy) => `
          <ellipse cx="${cx-S*.19}" cy="${cy+S*.1}" rx="${S*.1}" ry="${S*.07}" fill="${CHEEK}" opacity=".7"/>
          <ellipse cx="${cx+S*.19}" cy="${cy+S*.1}" rx="${S*.1}" ry="${S*.07}" fill="${CHEEK}" opacity=".7"/>
          <path d="M${cx-S*.2},${cy-S*.065} Q${cx-S*.13},${cy-S*.14} ${cx-S*.06},${cy-S*.065}"
                stroke="${LINE}" stroke-width="${S*.035}" fill="none" stroke-linecap="round"/>
          <path d="M${cx+S*.06},${cy-S*.065} Q${cx+S*.13},${cy-S*.14} ${cx+S*.2},${cy-S*.065}"
                stroke="${LINE}" stroke-width="${S*.035}" fill="none" stroke-linecap="round"/>
          <path d="M${cx-S*.2},${cy+S*.08} Q${cx},${cy+S*.33} ${cx+S*.2},${cy+S*.08}"
                stroke="${LINE}" stroke-width="${S*.028}" fill="none" stroke-linecap="round"/>
          <path d="M${cx-S*.16},${cy+S*.1} Q${cx},${cy+S*.31} ${cx+S*.16},${cy+S*.1}" fill="${WHITE}"/>
          <ellipse cx="${cx}" cy="${cy+S*.22}" rx="${S*.1}" ry="${S*.07}" fill="#D44"/>
          <line x1="${cx}" y1="${cy+S*.1}" x2="${cx}" y2="${cy+S*.175}" stroke="${LINE}" stroke-width="${S*.022}"/>
          <path d="M${cx-S*.38},${cy-S*.28} l${S*.04},0 m-${S*.02},-${S*.04} l0,${S*.04}"
                stroke="#FFD700" stroke-width="${S*.025}" stroke-linecap="round"/>
          <path d="M${cx+S*.36},${cy-S*.32} l${S*.04},0 m-${S*.02},-${S*.04} l0,${S*.04}"
                stroke="#FFD700" stroke-width="${S*.025}" stroke-linecap="round"/>
        `);
      }
    },

    talking: {
      label: 'Falando',
      animClass: 'kv-talking-body',
      svg(S, mouthOpen) {
        /* mouthOpen: 0.0 (leve sorriso) → 1.0 (boca aberta) */
        const cx = S / 2, cy = S * 0.52;
        const mo  = mouthOpen === undefined ? 0 : mouthOpen;
        const mh  = S * 0.04 + mo * S * 0.09;   /* altura da boca */
        const mw  = S * 0.17;
        const mcy = cy + S * 0.14;
        return baseFace(S, () => `
          <ellipse cx="${cx-S*.18}" cy="${cy+S*.1}" rx="${S*.085}" ry="${S*.052}" fill="${CHEEK}" opacity=".5"/>
          <ellipse cx="${cx+S*.18}" cy="${cy+S*.1}" rx="${S*.085}" ry="${S*.052}" fill="${CHEEK}" opacity=".5"/>
          <ellipse cx="${cx-S*.13}" cy="${cy-S*.06}" rx="${S*.07}" ry="${S*.077}" fill="${WHITE}" stroke="${LINE}" stroke-width="${S*.022}"/>
          <ellipse cx="${cx+S*.13}" cy="${cy-S*.06}" rx="${S*.07}" ry="${S*.077}" fill="${WHITE}" stroke="${LINE}" stroke-width="${S*.022}"/>
          <circle cx="${cx-S*.13}" cy="${cy-S*.055}" r="${S*.042}" fill="${LINE}"/>
          <circle cx="${cx+S*.13}" cy="${cy-S*.055}" r="${S*.042}" fill="${LINE}"/>
          <circle cx="${cx-S*.115}" cy="${cy-S*.075}" r="${S*.016}" fill="${WHITE}"/>
          <circle cx="${cx+S*.115}" cy="${cy-S*.075}" r="${S*.016}" fill="${WHITE}"/>
          <ellipse id="kv-mouth" cx="${cx}" cy="${mcy}" rx="${mw}" ry="${mh}"
                   fill="${LINE}" stroke="${LINE}" stroke-width="${S*.01}"/>
          <ellipse cx="${cx}" cy="${mcy + mh * 0.1}" rx="${mw * 0.82}" ry="${mh * 0.72}" fill="#cc3333"/>
          <ellipse cx="${cx}" cy="${mcy + mh * 0.55}" rx="${mw * 0.72}" ry="${mh * 0.42}" fill="#f08080"/>
        `);
      }
    }

  };

  /* ── CSS de animações injetado uma vez ── */
  const CSS = `
    #kevin-widget-root {
      position: fixed;
      z-index: 99999;
      display: flex;
      flex-direction: column;
      align-items: center;
      pointer-events: none;
      transition: bottom .3s, right .3s, left .3s;
    }
    #kevin-widget-root svg { display: block; overflow: visible; }
    .kv-wrap { transform-origin: center bottom; }

    @keyframes kv-bounce {
      0%,100% { transform: translateY(0) rotate(0deg); }
      25%      { transform: translateY(-6px) rotate(-2deg); }
      75%      { transform: translateY(-4px) rotate(2deg); }
    }
    @keyframes kv-shake {
      0%,100% { transform: translateX(0); }
      20%     { transform: translateX(-4px); }
      40%     { transform: translateX(4px); }
      60%     { transform: translateX(-3px); }
      80%     { transform: translateX(3px); }
    }
    @keyframes kv-sway {
      0%,100% { transform: rotate(0deg); }
      50%     { transform: rotate(-3deg); }
    }
    @keyframes kv-laughing {
      0%,100% { transform: translateY(0) scaleX(1); }
      30%     { transform: translateY(-7px) scaleX(1.04); }
      60%     { transform: translateY(-3px) scaleX(0.97); }
    }
    @keyframes kv-talking-body {
      0%,100% { transform: translateY(0); }
      50%     { transform: translateY(-2px); }
    }
    @keyframes kv-blink {
      0%,90%,100% { transform: scaleY(1); }
      95%         { transform: scaleY(0.08); }
    }
  `;

  /* ── Estado interno ── */
  let cfg = { size: 120, position: 'bottom-right' };
  let rootEl = null;
  let wrapEl = null;
  let currentKey = 'happy';
  let blinkTimer  = null;
  let talkTimer   = null;
  let talkPhase   = 0;
  let talkRunning = false;

  /* ── Monta o DOM ── */
  function mount() {
    if (document.getElementById('kevin-widget-root')) return;

    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    rootEl = document.createElement('div');
    rootEl.id = 'kevin-widget-root';
    applyPosition();

    wrapEl = document.createElement('div');
    wrapEl.className = 'kv-wrap';
    rootEl.appendChild(wrapEl);

    document.body.appendChild(rootEl);
  }

  function applyPosition() {
    if (!rootEl) return;
    const S = cfg.size;
    rootEl.style.bottom = (S * 0.1) + 'px';
    rootEl.style.right  = cfg.position === 'bottom-left' ? 'auto' : (S * 0.15) + 'px';
    rootEl.style.left   = cfg.position === 'bottom-left' ? (S * 0.15) + 'px' : 'auto';
  }

  /* ── Renderiza SVG de uma expressão ── */
  function renderSVG(key, mouthOpen) {
    const S   = cfg.size;
    const exp = expressions[key];
    if (!exp) return;
    const inner = key === 'talking'
      ? exp.svg(S, mouthOpen === undefined ? 0 : mouthOpen)
      : exp.svg(S);
    return `<svg xmlns="http://www.w3.org/2000/svg"
                 viewBox="0 0 ${S} ${S}" width="${S}" height="${S}"
                 overflow="visible">${inner}</svg>`;
  }

  /* ── Blink automático ── */
  function startBlink() {
    clearInterval(blinkTimer);
    blinkTimer = setInterval(() => {
      if (currentKey === 'talking') return;
      const eyes = wrapEl.querySelectorAll('ellipse[ry]');
      /* aplica scale nos dois olhos brancos (os maiores) */
      eyes.forEach(el => {
        const ry = parseFloat(el.getAttribute('ry'));
        const rx = parseFloat(el.getAttribute('rx'));
        if (ry > rx * 0.85 && ry < rx * 1.3 && el.getAttribute('fill') === '#FFFFFF') {
          el.style.transition = 'transform 60ms';
          el.style.transformBox = 'fill-box';
          el.style.transformOrigin = 'center';
          el.style.transform = 'scaleY(0.08)';
          setTimeout(() => { el.style.transform = 'scaleY(1)'; }, 100);
        }
      });
    }, 3500 + Math.random() * 1500);
  }

  /* ── Animação de fala (boca abrindo/fechando) ── */
  function startTalking() {
    talkRunning = true;
    talkPhase   = 0;
    const S = cfg.size;

    function step() {
      if (!talkRunning) return;
      talkPhase += 0.22;
      const open = Math.abs(Math.sin(talkPhase)) * 0.9 + 0.05;
      wrapEl.innerHTML = renderSVG('talking', open);
      talkTimer = requestAnimationFrame(step);
    }
    talkTimer = requestAnimationFrame(step);
  }

  function stopTalking() {
    talkRunning = false;
    cancelAnimationFrame(talkTimer);
  }

  /* ── API pública ── */
  const Kevin = {

    /**
     * Inicializa o widget (opcional — defaults: size 120, bottom-right)
     * @param {Object} options  { size: Number, position: 'bottom-right'|'bottom-left' }
     */
    init(options = {}) {
      cfg = Object.assign(cfg, options);
      mount();
      applyPosition();
      Kevin.show(currentKey);
    },

    /**
     * Troca a expressão do Kevin
     * @param {'happy'|'surprised'|'thinking'|'laughing'|'talking'} expr
     */
    show(expr) {
      if (!expressions[expr]) {
        console.warn('[Kevin] Expressão desconhecida:', expr);
        return;
      }
      if (!rootEl) mount();

      stopTalking();
      currentKey = expr;

      if (expr === 'talking') {
        /* corpo balança suavemente enquanto fala */
        wrapEl.style.animation = `kv-talking-body 0.6s ease-in-out infinite`;
        startTalking();
      } else {
        const exp = expressions[expr];
        wrapEl.innerHTML = renderSVG(expr);
        wrapEl.style.animation = 'none';
        void wrapEl.offsetWidth;                    /* força reflow */
        wrapEl.style.animation = exp.animClass === 'kv-shake'
          ? `${exp.animClass} 0.55s ease-in-out 1`
          : `${exp.animClass} ${
              exp.animClass === 'kv-bounce'   ? '1.2s' :
              exp.animClass === 'kv-laughing' ? '0.7s' : '2s'
            } ease-in-out infinite`;
      }

      startBlink();
    },

    /**
     * Para a animação de fala e volta para uma expressão
     * @param {'happy'|'thinking'} expr
     */
    stopTalking(returnTo = 'happy') {
      Kevin.show(returnTo);
    },

    /** Remove o widget da tela */
    hide() {
      stopTalking();
      clearInterval(blinkTimer);
      if (rootEl) rootEl.style.display = 'none';
    },

    /** Mostra o widget novamente */
    unhide() {
      if (rootEl) rootEl.style.display = 'flex';
    }
  };

  /* ── Auto-init desabilitado — o app.js controla quando Kevin aparece ── */
  /* Injeta o CSS de animacoes para uso inline */
  function injectCSS() {
    if (document.getElementById('kevin-widget-css')) return;
    const style = document.createElement('style');
    style.id = 'kevin-widget-css';
    style.textContent = CSS;
    document.head.appendChild(style);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectCSS);
  } else {
    injectCSS();
  }

  /* Expõe globalmente */
  window.Kevin = Kevin;

  /* Expõe as expressões para uso inline pelo app.js */
  window._kevinExpressions = expressions;

})();
