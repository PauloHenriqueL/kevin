// Kevin Puppet - motor de animação + presets, sem UI de teste.
//
// Uso:
//   import { createKevinPuppet } from "./kevin-puppet.js";
//   const kevin = await createKevinPuppet(containerEl, {
//     svgUrl: "./kevin-rigged.svg",      // opcional, default ao lado deste arquivo
//     backgroundUrl: "./background.png", // opcional
//     onError: (msg) => console.error(msg),
//   });
//   await kevin.setMode("standby" | "thinking" | "speaking" | "sleeping" | "musica" | "celebrate" | "tchau" | "off");
//   await kevin.setAudioInput(outraFonteDeAudio); // troca o microfone por outra fonte
//   kevin.destroy();
//
// Ver README.md para detalhes de integração e arquitetura.

const MODULE_URL = import.meta.url;

function resolveAsset(path) {
  return new URL(path, MODULE_URL).href;
}

const POSE_CONFIG = [
  {
    id: "_x2B_Frontal",
    mouthIds: ["Neutral", "M", "Aa", "Oh", "Uh", "F", "L", "S", "R", "D", "w-Oo", "Surprised"],
    eyeIds: ["Left_Eyeball2", "Right_Eyeball2", "_x2B_Left_Pupil2", "_x2B_Right_Pupil2"],
    blinkIds: ["Left_Blink", "Right_Blink"],
  },
  {
    id: "_x2B_Left_Quarter",
    mouthIds: ["_x2B_Mouth"],
    eyeIds: ["Left_Eyeball", "Right_Eyeball", "_x2B_Left_Pupil", "_x2B_Right_Pupil"],
    blinkIds: [],
  },
  {
    id: "_x2B_Left_Profile",
    mouthIds: ["_x2B_Mouth1"],
    eyeIds: ["Left_Eyeball1", "Right_Eyeball1", "_x2B_Left_Pupil1", "_x2B_Right_Pupil1"],
    blinkIds: [],
  },
  {
    id: "_x2B_Right_Quarter",
    mouthIds: ["_x2B_Mouth3"],
    eyeIds: ["Left_Eyeball3", "Right_Eyeball3", "_x2B_Left_Pupil3", "_x2B_Right_Pupil3"],
    blinkIds: [],
  },
  {
    id: "_x2B_Right_Profile",
    mouthIds: ["_x2B_Mouth4"],
    eyeIds: ["Right_Eyeball4", "Left_Eyeball4", "_x2B_Right_Pupil4", "_x2B_Left_Pupil4"],
    blinkIds: [],
  },
];

const POSE_INDEX_BY_HEAD_TURN = [4, 3, 0, 1, 2];
const HEAD_TURN_BY_POSE_INDEX = { 4: -2, 3: -1, 0: 0, 1: 1, 2: 2 };

const LEFT_ARM_PIVOTS = { shoulderX: 582.9, shoulderY: 488.5, elbowX: 671.3, elbowY: 574.4, wristX: 755.2, wristY: 661.8 };
const RIGHT_ARM_PIVOTS = { shoulderX: 404.6, shoulderY: 489.9, elbowX: 316.1, elbowY: 575.8, wristX: 232.3, wristY: 663.2 };
const LEFT_LEG_PIVOTS = { hipX: 563.3, hipY: 764.8, kneeX: 575.9, kneeY: 858.4, ankleX: 576.7, ankleY: 953.8 };
const RIGHT_LEG_PIVOTS = { hipX: 425.2, hipY: 764.7, kneeX: 412.6, kneeY: 858.2, ankleX: 411.8, ankleY: 953.6 };
const BODY_PIVOTS = { hipX: 493.5, hipY: 719.6, torsoX: 493, torsoY: 603.2 };
const HEAD_PIVOT = { x: 493, y: 460.9 };

// Posição/escala "zero" do personagem sobre o fundo, ajustada manualmente no
// app de testes (sliders de Zoom/Subir-Descer/Esq-Dir zerados nesse ponto).
// Aplicada como transform fixo no SVG - esta exportação não tem sliders.
const PUPPET_BASE_ZOOM = 86;      // escala, em %
const PUPPET_BASE_OFFSET_X = 0;   // px
const PUPPET_BASE_OFFSET_Y = -46; // px (negativo = desce)

const DEFAULT_VOCABULARY_ITEMS = [
  { id: "wake-up", words: "wake up", imageSrc: "./assets/img/vocabulario/wake-up.png" },
  { id: "take-a-shower", words: "take a shower", imageSrc: "./assets/img/vocabulario/take-a-shower .png" },
  { id: "get-dressed", words: "get dressed", imageSrc: "./assets/img/vocabulario/get-dressed.png" },
  { id: "brush-my-hair", words: "brush my hair", imageSrc: "./assets/img/vocabulario/brush-my-hair.png" },
  { id: "wash-my-face", words: "wash my face", imageSrc: "./assets/img/vocabulario/wahs-my-face.png" },
  { id: "have-breakfast", words: "have breakfast", imageSrc: "./assets/img/vocabulario/have-breakfast.png" },
  { id: "make-breakfast", words: "make breakfast" },
  { id: "go-to-school", words: "go to school" },
  { id: "take-a-taxi", words: "take a taxi" },
  { id: "take-the-bus", words: "take the bus" },
  { id: "take-the-train", words: "take the train" },
  { id: "take-the-subway", words: "take the subway" },
  { id: "walk", words: "walk" },
  { id: "ride-a-bicycle", words: "ride a bicycle" },
];

const TAIL_BOB_AMPLITUDE = 6.2;
const TAIL_BOB_SPEED = 1.9;
const PUPIL_TRACK_X_RATIO = 0.16;
const PUPIL_TRACK_Y_RATIO = 0.2;
const BODY_DROP_MAX = 50;
const BODY_DROP_KNEE_OUT_MAX = 42;

const IDLE_SQUAT_AMPLITUDE = 10;
const IDLE_SQUAT_SPEED = 0.54;

// Poses de braço do Stand by / Falando. "chin" e "scratch" são exclusivas:
// nunca os dois braços fazem essas poses ao mesmo tempo (ver idleGesture).
const ARM_POSE_LEFT = {
  rest: { shoulder: 15, elbow: 31 },
  hip: { shoulder: -18, elbow: 72 },
  chin: { shoulder: -4, elbow: 148 },
  scratch: { shoulder: -55, elbowA: -100, elbowB: -130 },
};
const ARM_POSE_RIGHT = {
  rest: { shoulder: -16, elbow: -33 },
  hip: { shoulder: 18, elbow: -77 },
  chin: { shoulder: 4, elbow: -148 },
  scratch: { shoulder: 55, elbowA: 98, elbowB: 120 },
};

// Pose fixa de braços do preset "Pensando".
const THINKING_ARM_TARGET_LEFT = { shoulder: 55, elbow: 119 };
const THINKING_ARM_TARGET_RIGHT = { shoulder: -31, elbow: -88 };
const THINKING_ARM_LERP_SPEED = 0.02;
const THINKING_SQUAT_AMPLITUDE = 40;

// Pose fixa de braços do preset "Dormindo".
const SLEEP_ARM_LEFT  = { shoulder: 21,  elbow:  21 };
const SLEEP_ARM_RIGHT = { shoulder: -23, elbow: -28 };
const SLEEP_HEAD_CENTER = 29.5;  // (24+35)/2
const SLEEP_HEAD_AMP    = 5.5;   // amplitude ±5.5 → 24–35°
const SLEEP_BODY_CENTER = 15;    // (0+30)/2
const SLEEP_BODY_AMP    = 15;    // amplitude ±15 → 0–30px
const SLEEP_OSC_SPEED   = 0.55;  // rad/s → ciclo ~11s (respiração lenta)

// ── Modo Musica ───────────────────────────────────────────────────────────────
const MUSICA_M1 = { shoulder: -16, elbow: 21 };   // braço alcança; camada desce
const MUSICA_M2 = { shoulder: 3,   elbow: 121 };  // braço passa atrás; ukulele aparece ao chegar em 121°
const MUSICA_M3 = { shoulder: -31, elbow: 11 };   // pose de pegar
const MUSICA_M4_LEFT        = { shoulder: 6,  elbow: -31 }; // pose de tocar (braço esq estático)
const MUSICA_M4_LEFT_TILT   = 56;                 // inclinação mão esq em M4
const MUSICA_M4_RIGHT_SHOULDER = -14;
const MUSICA_M4_RIGHT_ELBOW_MID = (-50 + -107) / 2;  // -78.5 → centro da oscilação
const MUSICA_M4_RIGHT_ELBOW_AMP = (-107 - -50)  / 2; // 28.5  → amplitude
const MUSICA_M4_BODY_MID    = 25;                 // descer body: centro da oscilação (0-50)
const MUSICA_M4_HEAD_AMP    = 6;                  // inclinação cabeça: ±6°
const MUSICA_STRUM_FREQ     = 1.8;                // Hz: velocidade do strumming/balanço
const MUSICA_ARM_LERP       = 0.1;
const MUSICA_NOTE_SYMBOLS   = ["♪", "♬", "♪", "♩", "♬"];

// ── Modo Tchau ────────────────────────────────────────────────────────────────
const TCHAU_SHOULDER    = 55;
const TCHAU_ELBOW_MID   = (27 + 58) / 2;   // 42.5
const TCHAU_ELBOW_AMP   = (58 - 27) / 2;   // 15.5
const TCHAU_WAVE_FREQ   = 1.5;              // Hz
const TCHAU_WAVE_CYCLES = 3;

// ── Modo Celebrate ───────────────────────────────────────────────────────────
const CELEBRATE_INIT_RIGHT = { shoulder: 21,  elbow: -90 };
const CELEBRATE_INIT_LEFT  = { shoulder: -17, elbow:  90 };
const CELEBRATE_M1_RIGHT   = { shoulder: 55,  elbow: -66 };
const CELEBRATE_M1_LEFT    = { shoulder: -55, elbow:  66 };
const CELEBRATE_M1_BODY_DROP = 50;
const CELEBRATE_M2_RIGHT   = { shoulder: 55,  elbow: 64 };
const CELEBRATE_M2_LEFT    = { shoulder: -55, elbow: 66 };
const CELEBRATE_M2_LEFT_LATE = { shoulder: 14, elbow: 32 };
const CELEBRATE_JUMP_TRIGGER_BODY_DROP = 20;
const CELEBRATE_JUMP_HEIGHT = 82;
const CELEBRATE_M3_RIGHT   = { shoulder: 33,  elbow: -66 };
const CELEBRATE_M3_LEFT    = { shoulder: -33, elbow:  66 };
const CELEBRATE_LANDING_BOUNCE = 28;
const CELEBRATE_FOOT_TILT_LEFT  = 13;
const CELEBRATE_FOOT_TILT_RIGHT = -13;
const CELEBRATE_ARM_LERP  = 0.1;
const CELEBRATE_BODY_LERP = 0.08;
const CELEBRATE_JUMP_LERP = 0.16;
const CELEBRATE_CONFETTI_COLORS = ["#ffd470", "#2ef2bb", "#ff6b8a", "#6aa7ff", "#ffffff", "#ff9f43"];
const DEFAULT_CELEBRATE_AUDIO_VOLUME = 0.1;
const DEFAULT_CELEBRATE_AUDIO_PLAY_DELAY_MS = 500;

// ── Mod Teaching (aditivo: zoom de câmera + objeto "quadro-negro" deslizando) ──
// Sequência: camera-in (câmera aproxima) → object-in (quadro entra e desce até
// o repouso) → active (segura) → object-out (quadro sobe e some) →
// camera-out (câmera volta a 0) → off. Reaproveita o sistema genérico de
// Câmera e de Objetos definidos abaixo.
const DEFAULT_TEACHING_CAMERA_ZOOM = 52;
const DEFAULT_TEACHING_CAMERA_PAN_X = -82;
const DEFAULT_TEACHING_CAMERA_PAN_Y = -31;
const DEFAULT_TEACHING_OBJECT_ZOOM = 34;
const DEFAULT_TEACHING_OBJECT_OFFSET_X = 224;
const DEFAULT_TEACHING_OBJECT_ENTER_Y = -400; // posição de onde o quadro entra/sai
const DEFAULT_TEACHING_OBJECT_REST_Y = -17;   // posição de repouso, quadro no lugar
const TEACHING_OBJECT_ID = "teaching-board";
const TEACHING_LERP = 0.08;
const CAMERA_ZOOM_MAX_EXTRA = 1.2; // zoom 100 → escala 1 + 1.2 = 2.2x

// ── Mod Camuflage (aditivo, disparo único: matiz 0→360→0, desativa sozinho) ──
const CAMUFLAGE_LERP = 0.01;

const DEFAULT_BACKSOUND_MUSIC_VOLUME = 0.4;
const DEFAULT_SNORE_AUDIO_VOLUME = 0.3;

// ── Mosca ─────────────────────────────────────────────────────────────────────
const MOSCA_ORIGIN_X = 142.9; // cx do Corpo_mosca no espaço local do grupo
const MOSCA_ORIGIN_Y = 164.2;
const MOSCA_WING_IDS = ["Asas_frame", "Asas_1_frame", "Asas_2_frame"];
const MOSCA_WING_MS = 55;    // ms por frame de asa (~18 fps)
const LINGUA_LEFT_FRAME_IDS  = ["lingua_frame_1", "Lingua_frame_2", "Lingua_esticada_frame_3"];
const LINGUA_RIGHT_FRAME_IDS = ["lingua_frame_11", "Lingua_frame_21", "Lingua_esticada_frame_31"];
const LINGUA_FRAME_MS = 150; // ms por frame de língua (~6.5 fps)
// Alcance da língua a partir do centro da boca, em unidades SVG locais do grupo de perfil
const LINGUA_REACH_SVG = [0, 334, 462]; // frame 0 = recolhida, 1 = média, 2 = esticada
const LINGUA_BEAM_PERP_SVG = 55;        // tolerância perpendicular ao raio (SVG local units)
const MOSCA_SPEED = 240;     // unidades SVG por segundo
const MOSCA_BOUNDS = { minX: 60, maxX: 960, minY: 60, maxY: 1050 };
// Zonas de vagueio: lateral esquerda, lateral direita e topo — evita o centro
const MOSCA_ZONES = [
  { weight: 4, minX: 55,  maxX: 322, minY: 100, maxY: 980 },  // esquerda
  { weight: 4, minX: 711, maxX: 965, minY: 100, maxY: 980 },  // direita
  { weight: 2, minX: 100, maxX: 900, minY: 60,  maxY: 220 },  // topo
];
const MOSCA_CHAR_CENTER_X = 493; // centro horizontal do personagem no SVG
const MOSCA_EYE_LEVEL_Y   = 290; // altura dos olhos do personagem no SVG

const AUDIO_MOUTH_SILENCE = 0.035;
const AUDIO_MOUTH_TIERS = [
  { max: 0.1, shapes: ["M", "F", "L"] },
  { max: 0.25, shapes: ["Aa", "Uh", "S", "D"] },
  { max: 1, shapes: ["Oh", "Surprised", "w-Oo", "R"] },
];

// ---------------------------------------------------------------------------
// Entrada de áudio plugável. Qualquer objeto com os mesmos três métodos
// (start, stop, update) pode substituir o microfone - por exemplo, um
// analisador apontando para o <audio> da fala da IA. Troque via
// `kevin.setAudioInput(novaFonte)`.
// ---------------------------------------------------------------------------
export function createMicAudioInput() {
  return {
    enabled: false,
    level: 0,
    _stream: null,
    _ctx: null,
    _analyser: null,
    _dataArray: null,

    async start() {
      if (this.enabled) return true;
      try {
        this._stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this._ctx = new (window.AudioContext || window.webkitAudioContext)();
        const source = this._ctx.createMediaStreamSource(this._stream);
        this._analyser = this._ctx.createAnalyser();
        this._analyser.fftSize = 512;
        this._analyser.smoothingTimeConstant = 0.6;
        source.connect(this._analyser);
        this._dataArray = new Uint8Array(this._analyser.fftSize);
        this.enabled = true;
        return true;
      } catch (err) {
        console.warn("KevinPuppet: nao foi possivel acessar o microfone.", err);
        this.enabled = false;
        return false;
      }
    },

    stop() {
      if (this._stream) {
        for (const track of this._stream.getTracks()) track.stop();
      }
      if (this._ctx) this._ctx.close();
      this._stream = null;
      this._ctx = null;
      this._analyser = null;
      this._dataArray = null;
      this.enabled = false;
      this.level = 0;
    },

    // Retorna o nível de volume atual, normalizado entre 0 e ~1 (RMS).
    update() {
      if (!this.enabled || !this._analyser) return 0;
      this._analyser.getByteTimeDomainData(this._dataArray);
      let sumSquares = 0;
      for (let i = 0; i < this._dataArray.length; i++) {
        const v = (this._dataArray[i] - 128) / 128;
        sumSquares += v * v;
      }
      this.level = Math.sqrt(sumSquares / this._dataArray.length);
      return this.level;
    },
  };
}

// ---------------------------------------------------------------------------
// Funções puras de deformação de mesh (não dependem de estado de instância)
// ---------------------------------------------------------------------------

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function formatPathNum(n) {
  return Number(n.toFixed(3)).toString();
}

function formatSignedNum(n) {
  return Number(n.toFixed(3)).toString();
}

function parsePathDataToAbsolute(d) {
  const tokens = d.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?/g) || [];
  const segments = [];
  let i = 0;
  let cmd = "";
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;

  function isCmd(t) {
    return /^[a-zA-Z]$/.test(t);
  }
  function nextNum() {
    return Number(tokens[i++]);
  }

  while (i < tokens.length) {
    if (isCmd(tokens[i])) cmd = tokens[i++];
    if (!cmd) break;

    if (cmd === "M" || cmd === "m") {
      const rel = cmd === "m";
      let x = nextNum();
      let y = nextNum();
      if (rel) {
        x += cx;
        y += cy;
      }
      segments.push({ cmd: "M", pts: [x, y] });
      cx = x;
      cy = y;
      sx = x;
      sy = y;

      while (i < tokens.length && !isCmd(tokens[i])) {
        x = nextNum();
        y = nextNum();
        if (rel) {
          x += cx;
          y += cy;
        }
        segments.push({ cmd: "L", pts: [x, y] });
        cx = x;
        cy = y;
      }
      continue;
    }

    if (cmd === "L" || cmd === "l") {
      const rel = cmd === "l";
      while (i < tokens.length && !isCmd(tokens[i])) {
        let x = nextNum();
        let y = nextNum();
        if (rel) {
          x += cx;
          y += cy;
        }
        segments.push({ cmd: "L", pts: [x, y] });
        cx = x;
        cy = y;
      }
      continue;
    }

    if (cmd === "H" || cmd === "h") {
      const rel = cmd === "h";
      while (i < tokens.length && !isCmd(tokens[i])) {
        let x = nextNum();
        if (rel) x += cx;
        segments.push({ cmd: "L", pts: [x, cy] });
        cx = x;
      }
      continue;
    }

    if (cmd === "V" || cmd === "v") {
      const rel = cmd === "v";
      while (i < tokens.length && !isCmd(tokens[i])) {
        let y = nextNum();
        if (rel) y += cy;
        segments.push({ cmd: "L", pts: [cx, y] });
        cy = y;
      }
      continue;
    }

    if (cmd === "C" || cmd === "c") {
      const rel = cmd === "c";
      while (i < tokens.length && !isCmd(tokens[i])) {
        let x1 = nextNum();
        let y1 = nextNum();
        let x2 = nextNum();
        let y2 = nextNum();
        let x = nextNum();
        let y = nextNum();
        if (rel) {
          x1 += cx;
          y1 += cy;
          x2 += cx;
          y2 += cy;
          x += cx;
          y += cy;
        }
        segments.push({ cmd: "C", pts: [x1, y1, x2, y2, x, y] });
        cx = x;
        cy = y;
      }
      continue;
    }

    if (cmd === "Z" || cmd === "z") {
      segments.push({ cmd: "Z", pts: [] });
      cx = sx;
      cy = sy;
      continue;
    }

    throw new Error(`Comando de path nao suportado: ${cmd}`);
  }

  return segments;
}

function serializeAbsolutePath(segments) {
  let out = "";
  for (const seg of segments) {
    if (seg.cmd === "Z") {
      out += "Z";
      continue;
    }
    out += seg.cmd;
    for (let i = 0; i < seg.pts.length; i += 2) {
      const x = formatPathNum(seg.pts[i]);
      const y = formatPathNum(seg.pts[i + 1]);
      out += `${i === 0 ? "" : " "}${x},${y}`;
    }
  }
  return out;
}

