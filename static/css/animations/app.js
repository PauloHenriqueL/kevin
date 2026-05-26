const mount = document.getElementById("puppetMount");
const speechBubble = document.getElementById("speechBubble");
const toggleAnimBtn = document.getElementById("toggleAnim");
const talkBtn = document.getElementById("talkBtn");
const poseBtn = document.getElementById("poseBtn");
const skeletonBtn = document.getElementById("skeletonBtn");
const headRotateSlider = document.getElementById("headRotate");
const headAngleValue = document.getElementById("headAngleValue");
const headPoseSlider = document.getElementById("headPoseRotate");
const headPoseValue = document.getElementById("headPoseValue");
const leftArmManualBtn = document.getElementById("leftArmManualBtn");
const leftArmShoulderSlider = document.getElementById("leftArmShoulder");
const leftArmShoulderValue = document.getElementById("leftArmShoulderValue");
const leftArmElbowSlider = document.getElementById("leftArmElbow");
const leftArmElbowValue = document.getElementById("leftArmElbowValue");
const animBodyBtn = document.getElementById("animBodyBtn");
const animTailBtn = document.getElementById("animTailBtn");
const animLeftArmBtn = document.getElementById("animLeftArmBtn");
const animRightArmBtn = document.getElementById("animRightArmBtn");
const animLeftLegBtn = document.getElementById("animLeftLegBtn");
const animRightLegBtn = document.getElementById("animRightLegBtn");

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

const FRONTAL_SPEAKING_SEQUENCE = ["M", "Aa", "Oh", "Uh", "F", "L", "S", "R", "D", "w-Oo", "Surprised"];
const LINES = ["Oi! Eu sou o Kevin.", "Rig pronto para animar.", "Pisca, fala e mexe!"];
const POSE_INDEX_BY_HEAD_TURN = [4, 3, 0, 1, 2];
const HEAD_TURN_BY_POSE_INDEX = {
  4: -2,
  3: -1,
  0: 0,
  1: 1,
  2: 2,
};
const HEAD_TURN_LABEL = {
  "-2": "Perfil Dir.",
  "-1": "3/4 Dir.",
  "0": "Frontal",
  "1": "3/4 Esq.",
  "2": "Perfil Esq.",
};

const LEFT_ARM_PIVOTS = {
  shoulderX: 582.9,
  shoulderY: 488.5,
  elbowX: 671.3,
  elbowY: 574.4,
  wristX: 755.2,
  wristY: 661.8,
};

const RIGHT_ARM_PIVOTS = {
  shoulderX: 404.6,
  shoulderY: 489.9,
  elbowX: 316.1,
  elbowY: 575.8,
  wristX: 232.3,
  wristY: 663.2,
};

const LEFT_LEG_PIVOTS = {
  hipX: 563.3,
  hipY: 764.8,
  kneeX: 575.9,
  kneeY: 858.4,
  ankleX: 576.7,
  ankleY: 953.8,
};

const RIGHT_LEG_PIVOTS = {
  hipX: 425.2,
  hipY: 764.7,
  kneeX: 412.6,
  kneeY: 858.2,
  ankleX: 411.8,
  ankleY: 953.6,
};

const BODY_PIVOTS = {
  hipX: 493.5,
  hipY: 719.6,
  torsoX: 493,
  torsoY: 603.2,
};

const HEAD_PIVOT = {
  x: 493,
  y: 460.9,
};

const TAIL_BOB_AMPLITUDE = 6.2;
const TAIL_BOB_SPEED = 1.9;
const PUPIL_TRACK_X_RATIO = 0.16;
const PUPIL_TRACK_Y_RATIO = 0.2;

let puppet = null;
let rig = null;
let running = true;
let talkingUntil = 0;
let poseIndex = 0;
let nextBlinkAt = 0;
let blinkUntil = 0;
let pointerClientX = window.innerWidth * 0.5;
let pointerClientY = window.innerHeight * 0.5;
let skeletonVisible = true;
let headRotateDeg = 0;
let leftArmManualEnabled = false;
let leftArmManualShoulderDeg = 0;
let leftArmManualElbowDeg = 0;
const memberPresetEnabled = {
  body: false,
  tail: false,
  leftArm: false,
  rightArm: false,
  leftLeg: false,
  rightLeg: false,
};

