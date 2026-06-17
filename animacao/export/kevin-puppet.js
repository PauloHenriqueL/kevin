// Kevin Puppet - motor de animação + presets, sem UI de teste.
//
// Uso:
//   import { createKevinPuppet } from "./kevin-puppet.js";
//   const kevin = await createKevinPuppet(containerEl, {
//     svgUrl: "./kevin-rigged.svg",      // opcional, default ao lado deste arquivo
//     backgroundUrl: "./background.png", // opcional
//     onError: (msg) => console.error(msg),
//   });
//   await kevin.setMode("standby" | "thinking" | "speaking" | "off");
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
const THINKING_ARM_LERP_SPEED = 0.045;
const THINKING_SQUAT_AMPLITUDE = 40;

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
  const onError = options.onError ?? ((msg) => console.error(`KevinPuppet: ${msg}`));

  // --- DOM: cria o card (stage + mount) dentro do container fornecido ---
  const stage = document.createElement("div");
  stage.className = "kevin-stage";
  if (backgroundUrl) stage.style.backgroundImage = `url("${backgroundUrl}")`;

  const mount = document.createElement("div");
  mount.className = "kevin-puppet-mount";
  mount.setAttribute("aria-label", "Kevin animado");
  stage.appendChild(mount);
  container.appendChild(stage);

  // --- estado de instância (substitui os globais da demo) ---
  let puppet = null;
  let rig = null;
  let rafHandle = null;
  let poseIndex = 0;
  let nextBlinkAt = 0;
  let blinkUntil = 0;
  let bodyDropY = 0;
  let idleTiltExtra = 0;
  let activeAudioInput = createMicAudioInput();

  let currentMode = "off"; // "off" | "standby" | "speaking" | "thinking"
  let previousMode = "off";

  const idleArmState = {
    left: { curS: 15, curE: 31, tgtS: 15, tgtE: 31, baseMode: "rest", nextBaseAt: 0, speed: 0.018 },
    right: { curS: -16, curE: -33, tgtS: -16, tgtE: -33, baseMode: "rest", nextBaseAt: 0, speed: 0.018 },
  };
  const idleGesture = { side: null, type: null, endsAt: 0, nextAt: 0 };
  const idlePupilState = { curX: 0, curY: 0, tgtX: 0, tgtY: 0, nextAt: 0 };
  const idleHeadState = { tiltTgt: 0, tiltNextAt: 0, turnNextAt: 0 };
  const thinkingArmState = {
    left: { curS: 0, curE: 0 },
    right: { curS: 0, curE: 0 },
  };
  const audioMouthState = { smoothedLevel: 0, shapes: AUDIO_MOUTH_TIERS[0].shapes, shapeIdx: 0, nextChangeAt: 0 };

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

  function getFirstExistingBoneNode(ids) {
    for (const id of ids) {
      const node = getNodeById(id);
      if (node && node.matches && node.matches(".st11")) return node;
    }
    return null;
  }

  function setDisplay(node, visible) {
    if (!node) return;
    node.style.display = visible ? "" : "none";
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

  function applyHeadRotation() {
    if (!rig || !rig.head || !rig.head.node) return;
    const rot = `rotate(${idleTiltExtra.toFixed(3)} ${HEAD_PIVOT.x} ${HEAD_PIVOT.y})`;
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
        wristBone: getFirstExistingBoneNode(["Pulso_bone1", "Pulso1"]),
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
        handMirrorShoulderGteDeg: null,
        handMirrorShoulderLteDeg: -54.5,
        handMirrorElbowSign: "negative",
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
        handMirrorShoulderGteDeg: 55,
        handMirrorShoulderLteDeg: null,
        handMirrorElbowSign: "positive",
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
      skeletonVisualNodes: [],
    };

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

    // Esqueleto fica permanentemente oculto nesta exportação (sem toggle).
    const skeletonRoots = [rig.leftArm.bonesGroup, rig.rightArm.bonesGroup, rig.leftLeg.bonesGroup, rig.rightLeg.bonesGroup, rig.body.bonesGroup].filter(Boolean);
    const visualSet = new Set();
    for (const root of skeletonRoots) {
      for (const node of root.querySelectorAll(".st11")) visualSet.add(node);
    }
    rig.skeletonVisualNodes = Array.from(visualSet);
    for (const node of rig.skeletonVisualNodes) setDisplay(node, false);

    applyHeadRotation();
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
      const shouldMirrorHand = arm.mirrorHandOnNegative && shoulderWithinMin && shoulderWithinMax && elbowMatchesSign;
      if (shouldMirrorHand) {
        const tilt = arm.handMirrorTiltDeg || 0;
        const mirror = `translate(${arm.pivots.wristX} ${arm.pivots.wristY}) scale(-1 1) rotate(${tilt.toFixed(3)}) translate(${-arm.pivots.wristX} ${-arm.pivots.wristY})`;
        setSvgTransform(arm.handGroup, arm.handBaseTransform ? `${arm.handBaseTransform} ${mirror}` : mirror);
      } else {
        setSvgTransform(arm.handGroup, arm.handBaseTransform || "");
      }
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
    if (leg.footGroup) setSvgTransform(leg.footGroup, leg.footBaseTransform || "");

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

  function animateIdlePose(now, { allowHeadTurn = true } = {}) {
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

  // --- agachamento: compensação de pernas (joelho/tornozelo) ---
  function applyBodyDropPose() {
    if (!rig) return;

    if (rig.body && rig.body.meshGroup && currentMode === "off") {
      setSvgTransform(rig.body.meshGroup, composeTransforms(rig.body.baseTransform, getBodyDropTransform()));
    }
    applyHeadRotation();

    const dropNorm = smoothstep(0, BODY_DROP_MAX, bodyDropY);
    if (dropNorm <= 0) {
      if (currentMode === "off") {
        animateLegWithValues(rig.leftLeg, 0, 0);
        animateLegWithValues(rig.rightLeg, 0, 0);
      }
      return;
    }

    const kneeOut = BODY_DROP_KNEE_OUT_MAX * dropNorm;
    animateLegWithValues(rig.leftLeg, 0, 0, kneeOut * rig.leftLeg.hipSign);
    animateLegWithValues(rig.rightLeg, 0, 0, kneeOut * rig.rightLeg.hipSign);
  }

  // --- loop principal ---
  function animate(now) {
    if (!rig) return;

    if (currentMode === "standby" || currentMode === "speaking") {
      if (previousMode !== "standby" && previousMode !== "speaking") initIdleState(now);
      animateIdlePose(now, { allowHeadTurn: currentMode === "standby" });
    } else if (currentMode === "thinking") {
      if (previousMode !== "thinking") initThinkingState(now);
      animateThinkingPose(now);
    } else {
      if (previousMode !== "off") resetIdlePose();
    }

    applyBodyDropPose();
    previousMode = currentMode;

    if (currentMode !== "off") {
      updateIdlePupils(now);
    }
    updateBlink(now);

    if (currentMode === "speaking") {
      setMouthByAudioLevel(now, activeAudioInput.update());
    } else {
      setMouthShape("Neutral");
    }

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
  setPose(0);
  nextBlinkAt = performance.now() + 900;
  rafHandle = requestAnimationFrame(animate);

  // --- API pública ---
  return {
    /**
     * Troca o preset ativo. Retorna `false` se a troca para "speaking"
     * falhar (ex.: permissão de áudio negada) - nesse caso o modo anterior
     * é mantido.
     */
    async setMode(mode) {
      if (!["off", "standby", "speaking", "thinking"].includes(mode)) {
        console.warn(`KevinPuppet: modo desconhecido "${mode}".`);
        return false;
      }
      if (mode === currentMode) return true;

      if (mode === "speaking") {
        const ok = await activeAudioInput.start();
        if (!ok) {
          onError("Nao foi possivel iniciar a entrada de audio para o modo speaking.");
          return false;
        }
      } else if (currentMode === "speaking") {
        activeAudioInput.stop();
      }

      currentMode = mode;
      return true;
    },

    getMode() {
      return currentMode;
    },

    /** Troca a fonte de áudio usada no modo "speaking" (ver createMicAudioInput). */
    async setAudioInput(source) {
      const wasSpeaking = currentMode === "speaking";
      if (wasSpeaking) activeAudioInput.stop();
      activeAudioInput = source;
      if (wasSpeaking) await activeAudioInput.start();
    },

    /** Para o loop de animação e a entrada de áudio, e remove o DOM criado. */
    destroy() {
      if (rafHandle != null) cancelAnimationFrame(rafHandle);
      activeAudioInput.stop();
      stage.remove();
    },
  };
}