function deformArmPoint(x, y, bendDeg, pivots) {
  const ex = pivots.elbowX;
  const ey = pivots.elbowY;
  const wx = pivots.wristX;
  const wy = pivots.wristY;
  const ux0 = pivots.wristX - ex;
  const uy0 = pivots.wristY - ey;
  const len = Math.hypot(ux0, uy0) || 1;
  const ux = ux0 / len;
  const uy = uy0 / len;
  const nx = -uy;
  const ny = ux;

  const dx = x - ex;
  const dy = y - ey;
  const t = dx * ux + dy * uy;
  const r = dx * nx + dy * ny;
  const bendAbs = Math.abs(bendDeg);
  const dist = Math.hypot(dx, dy);
  const wristDist = Math.hypot(x - wx, y - wy);

  const bellWeight = smoothstep(25, 85, bendAbs) * (1 - smoothstep(115, 145, bendAbs));
  const highBendDamp = 1 - smoothstep(100, 128, bendAbs);
  const warpStrength = bellWeight * highBendDamp;

  const elbowMask = Math.exp(-(dist * dist) / (2 * 52 * 52));
  const wristLock = Math.exp(-(wristDist * wristDist) / (2 * 26 * 26));
  const localWarp = warpStrength * elbowMask * (1 - wristLock);
  const jointWeight = elbowMask * Math.exp(-(r * r) / (2 * 36 * 36));

  const bendRad = (bendDeg * Math.PI) / 180;
  const localRot = bendRad * 0.12 * localWarp;

  const c = Math.cos(localRot);
  const s = Math.sin(localRot);
  let tx = ex + dx * c - dy * s;
  let ty = ey + dx * s + dy * c;

  const squeeze = 1 - 0.04 * jointWeight * localWarp;
  const bulge = 0.03 * jointWeight * localWarp;
  const rx = tx - ex;
  const ry = ty - ey;
  const projT = rx * ux + ry * uy;
  const side = r >= 0 ? 1 : -1;
  const projR = (rx * nx + ry * ny) * squeeze + side * bulge * 20;
  tx = ex + projT * ux + projR * nx;
  ty = ey + projT * uy + projR * ny;

  return { x: tx, y: ty };
}

function deformArmSegments(segments, bendDeg, pivots) {
  return segments.map((seg) => {
    if (seg.cmd === "Z") return { cmd: "Z", pts: [] };
    const pts = seg.pts.slice();
    for (let i = 0; i < pts.length; i += 2) {
      const p = deformArmPoint(pts[i], pts[i + 1], bendDeg, pivots);
      pts[i] = p.x;
      pts[i + 1] = p.y;
    }
    return { cmd: seg.cmd, pts };
  });
}

function deformLegPoint(x, y, bendDeg, pivots, footLockY = 0, kneeOut = 0) {
  const kx = pivots.kneeX;
  const ky = pivots.kneeY;
  const ux0 = pivots.ankleX - kx;
  const uy0 = pivots.ankleY - ky;
  const len = Math.hypot(ux0, uy0) || 1;
  const ux = ux0 / len;
  const uy = uy0 / len;
  const nx = -uy;
  const ny = ux;

  const dx = x - kx;
  const dy = y - ky;
  const t = dx * ux + dy * uy;
  const r = dx * nx + dy * ny;

  const shinWeight = smoothstep(-26, 120, t);
  const jointWeight = Math.exp(-(t * t) / (2 * 52 * 52)) * Math.exp(-(r * r) / (2 * 34 * 34));
  const bendRad = (bendDeg * Math.PI) / 180;
  const localRot = bendRad * shinWeight;

  const c = Math.cos(localRot);
  const s = Math.sin(localRot);
  let tx = kx + dx * c - dy * s;
  let ty = ky + dx * s + dy * c;

  const bendNorm = Math.min(1, Math.abs(bendDeg) / 55);
  const squeeze = 1 - 0.12 * jointWeight * bendNorm;
  const bulge = 0.07 * jointWeight * bendNorm;
  const rx = tx - kx;
  const ry = ty - ky;
  const projT = rx * ux + ry * uy;
  const side = r >= 0 ? 1 : -1;
  const projR = (rx * nx + ry * ny) * squeeze + side * bulge * 16;
  tx = kx + projT * ux + projR * nx;
  ty = ky + projT * uy + projR * ny;

  if (kneeOut) {
    const kneeOutMask = Math.exp(-((y - pivots.kneeY) * (y - pivots.kneeY)) / (2 * 58 * 58));
    tx += kneeOut * kneeOutMask;
  }

  if (footLockY) {
    const ankleLock = smoothstep(pivots.kneeY + 36, pivots.ankleY + 8, y);
    tx += (x - tx) * ankleLock;
    ty += (y + footLockY - ty) * ankleLock;
  }

  return { x: tx, y: ty };
}

function deformLegSegments(segments, bendDeg, pivots, footLockY = 0, kneeOut = 0) {
  return segments.map((seg) => {
    if (seg.cmd === "Z") return { cmd: "Z", pts: [] };
    const pts = seg.pts.slice();
    for (let i = 0; i < pts.length; i += 2) {
      const p = deformLegPoint(pts[i], pts[i + 1], bendDeg, pivots, footLockY, kneeOut);
      pts[i] = p.x;
      pts[i + 1] = p.y;
    }
    return { cmd: seg.cmd, pts };
  });
}

function deformTorsoPoint(x, y, swayDeg, pivots) {
  const hipX = pivots.hipX;
  const hipY = pivots.hipY;
  const waistY = (pivots.hipY + pivots.torsoY) * 0.5;

  const lowerWeight = smoothstep(waistY - 26, hipY + 40, y);
  const waistWeight = Math.exp(-((y - waistY) * (y - waistY)) / (2 * 64 * 64));

  const rotRad = ((swayDeg * 0.62 * lowerWeight) * Math.PI) / 180;
  const dx = x - hipX;
  const dy = y - hipY;
  const c = Math.cos(rotRad);
  const s = Math.sin(rotRad);
  let tx = hipX + dx * c - dy * s;
  let ty = hipY + dx * s + dy * c;

  tx += swayDeg * 0.58 * lowerWeight;

  const squeeze = 1 - Math.abs(swayDeg) * 0.0036 * waistWeight;
  tx = hipX + (tx - hipX) * squeeze;

  return { x: tx, y: ty };
}

function deformTorsoSegments(segments, swayDeg, pivots) {
  return segments.map((seg) => {
    if (seg.cmd === "Z") return { cmd: "Z", pts: [] };
    const pts = seg.pts.slice();
    for (let i = 0; i < pts.length; i += 2) {
      const p = deformTorsoPoint(pts[i], pts[i + 1], swayDeg, pivots);
      pts[i] = p.x;
      pts[i + 1] = p.y;
    }
    return { cmd: seg.cmd, pts };
  });
}

function getSideFromId(id) {
  if (!id) return null;
  if (/left/i.test(id)) return "left";
  if (/right/i.test(id)) return "right";
  return null;
}