const MEMBER_PRESET_CONTROL = {
  body: { button: animBodyBtn, label: "Quadril" },
  tail: { button: animTailBtn, label: "Cauda" },
  leftArm: { button: animLeftArmBtn, label: "Braco Esq" },
  rightArm: { button: animRightArmBtn, label: "Braco Dir" },
  leftLeg: { button: animLeftLegBtn, label: "Perna Esq" },
  rightLeg: { button: animRightLegBtn, label: "Perna Dir" },
};

function setMessage(text) {
  if (speechBubble) speechBubble.textContent = text;
}

function getNodeById(id) {
  if (!puppet) return null;
  return puppet.querySelector(`[id="${id}"]`);
}

function setDisplay(node, visible) {
  if (!node) return;
  node.style.display = visible ? "" : "none";
}

function chooseNextLine() {
  setMessage(LINES[Math.floor(Math.random() * LINES.length)]);
}

function talkFor(ms = 2400) {
  talkingUntil = performance.now() + ms;
  chooseNextLine();
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

function formatSignedNum(n) {
  return Number(n.toFixed(3)).toString();
}

function formatPathNum(n) {
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

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function deformArmPoint(x, y, bendDeg, pivots) {
  const ex = pivots.elbowX;
  const ey = pivots.elbowY;
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

  const forearmWeight = smoothstep(-22, 112, t);
  const jointWeight = Math.exp(-(t * t) / (2 * 46 * 46)) * Math.exp(-(r * r) / (2 * 40 * 40));
  const bendRad = (bendDeg * Math.PI) / 180;
  const localRot = bendRad * forearmWeight;

  const c = Math.cos(localRot);
  const s = Math.sin(localRot);
  let tx = ex + dx * c - dy * s;
  let ty = ey + dx * s + dy * c;

  const bendNorm = Math.min(1, Math.abs(bendDeg) / 60);
  const squeeze = 1 - 0.14 * jointWeight * bendNorm;
  const bulge = 0.09 * jointWeight * bendNorm;
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

function deformLegPoint(x, y, bendDeg, pivots) {
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

  return { x: tx, y: ty };
}

function deformLegSegments(segments, bendDeg, pivots) {
  return segments.map((seg) => {
    if (seg.cmd === "Z") return { cmd: "Z", pts: [] };
    const pts = seg.pts.slice();
    for (let i = 0; i < pts.length; i += 2) {
      const p = deformLegPoint(pts[i], pts[i + 1], bendDeg, pivots);
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

  // Apply stronger effect on lower torso, keeping upper torso comparatively stable.
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

  // Slight waist squeeze / stretch to make deform visually clear.
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
  // Fallback for older SVG implementations.
  use.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", `#${basePath.id}`);
  shadowPath.setAttribute("clip-path", `url(#${clipId})`);
}

function clientToSvgPoint(clientX, clientY) {
  const svg = getSvgRoot();
  if (!svg || typeof svg.createSVGPoint !== "function") return null;
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  return pt.matrixTransform(ctm.inverse());
}

function updatePupilTracking() {
  if (!rig) return;
  const pose = getActivePose();
  if (!pose || !pose.pupilTrackPairs || pose.pupilTrackPairs.length === 0) return;
  const target = clientToSvgPoint(pointerClientX, pointerClientY);
  if (!target) return;

  for (const pair of pose.pupilTrackPairs) {
    const eyeballBox = pair.eyeballNode.getBBox();
    const centerX = eyeballBox.x + eyeballBox.width * 0.5;
    const centerY = eyeballBox.y + eyeballBox.height * 0.5;

    const maxX = Math.max(1.5, eyeballBox.width * PUPIL_TRACK_X_RATIO);
    const maxY = Math.max(1.5, eyeballBox.height * PUPIL_TRACK_Y_RATIO);
    let dx = target.x - centerX;
    let dy = target.y - centerY;

    const norm = Math.hypot(dx / maxX, dy / maxY);
    if (norm > 1) {
      dx /= norm;
      dy /= norm;
    }

    const move = `translate(${formatSignedNum(dx)} ${formatSignedNum(dy)})`;
    setSvgTransform(pair.pupilNode, pair.baseTransform ? `${pair.baseTransform} ${move}` : move);
  }
}

function setPose(index) {
  if (!rig) return;
  poseIndex = ((index % rig.poses.length) + rig.poses.length) % rig.poses.length;
  rig.poses.forEach((pose, i) => setDisplay(pose.node, i === poseIndex));
  setMouthByTalkState(performance.now());
  setEyesClosed(false);
  updatePupilTracking();
  syncHeadTurnControlsFromPose();
}

function getActivePose() {
  if (!rig) return null;
  return rig.poses[poseIndex] || null;
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

function setMouthByTalkState(now) {
  const pose = getActivePose();
  if (!pose) return;
  if (pose.id !== "_x2B_Frontal") {
    setMouthShape(pose.mouthIds[0]);
    return;
  }
  if (now < talkingUntil) {
    const step = Math.floor(now / 95) % FRONTAL_SPEAKING_SEQUENCE.length;
    setMouthShape(FRONTAL_SPEAKING_SEQUENCE[step]);
  } else {
    setMouthShape("Neutral");
  }
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

function updateHeadAngleLabel() {
  if (headAngleValue) headAngleValue.textContent = `${Math.round(headRotateDeg)}°`;
}

function applyHeadRotation() {
  if (!rig || !rig.head || !rig.head.node) return;
  const rot = `rotate(${headRotateDeg.toFixed(3)} ${HEAD_PIVOT.x} ${HEAD_PIVOT.y})`;
  setSvgTransform(rig.head.node, rig.head.baseTransform ? `${rig.head.baseTransform} ${rot}` : rot);
}

function clampHeadTurnStep(n) {
  return Math.max(-2, Math.min(2, Math.round(n)));
}

function headTurnStepToPoseIndex(step) {
  const clamped = clampHeadTurnStep(step);
  return POSE_INDEX_BY_HEAD_TURN[clamped + 2];
}

function poseIndexToHeadTurnStep(index) {
  return HEAD_TURN_BY_POSE_INDEX[index] ?? 0;
}

function updateHeadTurnLabel(step) {
  if (!headPoseValue) return;
  const clamped = clampHeadTurnStep(step);
  headPoseValue.textContent = HEAD_TURN_LABEL[String(clamped)] || "Frontal";
}

function syncHeadTurnControlsFromPose() {
  const step = poseIndexToHeadTurnStep(poseIndex);
  if (headPoseSlider) headPoseSlider.value = String(step);
  updateHeadTurnLabel(step);
}

function setSkeletonVisible(visible) {
  skeletonVisible = !!visible;
  if (rig && rig.skeletonVisualNodes) {
    for (const node of rig.skeletonVisualNodes) {
      setDisplay(node, skeletonVisible);
    }
  }
  if (skeletonBtn) {
    skeletonBtn.textContent = skeletonVisible ? "Ocultar esqueleto" : "Mostrar esqueleto";
  }
}

function updateMemberPresetButton(memberKey) {
  const cfg = MEMBER_PRESET_CONTROL[memberKey];
  if (!cfg || !cfg.button) return;
  const on = !!memberPresetEnabled[memberKey];
  cfg.button.textContent = `${cfg.label}: ${on ? "ON" : "OFF"}`;
}

function updateLeftArmManualUi() {
  if (leftArmManualBtn) {
    leftArmManualBtn.textContent = `Modo manual braco esq: ${leftArmManualEnabled ? "ON" : "OFF"}`;
  }
  if (leftArmShoulderValue) {
    leftArmShoulderValue.textContent = `${Math.round(leftArmManualShoulderDeg)}°`;
  }
  if (leftArmElbowValue) {
    leftArmElbowValue.textContent = `${Math.round(leftArmManualElbowDeg)}°`;
  }
}

function setMemberPresetEnabled(memberKey, enabled) {
  if (!(memberKey in memberPresetEnabled)) return;
  memberPresetEnabled[memberKey] = !!enabled;
  updateMemberPresetButton(memberKey);
}

function toggleMemberPresetEnabled(memberKey) {
  if (!(memberKey in memberPresetEnabled)) return;
  setMemberPresetEnabled(memberKey, !memberPresetEnabled[memberKey]);
}

function updateBlink(now) {
  if (now >= nextBlinkAt) {
    blinkUntil = now + 130;
    nextBlinkAt = now + 1700 + Math.random() * 2800;
  }
  setEyesClosed(now < blinkUntil);
}

function setupArmDrivers(arm) {
  if (!arm || !arm.meshGroup || !arm.bonesGroup) return;

  // Keep the same hierarchy on both sides so shoulder rotation drives mesh + bones together.
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
}

function setupBodyRig(body) {
  if (!body || !body.meshGroup || !body.bonesGroup) return;

  // Keep body skeleton linked to the body mesh so both follow the same motion.
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
  // Keep tail behind everything: first drawn = back layer in SVG.
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
  // Keep pelvis-driven mesh right after tail in layering.
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
      meshPaths: [getNodeById("Braço_Direito2"), getNodeById("Braço_Direito3")].filter(Boolean),
      meshSegmentsBase: [],
      bonesGroup: getNodeById("Bones_Left_Arm"),
      forearmBone: getNodeById("Anti_Braço1"),
      wristBone: getNodeById("Pulso1"),
      handGroup: getNodeById("Objeto_generativo__x28_180_x2C__0_x29_1"),
      elbowCore: getNodeById("Cotovelo_core1"),
      elbowDeform: getNodeById("Deform3"),
      elbowZone: getNodeById("Deform_Left_Elbow"),
      elbowDriver: null,
      wristDriver: null,
      driverPrefix: "left",
      shoulderSign: 1,
      elbowSign: 1,
      pivots: LEFT_ARM_PIVOTS,
    },
    rightArm: {
      meshGroup: getNodeById("Right_Arm"),
      meshPaths: [getNodeById("Braço_Direito"), getNodeById("Braço_Direito1")].filter(Boolean),
      basePath: getNodeById("Braço_Direito"),
      shadowPath: getNodeById("Braço_Direito1"),
      shadowDriver: null,
      shadowDriverBaseTransform: "",
      meshSegmentsBase: [],
      bonesGroup: getNodeById("Bones_Right_Arm"),
      forearmBone: getNodeById("Anti_Braço"),
      wristBone: getNodeById("Pulso"),
      handGroup: getNodeById("Objeto_generativo__x28_180_x2C__0_x29_"),
      elbowCore: getNodeById("Cotovelo_core"),
      elbowDeform: getNodeById("Deform2"),
      elbowZone: getNodeById("Deform_Right_Elbow"),
      elbowDriver: null,
      wristDriver: null,
      driverPrefix: "right",
      shoulderSign: -1,
      elbowSign: -1,
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
      return {
        node,
        baseTransform: node ? node.getAttribute("transform") || "" : "",
      };
    })(),
    tail: (() => {
      const node = getNodeById("Tail");
      return {
        node,
        baseTransform: node ? node.getAttribute("transform") || "" : "",
      };
    })(),
    skeletonVisualNodes: [],
  };
  for (const arm of [rig.leftArm, rig.rightArm]) {
    arm.meshSegmentsBase = arm.meshPaths.map((path) => {
      const d = path.getAttribute("d") || "";
      return parsePathDataToAbsolute(d);
    });
    for (let i = 0; i < arm.meshPaths.length; i++) {
      arm.meshPaths[i].setAttribute("d", serializeAbsolutePath(arm.meshSegmentsBase[i]));
    }
    setupArmDrivers(arm);
  }

  ensureShadowContainedByBasePath(rig.rightArm.shadowPath, rig.rightArm.basePath, "rightArmShadowClip");
  for (const leg of [rig.leftLeg, rig.rightLeg]) {
    leg.meshSegmentsBase = leg.meshPaths.map((path) => {
      const d = path.getAttribute("d") || "";
      try {
        return parsePathDataToAbsolute(d);
      } catch (err) {
        console.warn(`Falha ao parsear path da ${leg.driverPrefix}; deformacao desativada neste path.`, err);
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
  body.pelvisMeshDriverBaseTransform = body.pelvisMeshDriver
    ? body.pelvisMeshDriver.getAttribute("transform") || ""
    : "";
  body.tailMeshDriverBaseTransform = body.tailMeshDriver ? body.tailMeshDriver.getAttribute("transform") || "" : "";
  body.pelvisBaseTransform = body.pelvisGroup ? body.pelvisGroup.getAttribute("transform") || "" : "";
  body.torsoToPelvisBaseTransform = body.torsoToPelvisBone
    ? body.torsoToPelvisBone.getAttribute("transform") || ""
    : "";
  body.deformBaseTransform = body.deformNode ? body.deformNode.getAttribute("transform") || "" : "";

  body.torsoSegmentsBase = body.torsoPaths.map((path) => {
    const d = path.getAttribute("d") || "";
    try {
      return parsePathDataToAbsolute(d);
    } catch (err) {
      console.warn("Falha ao parsear path do torso; deformacao desativada neste path.", err);
      return null;
    }
  });
  for (let i = 0; i < body.torsoPaths.length; i++) {
    const base = body.torsoSegmentsBase[i];
    if (!base) continue;
    body.torsoPaths[i].setAttribute("d", serializeAbsolutePath(base));
  }

  const skeletonRoots = [rig.leftArm.bonesGroup, rig.rightArm.bonesGroup, rig.leftLeg.bonesGroup, rig.rightLeg.bonesGroup, rig.body.bonesGroup].filter(Boolean);
  const visualSet = new Set();
  for (const root of skeletonRoots) {
    for (const node of root.querySelectorAll(".st11")) {
      visualSet.add(node);
    }
  }
  rig.skeletonVisualNodes = Array.from(visualSet);

  setSkeletonVisible(skeletonVisible);
  applyHeadRotation();
}

function animateTail(now) {
  if (!rig || !rig.tail || !rig.tail.node) return;
  const t = now * 0.001;
  const offsetY = Math.sin(t * TAIL_BOB_SPEED) * TAIL_BOB_AMPLITUDE;
  const bob = `translate(0 ${offsetY.toFixed(3)})`;
  const base = rig.tail.baseTransform;
  setSvgTransform(rig.tail.node, base ? `${base} ${bob}` : bob);
}

function animateArm(arm, now) {
  if (!arm) return;

  const t = now * 0.001;
  const speakingBoost = now < talkingUntil ? 1.15 : 1;

  const shoulderRot = (Math.sin(t * 2.4) * 16 + Math.sin(t * 1.05 + 0.7) * 9) * speakingBoost * arm.shoulderSign;
  const elbowBend = Math.max(0, Math.sin(t * 3.6 + 0.35)) * 62 * speakingBoost * arm.elbowSign;

  animateArmWithValues(arm, shoulderRot, elbowBend);
}

function animateArmWithValues(arm, shoulderRot, elbowBend) {
  if (!arm) return;

  setSvgRotate(arm.meshGroup, shoulderRot, arm.pivots.shoulderX, arm.pivots.shoulderY);
  setSvgRotate(arm.elbowDriver, elbowBend, arm.pivots.elbowX, arm.pivots.elbowY);

  for (let i = 0; i < arm.meshPaths.length; i++) {
    const path = arm.meshPaths[i];
    // Right-arm shadow is driven by its own elbow pivot group to keep bend alignment.
    if (arm.shadowPath && path === arm.shadowPath && arm.shadowDriver) continue;
    const deformed = deformArmSegments(arm.meshSegmentsBase[i], elbowBend, arm.pivots);
    path.setAttribute("d", serializeAbsolutePath(deformed));
  }

  if (arm.shadowDriver) {
    const shadowRot = `rotate(${(elbowBend * 0.98).toFixed(3)} ${arm.pivots.elbowX} ${arm.pivots.elbowY})`;
    setSvgTransform(
      arm.shadowDriver,
      arm.shadowDriverBaseTransform ? `${arm.shadowDriverBaseTransform} ${shadowRot}` : shadowRot
    );
  }

  const absBend = Math.abs(elbowBend);
  const sx = 1 + absBend * 0.0036;
  const sy = 1 - absBend * 0.0028;
  setSvgRotateScale(arm.elbowDeform, elbowBend * 0.2, arm.pivots.elbowX, arm.pivots.elbowY, sx, sy);

  if (arm.elbowZone) {
    setSvgRotateScale(arm.elbowZone, elbowBend * 0.24, arm.pivots.elbowX, arm.pivots.elbowY, sx, sy);
  }
}

function animateLeg(leg, now) {
  if (!leg) return;

  const t = now * 0.001;
  const hipRot = (Math.sin(t * 1.7 + 0.8) * 4.8 + Math.sin(t * 0.95) * 2.4) * leg.hipSign;
  const kneeBend = Math.max(0, Math.sin(t * 2.45 + 0.4)) * 36 * leg.kneeSign;

  setSvgRotate(leg.meshGroup, hipRot, leg.pivots.hipX, leg.pivots.hipY);
  setSvgRotate(leg.kneeDriver, kneeBend, leg.pivots.kneeX, leg.pivots.kneeY);

  for (let i = 0; i < leg.meshPaths.length; i++) {
    const baseSegments = leg.meshSegmentsBase[i];
    if (!baseSegments) continue;
    const deformed = deformLegSegments(baseSegments, kneeBend, leg.pivots);
    leg.meshPaths[i].setAttribute("d", serializeAbsolutePath(deformed));
  }

  const absBend = Math.abs(kneeBend);
  const sx = 1 + absBend * 0.0028;
  const sy = 1 - absBend * 0.0022;
  setSvgRotateScale(leg.kneeDeform, kneeBend * 0.22, leg.pivots.kneeX, leg.pivots.kneeY, sx, sy);
}

function animateBody(body, now) {
  if (!body || !body.pelvisGroup) return;

  const t = now * 0.001;
  const hipSway = Math.sin(t * 1.35 + 0.2) * 7 + Math.sin(t * 0.7) * 2.2;
  const pelvisRotate = `rotate(${hipSway.toFixed(3)} ${body.pivots.hipX} ${body.pivots.hipY})`;

  // Keep the full body still; only the pelvis area should move.
  if (body.meshGroup) setSvgTransform(body.meshGroup, body.baseTransform);
  if (body.pelvisMeshDriver) {
    setSvgTransform(
      body.pelvisMeshDriver,
      body.pelvisMeshDriverBaseTransform
        ? `${body.pelvisMeshDriverBaseTransform} ${pelvisRotate}`
        : pelvisRotate
    );
  }
  if (body.tailMeshDriver) {
    setSvgTransform(
      body.tailMeshDriver,
      body.tailMeshDriverBaseTransform ? `${body.tailMeshDriverBaseTransform} ${pelvisRotate}` : pelvisRotate
    );
  }
  setSvgTransform(
    body.pelvisGroup,
    body.pelvisBaseTransform ? `${body.pelvisBaseTransform} ${pelvisRotate}` : pelvisRotate
  );

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
    setSvgTransform(
      body.torsoGroup,
      body.torsoGroupBaseTransform ? `${body.torsoGroupBaseTransform} ${torsoRot}` : torsoRot
    );
  }

  for (let i = 0; i < body.torsoPaths.length; i++) {
    const base = body.torsoSegmentsBase[i];
    if (!base) continue;
    const deformed = deformTorsoSegments(base, hipSway, body.pivots);
    body.torsoPaths[i].setAttribute("d", serializeAbsolutePath(deformed));
  }
}

function animate(now) {
  if (!running || !puppet || !rig) return;
  if (memberPresetEnabled.body) animateBody(rig.body, now);
  if (memberPresetEnabled.tail) animateTail(now);
  if (leftArmManualEnabled) {
    animateArmWithValues(rig.leftArm, leftArmManualShoulderDeg, leftArmManualElbowDeg);
  } else if (memberPresetEnabled.leftArm) {
    animateArm(rig.leftArm, now);
  }
  if (memberPresetEnabled.rightArm) animateArm(rig.rightArm, now);
  if (memberPresetEnabled.leftLeg) animateLeg(rig.leftLeg, now);
  if (memberPresetEnabled.rightLeg) animateLeg(rig.rightLeg, now);
  updatePupilTracking();
  updateBlink(now);
  setMouthByTalkState(now);
  requestAnimationFrame(animate);
}

function startLoop() {
  if (!running) return;
  requestAnimationFrame(animate);
}

async function boot() {
  if (!mount) return;
  const response = await fetch("./kevin-rigged.svg");
  if (!response.ok) throw new Error(`Erro ao buscar SVG: ${response.status}`);

  mount.innerHTML = await response.text();
  puppet = mount.querySelector("#_x2B_Puppet") || mount.querySelector("svg");
  if (!puppet) {
    setMessage("Falha ao carregar o rig.");
    return;
  }

  buildRigState();
  setPose(0);
  nextBlinkAt = performance.now() + 900;
  talkFor(1700);
  startLoop();
}

if (toggleAnimBtn) {
  toggleAnimBtn.addEventListener("click", () => {
    running = !running;
    toggleAnimBtn.textContent = running ? "Pausar" : "Retomar";
    if (running) startLoop();
  });
}

if (talkBtn) {
  talkBtn.addEventListener("click", () => talkFor(2600));
}

if (poseBtn) {
  poseBtn.addEventListener("click", () => {
    const currentStep = poseIndexToHeadTurnStep(poseIndex);
    const nextStep = currentStep >= 2 ? -2 : currentStep + 1;
    setPose(headTurnStepToPoseIndex(nextStep));
    talkFor(1700);
  });
}

if (skeletonBtn) {
  skeletonBtn.addEventListener("click", () => {
    setSkeletonVisible(!skeletonVisible);
  });
}

if (headRotateSlider) {
  headRotateSlider.addEventListener("input", () => {
    headRotateDeg = Number(headRotateSlider.value) || 0;
    updateHeadAngleLabel();
    applyHeadRotation();
  });
}

if (headPoseSlider) {
  headPoseSlider.addEventListener("input", () => {
    const step = clampHeadTurnStep(Number(headPoseSlider.value) || 0);
    updateHeadTurnLabel(step);
    setPose(headTurnStepToPoseIndex(step));
  });
}

if (leftArmManualBtn) {
  leftArmManualBtn.addEventListener("click", () => {
    leftArmManualEnabled = !leftArmManualEnabled;
    updateLeftArmManualUi();
  });
}

if (leftArmShoulderSlider) {
  leftArmShoulderSlider.addEventListener("input", () => {
    leftArmManualShoulderDeg = Number(leftArmShoulderSlider.value) || 0;
    updateLeftArmManualUi();
  });
}

if (leftArmElbowSlider) {
  leftArmElbowSlider.addEventListener("input", () => {
    const raw = Number(leftArmElbowSlider.value) || 0;
    leftArmManualElbowDeg = Math.max(0, Math.min(180, raw));
    leftArmElbowSlider.value = String(leftArmManualElbowDeg);
    updateLeftArmManualUi();
  });
}

for (const memberKey of Object.keys(MEMBER_PRESET_CONTROL)) {
  const cfg = MEMBER_PRESET_CONTROL[memberKey];
  if (cfg.button) {
    cfg.button.addEventListener("click", () => {
      toggleMemberPresetEnabled(memberKey);
    });
  }
  updateMemberPresetButton(memberKey);
}

window.addEventListener("pointermove", (event) => {
  pointerClientX = event.clientX;
  pointerClientY = event.clientY;
});

setInterval(() => {
  if (!running || !rig) return;
  talkFor(1400 + Math.random() * 1100);
}, 5200);

boot().catch(() => {
  setMessage("Nao foi possivel inicializar.");
});

updateHeadAngleLabel();
updateHeadTurnLabel(0);
updateLeftArmManualUi();