// ---------------------------------------------------------------------------
// Factory principal - todo o estado abaixo é isolado por instância (sem
// variáveis globais), então é seguro criar mais de um puppet na mesma página.
// ---------------------------------------------------------------------------
export async function createKevinPuppet(container, options = {}) {
  if (!container) throw new Error("KevinPuppet: container é obrigatório.");

  const svgUrl = options.svgUrl ?? resolveAsset("./kevin-rigged.svg");
  const backgroundUrl = options.backgroundUrl ?? null;
  const transitionVideoUrl = options.transitionVideoUrl ?? resolveAsset("./assets/videos/mudanca-cenario.webm");
  const entradaVideoUrl = options.entradaVideoUrl ?? resolveAsset("./assets/videos/entrada-kevin.webm");
  const teachingBoardUrl = options.teachingBoardUrl ?? resolveAsset("./assets/obj/quadro-negro.png");
  const celebrateAudioUrl = options.celebrateAudioUrl ?? resolveAsset("./assets/audio/efeitos-sonoros/celebrate.mp3");
  const celebrateAudioVolume = options.celebrateAudioVolume ?? DEFAULT_CELEBRATE_AUDIO_VOLUME;
  const celebrateAudioPlayDelayMs = options.celebrateAudioPlayDelayMs ?? DEFAULT_CELEBRATE_AUDIO_PLAY_DELAY_MS;
  const teachingCameraZoom = options.teachingCameraZoom ?? DEFAULT_TEACHING_CAMERA_ZOOM;
  const teachingCameraPanX = options.teachingCameraPanX ?? DEFAULT_TEACHING_CAMERA_PAN_X;
  const teachingCameraPanY = options.teachingCameraPanY ?? DEFAULT_TEACHING_CAMERA_PAN_Y;
  const teachingObjectZoom = options.teachingObjectZoom ?? DEFAULT_TEACHING_OBJECT_ZOOM;
  const teachingObjectOffsetX = options.teachingObjectOffsetX ?? DEFAULT_TEACHING_OBJECT_OFFSET_X;
  const teachingObjectEnterY = options.teachingObjectEnterY ?? DEFAULT_TEACHING_OBJECT_ENTER_Y;
  const teachingObjectRestY = options.teachingObjectRestY ?? DEFAULT_TEACHING_OBJECT_REST_Y;
  const backsoundMusicUrl = options.backsoundMusicUrl ?? resolveAsset("./assets/audio/backsound/trilha-padrao.mp3");
  const backsoundMusicVolume = options.backsoundMusicVolume ?? DEFAULT_BACKSOUND_MUSIC_VOLUME;
  const snoreAudioUrl = options.snoreAudioUrl ?? resolveAsset("./assets/audio/voz-kevin/ronco-kevin.mp3");
  const snoreAudioVolume = options.snoreAudioVolume ?? DEFAULT_SNORE_AUDIO_VOLUME;
  // Sequência de abertura padrão de qualquer aula: cortina congelada no 1º
  // frame + popup com o nome da aula + botão Iniciar. Ao clicar, a cortina
  // abre e, ao terminar, o Kevin acena (tchau) e emenda pra falando sozinho.
  // Desative com autoOpening:false se a aplicação externa preferir orquestrar
  // isso na mão (chamando playEntrada()/setMode() diretamente).
  const autoOpening = options.autoOpening ?? true;
  let lessonName = options.lessonName ?? "{{nome-aula}}";
  const onError = options.onError ?? ((msg) => console.error(`KevinPuppet: ${msg}`));

  // --- DOM: cria o card (stage + mount) dentro do container fornecido ---
  const stage = document.createElement("div");
  stage.className = "kevin-stage";

  // Wrapper de câmera: leva o background + o objeto genérico + o puppet, e
  // recebe o transform de zoom/pan do mod Teaching. `stage` continua sendo só
  // o frame fixo que corta (overflow:hidden) - ver applyCameraTransform().
  const stageCamera = document.createElement("div");
  stageCamera.className = "kevin-stage-camera";
  if (backgroundUrl) stageCamera.style.backgroundImage = `url("${backgroundUrl}")`;
  stage.appendChild(stageCamera);

  // Camada de objeto genérica (props posicionáveis). O Teaching a usa pra
  // mostrar o quadro-negro, mas o mecanismo (setActiveObjectId/setObjectPosition)
  // não é específico do Teaching - só um objeto fica visível por vez.
  const objectLayer = document.createElement("img");
  objectLayer.className = "kevin-object-layer";
  objectLayer.alt = "";
  stageCamera.appendChild(objectLayer);

  const vocabularyBoard = document.createElement("div");
  vocabularyBoard.className = "kevin-vocabulary-board";
  vocabularyBoard.setAttribute("aria-live", "polite");

  const vocabularyWords = document.createElement("div");
  vocabularyWords.className = "kevin-vocabulary-words";
  vocabularyBoard.appendChild(vocabularyWords);

  const vocabularyImage = document.createElement("img");
  vocabularyImage.className = "kevin-vocabulary-image";
  vocabularyImage.alt = "";
  vocabularyBoard.appendChild(vocabularyImage);
  stageCamera.appendChild(vocabularyBoard);

  const mount = document.createElement("div");
  mount.className = "kevin-puppet-mount";
  mount.setAttribute("aria-label", "Kevin animado");
  stageCamera.appendChild(mount);

  const celebrateAudio = document.createElement("audio");
  celebrateAudio.preload = "auto";
  celebrateAudio.src = celebrateAudioUrl;
  celebrateAudio.volume = celebrateAudioVolume;
  stage.appendChild(celebrateAudio);

  const backsoundMusicAudio = document.createElement("audio");
  backsoundMusicAudio.loop = true;
  backsoundMusicAudio.preload = "auto";
  backsoundMusicAudio.src = backsoundMusicUrl;
  backsoundMusicAudio.volume = backsoundMusicVolume;
  stage.appendChild(backsoundMusicAudio);

  const snoreAudio = document.createElement("audio");
  snoreAudio.loop = true;
  snoreAudio.preload = "auto";
  snoreAudio.src = snoreAudioUrl;
  snoreAudio.volume = snoreAudioVolume;
  stage.appendChild(snoreAudio);

  const transitionVideo = document.createElement("video");
  transitionVideo.className = "kevin-transition-overlay";
  transitionVideo.muted = true;
  transitionVideo.setAttribute("playsinline", "");
  transitionVideo.style.display = "none";
  const webmSrc = document.createElement("source");
  webmSrc.src = transitionVideoUrl;
  webmSrc.type = "video/webm";
  transitionVideo.appendChild(webmSrc);
  stage.appendChild(transitionVideo);

  // Overlay de entrada (toca uma vez ao chamar playEntrada(), "abre a cena"
  // revelando o Kevin já posicionado por baixo, em vez dele só aparecer).
  const entradaVideo = document.createElement("video");
  entradaVideo.className = "kevin-transition-overlay";
  entradaVideo.muted = true;
  entradaVideo.setAttribute("playsinline", "");
  entradaVideo.style.display = "none";
  const entradaWebmSrc = document.createElement("source");
  entradaWebmSrc.src = entradaVideoUrl;
  entradaWebmSrc.type = "video/webm";
  entradaVideo.appendChild(entradaWebmSrc);
  stage.appendChild(entradaVideo);

  // Card da sequência de abertura (fora de stageCamera - não é afetado por
  // zoom de câmera, igual entradaVideo/transitionVideo). `openingCard` só
  // posiciona (sem fundo, não escurece a cena); `openingCardBox` é o card
  // visual de verdade.
  const openingCard = document.createElement("div");
  openingCard.className = "kevin-opening-card";
  const openingCardBox = document.createElement("div");
  openingCardBox.className = "kevin-opening-card-box";
  const openingLessonName = document.createElement("h2");
  openingLessonName.className = "kevin-opening-lesson-name";
  openingLessonName.textContent = lessonName;
  openingCardBox.appendChild(openingLessonName);
  const openingStartBtn = document.createElement("button");
  openingStartBtn.className = "kevin-opening-start-btn";
  openingStartBtn.type = "button";
  openingStartBtn.textContent = "Iniciar";
  openingCardBox.appendChild(openingStartBtn);
  openingCard.appendChild(openingCardBox);
  if (autoOpening) stage.appendChild(openingCard);

  container.appendChild(stage);

  // --- estado de instância (substitui os globais da demo) ---
  let currentBgUrl = backgroundUrl ?? null;
  let transitionBusy = false;
  let entradaBusy = false;

  function runEntradaAnimation() {
    if (entradaBusy) return Promise.resolve(false);
    entradaBusy = true;

    return new Promise((resolve) => {
      function onEnded() {
        entradaVideo.style.display = "none";
        entradaBusy = false;
        entradaVideo.removeEventListener("ended", onEnded);
        resolve(true);
      }
      entradaVideo.addEventListener("ended", onEnded);
      entradaVideo.style.display = "block";
      entradaVideo.currentTime = 0;
      entradaVideo.play();
      // playEntrada() é o primeiro gesto do usuário disparado pela plataforma
      // (não há popup "Iniciar" no export) - aproveita esse mesmo gesto pra
      // ligar a música de fundo em loop, senão a política de autoplay do
      // navegador bloqueia o áudio sem interação.
      backsoundMusicAudio.play().catch(() => {});
    });
  }

  function runBackgroundTransition(newBgUrl) {
    if (transitionBusy || newBgUrl === currentBgUrl) return Promise.resolve(true);
    transitionBusy = true;
    let swapped = false;

    return new Promise((resolve) => {
      function onTimeUpdate() {
        if (!swapped && transitionVideo.duration && transitionVideo.currentTime >= transitionVideo.duration / 2) {
          swapped = true;
          stageCamera.style.backgroundImage = `url("${newBgUrl}")`;
          currentBgUrl = newBgUrl;
        }
      }
      function onEnded() {
        transitionVideo.style.display = "none";
        transitionBusy = false;
        transitionVideo.removeEventListener("timeupdate", onTimeUpdate);
        transitionVideo.removeEventListener("ended", onEnded);
        resolve(true);
      }
      transitionVideo.addEventListener("timeupdate", onTimeUpdate);
      transitionVideo.addEventListener("ended", onEnded);
      transitionVideo.style.display = "block";
      transitionVideo.currentTime = 0;
      transitionVideo.play();
    });
  }

  function normalizeVocabularyItem(item) {
    if (!item) return null;
    const words = item.words || item.word || item.label || "";
    if (!words) return null;
    return {
      id: item.id || words.toLowerCase().trim().replace(/\s+/g, "-"),
      words,
      imageSrc: item.imageSrc || item.imageUrl || item.src || "",
    };
  }

  function resolveVocabularyItemAsset(item) {
    const normalized = normalizeVocabularyItem(item);
    if (!normalized) return null;
    const isDefaultRelativeAsset = DEFAULT_VOCABULARY_ITEMS.some((defaultItem) => defaultItem.id === normalized.id && defaultItem.imageSrc === normalized.imageSrc);
    return {
      ...normalized,
      imageSrc: isDefaultRelativeAsset && normalized.imageSrc ? resolveAsset(normalized.imageSrc) : normalized.imageSrc,
    };
  }

  function getVocabularyItem(input) {
    if (typeof input === "object") return resolveVocabularyItemAsset(input);
    return vocabularyItems.find((item) => item.id === input || item.words === input) || null;
  }

  function renderVocabularyContent(item) {
    if (!item) return false;
    activeVocabularyId = item.id;
    vocabularyWords.textContent = item.words;
    if (item.imageSrc) {
      vocabularyImage.src = item.imageSrc;
      vocabularyImage.alt = item.words;
    } else {
      vocabularyImage.removeAttribute("src");
      vocabularyImage.alt = "";
    }
    vocabularyBoard.classList.add("active");
    vocabularyVisible = true;
    return true;
  }

  // Só esconde a palavra/imagem - o quadro em si (objeto genérico) é
  // controlado pelo mod Teaching (ver startTeachingMode/stopTeachingMode).
  function hideVocabularyContent() {
    vocabularyBoard.classList.remove("active");
    vocabularyImage.removeAttribute("src");
    vocabularyImage.alt = "";
    vocabularyWords.textContent = "";
    vocabularyVisible = false;
  }

  // --- Câmera (genérico) ---

  function applyCameraTransform() {
    const scale = 1 + (cameraZoom / 100) * CAMERA_ZOOM_MAX_EXTRA;
    const baseW = stageCamera.offsetWidth;
    const baseH = stageCamera.offsetHeight;
    const maxPanX = ((scale - 1) * baseW) / 2;
    const maxPanY = ((scale - 1) * baseH) / 2;
    const tx = (cameraPanX / 100) * maxPanX;
    const ty = (cameraPanY / 100) * maxPanY;
    stageCamera.style.transform = `scale(${scale}) translate(${tx / scale}px, ${ty / scale}px)`;
  }

  function setCameraState(zoom, panX, panY) {
    cameraZoom = zoom;
    cameraPanX = panX;
    cameraPanY = panY;
    applyCameraTransform();
  }

  // --- Objetos (genérico: props posicionáveis dentro de stageCamera) ---

  function getObjectPosition(id) {
    if (!objectPositions[id]) objectPositions[id] = { zoom: 100, offsetX: 0, offsetY: 0 };
    return objectPositions[id];
  }

  function applyObjectTransform() {
    if (!activeObjectId) {
      objectLayer.style.display = "none";
      return;
    }
    const pos = getObjectPosition(activeObjectId);
    const s = pos.zoom / 100;
    objectLayer.style.display = "block";
    objectLayer.style.transform = `translate(-50%, -50%) translateX(${pos.offsetX}px) translateY(${-pos.offsetY}px) scale(${s})`;
    // O quadro de vocabulário acompanha a mesma posição do objeto ativo (sem
    // escalar - fica legível independente do zoom do objeto), pra nunca
    // dessincronizar da posição real do quadro.
    vocabularyBoard.style.transform = `translate(-50%, -50%) translateX(${pos.offsetX}px) translateY(${-pos.offsetY}px)`;
  }

  function setActiveObjectId(id, src) {
    activeObjectId = id;
    if (id && src) objectLayer.src = src;
    else if (!id) objectLayer.removeAttribute("src");
    applyObjectTransform();
  }

  function setObjectPosition(id, zoom, offsetX, offsetY) {
    const pos = getObjectPosition(id);
    pos.zoom = zoom;
    pos.offsetX = offsetX;
    pos.offsetY = offsetY;
    if (activeObjectId === id) applyObjectTransform();
  }

  // --- Mod Teaching ---

  function startTeachingMode() {
    if (teachingPhase === "off" || teachingPhase === "object-out" || teachingPhase === "camera-out") {
      teachingPhase = "camera-in";
    }
  }

  function stopTeachingMode() {
    pendingVocabularyId = null;
    hideVocabularyContent();
    if (teachingPhase === "object-in" || teachingPhase === "active") {
      teachingPhase = "object-out";
    } else if (teachingPhase === "camera-in") {
      teachingPhase = "camera-out";
    }
  }

  function updateTeaching() {
    if (teachingPhase === "off") return;

    if (teachingPhase === "camera-in") {
      const nz = lerp(cameraZoom, teachingCameraZoom, TEACHING_LERP);
      const nx = lerp(cameraPanX, teachingCameraPanX, TEACHING_LERP);
      const ny = lerp(cameraPanY, teachingCameraPanY, TEACHING_LERP);
      setCameraState(nz, nx, ny);
      if (Math.abs(nz - teachingCameraZoom) < 0.5 && Math.abs(nx - teachingCameraPanX) < 0.5 && Math.abs(ny - teachingCameraPanY) < 0.5) {
        setCameraState(teachingCameraZoom, teachingCameraPanX, teachingCameraPanY);
        setActiveObjectId(TEACHING_OBJECT_ID, teachingBoardUrl);
        setObjectPosition(TEACHING_OBJECT_ID, teachingObjectZoom, teachingObjectOffsetX, teachingObjectEnterY);
        teachingPhase = "object-in";
      }
      return;
    }

    if (teachingPhase === "object-in") {
      const pos = getObjectPosition(TEACHING_OBJECT_ID);
      const ny = lerp(pos.offsetY, teachingObjectRestY, TEACHING_LERP);
      setObjectPosition(TEACHING_OBJECT_ID, teachingObjectZoom, teachingObjectOffsetX, ny);
      if (Math.abs(ny - teachingObjectRestY) < 0.5) {
        setObjectPosition(TEACHING_OBJECT_ID, teachingObjectZoom, teachingObjectOffsetX, teachingObjectRestY);
        teachingPhase = "active";
        if (pendingVocabularyId) {
          const item = getVocabularyItem(pendingVocabularyId);
          pendingVocabularyId = null;
          renderVocabularyContent(item);
        }
      }
      return;
    }

    if (teachingPhase === "active") return;

    if (teachingPhase === "object-out") {
      const pos = getObjectPosition(TEACHING_OBJECT_ID);
      const ny = lerp(pos.offsetY, teachingObjectEnterY, TEACHING_LERP);
      setObjectPosition(TEACHING_OBJECT_ID, teachingObjectZoom, teachingObjectOffsetX, ny);
      if (Math.abs(ny - teachingObjectEnterY) < 0.5) {
        setActiveObjectId(null);
        teachingPhase = "camera-out";
      }
      return;
    }

    if (teachingPhase === "camera-out") {
      const nz = lerp(cameraZoom, 0, TEACHING_LERP);
      const nx = lerp(cameraPanX, 0, TEACHING_LERP);
      const ny = lerp(cameraPanY, 0, TEACHING_LERP);
      setCameraState(nz, nx, ny);
      if (Math.abs(nz) < 0.5 && Math.abs(nx) < 0.5 && Math.abs(ny) < 0.5) {
        setCameraState(0, 0, 0);
        teachingPhase = "off";
      }
    }
  }

  // --- Mod Camuflage ---

  function applyHueRotate() {
    if (!puppet) return;
    puppet.style.filter = hueRotateDeg !== 0 ? `hue-rotate(${hueRotateDeg}deg)` : "";
  }

  function updateCamuflage() {
    if (camuflagePhase === "off") return;
    if (camuflagePhase === "m1") {
      hueRotateDeg = lerp(hueRotateDeg, 360, CAMUFLAGE_LERP);
      applyHueRotate();
      if (Math.abs(hueRotateDeg - 360) < 0.5) {
        hueRotateDeg = 360;
        applyHueRotate();
        camuflagePhase = "m2";
      }
      return;
    }
    if (camuflagePhase === "m2") {
      hueRotateDeg = lerp(hueRotateDeg, 0, CAMUFLAGE_LERP);
      applyHueRotate();
      if (Math.abs(hueRotateDeg) < 0.5) {
        hueRotateDeg = 0;
        applyHueRotate();
        camuflagePhase = "off";
      }
    }
  }

  let puppet = null;
  let rig = null;
  let rafHandle = null;
  let poseIndex = 0;
  let nextBlinkAt = 0;
  let blinkUntil = 0;
  let bodyDropY = 0;
  let idleTiltExtra = 0;
  let activeAudioInput = createMicAudioInput();
  let vocabularyItems = (options.vocabularyItems || DEFAULT_VOCABULARY_ITEMS).map(resolveVocabularyItemAsset).filter(Boolean);
  let activeVocabularyId = null;
  let vocabularyVisible = false;
  let pendingVocabularyId = null;

  // --- Câmera (genérico): zoom/pan do quadro inteiro dentro de stageCamera ---
  let cameraZoom = 0;   // 0-100, 0 = enquadramento padrão (sem zoom)
  let cameraPanX = 0;   // -100 a 100, % do deslocamento máximo disponível na escala atual
  let cameraPanY = 0;   // -100 a 100, idem

  // --- Objetos (genérico): props posicionáveis dentro de stageCamera, um por vez ---
  let activeObjectId = null;
  const objectPositions = {}; // { [objId]: { zoom, offsetX, offsetY } }

  // --- Mod Teaching ---
  let teachingPhase = "off"; // "off" | "camera-in" | "object-in" | "active" | "object-out" | "camera-out"

  // --- Sequência de abertura (autoOpening) ---
  let openingPendingSpeaking = false;

  // --- Mod Camuflage ---
  let camuflagePhase = "off"; // "off" | "m1" | "m2"
  let hueRotateDeg = 0; // 0-360, gira o matiz de todas as cores do SVG (usado só pelo Camuflage)

  // currentMode: "off" | "standby" | "speaking" | "thinking" | "sleeping" | "musica" | "celebrate" | "tchau"
  // É o modo pedido via setMode(). O modo efetivamente renderizado a cada frame
  // (effectiveMode, calculado em animate()) pode divergir temporariamente: a
  // saída do modo Musica é animada (M4 → exit_m2 → exit_m1) e Celebrate/Tchau
  // são gestos de disparo único que voltam sozinhos ao terminar.
  let currentMode = "off";
  let previousMode = "off";
  // Modo efetivamente renderizado no frame atual (calculado em animate()).
  // Diverge de currentMode durante a saída animada da Musica e o gesto do Tchau.
  let activeMode = "off";

  const idleArmState = {
    left: { curS: 15, curE: 31, tgtS: 15, tgtE: 31, baseMode: "rest", nextBaseAt: 0, speed: 0.02 },
    right: { curS: -16, curE: -33, tgtS: -16, tgtE: -33, baseMode: "rest", nextBaseAt: 0, speed: 0.02 },
  };
  const idleGesture = { side: null, type: null, endsAt: 0, nextAt: 0 };
  const idlePupilState = { curX: 0, curY: 0, tgtX: 0, tgtY: 0, nextAt: 0 };
  const idleHeadState = { tiltTgt: 0, tiltNextAt: 0, turnNextAt: 0 };
  const thinkingArmState = {
    left: { curS: 0, curE: 0 },
    right: { curS: 0, curE: 0 },
  };
  const audioMouthState = { smoothedLevel: 0, shapes: AUDIO_MOUTH_TIERS[0].shapes, shapeIdx: 0, nextChangeAt: 0 };

  // --- Dormindo ---
  let sleepPhaseStart = 0;
  let sleepZNextAt = 0;
  const sleepArmState = {
    left:  { curS: 0, curE: 0 },
    right: { curS: 0, curE: 0 },
  };

  // --- Celebrate ---
  let celebratePhase = "off"; // "off" | "enter" | "m1" | "m2" | "m3"
  let celebrateJumpStage = "none"; // "none" | "up" | "down" | "done"
  let celebrateLandingStage = "bounceDown"; // "bounceDown" | "bounceUp"
  let celebrateM3FeetTriggered = false;
  let celebrateConfettiFired = false;
  let celebrateAudioTimeout = null;
  const celebrateArmState = { rightS: 0, rightE: 0, leftS: 0, leftE: 0 };
  let celebrateJumpOffset = 0;

  // --- Musica ---
  let musicaPhase = "m1";          // "m1" | "m2" | "m3" | "m4" | "exit_m2" | "exit_m1"
  let musicaExiting = false;
  let musicaExitCallback = null;
  const musicaArmState = { curS: 0, curE: 0 };
  let musicaArmLayer = "default"; // "default" | "mid" | "bottom"
  let musicaArmOriginalNextSib = null;
  let musicaM4PhaseStart = 0;
  const musicaM4RightState = { curS: 0, curE: 0 };
  let musicaNoteNextAt = 0;

  // --- Tchau ---
  let tchauPhase = "off";    // "off" | "entering" | "waving" | "exiting"
  let tchauWaveStart = 0;
  const tchauArmState = { curS: 0, curE: 0 };     // braço direito (aceno)
  const tchauLeftArmState = { curS: 0, curE: 0 }; // braço esquerdo (descanso)

  // --- Mosca ---
  let moscaActive = false;
  const moscaState = {
    x: 0, y: 0, vx: 0, vy: 0,
    tgtX: 0, tgtY: 0, tgtChangeAt: 0,
    wingIdx: 0, wingDir: 1, wingNextAt: 0,
    entering: false,
    entryStartAt: 0, entryDuration: 0,
    entryFromX: 0, entryFromY: 0,
    entryToX: 0, entryToY: 0,
    exiting: false,
    exitStartAt: 0, exitDuration: 0,
    exitFromX: 0, exitFromY: 0,
    exitToX: 0, exitToY: 0,
    lastNow: 0,
    tiltCur: 0, tiltTgt: 0,
    headStep: 0,
    armLeft:  { curS: 15,  curE:  31, mode: "rest", nextAt: 0 },
    armRight: { curS: -16, curE: -33, mode: "rest", nextAt: 0 },
    bodyDrop: 0,
    bodyPhaseStart: 0,
    linguaIdx: 0, linguaDir: 1, linguaNextAt: 0, linguaCooldownUntil: 0, linguaFired: false,
  };

  // --- helpers de DOM/SVG ---
  function getNodeById(id) {
    if (!puppet) return null;
    return puppet.querySelector(`[id="${id}"]`);
  }

  function getFirstExistingNode(ids) {
    for (const id of ids) {
      const node = getNodeById(id);
      if (node) return node;
    }
    return null;
  }

  // Não depende de classe CSS: o Illustrator renumera .st0/.st11/etc a cada
  // re-export, então a identificação é sempre por ID.
  function getFirstExistingBoneNode(ids) {
    for (const id of ids) {
      const node = getNodeById(id);
      if (node) return node;
    }
    return null;
  }

  function setDisplay(node, visible) {
    if (!node) return;
    node.style.display = visible ? "" : "none";
  }

  function showExtra(key, visible) {
    if (!rig || !rig.extras) return;
    const node = rig.extras[key];
    if (!node) return;
    node.setAttribute("display", visible ? "" : "none");
  }

  function setSvgTransform(node, transform) {
    if (!node) return;
    node.setAttribute("transform", transform);
  }

  function setSvgRotate(node, deg, cx, cy) {
    setSvgTransform(node, `rotate(${deg.toFixed(3)} ${cx} ${cy})`);
  }

  function setSvgRotateScale(node, deg, cx, cy, sx, sy) {
    const d = deg.toFixed(3);
    const ax = sx.toFixed(4);
    const ay = sy.toFixed(4);
    setSvgTransform(node, `translate(${cx} ${cy}) rotate(${d}) scale(${ax} ${ay}) translate(${-cx} ${-cy})`);
  }

  function composeTransforms(...transforms) {
    return transforms.filter(Boolean).join(" ");
  }

  function getSvgRoot() {
    if (!puppet) return null;
    if (puppet.tagName && puppet.tagName.toLowerCase() === "svg") return puppet;
    return puppet.ownerSVGElement || null;
  }

  function ensureShadowContainedByBasePath(shadowPath, basePath, clipId) {
    if (!shadowPath || !basePath) return;
    const svg = getSvgRoot();
    if (!svg) return;

    let defs = svg.querySelector("defs");
    if (!defs) {
      defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
      svg.insertBefore(defs, svg.firstChild);
    }

    let clipPath = defs.querySelector(`#${clipId}`);
    if (!clipPath) {
      clipPath = document.createElementNS("http://www.w3.org/2000/svg", "clipPath");
      clipPath.setAttribute("id", clipId);
      defs.appendChild(clipPath);
    }

    let use = clipPath.querySelector("use");
    if (!use) {
      use = document.createElementNS("http://www.w3.org/2000/svg", "use");
      clipPath.appendChild(use);
    }

    use.setAttribute("href", `#${basePath.id}`);
    use.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", `#${basePath.id}`);
    shadowPath.setAttribute("clip-path", `url(#${clipId})`);
  }

  function buildPupilTrackPairs(eyeIds) {
    const eyeballs = { left: null, right: null };
    const pupils = { left: null, right: null };

    for (const id of eyeIds) {
      const side = getSideFromId(id);
      if (!side) continue;
      const node = getNodeById(id);
      if (!node) continue;
      if (id.includes("Eyeball")) eyeballs[side] = node;
      if (id.includes("Pupil")) pupils[side] = node;
    }

    const pairs = [];
    for (const side of ["left", "right"]) {
      if (!eyeballs[side] || !pupils[side]) continue;
      pairs.push({
        side,
        eyeballNode: eyeballs[side],
        pupilNode: pupils[side],
        baseTransform: pupils[side].getAttribute("transform") || "",
      });
    }
    return pairs;
  }

  // --- pose / olhos / boca ---
  function getActivePose() {
    if (!rig) return null;
    return rig.poses[poseIndex] || null;
  }

  function setPose(index) {
    if (!rig) return;
    poseIndex = ((index % rig.poses.length) + rig.poses.length) % rig.poses.length;
    rig.poses.forEach((pose, i) => setDisplay(pose.node, i === poseIndex));
    setEyesClosed(false);
    updateIdlePupils(performance.now());
    syncHeadTurnFromPose();
  }

  function setMouthShape(shapeId) {
    const pose = getActivePose();
    if (!pose || pose.mouthNodes.length === 0) return;
    const fallback = pose.mouthIds[0];
    const target = pose.mouthIds.includes(shapeId) ? shapeId : fallback;
    for (const node of pose.mouthNodes) {
      setDisplay(node, node.id === target);
    }
  }

  function setMouthByAudioLevel(now, level) {
    const pose = getActivePose();
    if (!pose) return;
    if (pose.id !== "_x2B_Frontal") {
      setMouthShape(pose.mouthIds[0]);
      return;
    }

    // Envelope attack/release: abre rápido no início da fala, fecha mais
    // devagar entre sílabas, evitando que o nível bruto (ruidoso) faça a
    // boca tremer.
    const rate = level > audioMouthState.smoothedLevel ? 0.5 : 0.12;
    audioMouthState.smoothedLevel = lerp(audioMouthState.smoothedLevel, level, rate);
    const smoothed = audioMouthState.smoothedLevel;

    if (smoothed <= AUDIO_MOUTH_SILENCE) {
      setMouthShape("Neutral");
      return;
    }

    if (now >= audioMouthState.nextChangeAt) {
      const tier = AUDIO_MOUTH_TIERS.find((t) => smoothed <= t.max) || AUDIO_MOUTH_TIERS[AUDIO_MOUTH_TIERS.length - 1];
      audioMouthState.shapes = tier.shapes;
      audioMouthState.shapeIdx = Math.floor(Math.random() * tier.shapes.length);
      audioMouthState.nextChangeAt = now + 120 + Math.random() * 100;
    }
    setMouthShape(audioMouthState.shapes[audioMouthState.shapeIdx]);
  }

  function setEyesClosed(closed) {
    const pose = getActivePose();
    if (!pose) return;
    if (pose.blinkNodes.length > 0) {
      for (const node of pose.blinkNodes) setDisplay(node, closed);
      for (const node of pose.eyeNodes) setDisplay(node, !closed);
      return;
    }
    for (const node of pose.eyeNodes) setDisplay(node, !closed);
  }

  function updateBlink(now) {
    if (activeMode === "sleeping") {
      setEyesClosed(true);
      return;
    }
    if (now >= nextBlinkAt) {
      blinkUntil = now + 130;
      nextBlinkAt = now + 1700 + Math.random() * 2800;
    }
    setEyesClosed(now < blinkUntil);
  }

  function updateIdlePupils(now) {
    if (!rig) return;
    const pose = getActivePose();
    if (!pose || !pose.pupilTrackPairs || pose.pupilTrackPairs.length === 0) return;

    if (now >= idlePupilState.nextAt) {
      const lookCenter = Math.random() < 0.3;
      idlePupilState.tgtX = lookCenter ? 0 : (Math.random() * 2 - 1) * 0.85;
      idlePupilState.tgtY = lookCenter ? 0 : (Math.random() * 2 - 1) * 0.85;
      idlePupilState.nextAt = now + 1200 + Math.random() * 2600;
    }

    idlePupilState.curX = lerp(idlePupilState.curX, idlePupilState.tgtX, 0.045);
    idlePupilState.curY = lerp(idlePupilState.curY, idlePupilState.tgtY, 0.045);

    for (const pair of pose.pupilTrackPairs) {
      const eyeballBox = pair.eyeballNode.getBBox();
      const maxX = Math.max(1.5, eyeballBox.width * PUPIL_TRACK_X_RATIO);
      const maxY = Math.max(1.5, eyeballBox.height * PUPIL_TRACK_Y_RATIO);
      const dx = idlePupilState.curX * maxX;
      const dy = idlePupilState.curY * maxY;
      const move = `translate(${formatSignedNum(dx)} ${formatSignedNum(dy)})`;
      setSvgTransform(pair.pupilNode, pair.baseTransform ? `${pair.baseTransform} ${move}` : move);
    }
  }

  // --- cabeça / agachamento ---
  function clampHeadTurnStep(n) {
    return Math.max(-2, Math.min(2, Math.round(n)));
  }

  function headTurnStepToPoseIndex(step) {
    return POSE_INDEX_BY_HEAD_TURN[clampHeadTurnStep(step) + 2];
  }

  function poseIndexToHeadTurnStep(index) {
    return HEAD_TURN_BY_POSE_INDEX[index] ?? 0;
  }

  function syncHeadTurnFromPose() {
    // mantido como ponto único de extensão caso o host queira observar o giro.
  }

  function setBodyDropValue(value) {
    bodyDropY = Math.max(0, Math.min(BODY_DROP_MAX, value));
  }

  function getBodyDropTransform() {
    return bodyDropY > 0 ? `translate(0 ${bodyDropY.toFixed(3)})` : "";
  }

  function applyPuppetBaseTransform() {
    if (!puppet) return;
    const s = PUPPET_BASE_ZOOM / 100;
    const ty = PUPPET_BASE_OFFSET_Y + celebrateJumpOffset;
    puppet.style.transformOrigin = "bottom center";
    puppet.style.transform = `translateX(${PUPPET_BASE_OFFSET_X}px) translateY(${-ty}px) scale(${s})`;
  }

  function applyHeadRotation() {
    if (!rig || !rig.head || !rig.head.node) return;
    const tilt = idleTiltExtra + moscaState.tiltCur;
    const rot = `rotate(${tilt.toFixed(3)} ${HEAD_PIVOT.x} ${HEAD_PIVOT.y})`;
    setSvgTransform(rig.head.node, composeTransforms(rig.head.baseTransform, getBodyDropTransform(), rot));
  }

  // --- rig: braços / pernas / corpo / cauda ---
  function setupArmDrivers(arm) {
    if (!arm || !arm.meshGroup || !arm.bonesGroup) return;

    if (!arm.meshGroup.contains(arm.bonesGroup)) {
      arm.meshGroup.appendChild(arm.bonesGroup);
    }

    const elbowDriverId = `${arm.driverPrefix}ElbowDriver`;
    const wristDriverId = `${arm.driverPrefix}WristDriver`;

    let elbowDriver = arm.bonesGroup.querySelector(`#${elbowDriverId}`);
    if (!elbowDriver) {
      elbowDriver = document.createElementNS("http://www.w3.org/2000/svg", "g");
      elbowDriver.setAttribute("id", elbowDriverId);
      arm.bonesGroup.insertBefore(elbowDriver, arm.bonesGroup.firstChild);
    }

    if (arm.forearmBone && arm.forearmBone.parentNode !== elbowDriver) elbowDriver.appendChild(arm.forearmBone);
    if (arm.elbowCore && arm.elbowCore.parentNode !== elbowDriver) elbowDriver.appendChild(arm.elbowCore);

    let wristDriver = elbowDriver.querySelector(`#${wristDriverId}`);
    if (!wristDriver) {
      wristDriver = document.createElementNS("http://www.w3.org/2000/svg", "g");
      wristDriver.setAttribute("id", wristDriverId);
      elbowDriver.appendChild(wristDriver);
    }

    if (arm.wristBone && arm.wristBone.parentNode !== wristDriver) wristDriver.appendChild(arm.wristBone);
    if (arm.handGroup && arm.handGroup.parentNode !== wristDriver) wristDriver.appendChild(arm.handGroup);
    if (arm.handGroup) arm.handBaseTransform = arm.handGroup.getAttribute("transform") || "";
    if (arm.ukeleGroup && arm.ukeleGroup.parentNode !== wristDriver) wristDriver.appendChild(arm.ukeleGroup);
    if (arm.ukeleGroup) arm.ukeleGroup.style.display = "none";
    if (arm.tchauGroup && arm.tchauGroup.parentNode !== wristDriver) wristDriver.appendChild(arm.tchauGroup);
    if (arm.tchauGroup) arm.tchauGroup.style.display = "none";
    if (arm.fechadaGroup && arm.fechadaGroup.parentNode !== wristDriver) wristDriver.appendChild(arm.fechadaGroup);
    if (arm.fechadaGroup) arm.fechadaGroup.style.display = "none";

    arm.elbowDriver = elbowDriver;
    arm.wristDriver = wristDriver;

    if (arm.shadowPath && arm.meshGroup) {
      const shadowDriverId = `${arm.driverPrefix}ShadowDriver`;
      let shadowDriver = arm.meshGroup.querySelector(`#${shadowDriverId}`);
      if (!shadowDriver) {
        shadowDriver = document.createElementNS("http://www.w3.org/2000/svg", "g");
        shadowDriver.setAttribute("id", shadowDriverId);
        arm.meshGroup.appendChild(shadowDriver);
      }

      if (arm.shadowPath.parentNode !== shadowDriver) shadowDriver.appendChild(arm.shadowPath);
      arm.shadowDriver = shadowDriver;
      arm.shadowDriverBaseTransform = shadowDriver.getAttribute("transform") || "";
    }

    if (arm.forearmMeshPath && arm.meshGroup) {
      const meshElbowDriverId = `${arm.driverPrefix}MeshElbowDriver`;
      let meshElbowDriver = arm.meshGroup.querySelector(`#${meshElbowDriverId}`);
      if (!meshElbowDriver) {
        meshElbowDriver = document.createElementNS("http://www.w3.org/2000/svg", "g");
        meshElbowDriver.setAttribute("id", meshElbowDriverId);
      }

      if (arm.bonesGroup.parentNode === arm.meshGroup) {
        arm.meshGroup.insertBefore(meshElbowDriver, arm.bonesGroup);
      } else if (meshElbowDriver.parentNode !== arm.meshGroup) {
        arm.meshGroup.appendChild(meshElbowDriver);
      }

      if (arm.forearmMeshPath.parentNode !== meshElbowDriver) {
        meshElbowDriver.appendChild(arm.forearmMeshPath);
      }
      arm.meshElbowDriver = meshElbowDriver;
      arm.meshElbowDriverBaseTransform = meshElbowDriver.getAttribute("transform") || "";
    }

    const frontLayerNodes = [arm.handLayerNode, arm.elbowLayerNode]
      .filter(Boolean)
      .filter((node) => node !== arm.handGroup);
    for (const node of frontLayerNodes) {
      if (node.parentNode !== arm.meshGroup) {
        arm.meshGroup.appendChild(node);
      } else if (arm.meshGroup.lastChild !== node) {
        arm.meshGroup.appendChild(node);
      }
    }
    if (arm.bonesGroup.parentNode === arm.meshGroup) {
      arm.meshGroup.appendChild(arm.bonesGroup);
    }
  }

  function setupLegDrivers(leg) {
    if (!leg || !leg.meshGroup || !leg.bonesGroup) return;

    if (!leg.meshGroup.contains(leg.bonesGroup)) {
      leg.meshGroup.appendChild(leg.bonesGroup);
    }

    const kneeDriverId = `${leg.driverPrefix}KneeDriver`;
    const ankleDriverId = `${leg.driverPrefix}AnkleDriver`;

    let kneeDriver = leg.bonesGroup.querySelector(`#${kneeDriverId}`);
    if (!kneeDriver) {
      kneeDriver = document.createElementNS("http://www.w3.org/2000/svg", "g");
      kneeDriver.setAttribute("id", kneeDriverId);
      leg.bonesGroup.insertBefore(kneeDriver, leg.bonesGroup.firstChild);
    }

    if (leg.shinBone && leg.shinBone.parentNode !== kneeDriver) kneeDriver.appendChild(leg.shinBone);
    if (leg.kneeCore && leg.kneeCore.parentNode !== kneeDriver) kneeDriver.appendChild(leg.kneeCore);

    let ankleDriver = kneeDriver.querySelector(`#${ankleDriverId}`);
    if (!ankleDriver) {
      ankleDriver = document.createElementNS("http://www.w3.org/2000/svg", "g");
      ankleDriver.setAttribute("id", ankleDriverId);
      kneeDriver.appendChild(ankleDriver);
    }

    if (leg.ankleBone && leg.ankleBone.parentNode !== ankleDriver) ankleDriver.appendChild(leg.ankleBone);
    if (leg.footGroup && leg.footGroup.parentNode !== ankleDriver) ankleDriver.appendChild(leg.footGroup);

    leg.kneeDriver = kneeDriver;
    leg.ankleDriver = ankleDriver;
    leg.meshGroupBaseTransform = leg.meshGroup.getAttribute("transform") || "";
    leg.ankleDriverBaseTransform = ankleDriver.getAttribute("transform") || "";
    leg.footBaseTransform = leg.footGroup ? leg.footGroup.getAttribute("transform") || "" : "";
  }

  function setupBodyRig(body) {
    if (!body || !body.meshGroup || !body.bonesGroup) return;

    if (!body.meshGroup.contains(body.bonesGroup)) {
      body.meshGroup.appendChild(body.bonesGroup);
    }

    const parent = body.meshRoot || body.meshGroup;
    if (!parent) return;

    let tailMeshDriver = parent.querySelector("#bodyTailMeshDriver");
    if (!tailMeshDriver) {
      tailMeshDriver = document.createElementNS("http://www.w3.org/2000/svg", "g");
      tailMeshDriver.setAttribute("id", "bodyTailMeshDriver");
    }
    if (parent.firstChild !== tailMeshDriver) {
      parent.insertBefore(tailMeshDriver, parent.firstChild);
    }
    if (body.tailGroup && body.tailGroup.parentNode !== tailMeshDriver) {
      tailMeshDriver.appendChild(body.tailGroup);
    }

    let pelvisMeshDriver = parent.querySelector("#bodyPelvisMeshDriver");
    if (!pelvisMeshDriver) {
      pelvisMeshDriver = document.createElementNS("http://www.w3.org/2000/svg", "g");
      pelvisMeshDriver.setAttribute("id", "bodyPelvisMeshDriver");
    }
    const afterTail = tailMeshDriver.nextSibling;
    if (pelvisMeshDriver.parentNode !== parent || pelvisMeshDriver !== afterTail) {
      parent.insertBefore(pelvisMeshDriver, afterTail);
    }

    for (const node of [body.leftLegGroup, body.rightLegGroup]) {
      if (!node) continue;
      if (node.parentNode !== pelvisMeshDriver) pelvisMeshDriver.appendChild(node);
    }

    body.pelvisMeshDriver = pelvisMeshDriver;
    body.pelvisMeshDriverBaseTransform = pelvisMeshDriver.getAttribute("transform") || "";
    body.tailMeshDriver = tailMeshDriver;
    body.tailMeshDriverBaseTransform = tailMeshDriver.getAttribute("transform") || "";
  }

  function buildRigState() {
    rig = {
      poses: POSE_CONFIG.map((cfg) => ({
        ...cfg,
        node: getNodeById(cfg.id),
        mouthNodes: cfg.mouthIds.map(getNodeById).filter(Boolean),
        eyeNodes: cfg.eyeIds.map(getNodeById).filter(Boolean),
        blinkNodes: cfg.blinkIds.map(getNodeById).filter(Boolean),
        pupilTrackPairs: buildPupilTrackPairs(cfg.eyeIds),
      })),
      leftArm: {
        meshGroup: getNodeById("Left_Arm"),
        upperArmPath: getFirstExistingNode(["bicepcs1", "Braço_Direito1"]),
        forearmMeshPath: getFirstExistingNode(["Anti_Braço1"]),
        meshPaths: [],
        meshSegmentsBase: [],
        bonesGroup: getNodeById("Bones_Left_Arm"),
        forearmBone: getFirstExistingBoneNode(["Anti_Braço_bone1", "Anti_Braço1"]),
        wristBone: getFirstExistingBoneNode(["Pulso_bone2", "Pulso1"]),
        handGroup: getFirstExistingNode(["Objeto_generativo__x28_180_x2C__0_x29_1", "mão", "Mão"]),
        handBaseTransform: "",
        handLayerNode: getFirstExistingNode(["mão", "Mão"]),
        elbowLayerNode: getFirstExistingNode(["Cutuvelo1", "Cutuvelo"]),
        elbowCore: getFirstExistingBoneNode(["Cotovelo_core_bone1", "Cotovelo_core1"]),
        elbowDeform: getNodeById("Deform3"),
        elbowZone: getNodeById("Deform_Left_Elbow"),
        elbowDriver: null,
        wristDriver: null,
        meshElbowDriver: null,
        meshElbowDriverBaseTransform: "",
        mirrorHandOnNegative: true,
        handMirrorTiltDeg: 80,
        handManualTiltDeg: 0,
        musicaHandMirrorOverride: null,
        handMirrorShoulderGteDeg: null,
        handMirrorShoulderLteDeg: -54.5,
        handMirrorElbowSign: "negative",
        ukeleGroup: getNodeById("Mão_Ukulele"),
        fechadaGroup: getNodeById("Mão_fechada1"),
        driverPrefix: "left",
        pivots: LEFT_ARM_PIVOTS,
      },
      rightArm: {
        meshGroup: getNodeById("Right_Arm"),
        upperArmPath: getFirstExistingNode(["bicepcs", "Braço_Direito"]),
        forearmMeshPath: getFirstExistingNode(["Anti_Braço"]),
        meshPaths: [],
        basePath: getFirstExistingNode(["bicepcs", "Braço_Direito"]),
        shadowPath: null,
        shadowDriver: null,
        shadowDriverBaseTransform: "",
        meshSegmentsBase: [],
        bonesGroup: getNodeById("Bones_Right_Arm"),
        forearmBone: getFirstExistingBoneNode(["Anti_Braço_bone", "Anti_Braço"]),
        wristBone: getFirstExistingBoneNode(["Pulso_bone", "Pulso"]),
        tchauGroup: getNodeById("Mão_tchau"),
        handGroup: getFirstExistingNode(["Objeto_generativo__x28_180_x2C__0_x29_", "Mão", "mão"]),
        handBaseTransform: "",
        handLayerNode: getFirstExistingNode(["Mão", "mão"]),
        elbowLayerNode: getFirstExistingNode(["Cutuvelo", "Cutuvelo1"]),
        elbowCore: getFirstExistingBoneNode(["Cotovelo_core_bone", "Cotovelo_core"]),
        elbowDeform: getNodeById("Deform2"),
        elbowZone: getNodeById("Deform_Right_Elbow"),
        elbowDriver: null,
        wristDriver: null,
        meshElbowDriver: null,
        meshElbowDriverBaseTransform: "",
        mirrorHandOnNegative: true,
        handMirrorTiltDeg: -80,
        handManualTiltDeg: 0,
        handMirrorShoulderGteDeg: 54.5,
        handMirrorShoulderLteDeg: null,
        handMirrorElbowSign: "positive",
        fechadaGroup: getNodeById("Mão_fechada"),
        driverPrefix: "right",
        pivots: RIGHT_ARM_PIVOTS,
      },
      leftLeg: {
        meshGroup: getNodeById("Left_Leg"),
        meshPaths: [getNodeById("Perna_direita")].filter(Boolean),
        meshSegmentsBase: [],
        bonesGroup: getNodeById("Bones_Right_leg"),
        shinBone: getNodeById("Tibia"),
        ankleBone: getNodeById("Tornozelo"),
        footGroup: getNodeById("Pé_direito"),
        kneeCore: getNodeById("Joelho_Core"),
        kneeDeform: getNodeById("Deform"),
        kneeDriver: null,
        ankleDriver: null,
        footManualTiltDeg: 0,
        driverPrefix: "leftLeg",
        hipSign: 1,
        kneeSign: 1,
        pivots: LEFT_LEG_PIVOTS,
      },
      rightLeg: {
        meshGroup: getNodeById("Right_Leg"),
        meshPaths: (() => {
          const group = getNodeById("Perna_esquerda");
          return group ? Array.from(group.querySelectorAll("path")) : [];
        })(),
        meshSegmentsBase: [],
        bonesGroup: getNodeById("Bones_Right_leg1"),
        shinBone: getNodeById("Tibia1"),
        ankleBone: getNodeById("Tornozelo1"),
        footGroup: getNodeById("Pé_Esquerdo"),
        kneeCore: getNodeById("Joelho_core"),
        kneeDeform: getNodeById("Deform1"),
        kneeDriver: null,
        ankleDriver: null,
        footManualTiltDeg: 0,
        driverPrefix: "rightLeg",
        hipSign: -1,
        kneeSign: -1,
        pivots: RIGHT_LEG_PIVOTS,
      },
      body: {
        meshGroup: getNodeById("Body"),
        meshRoot: getNodeById("Body1"),
        torsoGroup: getNodeById("Torso"),
        torsoPaths: [getNodeById("Torso1"), getNodeById("Sombra"), getNodeById("Sombra1")].filter(Boolean),
        torsoSegmentsBase: [],
        torsoGroupBaseTransform: "",
        bonesGroup: getNodeById("Bones_Body"),
        leftLegGroup: getNodeById("Left_Leg"),
        rightLegGroup: getNodeById("Right_Leg"),
        tailGroup: getNodeById("Tail"),
        pelvisGroup: getNodeById("Pelvis"),
        pelvisCore: getNodeById("Pelvis_Core"),
        torsoCore: getNodeById("Torso_Core"),
        torsoToPelvisBone: getNodeById("Bone_Torso_to_Pelvis"),
        deformNode: getNodeById("Deform4"),
        baseTransform: "",
        pelvisMeshDriver: null,
        pelvisMeshDriverBaseTransform: "",
        tailMeshDriver: null,
        tailMeshDriverBaseTransform: "",
        pelvisBaseTransform: "",
        torsoToPelvisBaseTransform: "",
        deformBaseTransform: "",
        pivots: BODY_PIVOTS,
      },
      head: (() => {
        const node = getNodeById("Head");
        return { node, baseTransform: node ? node.getAttribute("transform") || "" : "" };
      })(),
      tail: (() => {
        const node = getNodeById("Tail");
        return { node, baseTransform: node ? node.getAttribute("transform") || "" : "" };
      })(),
      extras: {
        mosca: getNodeById("Mosca") ?? getNodeById("Corpo_mosca")?.parentElement ?? null,
        moscaWingFrames: MOSCA_WING_IDS.map(getNodeById),
        linguaLeft: getNodeById("Lingua"),
        linguaRight: getNodeById("Lingua1"),
        linguaLeftFrames:  LINGUA_LEFT_FRAME_IDS.map(getNodeById),
        linguaRightFrames: LINGUA_RIGHT_FRAME_IDS.map(getNodeById),
        mouthLinguaLeft: getNodeById("_x2B_Mouth_lingua"),
        mouthLinguaRight: getNodeById("_x2B_Mouth_lingua1"),
        mouthLeft: getNodeById("_x2B_Mouth1"),   // boca visível no perfil esquerdo
        mouthRight: getNodeById("_x2B_Mouth4"),  // boca visível no perfil direito
        handTchauRight: getNodeById("Mão_tchau"),
        handFechadaRight: getNodeById("Mão_fechada"),
        handTchauLeft: getNodeById("Mão_tchau1"),
        handFechadaLeft: getNodeById("Mão_fechada1"),
      },
      skeletonVisualNodes: [],
    };

    // Coleta os nós visuais do esqueleto ANTES dos drivers de setup abaixo
    // moverem mão/pé para dentro dos grupos Bones_* - senão a mão e o pé
    // acabam capturados neste conjunto (por estarem então aninhados dentro
    // do bonesGroup) e ficam ocultos junto com os ossos.
    {
      const skeletonRoots = [rig.leftArm.bonesGroup, rig.rightArm.bonesGroup, rig.leftLeg.bonesGroup, rig.rightLeg.bonesGroup, rig.body.bonesGroup].filter(Boolean);
      const visualSet = new Set();
      for (const root of skeletonRoots) {
        for (const node of root.querySelectorAll("*")) visualSet.add(node);
      }
      rig.skeletonVisualNodes = Array.from(visualSet);
    }

    for (const arm of [rig.leftArm, rig.rightArm]) {
      arm.meshPaths = [arm.upperArmPath, arm.forearmMeshPath].filter(Boolean);
      arm.meshSegmentsBase = arm.meshPaths.map((path) => parsePathDataToAbsolute(path.getAttribute("d") || ""));
      for (let i = 0; i < arm.meshPaths.length; i++) {
        arm.meshPaths[i].setAttribute("d", serializeAbsolutePath(arm.meshSegmentsBase[i]));
      }
      setupArmDrivers(arm);
    }

    ensureShadowContainedByBasePath(rig.rightArm.shadowPath, rig.rightArm.basePath, "rightArmShadowClip");

    for (const leg of [rig.leftLeg, rig.rightLeg]) {
      leg.meshSegmentsBase = leg.meshPaths.map((path) => {
        try {
          return parsePathDataToAbsolute(path.getAttribute("d") || "");
        } catch (err) {
          console.warn(`KevinPuppet: falha ao parsear path da ${leg.driverPrefix}.`, err);
          return null;
        }
      });
      for (let i = 0; i < leg.meshPaths.length; i++) {
        if (!leg.meshSegmentsBase[i]) continue;
        leg.meshPaths[i].setAttribute("d", serializeAbsolutePath(leg.meshSegmentsBase[i]));
      }
      setupLegDrivers(leg);
    }

    const body = rig.body;
    setupBodyRig(body);
    body.baseTransform = body.meshGroup ? body.meshGroup.getAttribute("transform") || "" : "";
    body.torsoGroupBaseTransform = body.torsoGroup ? body.torsoGroup.getAttribute("transform") || "" : "";
    body.pelvisMeshDriverBaseTransform = body.pelvisMeshDriver ? body.pelvisMeshDriver.getAttribute("transform") || "" : "";
    body.tailMeshDriverBaseTransform = body.tailMeshDriver ? body.tailMeshDriver.getAttribute("transform") || "" : "";
    body.pelvisBaseTransform = body.pelvisGroup ? body.pelvisGroup.getAttribute("transform") || "" : "";
    body.torsoToPelvisBaseTransform = body.torsoToPelvisBone ? body.torsoToPelvisBone.getAttribute("transform") || "" : "";
    body.deformBaseTransform = body.deformNode ? body.deformNode.getAttribute("transform") || "" : "";

    body.torsoSegmentsBase = body.torsoPaths.map((path) => {
      try {
        return parsePathDataToAbsolute(path.getAttribute("d") || "");
      } catch (err) {
        console.warn("KevinPuppet: falha ao parsear path do torso.", err);
        return null;
      }
    });
    for (let i = 0; i < body.torsoPaths.length; i++) {
      const base = body.torsoSegmentsBase[i];
      if (!base) continue;
      body.torsoPaths[i].setAttribute("d", serializeAbsolutePath(base));
    }

    // Esqueleto fica permanentemente oculto nesta exportação (sem toggle) -
    // a coleta em si já rodou acima, antes dos drivers de setup.
    for (const node of rig.skeletonVisualNodes) setDisplay(node, false);

    applyHeadRotation();
  }

  // Oculta variantes (mão/cabeça/prop) e extras controlados pelo app, que no
  // SVG cru vêm todos visíveis por padrão.
  function initDefaultVisibility() {
    if (!puppet) return;

    // Variantes de mão, cabeça e props: oculta apenas o grupo raiz de cada
    // variante. Elementos filhos não recebem display:none próprio - herdam
    // do pai e voltam a aparecer corretamente quando o pai for reexibido.
    const variantSelector = '[id^="Mão_"], [id^="Mao_"], [id^="Cabeça_"], [id^="Cabeca_"], [id^="Prop_"]';
    for (const el of puppet.querySelectorAll(variantSelector)) {
      if (!el.parentElement?.closest(variantSelector)) {
        el.style.display = "none";
      }
    }

    // Extras com visibilidade controlada pelo app
    const extrasToHide = ["handTchauRight", "handFechadaRight", "handTchauLeft", "handFechadaLeft", "linguaLeft", "linguaRight", "mouthLinguaLeft", "mouthLinguaRight"];
    for (const key of extrasToHide) showExtra(key, false);

    // Mosca começa oculta
    if (rig?.extras?.mosca) rig.extras.mosca.setAttribute("display", "none");

    // Bones de referência visual: sempre ocultos, mesmo quando o grupo pai é exibido
    for (const id of ["Pulso_bone1"]) {
      const el = getNodeById(id);
      if (el) el.style.display = "none";
    }
  }

  // --- animação: cauda / braço / perna / corpo ---
  function animateTail(now) {
    if (!rig || !rig.tail || !rig.tail.node) return;
    const t = now * 0.001;
    const offsetY = Math.sin(t * TAIL_BOB_SPEED) * TAIL_BOB_AMPLITUDE;
    const bob = `translate(0 ${offsetY.toFixed(3)})`;
    const base = rig.tail.baseTransform;
    setSvgTransform(rig.tail.node, base ? `${base} ${bob}` : bob);
  }

  function animateArmWithValues(arm, shoulderRot, elbowBend) {
    if (!arm) return;

    // Guarda o último ângulo aplicado para que outros presets possam partir
    // de onde o braço estava, em vez de saltar de um valor fixo.
    arm.lastShoulder = shoulderRot;
    arm.lastElbow = elbowBend;

    setSvgRotate(arm.meshGroup, shoulderRot, arm.pivots.shoulderX, arm.pivots.shoulderY);
    setSvgRotate(arm.elbowDriver, elbowBend, arm.pivots.elbowX, arm.pivots.elbowY);
    if (arm.meshElbowDriver) {
      const rigidForearmRot = `rotate(${elbowBend.toFixed(3)} ${arm.pivots.elbowX} ${arm.pivots.elbowY})`;
      setSvgTransform(
        arm.meshElbowDriver,
        arm.meshElbowDriverBaseTransform ? `${arm.meshElbowDriverBaseTransform} ${rigidForearmRot}` : rigidForearmRot
      );
    }

    if (arm.handGroup) {
      const shoulderWithinMin = arm.handMirrorShoulderGteDeg == null ? true : shoulderRot >= arm.handMirrorShoulderGteDeg;
      const shoulderWithinMax = arm.handMirrorShoulderLteDeg == null ? true : shoulderRot <= arm.handMirrorShoulderLteDeg;
      const elbowMatchesSign =
        arm.handMirrorElbowSign === "positive" ? elbowBend > 0 : arm.handMirrorElbowSign === "negative" ? elbowBend < 0 : false;
      const autoMirror = arm.mirrorHandOnNegative && shoulderWithinMin && shoulderWithinMax && elbowMatchesSign;
      const shouldMirrorHand = arm.musicaHandMirrorOverride != null ? arm.musicaHandMirrorOverride : autoMirror;

      let handTransform;
      if (shouldMirrorHand) {
        const tilt = arm.handMirrorTiltDeg || 0;
        const mirror = `translate(${arm.pivots.wristX} ${arm.pivots.wristY}) scale(-1 1) rotate(${tilt.toFixed(3)}) translate(${-arm.pivots.wristX} ${-arm.pivots.wristY})`;
        handTransform = arm.handBaseTransform ? `${arm.handBaseTransform} ${mirror}` : mirror;
      } else {
        handTransform = arm.handBaseTransform || "";
      }

      const manualTilt = arm.handManualTiltDeg || 0;
      if (manualTilt !== 0) {
        handTransform += ` rotate(${manualTilt.toFixed(3)} ${arm.pivots.wristX} ${arm.pivots.wristY})`;
      }
      setSvgTransform(arm.handGroup, handTransform);

      // Aplica o mesmo transform ao ukulele e à mão tchau (quando visíveis)
      if (arm.ukeleGroup) {
        const ukeTilt = manualTilt !== 0
          ? `rotate(${manualTilt.toFixed(3)} ${arm.pivots.wristX} ${arm.pivots.wristY})`
          : "";
        setSvgTransform(arm.ukeleGroup, ukeTilt);
      }
      if (arm.tchauGroup) setSvgTransform(arm.tchauGroup, handTransform);
      if (arm.fechadaGroup) setSvgTransform(arm.fechadaGroup, handTransform);
    }

    for (let i = 0; i < arm.meshPaths.length; i++) {
      const path = arm.meshPaths[i];
      if (arm.shadowPath && path === arm.shadowPath && arm.shadowDriver) continue;
      const deformed = deformArmSegments(arm.meshSegmentsBase[i], elbowBend, arm.pivots);
      path.setAttribute("d", serializeAbsolutePath(deformed));
    }

    if (arm.shadowDriver) {
      const shadowRot = `rotate(${(elbowBend * 0.98).toFixed(3)} ${arm.pivots.elbowX} ${arm.pivots.elbowY})`;
      setSvgTransform(arm.shadowDriver, arm.shadowDriverBaseTransform ? `${arm.shadowDriverBaseTransform} ${shadowRot}` : shadowRot);
    }

    const absBend = Math.abs(elbowBend);
    const bendScale = Math.min(absBend, 90);
    const sx = 1 + bendScale * 0.0019;
    const sy = Math.max(0.88, 1 - bendScale * 0.00125);
    setSvgRotateScale(arm.elbowDeform, elbowBend * 0.2, arm.pivots.elbowX, arm.pivots.elbowY, sx, sy);

    if (arm.elbowZone) {
      setSvgRotateScale(arm.elbowZone, elbowBend * 0.24, arm.pivots.elbowX, arm.pivots.elbowY, sx, sy);
    }
  }

  function animateLegWithValues(leg, hipRot, kneeBend, kneeOut = 0) {
    if (!leg) return;

    const hipRotate = `rotate(${hipRot.toFixed(3)} ${leg.pivots.hipX} ${leg.pivots.hipY})`;
    setSvgTransform(leg.meshGroup, composeTransforms(leg.meshGroupBaseTransform, hipRotate));

    const kneeOutTransform = kneeOut ? `translate(${kneeOut.toFixed(3)} 0)` : "";
    const kneeRotate = kneeBend ? `rotate(${kneeBend.toFixed(3)} ${leg.pivots.kneeX} ${leg.pivots.kneeY})` : "";
    setSvgTransform(leg.kneeDriver, composeTransforms(kneeOutTransform, kneeRotate));

    if (leg.ankleDriver) {
      const cancelKnee = kneeBend ? `rotate(${(-kneeBend).toFixed(3)} ${leg.pivots.kneeX} ${leg.pivots.kneeY})` : "";
      const footLock = bodyDropY > 0 || kneeOut ? `translate(${(-kneeOut).toFixed(3)} ${(-bodyDropY).toFixed(3)})` : "";
      setSvgTransform(leg.ankleDriver, composeTransforms(leg.ankleDriverBaseTransform, cancelKnee, footLock));
    }
    if (leg.footGroup) {
      const manualTilt = leg.footManualTiltDeg || 0;
      const tiltRotate = manualTilt !== 0 ? `rotate(${manualTilt.toFixed(3)} ${leg.pivots.ankleX} ${leg.pivots.ankleY})` : "";
      setSvgTransform(leg.footGroup, composeTransforms(leg.footBaseTransform, tiltRotate));
    }

    const footLockY = bodyDropY > 0 ? -bodyDropY : 0;
    for (let i = 0; i < leg.meshPaths.length; i++) {
      const baseSegments = leg.meshSegmentsBase[i];
      if (!baseSegments) continue;
      const deformed = deformLegSegments(baseSegments, kneeBend, leg.pivots, footLockY, kneeOut);
      leg.meshPaths[i].setAttribute("d", serializeAbsolutePath(deformed));
    }

    const absBend = Math.abs(kneeBend);
    const sx = 1 + absBend * 0.0028;
    const sy = 1 - absBend * 0.0022;
    setSvgRotateScale(leg.kneeDeform, kneeBend * 0.22, leg.pivots.kneeX, leg.pivots.kneeY, sx, sy);
  }

  function animateBodyWithSway(body, hipSway) {
    if (!body || !body.pelvisGroup) return;

    const pelvisRotate = `rotate(${hipSway.toFixed(3)} ${body.pivots.hipX} ${body.pivots.hipY})`;

    if (body.meshGroup) setSvgTransform(body.meshGroup, composeTransforms(body.baseTransform, getBodyDropTransform()));
    if (body.pelvisMeshDriver) {
      setSvgTransform(
        body.pelvisMeshDriver,
        body.pelvisMeshDriverBaseTransform ? `${body.pelvisMeshDriverBaseTransform} ${pelvisRotate}` : pelvisRotate
      );
    }
    if (body.tailMeshDriver) {
      setSvgTransform(
        body.tailMeshDriver,
        body.tailMeshDriverBaseTransform ? `${body.tailMeshDriverBaseTransform} ${pelvisRotate}` : pelvisRotate
      );
    }
    setSvgTransform(body.pelvisGroup, body.pelvisBaseTransform ? `${body.pelvisBaseTransform} ${pelvisRotate}` : pelvisRotate);

    if (body.torsoToPelvisBone) {
      const linkRot = `rotate(${(hipSway * 0.32).toFixed(3)} ${body.pivots.hipX} ${body.pivots.hipY})`;
      setSvgTransform(
        body.torsoToPelvisBone,
        body.torsoToPelvisBaseTransform ? `${body.torsoToPelvisBaseTransform} ${linkRot}` : linkRot
      );
    }

    if (body.deformNode) {
      const absSway = Math.abs(hipSway);
      const sx = (1 + absSway * 0.0021).toFixed(4);
      const sy = (1 - absSway * 0.0016).toFixed(4);
      const deformRot = (hipSway * 0.52).toFixed(3);
      const cx = body.pivots.hipX;
      const cy = ((body.pivots.hipY + body.pivots.torsoY) * 0.5).toFixed(3);
      const deformAnim = `translate(${cx} ${cy}) rotate(${deformRot}) scale(${sx} ${sy}) translate(${-cx} ${-cy})`;
      setSvgTransform(body.deformNode, body.deformBaseTransform ? `${body.deformBaseTransform} ${deformAnim}` : deformAnim);
    }

    if (body.torsoGroup) {
      const torsoRot = `rotate(${(hipSway * 0.26).toFixed(3)} ${body.pivots.hipX} ${body.pivots.hipY})`;
      setSvgTransform(body.torsoGroup, body.torsoGroupBaseTransform ? `${body.torsoGroupBaseTransform} ${torsoRot}` : torsoRot);
    }

    for (let i = 0; i < body.torsoPaths.length; i++) {
      const base = body.torsoSegmentsBase[i];
      if (!base) continue;
      const deformed = deformTorsoSegments(base, hipSway, body.pivots);
      body.torsoPaths[i].setAttribute("d", serializeAbsolutePath(deformed));
    }
  }

  // --- preset: Stand by / Falando (giro de cabeça liga/desliga) ---
  function getArmBaseTarget(side) {
    const poses = side === "left" ? ARM_POSE_LEFT : ARM_POSE_RIGHT;
    return poses[idleArmState[side].baseMode];
  }

  function updateArmBaseMode(side, now) {
    const state = idleArmState[side];
    if (now >= state.nextBaseAt) {
      state.baseMode = state.baseMode === "rest" ? "hip" : "rest";
      state.nextBaseAt = now + 5000 + Math.random() * 6000;
    }
  }

  function initIdleState(now) {
    // Os braços partem de onde estavam (ex.: saindo do preset "Pensando"),
    // nunca saltam direto para a pose de descanso - a transição é feita pelo
    // lerp já existente em animateIdlePose.
    for (const side of ["left", "right"]) {
      const poses = side === "left" ? ARM_POSE_LEFT : ARM_POSE_RIGHT;
      const state = idleArmState[side];
      const arm = side === "left" ? rig?.leftArm : rig?.rightArm;
      state.baseMode = "rest";
      state.curS = arm?.lastShoulder ?? poses.rest.shoulder;
      state.curE = arm?.lastElbow ?? poses.rest.elbow;
      state.tgtS = poses.rest.shoulder;
      state.tgtE = poses.rest.elbow;
      state.nextBaseAt = now + 4000 + Math.random() * 5000;
    }
    idleGesture.side = null;
    idleGesture.type = null;
    idleGesture.nextAt = now + 4000 + Math.random() * 5000;

    // idleTiltExtra e bodyDropY não são zerados aqui de propósito: o lerp em
    // animateIdlePose os traz suavemente do valor atual até o novo alvo.
    idleHeadState.tiltTgt = 0;
    idleHeadState.tiltNextAt = now + 2000 + Math.random() * 3000;
    idleHeadState.turnNextAt = now + 3000 + Math.random() * 5000;

    idlePupilState.curX = 0;
    idlePupilState.curY = 0;
    idlePupilState.tgtX = 0;
    idlePupilState.tgtY = 0;
    idlePupilState.nextAt = now + 600 + Math.random() * 1200;
  }

  function animateIdlePose(now, { allowHeadTurn = true, skipArms = false } = {}) {
    if (!rig) return;
    const t = now * 0.001;

    // Agachamento lento (0 a 10px), sincronizado em loop com o bob da cauda.
    // Usa bodyDropY para que a compensação de pernas (joelho/tornozelo)
    // mantenha os pés no chão. O valor é aproximado por lerp (não atribuído
    // direto) para que a troca de preset não dê um salto brusco de altura.
    const idleSquatTarget = IDLE_SQUAT_AMPLITUDE * (0.5 - Math.cos(t * IDLE_SQUAT_SPEED) * 0.5);
    setBodyDropValue(lerp(bodyDropY, idleSquatTarget, 0.06));

    // Sem sway de quadril - apenas o agachamento (translate) é aplicado ao corpo
    animateBodyWithSway(rig.body, 0);

    // Cauda sempre ligada
    animateTail(now);

    // Gesto exclusivo (mão no queixo / coçando a cabeça): nunca os dois
    // braços ao mesmo tempo - apenas um braço por vez, esporadicamente.
    if (!idleGesture.side && now >= idleGesture.nextAt) {
      idleGesture.side = Math.random() < 0.5 ? "left" : "right";
      idleGesture.type = Math.random() < 0.5 ? "chin" : "scratch";
      const duration = idleGesture.type === "chin" ? 2600 + Math.random() * 2200 : 2000 + Math.random() * 1800;
      idleGesture.endsAt = now + duration;
    } else if (idleGesture.side && now >= idleGesture.endsAt) {
      idleGesture.side = null;
      idleGesture.type = null;
      idleGesture.nextAt = now + 6000 + Math.random() * 9000;
    }

    // Braços: descanso/cintura em loop lento, ou gesto exclusivo quando ativo
    // (skipArms: usado pelo modo Tchau, que controla os dois braços por conta própria)
    if (!skipArms) {
      for (const side of ["left", "right"]) {
        const state = idleArmState[side];
        const poses = side === "left" ? ARM_POSE_LEFT : ARM_POSE_RIGHT;
        const arm = side === "left" ? rig.leftArm : rig.rightArm;

        const isGesturing = idleGesture.side === side;
        let speed = state.speed;

        if (isGesturing && idleGesture.type === "chin") {
          state.tgtS = poses.chin.shoulder;
          state.tgtE = poses.chin.elbow;
        } else if (isGesturing && idleGesture.type === "scratch") {
          const wave = (Math.sin(now * 0.016) + 1) / 2;
          state.tgtS = poses.scratch.shoulder;
          state.tgtE = lerp(poses.scratch.elbowA, poses.scratch.elbowB, wave);
          speed = 0.35; // acompanha de perto o movimento de coçar
        } else {
          updateArmBaseMode(side, now);
          const base = getArmBaseTarget(side);
          state.tgtS = base.shoulder;
          state.tgtE = base.elbow;
        }

        state.curS = lerp(state.curS, state.tgtS, speed);
        state.curE = lerp(state.curE, state.tgtE, speed);
        animateArmWithValues(arm, state.curS, state.curE);
      }
    }

    // Pernas: a compensação do agachamento (joelho/tornozelo) é feita por
    // applyBodyDropPose com base em bodyDropY, chamada depois desta função.

    // Giro da cabeça: olhadas rápidas para os lados, retornando logo para
    // frente. No modo "Falando" o giro é desativado - cabeça sempre de frente.
    if (!allowHeadTurn) {
      if (poseIndexToHeadTurnStep(poseIndex) !== 0) setPose(headTurnStepToPoseIndex(0));
    } else if (now >= idleHeadState.turnNextAt) {
      const lookingSideways = poseIndexToHeadTurnStep(poseIndex) !== 0;
      if (lookingSideways) {
        setPose(headTurnStepToPoseIndex(0));
        idleHeadState.turnNextAt = now + 4000 + Math.random() * 6000;
      } else {
        const roll = Math.random();
        const newStep = roll < 0.4 ? -1 : roll < 0.8 ? 1 : roll < 0.9 ? -2 : 2;
        setPose(headTurnStepToPoseIndex(newStep));
        idleHeadState.turnNextAt = now + 700 + Math.random() * 900;
      }
    }

    // Inclinação de cabeça: pequenos movimentos lentos entre -5 e 5 graus
    if (now >= idleHeadState.tiltNextAt) {
      idleHeadState.tiltTgt = Math.random() < 0.5 ? -Math.random() * 5 : Math.random() * 5;
      idleHeadState.tiltNextAt = now + 4000 + Math.random() * 5000;
    }
    idleTiltExtra = lerp(idleTiltExtra, idleHeadState.tiltTgt, 0.012);
  }

  function resetIdlePose() {
    if (!rig) return;

    idleTiltExtra = 0;
    idleGesture.side = null;
    idleGesture.type = null;
    idleArmState.left.curS = idleArmState.left.curE = 0;
    idleArmState.right.curS = idleArmState.right.curE = 0;
    setBodyDropValue(0);
    applyHeadRotation();
    animateArmWithValues(rig.leftArm, 0, 0);
    animateArmWithValues(rig.rightArm, 0, 0);
    animateLegWithValues(rig.leftLeg, 0, 0);
    animateLegWithValues(rig.rightLeg, 0, 0);
    if (rig.body) animateBodyWithSway(rig.body, 0);
    if (rig.tail && rig.tail.node) setSvgTransform(rig.tail.node, rig.tail.baseTransform || "");
  }

  // --- preset: Pensando ---
  function initThinkingState(now) {
    if (!rig) return;
    thinkingArmState.left.curS = rig.leftArm?.lastShoulder ?? 0;
    thinkingArmState.left.curE = rig.leftArm?.lastElbow ?? 0;
    thinkingArmState.right.curS = rig.rightArm?.lastShoulder ?? 0;
    thinkingArmState.right.curE = rig.rightArm?.lastElbow ?? 0;
    idleHeadState.tiltNextAt = now;
  }

  function animateThinkingPose(now) {
    if (!rig) return;
    const t = now * 0.001;

    // Agachamento (0 a 40px). Lerp a partir do valor atual para evitar
    // salto ao trocar de preset.
    const thinkingSquatTarget = THINKING_SQUAT_AMPLITUDE * (0.5 - Math.cos(t * IDLE_SQUAT_SPEED) * 0.5);
    setBodyDropValue(lerp(bodyDropY, thinkingSquatTarget, 0.06));

    animateBodyWithSway(rig.body, 0);
    animateTail(now);

    // Cabeça fixa em 3/4 direita
    if (poseIndexToHeadTurnStep(poseIndex) !== -1) {
      setPose(headTurnStepToPoseIndex(-1));
    }

    // Inclinação de cabeça: movimento lento entre 0 e 20 graus
    if (now >= idleHeadState.tiltNextAt) {
      idleHeadState.tiltTgt = Math.random() * 20;
      idleHeadState.tiltNextAt = now + 3000 + Math.random() * 4000;
    }
    idleTiltExtra = lerp(idleTiltExtra, idleHeadState.tiltTgt, 0.014);

    // Braços: vão até a pose fixa de "pensando", a partir de onde estavam
    for (const side of ["left", "right"]) {
      const state = thinkingArmState[side];
      const target = side === "left" ? THINKING_ARM_TARGET_LEFT : THINKING_ARM_TARGET_RIGHT;
      const arm = side === "left" ? rig.leftArm : rig.rightArm;

      state.curS = lerp(state.curS, target.shoulder, THINKING_ARM_LERP_SPEED);
      state.curE = lerp(state.curE, target.elbow, THINKING_ARM_LERP_SPEED);
      animateArmWithValues(arm, state.curS, state.curE);
    }
  }

  // --- preset: Dormindo ---
  function initSleepingState(now) {
    if (!rig) return;
    sleepPhaseStart = now;
    sleepZNextAt = now + 1200;
    snoreAudio.currentTime = 0;
    snoreAudio.play().catch(() => {});
    sleepArmState.left.curS  = rig.leftArm?.lastShoulder  ?? ARM_POSE_LEFT.rest.shoulder;
    sleepArmState.left.curE  = rig.leftArm?.lastElbow      ?? ARM_POSE_LEFT.rest.elbow;
    sleepArmState.right.curS = rig.rightArm?.lastShoulder ?? ARM_POSE_RIGHT.rest.shoulder;
    sleepArmState.right.curE = rig.rightArm?.lastElbow     ?? ARM_POSE_RIGHT.rest.elbow;
  }

  function spawnSleepZ(now) {
    if (now < sleepZNextAt) return;
    sleepZNextAt = now + 700 + Math.random() * 900;

    // Durante o sono os eyeNodes ficam display:none → usar blinkNodes (visíveis)
    const pose = getActivePose();
    const refNode = pose?.blinkNodes?.length > 0 ? pose.blinkNodes[0] : pose?.eyeNodes?.[0];
    let relX = stage.offsetWidth / 2;
    let relY = stage.offsetHeight * 0.18;

    if (refNode) {
      const refRect = refNode.getBoundingClientRect();
      const stageRect = stage.getBoundingClientRect();
      if (refRect.width > 0 || refRect.height > 0) {
        relX = refRect.left + refRect.width / 2 - stageRect.left;
        relY = refRect.top - stageRect.top - 24;
      }
    }

    const sizes = [28, 36, 48];
    const size = sizes[Math.floor(Math.random() * sizes.length)];
    const xOff = 8 + Math.random() * 44; // ligeiramente à direita da cabeça

    const el = document.createElement("span");
    el.className = "kevin-sleep-z";
    el.textContent = "Z";
    el.style.left = `${relX + xOff}px`;
    el.style.top = `${relY}px`;
    el.style.fontSize = `${size}px`;
    stage.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }

  function animateSleepingPose(now) {
    if (!rig) return;
    const t = (now - sleepPhaseStart) / 1000;
    const sinPhase = Math.sin(t * SLEEP_OSC_SPEED);

    // Cabeça: oscila entre 24° e 35° via idleTiltExtra
    const headTgt = SLEEP_HEAD_CENTER + SLEEP_HEAD_AMP * sinPhase;
    idleTiltExtra = lerp(idleTiltExtra, headTgt, 0.025);
    applyHeadRotation();

    // Body drop: 0–30px, em sincronia com a cabeça
    const bodyTgt = SLEEP_BODY_CENTER + SLEEP_BODY_AMP * sinPhase;
    setBodyDropValue(lerp(bodyDropY, bodyTgt, 0.04));

    animateBodyWithSway(rig.body, 0);
    animateTail(now);

    if (poseIndexToHeadTurnStep(poseIndex) !== 0) setPose(headTurnStepToPoseIndex(0));

    sleepArmState.left.curS  = lerp(sleepArmState.left.curS,  SLEEP_ARM_LEFT.shoulder,  0.04);
    sleepArmState.left.curE  = lerp(sleepArmState.left.curE,  SLEEP_ARM_LEFT.elbow,     0.04);
    sleepArmState.right.curS = lerp(sleepArmState.right.curS, SLEEP_ARM_RIGHT.shoulder, 0.04);
    sleepArmState.right.curE = lerp(sleepArmState.right.curE, SLEEP_ARM_RIGHT.elbow,    0.04);
    animateArmWithValues(rig.leftArm,  sleepArmState.left.curS,  sleepArmState.left.curE);
    animateArmWithValues(rig.rightArm, sleepArmState.right.curS, sleepArmState.right.curE);

    spawnSleepZ(now);
  }

  // --- preset: Celebrate ---
  function celebrateSetFists(visible) {
    for (const arm of [rig?.rightArm, rig?.leftArm]) {
      if (!arm) continue;
      if (arm.handGroup) arm.handGroup.style.display = visible ? "none" : "";
      if (arm.fechadaGroup) {
        if (visible) arm.fechadaGroup.removeAttribute("display");
        arm.fechadaGroup.style.display = visible ? "" : "none";
      }
    }
  }

  function playCelebrateAudio() {
    if (!celebrateAudio) return;
    celebrateAudio.currentTime = 0;
    celebrateAudio.volume = celebrateAudioVolume;
    celebrateAudio.muted = false;
    celebrateAudio.play().catch(() => {});
  }

  function scheduleCelebrateAudio() {
    if (celebrateAudioTimeout != null) clearTimeout(celebrateAudioTimeout);
    celebrateAudioTimeout = setTimeout(() => {
      celebrateAudioTimeout = null;
      playCelebrateAudio();
    }, celebrateAudioPlayDelayMs);
  }

  function spawnCelebrateConfetti() {
    if (!stage) return;
    const count = 72;
    const originX = stage.offsetWidth * 0.5;
    const originY = stage.offsetHeight * 0.34;

    for (let i = 0; i < count; i++) {
      const angle = -Math.PI * 0.95 + Math.random() * Math.PI * 0.9;
      const spread = 110 + Math.random() * 290;
      const drift = -80 + Math.random() * 160;
      const size = 6 + Math.random() * 8;
      const fall = 160 + Math.random() * 230;
      const el = document.createElement("span");

      el.className = "kevin-celebrate-confetti";
      el.style.left = `${originX + drift * 0.2}px`;
      el.style.top = `${originY}px`;
      el.style.width = `${size}px`;
      el.style.height = `${size * (0.45 + Math.random() * 0.9)}px`;
      el.style.background = CELEBRATE_CONFETTI_COLORS[i % CELEBRATE_CONFETTI_COLORS.length];
      el.style.borderRadius = Math.random() > 0.72 ? "50%" : "2px";
      el.style.setProperty("--confetti-x", `${Math.cos(angle) * spread + drift}px`);
      el.style.setProperty("--confetti-y", `${Math.sin(angle) * spread + fall}px`);
      el.style.setProperty("--confetti-rot", `${180 + Math.random() * 720}deg`);
      el.style.animationDuration = `${1150 + Math.random() * 650}ms`;
      el.style.animationDelay = `${Math.random() * 90}ms`;

      stage.appendChild(el);
      setTimeout(() => el.remove(), 1900);
    }
  }

  function initCelebrateState() {
    celebratePhase = "enter";
    celebrateJumpStage = "none";
    celebrateLandingStage = "bounceDown";
    celebrateM3FeetTriggered = false;
    celebrateConfettiFired = false;
    celebrateArmState.rightS = rig?.rightArm?.lastShoulder ?? 0;
    celebrateArmState.rightE = rig?.rightArm?.lastElbow ?? 0;
    celebrateArmState.leftS  = rig?.leftArm?.lastShoulder ?? 0;
    celebrateArmState.leftE  = rig?.leftArm?.lastElbow ?? 0;
    celebrateJumpOffset = 0;
    if (rig?.rightArm) rig.rightArm.musicaHandMirrorOverride = false;
  }

  function cleanupCelebrate() {
    celebratePhase = "off";
    celebrateJumpStage = "none";
    celebrateJumpOffset = 0;
    celebrateLandingStage = "bounceDown";
    celebrateM3FeetTriggered = false;
    celebrateConfettiFired = false;
    if (celebrateAudioTimeout != null) {
      clearTimeout(celebrateAudioTimeout);
      celebrateAudioTimeout = null;
    }
    if (stage) stage.querySelectorAll(".kevin-celebrate-confetti").forEach((el) => el.remove());
    if (rig?.rightArm) rig.rightArm.musicaHandMirrorOverride = null;
    if (rig?.leftLeg) rig.leftLeg.footManualTiltDeg = 0;
    if (rig?.rightLeg) rig.rightLeg.footManualTiltDeg = 0;
    celebrateSetFists(false);
    applyPuppetBaseTransform();
  }

  function animateCelebratePose(now) {
    if (!rig) return;
    const right = rig.rightArm;
    const left = rig.leftArm;

    if (celebratePhase === "enter") {
      celebrateArmState.rightS = lerp(celebrateArmState.rightS, CELEBRATE_INIT_RIGHT.shoulder, CELEBRATE_ARM_LERP);
      celebrateArmState.rightE = lerp(celebrateArmState.rightE, CELEBRATE_INIT_RIGHT.elbow, CELEBRATE_ARM_LERP);
      celebrateArmState.leftS  = lerp(celebrateArmState.leftS,  CELEBRATE_INIT_LEFT.shoulder, CELEBRATE_ARM_LERP);
      celebrateArmState.leftE  = lerp(celebrateArmState.leftE,  CELEBRATE_INIT_LEFT.elbow, CELEBRATE_ARM_LERP);
      setBodyDropValue(lerp(bodyDropY, 0, CELEBRATE_BODY_LERP));
      if (Math.abs(celebrateArmState.rightS - CELEBRATE_INIT_RIGHT.shoulder) < 2 &&
          Math.abs(celebrateArmState.rightE - CELEBRATE_INIT_RIGHT.elbow) < 2 &&
          Math.abs(celebrateArmState.leftS - CELEBRATE_INIT_LEFT.shoulder) < 2 &&
          Math.abs(celebrateArmState.leftE - CELEBRATE_INIT_LEFT.elbow) < 2) {
        celebratePhase = "m1";
      }

    } else if (celebratePhase === "m1") {
      celebrateArmState.rightS = lerp(celebrateArmState.rightS, CELEBRATE_M1_RIGHT.shoulder, CELEBRATE_ARM_LERP);
      celebrateArmState.rightE = lerp(celebrateArmState.rightE, CELEBRATE_M1_RIGHT.elbow, CELEBRATE_ARM_LERP);
      celebrateArmState.leftS  = lerp(celebrateArmState.leftS,  CELEBRATE_M1_LEFT.shoulder, CELEBRATE_ARM_LERP);
      celebrateArmState.leftE  = lerp(celebrateArmState.leftE,  CELEBRATE_M1_LEFT.elbow, CELEBRATE_ARM_LERP);
      setBodyDropValue(lerp(bodyDropY, CELEBRATE_M1_BODY_DROP, CELEBRATE_BODY_LERP));
      if (Math.abs(celebrateArmState.rightS - CELEBRATE_M1_RIGHT.shoulder) < 2 &&
          Math.abs(celebrateArmState.rightE - CELEBRATE_M1_RIGHT.elbow) < 2 &&
          Math.abs(celebrateArmState.leftS - CELEBRATE_M1_LEFT.shoulder) < 2 &&
          Math.abs(celebrateArmState.leftE - CELEBRATE_M1_LEFT.elbow) < 2 &&
          Math.abs(bodyDropY - CELEBRATE_M1_BODY_DROP) < 2) {
        celebrateSetFists(true);
        celebratePhase = "m2";
      }

    } else if (celebratePhase === "m2") {
      celebrateArmState.rightS = lerp(celebrateArmState.rightS, CELEBRATE_M2_RIGHT.shoulder, CELEBRATE_ARM_LERP);
      celebrateArmState.rightE = lerp(celebrateArmState.rightE, CELEBRATE_M2_RIGHT.elbow, CELEBRATE_ARM_LERP);

      const leftTarget = celebrateJumpStage === "none" ? CELEBRATE_M2_LEFT : CELEBRATE_M2_LEFT_LATE;
      celebrateArmState.leftS = lerp(celebrateArmState.leftS, leftTarget.shoulder, CELEBRATE_ARM_LERP);
      celebrateArmState.leftE = lerp(celebrateArmState.leftE, leftTarget.elbow, CELEBRATE_ARM_LERP);

      const footTiltLeftTarget  = celebrateJumpStage === "none" ? 0 : CELEBRATE_FOOT_TILT_LEFT;
      const footTiltRightTarget = celebrateJumpStage === "none" ? 0 : CELEBRATE_FOOT_TILT_RIGHT;
      if (rig.leftLeg)  rig.leftLeg.footManualTiltDeg  = lerp(rig.leftLeg.footManualTiltDeg  ?? 0, footTiltLeftTarget,  CELEBRATE_ARM_LERP);
      if (rig.rightLeg) rig.rightLeg.footManualTiltDeg = lerp(rig.rightLeg.footManualTiltDeg ?? 0, footTiltRightTarget, CELEBRATE_ARM_LERP);

      setBodyDropValue(lerp(bodyDropY, 0, CELEBRATE_BODY_LERP));

      if (celebrateJumpStage === "none" && bodyDropY <= CELEBRATE_JUMP_TRIGGER_BODY_DROP) {
        celebrateJumpStage = "up";
        if (!celebrateConfettiFired) {
          celebrateConfettiFired = true;
          spawnCelebrateConfetti();
        }
      } else if (celebrateJumpStage === "up") {
        celebrateJumpOffset = lerp(celebrateJumpOffset, CELEBRATE_JUMP_HEIGHT, CELEBRATE_JUMP_LERP);
        if (celebrateJumpOffset > CELEBRATE_JUMP_HEIGHT - 2) celebrateJumpStage = "down";
      } else if (celebrateJumpStage === "down") {
        celebrateJumpOffset = lerp(celebrateJumpOffset, 0, CELEBRATE_JUMP_LERP);
        if (celebrateJumpOffset < 2) {
          celebrateJumpOffset = 0;
          celebrateJumpStage = "done";
        }
      }

      if (celebrateJumpStage === "done") {
        celebrateSetFists(false);
        celebrateLandingStage = "bounceDown";
        celebratePhase = "m3";
      }

    } else if (celebratePhase === "m3") {
      celebrateArmState.rightS = lerp(celebrateArmState.rightS, CELEBRATE_M3_RIGHT.shoulder, CELEBRATE_ARM_LERP);
      celebrateArmState.rightE = lerp(celebrateArmState.rightE, CELEBRATE_M3_RIGHT.elbow, CELEBRATE_ARM_LERP);
      celebrateArmState.leftS  = lerp(celebrateArmState.leftS,  CELEBRATE_M3_LEFT.shoulder, CELEBRATE_ARM_LERP);
      celebrateArmState.leftE  = lerp(celebrateArmState.leftE,  CELEBRATE_M3_LEFT.elbow, CELEBRATE_ARM_LERP);

      if (celebrateLandingStage === "bounceDown") {
        setBodyDropValue(lerp(bodyDropY, CELEBRATE_LANDING_BOUNCE, CELEBRATE_BODY_LERP));
        if (bodyDropY > CELEBRATE_LANDING_BOUNCE - 2) celebrateLandingStage = "bounceUp";
      } else {
        setBodyDropValue(lerp(bodyDropY, 0, CELEBRATE_BODY_LERP));
      }

      if (!celebrateM3FeetTriggered && bodyDropY >= CELEBRATE_JUMP_TRIGGER_BODY_DROP) {
        celebrateM3FeetTriggered = true;
      }
      const footTiltLeftTarget  = celebrateM3FeetTriggered ? 0 : CELEBRATE_FOOT_TILT_LEFT;
      const footTiltRightTarget = celebrateM3FeetTriggered ? 0 : CELEBRATE_FOOT_TILT_RIGHT;
      if (rig.leftLeg)  rig.leftLeg.footManualTiltDeg  = lerp(rig.leftLeg.footManualTiltDeg  ?? 0, footTiltLeftTarget,  CELEBRATE_ARM_LERP);
      if (rig.rightLeg) rig.rightLeg.footManualTiltDeg = lerp(rig.rightLeg.footManualTiltDeg ?? 0, footTiltRightTarget, CELEBRATE_ARM_LERP);

      if (celebrateLandingStage === "bounceUp" && bodyDropY < 2 &&
          Math.abs(celebrateArmState.rightS - CELEBRATE_M3_RIGHT.shoulder) < 2 &&
          Math.abs(celebrateArmState.rightE - CELEBRATE_M3_RIGHT.elbow) < 2 &&
          Math.abs(celebrateArmState.leftS - CELEBRATE_M3_LEFT.shoulder) < 2 &&
          Math.abs(celebrateArmState.leftE - CELEBRATE_M3_LEFT.elbow) < 2) {
        cleanupCelebrate();
        currentMode = "standby";
        return;
      }
    }

    if (right) animateArmWithValues(right, celebrateArmState.rightS, celebrateArmState.rightE);
    if (left) animateArmWithValues(left, celebrateArmState.leftS, celebrateArmState.leftE);
    applyPuppetBaseTransform();
    animateBodyWithSway(rig.body, 0);
    animateTail(now);
    if (poseIndexToHeadTurnStep(poseIndex) !== 0) setPose(headTurnStepToPoseIndex(0));
  }

  // --- preset: Musica ---
  function musicaSetArmLayer(layer) {
    if (musicaArmLayer === layer) return;
    const leftArmWrapper  = rig?.leftArm?.meshGroup?.parentNode;
    const torso           = rig?.body?.torsoGroup;
    const rightArmWrapper = getNodeById("_x2B_Right_Arm");
    if (!leftArmWrapper || !torso || !rightArmWrapper) return;
    const parent = torso.parentNode;
    if (!parent || leftArmWrapper.parentNode !== parent) return;

    if (musicaArmLayer === "default") {
      musicaArmOriginalNextSib = leftArmWrapper.nextSibling; // salva posição original
    }

    if (layer === "bottom") {
      // Após o tailMeshDriver (cauda permanece no fundo absoluto), antes das pernas
      const tailDriver = rig?.body?.tailMeshDriver ?? null;
      parent.insertBefore(leftArmWrapper, tailDriver ? tailDriver.nextSibling : parent.firstChild);
    } else if (layer === "mid") {
      parent.insertBefore(leftArmWrapper, rightArmWrapper); // acima do torso, abaixo do braço dir
    } else { // "default"
      if (musicaArmOriginalNextSib && musicaArmOriginalNextSib.parentNode === parent) {
        parent.insertBefore(leftArmWrapper, musicaArmOriginalNextSib);
      } else {
        parent.appendChild(leftArmWrapper); // volta ao final (acima de tudo)
      }
      musicaArmOriginalNextSib = null;
    }
    musicaArmLayer = layer;
  }

  function applyUkuHand(visible) {
    const arm = rig?.leftArm;
    if (!arm) return;
    if (arm.handGroup)  arm.handGroup.style.display  = visible ? "none" : "";
    if (arm.ukeleGroup) arm.ukeleGroup.style.display = visible ? "" : "none";
  }

  function spawnMusicaNote(now) {
    if (now < musicaNoteNextAt) return;
    musicaNoteNextAt = now + 380 + Math.random() * 420;

    const arm = rig?.leftArm;
    let relX = stage.offsetWidth  * 0.62;
    let relY = stage.offsetHeight * 0.52;

    const ukeEl = arm?.ukeleGroup;
    if (ukeEl) {
      const ukeRect = ukeEl.getBoundingClientRect();
      const stageRect = stage.getBoundingClientRect();
      if (ukeRect.width > 0) {
        relX = ukeRect.left + ukeRect.width  * 0.5 - stageRect.left;
        relY = ukeRect.top  + ukeRect.height * 0.25 - stageRect.top;
      }
    }

    const sym  = MUSICA_NOTE_SYMBOLS[Math.floor(Math.random() * MUSICA_NOTE_SYMBOLS.length)];
    const size = 22 + Math.floor(Math.random() * 18);
    const xOff = -30 + Math.random() * 60;

    const el = document.createElement("span");
    el.className = "kevin-musica-note";
    el.textContent = sym;
    el.style.left = `${relX + xOff}px`;
    el.style.top = `${relY}px`;
    el.style.fontSize = `${size}px`;
    stage.appendChild(el);
    setTimeout(() => el.remove(), 2200);
  }

  function initMusicaState(now) {
    if (!rig) return;
    musicaPhase = "m1";
    musicaArmState.curS = rig.leftArm?.lastShoulder ?? 0;
    musicaArmState.curE = rig.leftArm?.lastElbow ?? 0;
    musicaArmLayer = "default";
    musicaArmOriginalNextSib = null;
    if (rig.leftArm) {
      rig.leftArm.musicaHandMirrorOverride = null;
      // Musica começa com a mão padrão; troca para ukulele em M2
      applyUkuHand(false);
    }
  }

  function animateMusicaPose(now) {
    if (!rig) return;
    const arm = rig.leftArm;

    // Alvo do braço esq para fases com lerp direto (não m4)
    const tgt = musicaPhase === "m1"       ? MUSICA_M1
               : musicaPhase === "m2"       ? MUSICA_M2
               : musicaPhase === "exit_m2"  ? MUSICA_M2
               : musicaPhase === "exit_m1"  ? MUSICA_M1
               : musicaPhase === "m3"       ? MUSICA_M3
               : null; // m4 gerencia o próprio lerp

    if (tgt) {
      musicaArmState.curS = lerp(musicaArmState.curS, tgt.shoulder, MUSICA_ARM_LERP);
      musicaArmState.curE = lerp(musicaArmState.curE, tgt.elbow,   MUSICA_ARM_LERP);
    }

    if (musicaPhase === "m1") {
      if (musicaArmLayer !== "bottom" && musicaArmState.curE >= 18) musicaSetArmLayer("bottom");
      if (Math.abs(musicaArmState.curE - MUSICA_M1.elbow) < 3) musicaPhase = "m2";

    } else if (musicaPhase === "m2") {
      if (Math.abs(musicaArmState.curE - MUSICA_M2.elbow) < 4) {
        // Troca de mão exatamente ao chegar em 121°
        applyUkuHand(true);
        musicaPhase = "m3";
      }

    } else if (musicaPhase === "m3") {
      // Ao sair de trás do tronco: sobe para acima do torso mas abaixo do braço dir
      if (musicaArmLayer === "bottom" && musicaArmState.curE <= 15) musicaSetArmLayer("mid");
      if (Math.abs(musicaArmState.curS - MUSICA_M3.shoulder) < 2 &&
          Math.abs(musicaArmState.curE - MUSICA_M3.elbow) < 2) {
        musicaPhase = "m4";
        musicaM4PhaseStart = now;
        musicaM4RightState.curS = rig.rightArm?.lastShoulder ?? 0;
        musicaM4RightState.curE = rig.rightArm?.lastElbow ?? 0;
      }

    } else if (musicaPhase === "exit_m2") {
      // Saída: braço volta atrás do tronco, troca mão de volta para normal
      if (musicaArmLayer !== "bottom" && musicaArmState.curE >= 18) musicaSetArmLayer("bottom");
      if (musicaArmState.curE >= 100) applyUkuHand(false);
      if (arm) arm.handManualTiltDeg = lerp(arm.handManualTiltDeg ?? 0, 0, 0.08);
      musicaM4RightState.curS = lerp(musicaM4RightState.curS, 0, 0.04);
      if (rig.rightArm) animateArmWithValues(rig.rightArm, musicaM4RightState.curS, lerp(rig.rightArm.lastElbow ?? 0, 0, 0.06));
      if (Math.abs(musicaArmState.curE - MUSICA_M2.elbow) < 5) musicaPhase = "exit_m1";

    } else if (musicaPhase === "exit_m1") {
      // Saída: braço sai de trás do tronco e volta à posição original
      if (musicaArmLayer !== "default" && musicaArmState.curE <= 18) musicaSetArmLayer("default");
      if (arm) arm.handManualTiltDeg = lerp(arm.handManualTiltDeg ?? 0, 0, 0.08);
      musicaM4RightState.curS = lerp(musicaM4RightState.curS, 0, 0.04);
      if (rig.rightArm) animateArmWithValues(rig.rightArm, musicaM4RightState.curS, lerp(rig.rightArm.lastElbow ?? 0, 0, 0.06));
      if (Math.abs(musicaArmState.curE - MUSICA_M1.elbow) < 3) {
        const cb = musicaExitCallback;
        musicaExiting = false;
        musicaExitCallback = null;
        cleanupMusica();
        if (cb) cb();
        return;
      }

    } else { // "m4" — loop de tocar ukulele
      const t4 = (now - musicaM4PhaseStart) / 1000;
      const strumSin = Math.sin(t4 * MUSICA_STRUM_FREQ * Math.PI * 2);

      musicaArmState.curS = lerp(musicaArmState.curS, MUSICA_M4_LEFT.shoulder, 0.04);
      musicaArmState.curE = lerp(musicaArmState.curE, MUSICA_M4_LEFT.elbow, 0.04);
      if (arm) arm.handManualTiltDeg = lerp(arm.handManualTiltDeg ?? 0, MUSICA_M4_LEFT_TILT, 0.05);

      musicaM4RightState.curS = lerp(musicaM4RightState.curS, MUSICA_M4_RIGHT_SHOULDER, 0.04);
      const rightElbowTarget = MUSICA_M4_RIGHT_ELBOW_MID + MUSICA_M4_RIGHT_ELBOW_AMP * strumSin;
      // Segue a senoide do strum por lerp (não salta direto) — entra suave ao chegar em M4
      musicaM4RightState.curE = lerp(musicaM4RightState.curE, rightElbowTarget, 0.15);
      if (rig.rightArm) animateArmWithValues(rig.rightArm, musicaM4RightState.curS, musicaM4RightState.curE);

      const bodyTgt = MUSICA_M4_BODY_MID + MUSICA_M4_BODY_MID * strumSin;
      setBodyDropValue(lerp(bodyDropY, bodyTgt, 0.08));

      idleTiltExtra = lerp(idleTiltExtra, MUSICA_M4_HEAD_AMP * strumSin, 0.08);

      spawnMusicaNote(now);
      animateBodyWithSway(rig.body, 0);
      animateTail(now);
      if (poseIndexToHeadTurnStep(poseIndex) !== 0) setPose(headTurnStepToPoseIndex(0));

      if (arm) animateArmWithValues(arm, musicaArmState.curS, musicaArmState.curE);
      return;
    }

    // Todas as fases exceto m4 (que retorna acima)
    if (arm) animateArmWithValues(arm, musicaArmState.curS, musicaArmState.curE);
    setBodyDropValue(lerp(bodyDropY, 0, 0.04));
    animateBodyWithSway(rig.body, 0);
    animateTail(now);
    if (poseIndexToHeadTurnStep(poseIndex) !== 0) setPose(headTurnStepToPoseIndex(0));
    idleTiltExtra = lerp(idleTiltExtra, 0, 0.02);
  }

  function cleanupMusica() {
    if (rig?.leftArm) {
      rig.leftArm.musicaHandMirrorOverride = null;
      rig.leftArm.handManualTiltDeg = 0;
    }
    if (rig?.rightArm) rig.rightArm.handManualTiltDeg = 0;
    musicaSetArmLayer("default");
    musicaPhase = "m1";
    musicaExiting = false;
    musicaExitCallback = null;
    if (stage) stage.querySelectorAll(".kevin-musica-note").forEach((el) => el.remove());
    applyUkuHand(false);
  }

  // Inicia a saída animada do modo Musica (M4 → exit_m2 → exit_m1) e chama o
  // callback ao final. Se já estiver em M1 (ou musica não estiver ativa),
  // encerra na hora.
  function startMusicaExit(callback) {
    if (currentMode !== "musica" && !musicaExiting) {
      if (callback) callback();
      return;
    }
    if (musicaPhase === "m1") {
      cleanupMusica();
      if (callback) callback();
      return;
    }
    if (!musicaExiting) {
      musicaPhase = (musicaPhase === "m2") ? "exit_m1" : "exit_m2";
      musicaExiting = true;
    }
    musicaExitCallback = callback ?? null;
  }

  // --- preset: Tchau ---
  function initTchauState(now) {
    tchauPhase = "entering";
    tchauArmState.curS = rig?.rightArm?.lastShoulder ?? 0;
    tchauArmState.curE = rig?.rightArm?.lastElbow   ?? 0;
    tchauLeftArmState.curS = rig?.leftArm?.lastShoulder ?? 0;
    tchauLeftArmState.curE = rig?.leftArm?.lastElbow   ?? 0;
    tchauWaveStart = 0;
  }

  function cleanupTchau() {
    tchauPhase = "off";
    const arm = rig?.rightArm;
    if (arm) {
      if (arm.handGroup)  arm.handGroup.style.display  = "";
      if (arm.tchauGroup) arm.tchauGroup.style.display = "none";
    }
  }

  function animateTchauMode(now) {
    if (!rig) return;
    const rightArm = rig.rightArm;
    const leftArm = rig.leftArm;
    if (!rightArm) return;

    // Corpo, cauda e cabeça seguem o mesmo idle do modo Falando (cabeça frontal);
    // skipArms: true porque os dois braços são controlados abaixo, com exclusividade.
    animateIdlePose(now, { allowHeadTurn: false, skipArms: true });

    // Braço esquerdo em descanso enquanto o direito acena
    const restLeft = ARM_POSE_LEFT.rest;
    tchauLeftArmState.curS = lerp(tchauLeftArmState.curS, restLeft.shoulder, 0.05);
    tchauLeftArmState.curE = lerp(tchauLeftArmState.curE, restLeft.elbow,   0.05);
    if (leftArm) animateArmWithValues(leftArm, tchauLeftArmState.curS, tchauLeftArmState.curE);

    if (tchauPhase === "entering") {
      tchauArmState.curS = lerp(tchauArmState.curS, TCHAU_SHOULDER, 0.2);
      tchauArmState.curE = lerp(tchauArmState.curE, TCHAU_ELBOW_MID, 0.2);
      // Troca de mão ao chegar perto de 55°
      if (tchauArmState.curS >= TCHAU_SHOULDER - 2) {
        if (rightArm.handGroup)  rightArm.handGroup.style.display  = "none";
        if (rightArm.tchauGroup) {
          rightArm.tchauGroup.removeAttribute("display"); // limpa atributo setado por showExtra/initDefaultVisibility
          rightArm.tchauGroup.style.display = "";
        }
      }
      if (Math.abs(tchauArmState.curS - TCHAU_SHOULDER) < 1.5) {
        tchauPhase = "waving";
        tchauWaveStart = now;
      }

    } else if (tchauPhase === "waving") {
      const t = (now - tchauWaveStart) / 1000;
      const cycles = t * TCHAU_WAVE_FREQ;
      if (cycles >= TCHAU_WAVE_CYCLES) {
        tchauPhase = "exiting";
      } else {
        const waveSin = Math.sin(cycles * Math.PI * 2);
        tchauArmState.curS = TCHAU_SHOULDER;
        tchauArmState.curE = TCHAU_ELBOW_MID + TCHAU_ELBOW_AMP * waveSin;
      }

    } else if (tchauPhase === "exiting") {
      tchauArmState.curS = lerp(tchauArmState.curS, 0, 0.2);
      tchauArmState.curE = lerp(tchauArmState.curE, 0, 0.2);
      if (Math.abs(tchauArmState.curS) < 2 && Math.abs(tchauArmState.curE) < 2) {
        cleanupTchau();
        currentMode = "standby";
        if (openingPendingSpeaking) {
          openingPendingSpeaking = false;
          setModeInternal("speaking");
        }
        return;
      }
      // Restaura mão padrão assim que o braço estiver descendo
      if (rightArm.tchauGroup && rightArm.tchauGroup.style.display !== "none") {
        if (rightArm.handGroup)  rightArm.handGroup.style.display  = "";
        if (rightArm.tchauGroup) rightArm.tchauGroup.style.display = "none";
      }
    }

    animateArmWithValues(rightArm, tchauArmState.curS, tchauArmState.curE);
  }

  // --- agachamento: compensação de pernas (joelho/tornozelo) ---
  function applyBodyDropPose() {
    if (!rig) return;

    if (rig.body && rig.body.meshGroup && activeMode === "off") {
      setSvgTransform(rig.body.meshGroup, composeTransforms(rig.body.baseTransform, getBodyDropTransform()));
    }
    applyHeadRotation();

    const dropNorm = smoothstep(0, BODY_DROP_MAX, bodyDropY);
    if (dropNorm <= 0) {
      if (activeMode === "off") {
        animateLegWithValues(rig.leftLeg, 0, 0);
        animateLegWithValues(rig.rightLeg, 0, 0);
      }
      return;
    }

    const kneeOut = BODY_DROP_KNEE_OUT_MAX * dropNorm;
    animateLegWithValues(rig.leftLeg, 0, 0, kneeOut * rig.leftLeg.hipSign);
    animateLegWithValues(rig.rightLeg, 0, 0, kneeOut * rig.rightLeg.hipSign);
  }

  // --- Mosca (animação independente dos modos de idle - roda em paralelo) ---
  function setMoscaTransform(x, y) {
    const node = rig?.extras?.mosca;
    if (!node) return;
    const dx = x - MOSCA_ORIGIN_X;
    const dy = y - MOSCA_ORIGIN_Y;
    node.setAttribute("transform", `translate(${dx.toFixed(2)} ${dy.toFixed(2)})`);
  }

  function setMoscaWingFrame(idx) {
    const frames = rig?.extras?.moscaWingFrames;
    if (!frames) return;
    frames.forEach((f, i) => {
      if (!f) return;
      if (i === idx) f.removeAttribute("display");
      else f.setAttribute("display", "none");
    });
  }

  function setLinguaFrame(side, idx) {
    const frames = side === "left" ? rig?.extras?.linguaLeftFrames : rig?.extras?.linguaRightFrames;
    if (!frames) return;
    frames.forEach((f, i) => {
      if (!f) return;
      if (i === idx) f.removeAttribute("display");
      else f.setAttribute("display", "none");
    });
  }

  function moscaPickZone() {
    const totalWeight = MOSCA_ZONES.reduce((s, z) => s + z.weight, 0);
    let r = Math.random() * totalWeight;
    for (const z of MOSCA_ZONES) {
      r -= z.weight;
      if (r <= 0) return z;
    }
    return MOSCA_ZONES[0];
  }

  function moscaPickTarget(now) {
    const z = moscaPickZone();
    moscaState.tgtX = z.minX + Math.random() * (z.maxX - z.minX);
    moscaState.tgtY = z.minY + Math.random() * (z.maxY - z.minY);
    moscaState.tgtChangeAt = now + 2000 + Math.random() * 3000;
  }

  function startMoscaInternal() {
    if (!rig?.extras?.mosca) return;
    const now = performance.now();
    const corners = [
      { x: -80, y: -80 }, { x: 1104, y: -80 },
      { x: -80, y: 1192 }, { x: 1104, y: 1192 },
    ];
    const c = corners[Math.floor(Math.random() * 4)];
    const entryZone = moscaPickZone();
    const toX = entryZone.minX + Math.random() * (entryZone.maxX - entryZone.minX);
    const toY = entryZone.minY + Math.random() * (entryZone.maxY - entryZone.minY);

    Object.assign(moscaState, {
      x: c.x, y: c.y, vx: 0, vy: 0,
      entering: true,
      entryStartAt: now,
      entryDuration: 1600 + Math.random() * 800,
      entryFromX: c.x, entryFromY: c.y,
      entryToX: toX, entryToY: toY,
      wingIdx: 0, wingDir: 1, wingNextAt: now,
      lastNow: now,
    });
    const armL = rig?.leftArm;
    const armR = rig?.rightArm;
    moscaState.armLeft.curS  = armL?.lastShoulder ?? ARM_POSE_LEFT.rest.shoulder;
    moscaState.armLeft.curE  = armL?.lastElbow    ?? ARM_POSE_LEFT.rest.elbow;
    moscaState.armLeft.mode  = "rest";
    moscaState.armLeft.nextAt = now + 2000 + Math.random() * 2000;
    moscaState.armRight.curS = armR?.lastShoulder ?? ARM_POSE_RIGHT.rest.shoulder;
    moscaState.armRight.curE = armR?.lastElbow    ?? ARM_POSE_RIGHT.rest.elbow;
    moscaState.armRight.mode  = "rest";
    moscaState.armRight.nextAt = now + 2500 + Math.random() * 2000;
    moscaState.bodyPhaseStart = now;
    moscaState.bodyDrop       = bodyDropY;
    moscaState.linguaIdx           = 0;
    moscaState.linguaDir           = 1;
    moscaState.linguaNextAt        = 0;
    moscaState.linguaCooldownUntil = 0;
    moscaState.linguaFired         = false;

    moscaActive = true;
    setMoscaTransform(c.x, c.y);
    rig.extras.mosca.removeAttribute("display");
    setMoscaWingFrame(0);
  }

  function stopMoscaInternal() {
    moscaActive = false;
    moscaState.exiting = false;
    moscaState.tiltTgt = 0;
    const node = rig?.extras?.mosca;
    if (node) node.setAttribute("display", "none");
    showExtra("mouthLinguaLeft",  false);
    showExtra("mouthLinguaRight", false);
    showExtra("linguaLeft",  false);
    showExtra("linguaRight", false);
    setPose(headTurnStepToPoseIndex(0));
  }

  function dismissMoscaInternal() {
    if (!moscaActive || moscaState.exiting) return;
    const now = performance.now();
    const corners = [
      { x: -80, y: -80 }, { x: 1104, y: -80 },
      { x: -80, y: 1192 }, { x: 1104, y: 1192 },
    ];
    let best = corners[0];
    let bestDist = Infinity;
    for (const c of corners) {
      const d = Math.hypot(c.x - moscaState.x, c.y - moscaState.y);
      if (d < bestDist) { bestDist = d; best = c; }
    }
    moscaState.entering = false;
    moscaState.exiting = true;
    moscaState.exitStartAt = now;
    moscaState.exitDuration = 1200 + Math.random() * 500;
    moscaState.exitFromX = moscaState.x;
    moscaState.exitFromY = moscaState.y;
    moscaState.exitToX = best.x;
    moscaState.exitToY = best.y;
  }

  function moscaTrackPupils(svgX, svgY) {
    const pose = getActivePose();
    if (!pose?.pupilTrackPairs?.length) return;
    for (const pair of pose.pupilTrackPairs) {
      const box = pair.eyeballNode.getBBox();
      const cx = box.x + box.width * 0.5;
      const cy = box.y + box.height * 0.5;
      const maxX = Math.max(1.5, box.width  * PUPIL_TRACK_X_RATIO);
      const maxY = Math.max(1.5, box.height * PUPIL_TRACK_Y_RATIO);
      let dx = svgX - cx;
      let dy = svgY - cy;
      const norm = Math.hypot(dx / maxX, dy / maxY);
      if (norm > 1) { dx /= norm; dy /= norm; }
      const move = `translate(${formatSignedNum(dx)} ${formatSignedNum(dy)})`;
      setSvgTransform(pair.pupilNode, pair.baseTransform ? `${pair.baseTransform} ${move}` : move);
    }
  }

  // Calcula o raio invisível da língua (da boca em direção à mosca) em espaço de tela.
  function getTongueBeam(linguaSide) {
    const mouthEl = linguaSide === "left" ? rig?.extras?.mouthLeft : rig?.extras?.mouthRight;
    if (!mouthEl) return null;
    const ctm = mouthEl.getScreenCTM();
    if (!ctm) return null;
    const box = mouthEl.getBoundingClientRect();
    if (box.width === 0 && box.height === 0) return null;

    const mouthSX = (box.left + box.right)  * 0.5;
    const mouthSY = (box.top  + box.bottom) * 0.5;

    const localDirX = linguaSide === "left" ? 1 : -1;
    const rawDX = ctm.a * localDirX;
    const rawDY = ctm.b * localDirX;
    const scale = Math.hypot(rawDX, rawDY) || 1;
    const dx = rawDX / scale;
    const dy = rawDY / scale;

    const svg = mouthEl.ownerSVGElement;
    const svgCtm = svg?.getScreenCTM();
    if (!svgCtm) return null;
    const pt = svg.createSVGPoint();
    pt.x = moscaState.x; pt.y = moscaState.y;
    const fly = pt.matrixTransform(svgCtm);

    const toFlyX = fly.x - mouthSX;
    const toFlyY = fly.y - mouthSY;
    const projDist = toFlyX * dx + toFlyY * dy;
    const perpDist = Math.abs(-toFlyX * dy + toFlyY * dx);
    const perpThreshPx = LINGUA_BEAM_PERP_SVG * scale;
    const reachPx = LINGUA_REACH_SVG.map((r) => r * scale);

    return {
      projDist, perpDist, perpThreshPx, reachPx,
      inBeam: projDist > 0 && projDist <= reachPx[2] + 15 && perpDist <= perpThreshPx,
    };
  }

  function animateMosca(now) {
    if (!moscaActive) {
      if (Math.abs(moscaState.tiltCur) > 0.01) {
        moscaState.tiltCur = lerp(moscaState.tiltCur, 0, 0.06);
        applyHeadRotation();
      }
      if (moscaState.bodyDrop > 0.05) {
        moscaState.bodyDrop = lerp(moscaState.bodyDrop, 0, 0.05);
        setBodyDropValue(moscaState.bodyDrop);
        applyBodyDropPose();
      } else if (moscaState.bodyDrop > 0) {
        moscaState.bodyDrop = 0;
        setBodyDropValue(0);
        applyBodyDropPose();
      }
      return;
    }
    if (!rig?.extras?.mosca) return;

    const dt = Math.min((now - moscaState.lastNow) / 1000, 0.05);
    moscaState.lastNow = now;

    if (now >= moscaState.wingNextAt) {
      moscaState.wingIdx += moscaState.wingDir;
      if (moscaState.wingIdx >= MOSCA_WING_IDS.length - 1) { moscaState.wingIdx = MOSCA_WING_IDS.length - 1; moscaState.wingDir = -1; }
      else if (moscaState.wingIdx <= 0) { moscaState.wingIdx = 0; moscaState.wingDir = 1; }
      setMoscaWingFrame(moscaState.wingIdx);
      moscaState.wingNextAt = now + MOSCA_WING_MS;
    }

    if (moscaState.entering) {
      const rawT = Math.min((now - moscaState.entryStartAt) / moscaState.entryDuration, 1);
      const t = rawT < 0.5 ? 2 * rawT * rawT : -1 + (4 - 2 * rawT) * rawT;
      moscaState.x = moscaState.entryFromX + (moscaState.entryToX - moscaState.entryFromX) * t;
      moscaState.y = moscaState.entryFromY + (moscaState.entryToY - moscaState.entryFromY) * t;
      setMoscaTransform(moscaState.x, moscaState.y);
      if (rawT >= 1) { moscaState.entering = false; moscaPickTarget(now); }
      return;
    }

    if (moscaState.exiting) {
      const rawT = Math.min((now - moscaState.exitStartAt) / moscaState.exitDuration, 1);
      const t = rawT < 0.5 ? 2 * rawT * rawT : -1 + (4 - 2 * rawT) * rawT;
      moscaState.x = moscaState.exitFromX + (moscaState.exitToX - moscaState.exitFromX) * t;
      moscaState.y = moscaState.exitFromY + (moscaState.exitToY - moscaState.exitFromY) * t;
      setMoscaTransform(moscaState.x, moscaState.y);
      if (rawT >= 1) stopMoscaInternal();
      return;
    }

    if (now >= moscaState.tgtChangeAt) moscaPickTarget(now);

    const dx = moscaState.tgtX - moscaState.x;
    const dy = moscaState.tgtY - moscaState.y;
    const dist = Math.hypot(dx, dy) || 1;

    if (dist > 10) {
      moscaState.vx += (dx / dist * MOSCA_SPEED - moscaState.vx) * 3.5 * dt;
      moscaState.vy += (dy / dist * MOSCA_SPEED - moscaState.vy) * 3.5 * dt;
    }
    moscaState.vx += (Math.random() - 0.5) * MOSCA_SPEED * 0.5;
    moscaState.vy += (Math.random() - 0.5) * MOSCA_SPEED * 0.5;

    const spd = Math.hypot(moscaState.vx, moscaState.vy) || 1;
    if (spd > MOSCA_SPEED * 1.4) {
      moscaState.vx = moscaState.vx / spd * MOSCA_SPEED * 1.4;
      moscaState.vy = moscaState.vy / spd * MOSCA_SPEED * 1.4;
    }

    moscaState.x += moscaState.vx * dt;
    moscaState.y += moscaState.vy * dt;

    const b = MOSCA_BOUNDS;
    if (moscaState.x < b.minX) { moscaState.x = b.minX; moscaState.vx = Math.abs(moscaState.vx); }
    if (moscaState.x > b.maxX) { moscaState.x = b.maxX; moscaState.vx = -Math.abs(moscaState.vx); }
    if (moscaState.y < b.minY) { moscaState.y = b.minY; moscaState.vy = Math.abs(moscaState.vy); }
    if (moscaState.y > b.maxY) { moscaState.y = b.maxY; moscaState.vy = -Math.abs(moscaState.vy); }

    setMoscaTransform(moscaState.x, moscaState.y);

    // Giro da cabeça por zona horizontal
    const relX = moscaState.x - MOSCA_CHAR_CENTER_X;
    const targetStep =
      relX < -320 ? -2 :
      relX < -150 ? -1 :
      relX <  150 ?  0 :
      relX <  320 ?  1 : 2;
    if (poseIndexToHeadTurnStep(poseIndex) !== targetStep) {
      setPose(headTurnStepToPoseIndex(targetStep));
    }

    // Inclinação da cabeça por Y (acima dos olhos → olha pra cima)
    const rawTilt = (MOSCA_EYE_LEVEL_Y - moscaState.y) / 750 * 22;
    moscaState.tiltTgt = Math.max(-18, Math.min(18, targetStep > 0 ? -rawTilt : rawTilt));
    moscaState.tiltCur = lerp(moscaState.tiltCur, moscaState.tiltTgt, 0.05);
    applyHeadRotation();

    moscaTrackPupils(moscaState.x, moscaState.y);

    // Língua: raio invisível da boca detecta a mosca → dispara animação → captura
    const inProfile = targetStep !== 0;
    const linguaSide = targetStep < 0 ? "right" : "left";
    if (inProfile) {
      const inCooldown = now < moscaState.linguaCooldownUntil;
      const beam = !inCooldown && !moscaState.linguaFired ? getTongueBeam(linguaSide) : null;

      if (beam?.inBeam) {
        moscaState.linguaFired = true;
        moscaState.linguaIdx   = 0;
        moscaState.linguaDir   = 1;
        moscaState.linguaNextAt = now;
      }

      const tongueOn = moscaState.linguaFired;
      showExtra("mouthLinguaLeft",  tongueOn && linguaSide === "left");
      showExtra("mouthLinguaRight", tongueOn && linguaSide === "right");
      showExtra("linguaLeft",  tongueOn && linguaSide === "left");
      showExtra("linguaRight", tongueOn && linguaSide === "right");

      if (tongueOn) {
        if (now >= moscaState.linguaNextAt) {
          moscaState.linguaIdx += moscaState.linguaDir;
          const maxIdx = LINGUA_LEFT_FRAME_IDS.length - 1;
          if (moscaState.linguaIdx >= maxIdx) {
            moscaState.linguaIdx = maxIdx;
            moscaState.linguaDir = -1;
          } else if (moscaState.linguaIdx <= 0) {
            moscaState.linguaIdx  = 0;
            moscaState.linguaDir  = 1;
            moscaState.linguaFired = false;
            moscaState.linguaCooldownUntil = now + 3000;
            showExtra("linguaLeft",  false); showExtra("linguaRight", false);
            showExtra("mouthLinguaLeft", false); showExtra("mouthLinguaRight", false);
          }
          if (moscaState.linguaFired) setLinguaFrame(linguaSide, moscaState.linguaIdx);
          moscaState.linguaNextAt = now + LINGUA_FRAME_MS;
        }

        // Captura: só no frame máximo (língua totalmente estendida)
        const maxIdx = LINGUA_LEFT_FRAME_IDS.length - 1;
        if (moscaState.linguaIdx === maxIdx) {
          const hitBeam = getTongueBeam(linguaSide);
          if (hitBeam && hitBeam.projDist > 0
              && hitBeam.projDist  <= hitBeam.reachPx[maxIdx]
              && hitBeam.perpDist  <= hitBeam.perpThreshPx) {
            stopMoscaInternal();
            return;
          }
        }
      }
    } else {
      showExtra("mouthLinguaLeft",  false); showExtra("mouthLinguaRight", false);
      showExtra("linguaLeft",  false); showExtra("linguaRight", false);
      moscaState.linguaIdx   = 0;
      moscaState.linguaDir   = 1;
      moscaState.linguaFired = false;
    }

    // Braços: alternância suave descanso <-> cintura
    for (const [armRef, poses, st] of [
      [rig.leftArm,  ARM_POSE_LEFT,  moscaState.armLeft],
      [rig.rightArm, ARM_POSE_RIGHT, moscaState.armRight],
    ]) {
      if (now >= st.nextAt) {
        st.mode  = st.mode === "rest" ? "hip" : "rest";
        st.nextAt = now + 3000 + Math.random() * 4000;
      }
      const pose = poses[st.mode];
      st.curS = lerp(st.curS, pose.shoulder, 0.025);
      st.curE = lerp(st.curE, pose.elbow,    0.025);
      animateArmWithValues(armRef, st.curS, st.curE);
    }

    // Corpo: oscilação suave 0–10 px com período de ~3 s
    const bodyPhase = (now - moscaState.bodyPhaseStart) / 3000 * Math.PI * 2;
    const bodyTarget = 5 - 5 * Math.cos(bodyPhase);
    moscaState.bodyDrop = lerp(moscaState.bodyDrop, bodyTarget, 0.08);
    setBodyDropValue(moscaState.bodyDrop);
    applyBodyDropPose();
  }

  // Lógica de setMode() extraída pra função interna, reutilizada pela sequência
  // de abertura (ver runOpeningSequence) sem duplicar o fluxo de mic/prioridade.
  async function setModeInternal(mode) {
    if (!VALID_MODES.includes(mode)) {
      console.warn(`KevinPuppet: modo desconhecido "${mode}".`);
      return false;
    }

    if (mode === "tchau" && currentMode === "tchau" && tchauPhase !== "off") {
      cleanupTchau();
      currentMode = "off";
      return true;
    }
    if (mode === "tchau" && (currentMode === "musica" || musicaExiting || currentMode === "celebrate" || celebratePhase !== "off")) {
      return false;
    }
    if (mode === currentMode) return true;

    if (mode === "speaking" || mode === "musica" || mode === "tchau") {
      const ok = await activeAudioInput.start();
      if (!ok) {
        onError(`Nao foi possivel iniciar a entrada de audio para o modo "${mode}".`);
        return false;
      }
    }

    // Saindo da Musica: dispara a animação de guardar o ukulele antes de
    // aplicar o novo modo (que só aparece quando ela terminar).
    if (currentMode === "musica" && mode !== "musica") {
      startMusicaExit(null);
    }

    if (currentMode === "celebrate" && mode !== "celebrate") {
      cleanupCelebrate();
    }

    if (mode === "celebrate") {
      if (currentMode === "tchau" || tchauPhase !== "off") cleanupTchau();
      scheduleCelebrateAudio();
    }

    if (moscaActive && (mode === "musica" || mode === "sleeping" || mode === "thinking" || mode === "celebrate" || mode === "tchau")) {
      dismissMoscaInternal();
    }

    currentMode = mode;
    return true;
  }

  // Mic deve continuar rodando enquanto qualquer modo que o usa estiver ativo
  // (inclui a saída animada da Musica e o gesto do Tchau em andamento).
  function isMicNeeded() {
    return currentMode === "speaking" || currentMode === "musica" || musicaExiting
      || currentMode === "tchau" || tchauPhase !== "off";
  }

  // --- loop principal ---
  function animate(now) {
    if (!rig) return;
    updateTeaching();
    updateCamuflage();

    activeMode = (currentMode === "musica" || musicaExiting) ? "musica"
      : (currentMode === "celebrate" || celebratePhase !== "off") ? "celebrate"
      : (currentMode === "tchau" || tchauPhase !== "off") ? "tchau"
      : currentMode; // off | standby | speaking | thinking | sleeping

    // Musica e Celebrate têm prioridade sobre o Tchau se houver uma corrida
    // entre chamadas programáticas.
    if ((activeMode === "musica" || activeMode === "celebrate") && tchauPhase !== "off") {
      cleanupTchau();
    }

    if (activeMode === "standby" || activeMode === "speaking") {
      if (previousMode !== "standby" && previousMode !== "speaking") initIdleState(now);
      animateIdlePose(now, { allowHeadTurn: activeMode === "standby" });
    } else if (activeMode === "celebrate") {
      if (previousMode !== "celebrate") initCelebrateState();
      animateCelebratePose(now);
    } else if (activeMode === "tchau") {
      if (previousMode !== "tchau") initTchauState(now);
      animateTchauMode(now);
    } else if (activeMode === "thinking") {
      if (previousMode !== "thinking") initThinkingState(now);
      animateThinkingPose(now);
    } else if (activeMode === "sleeping") {
      if (previousMode !== "sleeping") initSleepingState(now);
      animateSleepingPose(now);
    } else if (activeMode === "musica") {
      if (previousMode !== "musica") initMusicaState(now);
      animateMusicaPose(now);
    } else {
      if (previousMode !== "off") resetIdlePose();
    }

    applyBodyDropPose();

    // Ao sair do sleeping para qualquer modo, para o ronco (cobre todos os
    // jeitos de sair: setMode direto, Mosca acordando, Tchau/Celebrate/Musica
    // interrompendo).
    if (previousMode === "sleeping" && activeMode !== "sleeping") {
      snoreAudio.pause();
      snoreAudio.currentTime = 0;
    }

    previousMode = activeMode;

    if (!moscaActive || moscaState.entering) {
      if (activeMode !== "off") {
        updateIdlePupils(now);
      }
    }
    animateMosca(now);
    updateBlink(now);

    if ((currentMode === "musica" || musicaExiting) && musicaPhase === "m4") {
      setMouthByAudioLevel(now, activeAudioInput.update());
    } else if (activeMode === "celebrate") {
      setMouthShape("Aa");
    } else if (activeMode === "standby" || activeMode === "thinking" || activeMode === "sleeping" || activeMode === "musica") {
      setMouthShape("Neutral");
    } else if (activeMode === "speaking" || activeMode === "tchau") {
      setMouthByAudioLevel(now, activeAudioInput.update());
    } else {
      setMouthShape("Neutral");
    }

    if (!isMicNeeded() && activeAudioInput.enabled) activeAudioInput.stop();

    rafHandle = requestAnimationFrame(animate);
  }

  // --- boot: carrega o SVG e monta o rig ---
  const response = await fetch(svgUrl);
  if (!response.ok) {
    onError(`Erro ao buscar SVG (${response.status}): ${svgUrl}`);
    throw new Error(`KevinPuppet: erro ao buscar SVG (${response.status}).`);
  }
  mount.innerHTML = await response.text();
  puppet = mount.querySelector("#_x2B_Puppet") || mount.querySelector("svg");
  if (!puppet) {
    onError("Falha ao carregar o rig (SVG sem o grupo esperado).");
    throw new Error("KevinPuppet: SVG invalido.");
  }

  buildRigState();
  initDefaultVisibility();

  // Posição/escala fixa do personagem sobre o fundo (ver PUPPET_BASE_*).
  applyPuppetBaseTransform();

  setPose(0);
  nextBlinkAt = performance.now() + 900;
  rafHandle = requestAnimationFrame(animate);

  if (autoOpening) {
    // Kevin já em standby, congelado no 1º frame da cortina, esperando o
    // clique em "Iniciar" - o popup cobre a cena até lá.
    currentMode = "standby";
    entradaVideo.style.display = "block";
    entradaVideo.currentTime = 0;
    openingStartBtn.addEventListener("click", () => {
      openingCard.style.display = "none";
      runEntradaAnimation().then(() => {
        openingPendingSpeaking = true;
        setModeInternal("tchau");
      });
    });
  }

  // --- API pública ---
  const VALID_MODES = ["off", "standby", "speaking", "thinking", "sleeping", "musica", "celebrate", "tchau"];

  return {
    /**
     * Troca o preset ativo. Retorna `false` se a troca para um modo que
     * depende de áudio falhar (ex.: permissão de microfone negada) - nesse
     * caso o modo anterior é mantido.
     *
     * "musica" entra em loop (M1→M4) até outro modo ser pedido; a saída é
     * animada (M4→exit_m2→exit_m1) e acontece em segundo plano - a troca de
     * modo é aceita na hora, mas o personagem só assume a nova pose quando a
     * animação de guardar o ukulele terminar.
     *
     * "celebrate" é um gesto de disparo único com confetes e efeito sonoro;
     * volta a "standby" sozinho ao terminar.
     *
     * "tchau" é um gesto de disparo único (acena e volta a "off" sozinho).
     * Chamar setMode("tchau") de novo enquanto ele acena cancela o gesto na
     * hora. Chamar setMode("tchau") enquanto "musica" ou "celebrate" está
     * ativo retorna `false` (esses modos têm prioridade).
     */
    setMode(mode) {
      return setModeInternal(mode);
    },

    getMode() {
      return currentMode;
    },

    /**
     * Ativa a mosca (animação independente, roda por cima do modo atual).
     * Se estiver dormindo, acorda para "standby"; se a Musica estiver
     * tocando, aguarda a animação de saída terminar antes de soltar a mosca.
     */
    async startMosca() {
      if (moscaActive) return true;
      if (currentMode === "sleeping") currentMode = "standby";
      if (currentMode === "musica" || musicaExiting) {
        await new Promise((resolve) => startMusicaExit(resolve));
        currentMode = "standby";
      }
      startMoscaInternal();
      return true;
    },

    /** Manda a mosca voar para fora de cena (captura automática também faz isso). */
    dismissMosca() {
      dismissMoscaInternal();
    },

    isMoscaActive() {
      return moscaActive;
    },

    /** Troca a fonte de áudio usada nos modos "speaking"/"musica"/"tchau" (ver createMicAudioInput). */
    async setAudioInput(source) {
      const wasRunning = activeAudioInput.enabled;
      if (wasRunning) activeAudioInput.stop();
      activeAudioInput = source;
      if (wasRunning) await activeAudioInput.start();
    },

    /**
     * Troca o cenário de fundo com a animação de transição.
     * Aceita qualquer URL de imagem. Retorna uma Promise que resolve quando
     * a transição termina. Chamadas durante uma transição em curso são ignoradas.
     */
    setBackground(url) {
      return runBackgroundTransition(url);
    },

    /**
     * Ativa o mod Teaching: a câmera aproxima e o quadro-negro desliza até o
     * lugar (~1-2s de animação). Aditivo - não sobrepõe standby/speaking/etc.
     * Não precisa chamar isso antes de `showTeachingVocabulary` - ela já ativa
     * sozinha se o Teaching ainda não estiver rodando.
     */
    startTeaching() {
      startTeachingMode();
    },

    /**
     * Desativa o Teaching: some a palavra/imagem, o quadro desliza pra fora e
     * some, e só então a câmera volta pra posição normal (~1-2s de animação).
     */
    stopTeaching() {
      stopTeachingMode();
    },

    isTeachingActive() {
      return teachingPhase !== "off";
    },

    /**
     * Mostra o quadro de ensino com uma palavra/expressão de vocabulário.
     * Aceita o id da lista padrão ("wake-up") ou um objeto:
     * { id?: string, words: string, imageSrc?: string }. Se o Teaching ainda
     * não estiver ativo, ativa sozinho e mostra a palavra assim que o quadro
     * terminar de entrar.
     */
    showTeachingVocabulary(input) {
      const item = getVocabularyItem(input);
      if (!item) return false;
      activeVocabularyId = item.id;
      if (teachingPhase === "active") return renderVocabularyContent(item);
      pendingVocabularyId = item.id;
      startTeachingMode();
      return true;
    },

    /**
     * Esconde a palavra/imagem e desativa o Teaching por completo (câmera e
     * quadro saem animados) - use antes de qualquer transição de saída do
     * Teaching na aplicação externa.
     */
    hideTeachingVocabulary() {
      hideVocabularyContent();
      stopTeachingMode();
    },

    /** Esconde apenas palavra/imagem, mantendo o quadro/Teaching como está. */
    hideVocabulary() {
      hideVocabularyContent();
    },

    getVocabularyItems() {
      return vocabularyItems.map((item) => ({ ...item }));
    },

    /**
     * Preenche o nome da aula no popup da sequência de abertura (autoOpening).
     * Pode ser chamado antes ou depois do popup renderizar.
     */
    setLessonName(name) {
      lessonName = name;
      openingLessonName.textContent = name;
    },

    setVocabularyItems(items) {
      if (!Array.isArray(items)) return false;
      vocabularyItems = items.map(resolveVocabularyItemAsset).filter(Boolean);
      activeVocabularyId = null;
      hideVocabularyContent();
      return true;
    },

    /**
     * Dispara o mod Camuflage: o matiz de cor do Kevin gira 0→360→0 (~22s no
     * ritmo padrão) e desativa sozinho ao terminar. Aditivo - não sobrepõe
     * outros mods. Chamar de novo enquanto roda cancela na hora.
     */
    playCamuflage() {
      if (camuflagePhase !== "off") {
        camuflagePhase = "off";
        hueRotateDeg = 0;
        applyHueRotate();
        return;
      }
      camuflagePhase = "m1";
    },

    /**
     * Toca a animação de entrada uma vez, cobrindo a cena e revelando o Kevin
     * ao final (em vez dele simplesmente aparecer). Chame antes ou depois de
     * setMode() - o Kevin já deve estar no modo/cenário desejado por baixo do
     * vídeo, já que ele só "abre" a cortina, não troca nada sozinho. Retorna
     * uma Promise que resolve quando a animação termina. Chamadas durante uma
     * entrada em curso são ignoradas (resolve `false`).
     */
    playEntrada() {
      return runEntradaAnimation();
    },

    /** Para o loop de animação e a entrada de áudio, e remove o DOM criado. */
    destroy() {
      if (rafHandle != null) cancelAnimationFrame(rafHandle);
      if (celebrateAudioTimeout != null) clearTimeout(celebrateAudioTimeout);
      activeAudioInput.stop();
      backsoundMusicAudio.pause();
      snoreAudio.pause();
      stage.remove();
    },
  };
}
