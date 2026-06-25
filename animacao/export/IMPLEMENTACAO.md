# Guia de implementação — Kevin Puppet

Documento para uma IA (ou desenvolvedor) que precise **estender ou modificar** o
motor de animação. Não é tutorial de "como integrar" — para integração consulte
[README.md](./README.md). Aqui o foco é o **interno** do `kevin-puppet.js`: onde
cada coisa mora, como funciona, e exatamente onde editar para adicionar um modo
novo, um gesto novo, uma fonte de áudio nova ou ajustar o feel.

Trabalhe sempre com `kevin-puppet.js` aberto ao lado. Os números de linha citados
neste documento referem-se à versão `2025-06` (1624 linhas).

---

## 1. Modelo mental em 1 minuto

O motor é um **loop único** `animate(now)` que roda a 60 fps via
`requestAnimationFrame` (linhas 1529-1557). A cada frame ele:

1. Lê `currentMode` (`off | standby | thinking | speaking`).
2. Se o modo mudou neste frame, chama o `init…State()` do novo (continuidade
   entre modos é feita aqui).
3. Aplica a **pose do preset** (`animateIdlePose` ou `animateThinkingPose` ou
   `resetIdlePose`) — calcula os ângulos finais dos braços, cabeça, agachamento.
4. Aplica a **compensação de pernas** do agachamento (igual para todos os modos).
5. Atualiza **pupilas** (drift natural) e **blink** (piscar) — sempre, exceto em
   `off` para as pupilas.
6. Decide a **forma da boca**: `Neutral` em qualquer modo que não seja
   `speaking`; em `speaking` chama `setMouthByAudioLevel` com o nível atual do
   `activeAudioInput`.
7. Agenda o próximo frame.

**Princípios invioláveis** do código:

- **Continuidade por lerp**: nenhum modo "salta" — todo valor que muda
  (`bodyDropY`, ângulos de braço, `idleTiltExtra`) é interpolado a partir do
  estado atual. Se você adicionar um modo novo, **nunca** atribua valores
  diretamente — sempre `lerp(curr, target, factor)`.
- **Base imutável para path data**: os paths SVG são parseados para coordenadas
  absolutas **uma vez** (`parsePathDataToAbsolute`, linha 187) e guardados em
  `meshSegmentsBase`. Toda deformação é recalculada a partir desse snapshot, não
  do resultado do frame anterior — evita acúmulo de erro de floating point.
- **Pivôs em coordenadas SVG originais**: todas as rotações usam `rotate(deg cx
  cy)` onde `cx, cy` vêm dos `*_PIVOTS` (linhas 58-63). Esses números são
  específicos do `kevin-rigged.svg` exportado do Illustrator — se trocar o SVG,
  precisará recalcular.
- **Tolerância a SVG incompleto**: praticamente todo acesso a nó SVG é
  `getNodeById(...)?.…` ou `filter(Boolean)`. Se um id sumir, aquele membro só
  para de animar — não dá crash. Conveniente em desenvolvimento, perigoso em
  produção: **adicione logs** quando integrar com um novo SVG.

---

## 2. Mapa do arquivo `kevin-puppet.js`

| Linhas | Seção | O quê |
|---|---|---|
| 16-20 | `MODULE_URL`, `resolveAsset` | Resolução de path do SVG relativa ao módulo |
| 22-53 | `POSE_CONFIG` | Definição das 5 poses de cabeça (frontal, ¾, perfil — esq./dir.) |
| 55-56 | `POSE_INDEX_BY_HEAD_TURN`, `HEAD_TURN_BY_POSE_INDEX` | Mapeamento entre "step de giro" (-2…+2) e índice de pose |
| 58-73 | Pivôs e amplitudes do corpo | `LEFT_ARM_PIVOTS`, `…`, `BODY_DROP_MAX`, `IDLE_SQUAT_*` |
| 77-94 | Poses de braço | `ARM_POSE_LEFT`, `ARM_POSE_RIGHT`, alvos do "Pensando" |
| 96-101 | Lipsync | `AUDIO_MOUTH_SILENCE`, `AUDIO_MOUTH_TIERS` |
| 109-164 | `createMicAudioInput()` | Fonte de áudio default (microfone) — modelo a copiar |
| 170-178 | `lerp`, `smoothstep` | Math helpers |
| 187-326 | Parser/serializer de path data | `parsePathDataToAbsolute`, `serializeAbsolutePath` |
| 328-491 | Funções de deformação | `deformArm/Leg/TorsoPoint/Segments` |
| 504-1624 | `createKevinPuppet` (closure gigante) | **Tudo abaixo está dentro dela** |
| 522-547 | Estado de instância | `puppet`, `rig`, `currentMode`, `idleArmState`, `idleGesture`, `audioMouthState`, etc. |
| 663-670 | `setPose(index)` | Troca qual grupo de cabeça está visível |
| 672-680 | `setMouthShape(shapeId)` | Toggle de visibilidade entre formas de boca |
| 682-709 | `setMouthByAudioLevel(now, level)` | **Lipsync core** (envelope + tiers + cycle) |
| 711-728 | Olhos | `setEyesClosed`, `updateBlink` |
| 730-754 | `updateIdlePupils(now)` | Drift natural das pupilas + clamping via `getBBox` |
| 757-779 | Helpers de cabeça/agachamento | `clampHeadTurnStep`, `setBodyDropValue`, etc. |
| 952-…  | `buildRigState()` | Indexa o SVG por id e monta o objeto `rig` |
| 1160-1167 | `animateTail(now)` | Cauda (senoidal simples) |
| 1169-1224 | `animateArmWithValues(arm, shoulder, elbow)` | Aplica ângulos no braço + deforma mesh |
| 1225-1254 | `animateLegWithValues(leg, …)` | Idem perna |
| 1256-1320 | `animateBodyWithSway(body, hipSway)` | Aplica sway de quadril + translate do agachamento |
| 1322-1352 | `initIdleState(now)` | **Setup ao entrar em `standby`/`speaking`** |
| 1354-1439 | `animateIdlePose(now, {allowHeadTurn})` | **Core do standby/speaking** |
| 1441-1457 | `resetIdlePose()` | Zera tudo (entrada em `off`) |
| 1460-1467 | `initThinkingState(now)` | Setup ao entrar em `thinking` |
| 1469-1503 | `animateThinkingPose(now)` | **Core do thinking** |
| 1506-1526 | `applyBodyDropPose()` | Compensação de joelhos com o agachamento |
| 1529-1557 | `animate(now)` | **Loop principal** |
| 1559-1576 | Boot | Fetch SVG → `buildRigState` → `setPose(0)` → primeiro `rAF` |
| 1577-1623 | API pública | `{ setMode, getMode, setAudioInput, destroy }` |

---

## 3. Anatomia do loop principal (`animate`, linhas 1529-1557)

```
function animate(now):
  if (!rig) return                          # SVG ainda carregando

  # 1. Escolhe a função de pose pelo modo atual
  if currentMode in (standby, speaking):
    if previousMode not in (standby, speaking): initIdleState(now)   # ENTRADA
    animateIdlePose(now, { allowHeadTurn: currentMode === "standby" })
  elif currentMode == thinking:
    if previousMode != thinking: initThinkingState(now)              # ENTRADA
    animateThinkingPose(now)
  else:  # off
    if previousMode != off: resetIdlePose()                          # ENTRADA

  # 2. Compensação universal de pernas com o agachamento
  applyBodyDropPose()

  # 3. Memoriza pra detectar transição no próximo frame
  previousMode = currentMode

  # 4. Coisas que rodam em quase todo modo
  if currentMode != off: updateIdlePupils(now)
  updateBlink(now)                          # blink mesmo em "off"

  # 5. Boca
  if currentMode == speaking:
    setMouthByAudioLevel(now, activeAudioInput.update())
  else:
    setMouthShape("Neutral")

  # 6. Próximo frame
  rafHandle = requestAnimationFrame(animate)
```

**Pontos sutis**:

- `standby` e `speaking` **compartilham** a função `animateIdlePose` — a única
  diferença é `allowHeadTurn: false` em speaking (cabeça pinada frontal pra não
  desincronizar com a boca).
- `previousMode` é atualizado **dentro** do `animate` (linha 1543), não em
  `setMode`. Isso permite que cada preset detecte sua própria entrada e decida
  se chama `init…State(now)`.
- A boca volta pra `"Neutral"` **todo frame** que não for `speaking`. Se você
  adicionar um modo que precisa de outra forma (ex: `"Surprised"` em
  `celebrating`), precisa adicionar um `setMouthShape(...)` próprio antes do
  `rAF`.

---

## 4. Os 4 modos em detalhe

### `off` (linha 1538)
- **Entrada**: `resetIdlePose()` zera braços, pernas, agachamento e tilt.
- **Por frame**: blink continua; pupilas **não** atualizam (`updateIdlePupils`
  só roda fora de `off`); boca em `Neutral`.
- **Quando usar**: quando o motor está montado mas o usuário não interagiu
  ainda, ou em `prefers-reduced-motion`, ou quando o personagem deve sumir/ficar
  estático.

### `standby` (linha 1532, via `animateIdlePose`)
- **Entrada**: `initIdleState(now)` sementeia braços a partir de
  `arm.lastShoulder/lastElbow` (continuidade vinda de `thinking`).
- **Por frame**:
  - Agachamento senoidal 0-10px sincronizado com a cauda (`IDLE_SQUAT_*`).
  - Braços alternam entre `rest` ↔ `hip` a cada 5-11s.
  - Esporadicamente (5-14s entre ocorrências), **um** dos braços faz um gesto
    exclusivo: `chin` (mão no queixo, 2.6-4.8s) ou `scratch` (coçar cabeça, 2-3.8s).
  - Cabeça olha rápido pros lados (0.7-1.6s) e volta a frontal (4-10s).
  - Inclinação de cabeça oscila lentamente -5°…+5°.
- **Observavel**: Kevin parece "vivo" e atento, esperando.

### `thinking` (linha 1535, via `animateThinkingPose`)
- **Entrada**: `initThinkingState(now)` semeia braços a partir do estado atual.
- **Por frame**:
  - Agachamento mais profundo (até 40px, `THINKING_SQUAT_AMPLITUDE`).
  - Cabeça **travada** em ¾ direita (`headTurnStepToPoseIndex(-1)`).
  - Inclinação 0°-20° (mais acentuada que standby).
  - Ambos os braços vão (lerp lento, 0.045) pra
    `THINKING_ARM_TARGET_LEFT/RIGHT` (mão perto do rosto).
  - Cauda continua bobinando.
- **Observavel**: Kevin "agachado" em postura pensativa, mão perto do rosto,
  cabeça inclinada para um lado.

### `speaking` (linha 1532, mesma função que standby + lipsync)
- **Entrada**: `setMode("speaking")` é **async** — antes de entrar, faz
  `await activeAudioInput.start()`. Se retornar `false`, o modo **não muda**.
- **Por frame**: idêntico a `standby` exceto:
  - `allowHeadTurn: false` — cabeça permanece frontal (pose index 0).
  - Boca dirigida por `setMouthByAudioLevel(now, audioInput.update())`.
- **Saída**: ao trocar para outro modo, chama `activeAudioInput.stop()`.

---

## 5. O sistema de poses de cabeça

`POSE_CONFIG` (linha 22) é um array de 5 entradas, uma por pose:

```
Index | id                  | mouthIds                | head turn step
------|---------------------|-------------------------|----------------
 0    | _x2B_Frontal        | 12 formas (Neutral, Aa, …) |  0
 1    | _x2B_Left_Quarter   | 1 forma (_x2B_Mouth)    | +1
 2    | _x2B_Left_Profile   | 1 forma                 | +2
 3    | _x2B_Right_Quarter  | 1 forma                 | -1
 4    | _x2B_Right_Profile  | 1 forma                 | -2
```

`POSE_INDEX_BY_HEAD_TURN = [4, 3, 0, 1, 2]` mapeia `step + 2 → poseIndex`. Ou
seja, `headTurnStepToPoseIndex(-2) = 4` (right_profile), `(-1) = 3`,
`(0) = 0` (frontal), etc.

**Só a pose Frontal tem lipsync real**. As outras 4 têm 1 forma de boca cada
(fechada). Se chamar `setMouthByAudioLevel` numa pose não-frontal, ele apenas
chama `setMouthShape(pose.mouthIds[0])` (linha 686-688) — boca fica estática.
Por isso `speaking` força cabeça frontal.

### Adicionar uma pose nova (ex: `LookUp`)

1. **SVG primeiro**: o `kevin-rigged.svg` precisa ganhar um grupo
   `_x2B_LookUp` (Illustrator transforma `+` em `_x2B_`) contendo subelementos
   com ids únicos para mouth/eye/pupil/blink. Exemplo de naming convention:
   - Boca: `_x2B_Mouth_Up` (ou várias se for ter lipsync nessa pose)
   - Olhos: `Left_Eyeball_Up`, `Right_Eyeball_Up`, `_x2B_Left_Pupil_Up`,
     `_x2B_Right_Pupil_Up`
   - Blink: `Left_Blink_Up`, `Right_Blink_Up` (opcional)
2. **Editar `POSE_CONFIG`** (linha 22-53), adicionar entrada:
   ```js
   {
     id: "_x2B_LookUp",
     mouthIds: ["_x2B_Mouth_Up"],
     eyeIds: ["Left_Eyeball_Up", "Right_Eyeball_Up", "_x2B_Left_Pupil_Up", "_x2B_Right_Pupil_Up"],
     blinkIds: ["Left_Blink_Up", "Right_Blink_Up"],
   },
   ```
3. **Editar `POSE_INDEX_BY_HEAD_TURN` e `HEAD_TURN_BY_POSE_INDEX`** (linhas
   55-56). O sistema atual usa steps `[-2, -1, 0, +1, +2]`. Se você quer um
   `LookUp` como step `+3`, expanda os arrays:
   ```js
   const POSE_INDEX_BY_HEAD_TURN = [4, 3, 0, 1, 2, 5];   // 5 = LookUp
   const HEAD_TURN_BY_POSE_INDEX = { 4: -2, 3: -1, 0: 0, 1: 1, 2: 2, 5: 3 };
   ```
   E ajuste `clampHeadTurnStep` (linha 757) pra permitir `+3`.
4. Pose nova aparece automaticamente: `buildRigState` (linha 952) faz
   `.map(POSE_CONFIG, …)` e cacheia os nós.

**Cuidado**: o lipsync atualmente **só funciona em `_x2B_Frontal`** (chequeagem
hardcoded na linha 685). Se quiser lipsync em outra pose, mude a condição para
`pose.mouthIds.length >= N` ou similar.

---

## 6. Como adicionar um **modo** novo (receita completa)

Cenário: adicionar `celebrating` — Kevin pula com os braços pra cima e a boca
em `Surprised`.

### Passo 1 — Constantes (logo abaixo das existentes, linhas ~94)
```js
const CELEBRATING_ARM_TARGET_LEFT  = { shoulder: 120, elbow: 30 };  // braços pra cima
const CELEBRATING_ARM_TARGET_RIGHT = { shoulder: -120, elbow: -30 };
const CELEBRATING_ARM_LERP_SPEED = 0.10;       // mais rápido que thinking (0.045)
const CELEBRATING_HOP_AMPLITUDE = 30;          // pulinho de 30px pra cima
const CELEBRATING_HOP_SPEED = 4.0;             // 4 ciclos/s
```

### Passo 2 — Estado da instância (depois do bloco linha 522-547)
```js
const celebratingArmState = {
  left:  { curS: 0, curE: 0 },
  right: { curS: 0, curE: 0 },
};
```

### Passo 3 — `init` (espelhar `initThinkingState`, linha 1460)
```js
function initCelebratingState(now) {
  if (!rig) return;
  celebratingArmState.left.curS  = rig.leftArm?.lastShoulder ?? 0;
  celebratingArmState.left.curE  = rig.leftArm?.lastElbow ?? 0;
  celebratingArmState.right.curS = rig.rightArm?.lastShoulder ?? 0;
  celebratingArmState.right.curE = rig.rightArm?.lastElbow ?? 0;
}
```

### Passo 4 — Função de pose (espelhar `animateThinkingPose`, linha 1469)
```js
function animateCelebratingPose(now) {
  if (!rig) return;
  const t = now * 0.001;

  // Pulinho — negativo porque o eixo Y do SVG cresce pra baixo.
  const hop = -CELEBRATING_HOP_AMPLITUDE * Math.abs(Math.sin(t * CELEBRATING_HOP_SPEED));
  setBodyDropValue(lerp(bodyDropY, hop, 0.18));

  animateBodyWithSway(rig.body, 0);
  animateTail(now);

  // Cabeça frontal pra ver bem
  if (poseIndexToHeadTurnStep(poseIndex) !== 0) setPose(headTurnStepToPoseIndex(0));
  idleTiltExtra = lerp(idleTiltExtra, 0, 0.1);

  // Braços pra cima
  for (const side of ["left", "right"]) {
    const state = celebratingArmState[side];
    const target = side === "left" ? CELEBRATING_ARM_TARGET_LEFT : CELEBRATING_ARM_TARGET_RIGHT;
    const arm = side === "left" ? rig.leftArm : rig.rightArm;
    state.curS = lerp(state.curS, target.shoulder, CELEBRATING_ARM_LERP_SPEED);
    state.curE = lerp(state.curE, target.elbow, CELEBRATING_ARM_LERP_SPEED);
    animateArmWithValues(arm, state.curS, state.curE);
  }
}
```

### Passo 5 — Plugar no `animate` (linha 1532)
```js
if (currentMode === "standby" || currentMode === "speaking") {
  …
} else if (currentMode === "thinking") {
  …
} else if (currentMode === "celebrating") {
  if (previousMode !== "celebrating") initCelebratingState(now);
  animateCelebratingPose(now);
} else {
  …
}
```

E na boca (linha 1550):
```js
if (currentMode === "speaking") {
  setMouthByAudioLevel(…);
} else if (currentMode === "celebrating") {
  setMouthShape("Surprised");
} else {
  setMouthShape("Neutral");
}
```

### Passo 6 — Allow-list do `setMode` (linha 1585)
```js
if (!["off", "standby", "speaking", "thinking", "celebrating"].includes(mode)) {
  …
}
```

### Passo 7 — Lifecycle do áudio
Se o modo não toca áudio, **não esqueça** a lógica de stop:
```js
if (mode === "speaking") {
  const ok = await activeAudioInput.start(); …
} else if (currentMode === "speaking") {     // saindo de speaking
  activeAudioInput.stop();
}
```
Já tá certo no código atual — só verifique se sua transição não trava o áudio
em estado inválido.

### Passo 8 — Testar
Use `demo.html` adicionando um botão `<button data-mode="celebrating">Comemorar</button>`.

---

## 7. Como adicionar um **gesto idle** novo (ex: bocejar)

Gestos idle são **exclusivos por lado** (só um braço por vez, esporádicos)
durante `standby` e `speaking`. O sistema vive em `idleGesture` (linhas
540, 1373-1382) e nas poses de braço (`ARM_POSE_LEFT/RIGHT`, linhas 77-88).

### Passo 1 — Adicionar a pose em `ARM_POSE_LEFT` e `ARM_POSE_RIGHT` (linha 77)
```js
const ARM_POSE_LEFT = {
  rest: { shoulder: 15, elbow: 31 },
  hip:  { shoulder: -18, elbow: 72 },
  chin: { shoulder: -4, elbow: 148 },
  scratch: { shoulder: -55, elbowA: -100, elbowB: -130 },
  yawn: { shoulder: 70, elbow: 90 },     // ← novo
};
const ARM_POSE_RIGHT = {
  …,
  yawn: { shoulder: -70, elbow: -90 },
};
```

### Passo 2 — Estender o picker em `animateIdlePose` (linha 1374)
```js
if (!idleGesture.side && now >= idleGesture.nextAt) {
  idleGesture.side = Math.random() < 0.5 ? "left" : "right";
  const roll = Math.random();
  idleGesture.type = roll < 0.4 ? "chin" : roll < 0.8 ? "scratch" : "yawn";  // ← novo
  const duration =
    idleGesture.type === "chin"    ? 2600 + Math.random() * 2200 :
    idleGesture.type === "scratch" ? 2000 + Math.random() * 1800 :
                                     1500 + Math.random() * 1000;  // ← novo: yawn 1.5–2.5s
  idleGesture.endsAt = now + duration;
}
```

### Passo 3 — Handler do gesto (dentro do loop de braços, linha 1393)
```js
if (isGesturing && idleGesture.type === "chin") {
  state.tgtS = poses.chin.shoulder;
  state.tgtE = poses.chin.elbow;
} else if (isGesturing && idleGesture.type === "scratch") {
  …
} else if (isGesturing && idleGesture.type === "yawn") {           // ← novo
  state.tgtS = poses.yawn.shoulder;
  state.tgtE = poses.yawn.elbow;
} else {
  …
}
```

### Para gestos que envolvem **boca/olhos** (ex: bocejar com boca aberta + olhos fechados)
Você precisa do flag `idleGesture.type === "yawn"` lido também no fim do
`animate()` antes da boca:
```js
if (currentMode === "speaking") {
  setMouthByAudioLevel(…);
} else if (idleGesture.type === "yawn") {
  setMouthShape("w-Oo");      // boca aberta
} else {
  setMouthShape("Neutral");
}
```
E pros olhos: ou força `setEyesClosed(true)` na metade do gesto, ou suprime o
blink natural durante o gesto.

---

## 8. Lipsync — como funciona, como ajustar, como trocar a fonte

### Fluxo (linhas 682-709)

```
audio.update() → level (0–1, RMS) → envelope assimétrico → bucket de tier → forma da boca
```

1. **Nível bruto**: `activeAudioInput.update()` retorna 0-1 (RMS dos últimos
   `fftSize` samples).
2. **Envelope assimétrico**: `lerp(smoothed, level, rate)` onde:
   - `rate = 0.5` quando `level > smoothed` (**attack**, abre rápido)
   - `rate = 0.12` quando `level < smoothed` (**release**, fecha devagar)
   - Por que assimétrico: boca abrir rápido em ataque consonantal é natural;
     fechar devagar entre sílabas evita tremor.
3. **Silêncio**: `smoothed <= AUDIO_MOUTH_SILENCE (0.035)` → boca `Neutral`,
   retorna.
4. **Bucket**: `AUDIO_MOUTH_TIERS.find(t => smoothed <= t.max)` escolhe um dos
   3 tiers:
   ```
   tier 1 (≤0.10): ["M","F","L"]              — fechado/quieto
   tier 2 (≤0.25): ["Aa","Uh","S","D"]        — meio aberto
   tier 3 (≤1.0):  ["Oh","Surprised","w-Oo","R"] — bem aberto
   ```
5. **Cycle de 120-220ms**: a forma só **muda** quando `now >=
   audioMouthState.nextChangeAt`. Escolha aleatória dentro do tier. Esse cycle
   imita ritmo de sílabas — sem ele a boca trocaria de forma a cada frame e
   pareceria mecânica.

### Receitas de tuning

| Quero… | Onde mexer | Como |
|---|---|---|
| Boca mais reativa | linha 693 | Aumentar `rate` no attack (0.5 → 0.7) |
| Boca fechar mais devagar | linha 693 | Diminuir o release (0.12 → 0.06) |
| Mais "rubber lips" (flutter) | linha 706 | Diminuir o cycle (`120 + random*100` → `60 + random*50`) |
| Mais "calmo"/menos trocas | linha 706 | Aumentar o cycle (`120 + random*100` → `200 + random*200`) |
| Considerar mais som como silêncio | linha 96 | Aumentar `AUDIO_MOUTH_SILENCE` (0.035 → 0.05) |
| Forçar só boca fechada (TTS ruim) | linha 97 | Substituir todos os tiers por `["M","F","L"]` |
| Forçar boca aberta sempre que falando | linha 697 | Trocar `if (smoothed <= silence)` por `if (false)` |

### Trocar a fonte de áudio (contrato)

`activeAudioInput` é qualquer objeto com:
```ts
{
  enabled: boolean,        // estado interno (não obrigatório)
  level: number,           // último nível (não obrigatório)
  async start(): Promise<boolean>,
  stop(): void,
  update(): number,        // 0..~1 — chamado por frame durante "speaking"
}
```

Trocar via `kevin.setAudioInput(fonte)` (linha 1610). Veja exemplos:

#### Fonte 1: TTS via `<audio>` (já documentado no README)
Conecta `audioEl` → `createMediaElementSource` → `AnalyserNode`. Já existe no
`kevin-puppet-integration.js` da plataforma — `source.connect(ctx.destination)`
é essencial ou o áudio fica mudo.

#### Fonte 2: sempre-aberto (debug / testes visuais)
```js
function createAlwaysOpenInput(targetLevel = 0.4) {
  return {
    enabled: false,
    level: 0,
    async start() { this.enabled = true; this.level = targetLevel; return true; },
    stop()        { this.enabled = false; this.level = 0; },
    update()      { return this.enabled ? targetLevel : 0; },
  };
}
```

#### Fonte 3: phoneme alignment (timestamps pré-gerados)
Quando você tem `[{time_ms, mouthShape: "Aa"}, …]` de um alinhador (Whisper,
forced alignment, etc.):
```js
function createTimedShapeInput(timeline, audioEl) {
  const startedAt = { current: 0 };
  return {
    async start() {
      startedAt.current = performance.now() - audioEl.currentTime * 1000;
      return true;
    },
    stop() { startedAt.current = 0; },
    update() {
      const elapsed = performance.now() - startedAt.current;
      // Retorna um nível "fake" só pra passar o silence check, e
      // sobrescreve setMouthShape direto via setInterval no host.
      return 0.3;
    },
  };
}
```
**Observação**: pra esse caso seria mais limpo expor um hook
`engine.setMouthShape(id)` na API pública, mas hoje o motor não permite — você
teria que estender em `createKevinPuppet` retornando uma nova função.

#### Fonte 4: constante de teste
Útil quando quer ver Kevin "falar" sem áudio:
```js
let phase = 0;
const fakeInput = {
  async start() { return true; },
  stop() {},
  update() { phase += 0.05; return (Math.sin(phase) + 1) / 2 * 0.5; },
};
```

---

## 9. SVG — quais ids o motor lê e o que acontece se sumirem

| ID | Onde é lido | Função | Se sumir, o que acontece |
|---|---|---|---|
| `_x2B_Puppet` | linha 1566 | Container root | Fallback `mount.querySelector("svg")`; se ainda assim falhar, throw |
| `_x2B_Frontal` | `POSE_CONFIG[0].id` | Pose frontal | **Sem lipsync** (única pose que tem) |
| `Neutral`, `M`, `Aa`, `Oh`, `Uh`, `F`, `L`, `S`, `R`, `D`, `w-Oo`, `Surprised` | `POSE_CONFIG[0].mouthIds` | 12 formas da boca | Cada uma some individualmente (a faltante fica indisponível pro tier) |
| `Left_Eyeball2`, `Right_Eyeball2`, `_x2B_Left_Pupil2`, `_x2B_Right_Pupil2` | `POSE_CONFIG[0].eyeIds` | Olhos + pupilas (frontal) | Sem drift de pupila na frontal |
| `Left_Blink`, `Right_Blink` | `POSE_CONFIG[0].blinkIds` | Olhos fechados (blink) | Kevin não pisca |
| `_x2B_Left_Quarter`, `_x2B_Left_Profile`, `_x2B_Right_Quarter`, `_x2B_Right_Profile` | `POSE_CONFIG[1-4].id` | Outras 4 poses de cabeça | Aquela pose fica indisponível (no `setPose` ela some) |
| `_x2B_Mouth`, `_x2B_Mouth1`, `_x2B_Mouth3`, `_x2B_Mouth4` | Mouth das poses não-frontais | Boca fechada das outras poses | Pose fica sem boca renderizada |
| `Left_Arm`, `Right_Arm` | `rig.leftArm.meshGroup`, `rig.rightArm.meshGroup` | Grupo do braço (rotaciona inteiro) | **Braço não anima** |
| `Anti_Braço`, `Anti_Braço1` | `forearmMeshPath` | Mesh do antebraço | Sem deformação de cotovelo |
| `bicepcs`, `bicepcs1` | `upperArmPath` | Mesh do bíceps | Idem |
| `Cotovelo_core_bone`, `Cotovelo_core_bone1` | `elbowCore` | Pivô do cotovelo | Cotovelo gira errado |
| `Pulso_bone`, `Pulso_bone1`, `Pulso`, `Pulso1` | `wristBone` | Pivô do pulso | Mão desconectada do braço |
| `Mão`, `mão` | `handLayerNode` | Mão | Mão não acompanha |
| `Deform2`, `Deform3` | `elbowDeform` | Driver de deformação do cotovelo | Sem dobra suave |
| `Left_Leg`, `Right_Leg` | `rig.leftLeg.meshGroup`, `rig.rightLeg.meshGroup` | Grupo da perna | **Perna não anima no agachamento** |
| `Perna_direita`, `Perna_esquerda` | `meshPaths` | Mesh da perna | Sem deformação |
| `Tibia`, `Tornozelo` | `shinBone`, `ankleBone` | Tíbia/tornozelo | Perna não dobra |
| `Pé_direito`, `Pé_esquerdo` | `footGroup` | Pé | Pé não acompanha o joelho |
| `Joelho_Core`, `Deform` | `kneeCore`, `kneeDeform` | Pivô e deform do joelho | Idem |
| `Bones_Right_leg`, `Bones_Left_Leg` | `bonesGroup` | Esqueleto (oculto sempre) | Nada visível, mas usado pra aninhar mesh |
| `Tail` | `rig.tail.node` | Cauda | Sem balanço |
| `Bones_Left_Arm`, `Bones_Right_Arm` | `bonesGroup` (braços) | Esqueleto dos braços | Idem |

### Convenções do SVG (regras pra um novo export)

1. **Origem**: Illustrator (`.ai`) → Salvar como SVG. O Illustrator transforma
   automaticamente caracteres especiais (`+` → `_x2B_`, `ç` → `_xE7_`, etc.).
   O motor usa os ids **literais** (`_x2B_Puppet`), então não pode renomear
   manualmente.
2. **Hierarquia**: o root deve ser `<g id="_x2B_Puppet">` (ou fallback `<svg>`).
   Dentro, os 5 grupos de pose. Dentro de cada pose, os subelementos com ids
   próprios (boca/olho/pupila/blink).
3. **Path data**: o parser (`parsePathDataToAbsolute`, linha 187) só entende
   `M, m, L, l, H, h, V, v, C, c, Z, z`. **Arcos (`A`) e quadratics (`Q`)
   lançam exceção** ("Comando de path nao suportado"). Exporte do Illustrator
   com a opção "Curvas Bezier cúbicas".
4. **Layer ordering**: as formas de boca (`Neutral`, `M`, …) devem ser
   **siblings** dentro do mesmo grupo pose — o `setMouthShape` faz `display:
   none/inline` em cada uma sem reordenar.
5. **Ids únicos globais**: todos os ids citados acima devem ser **únicos no
   SVG inteiro**. Illustrator às vezes duplica ids quando você cola uma camada
   — sempre verifique com `grep 'id="..."' kevin-rigged.svg | sort | uniq -d`.
6. **Pivôs hard-coded**: as coordenadas em `LEFT_ARM_PIVOTS` etc. (linha 58)
   são valores **fixos no espaço SVG original**. Se o novo export mudou o
   `viewBox`, transformou o personagem, ou redesenhou a geometria das juntas,
   esses pivôs precisam ser recalculados. Use o Illustrator: clique no ponto
   exato do ombro/cotovelo/etc. e leia as coordenadas X/Y.

---

## 10. Constantes ajustáveis (cheat sheet)

| Constante | Linha | Atual | Categoria | Efeito de aumentar | Range seguro |
|---|---|---|---|---|---|
| `TAIL_BOB_AMPLITUDE` | 65 | 6.2 | cauda | Cauda balança mais largo | 2-15 |
| `TAIL_BOB_SPEED` | 66 | 1.9 | cauda | Cauda balança mais rápido | 0.5-4 |
| `PUPIL_TRACK_X_RATIO` | 67 | 0.16 | olhos | Pupilas correm mais nos cantos | 0.05-0.30 |
| `PUPIL_TRACK_Y_RATIO` | 68 | 0.2 | olhos | Idem vertical | 0.05-0.35 |
| `BODY_DROP_MAX` | 69 | 50 | corpo | Máximo de agachamento (px) | 30-80 |
| `BODY_DROP_KNEE_OUT_MAX` | 70 | 42 | corpo | Joelhos abrem mais | 20-60 |
| `IDLE_SQUAT_AMPLITUDE` | 72 | 10 | standby | Standby agacha mais (px) | 5-25 |
| `IDLE_SQUAT_SPEED` | 73 | 0.54 | standby | Standby agacha mais rápido | 0.2-1.5 |
| `ARM_POSE_LEFT.rest.*` | 77 | … | braços | Pose neutra do braço esq. | combinações de tilt + flex |
| `ARM_POSE_LEFT.chin.*` | 80 | … | braços | Pose "mão no queixo" | |
| `ARM_POSE_LEFT.scratch.{elbowA,elbowB}` | 81 | -100, -130 | braços | Range do movimento de coçar | A-B = 20-40 |
| `THINKING_ARM_TARGET_LEFT.*` | 91 | 55, 119 | thinking | Pose de "mão perto do rosto" | |
| `THINKING_ARM_LERP_SPEED` | 93 | 0.045 | thinking | Quão rápido vai pra pose | 0.02-0.10 |
| `THINKING_SQUAT_AMPLITUDE` | 94 | 40 | thinking | Quão fundo agacha pensando | 20-70 |
| `AUDIO_MOUTH_SILENCE` | 96 | 0.035 | lipsync | Threshold de "tá em silêncio" | 0.01-0.08 |
| `AUDIO_MOUTH_TIERS[*].max` | 97 | 0.10, 0.25, 1.0 | lipsync | Limites entre tiers | crescente, último ≥ 1 |
| Envelope attack | 693 | 0.5 | lipsync | Boca abre mais rápido | 0.3-0.8 |
| Envelope release | 693 | 0.12 | lipsync | Boca fecha mais devagar | 0.05-0.25 |
| Cycle base | 706 | 120 | lipsync | Tempo mínimo entre trocas (ms) | 60-300 |
| Cycle jitter | 706 | 100 | lipsync | Variação aleatória (ms) | 50-200 |
| Blink delay base | 725 | 1700 | olhos | Intervalo entre piscadas (ms) | 800-4000 |
| Blink delay jitter | 725 | 2800 | olhos | Variação | 500-4000 |
| Blink duration | 724 | 130 | olhos | Quanto tempo fechado (ms) | 80-200 |
| Pupil drift cycle | 739 | 1200 + r*2600 | olhos | Quão rápido pupila muda alvo | 500-5000 |
| Pupil drift speed | 742 | lerp 0.045 | olhos | Velocidade do movimento | 0.02-0.15 |
| Idle head turn base | 1429 | 700 + r*900 | cabeça | Quanto tempo olha pro lado | 500-3000 |
| Idle head return | 1424 | 4000 + r*6000 | cabeça | Quanto tempo fica frontal | 2000-15000 |
| Idle gesture min | 1339 | 4000 + r*5000 | gestos | Tempo até primeiro gesto | 3000-15000 |
| Idle gesture cooldown | 1381 | 6000 + r*9000 | gestos | Tempo entre gestos | 4000-20000 |

---

## 11. Pitfalls comuns

### `Comando de path nao suportado: Q`
Você exportou o SVG com curvas quadráticas. Re-exporte só com cubic bezier
(`C`). No Illustrator: Edit → Preferences → "Decimal places: 3" e exportar como
"SVG 1.1" sem "Subset converter".

### Kevin renderiza mas o braço está em posição esquisita / desencaixado
Os **pivôs** (`LEFT_ARM_PIVOTS` etc., linhas 58-63) estão em coordenadas
absolutas no espaço SVG original. Se você reimportou o SVG com `transform` no
root, todos os pivôs ficam errados. Solução: tirar o transform do root no SVG
ou recalcular todos os pivôs.

### A boca não abre durante `speaking`
Cinco causas possíveis, na ordem:
1. Pose atual não é Frontal (`pose.id !== "_x2B_Frontal"` — linha 685).
   Verifique se `currentMode === "speaking"` força frontal.
2. `activeAudioInput.update()` retorna 0 (microfone mudo / `<audio>` pausado /
   `AudioContext` suspended).
3. `AUDIO_MOUTH_SILENCE` está muito alto pro nível atual — abaixe pra `0.01`
   pra testar.
4. SVG perdeu uma das formas (`Aa`, `Oh`, etc.) e o fallback caiu sempre em
   `Neutral` — abra DevTools, busque `#Aa`, etc.
5. A integração não conectou `source.connect(ctx.destination)` — áudio toca em
   bypass, analyser recebe silêncio. Ver `kevin-puppet-integration.js`.

### Trocar de modo causa um "salto"
Você esqueceu de **partir do estado atual** no `init…State`. Padrão a seguir:
sempre semeie `curr*` com `arm?.lastShoulder ?? defaultValue` (espelhar
`initThinkingState`, linha 1462).

### `setMode("speaking")` retorna `false`
A fonte de áudio falhou em `start()`. Causas:
- **Microfone**: permissão negada (`getUserMedia` reject).
- **TTS**: `AudioContext.resume()` rejeitou (precisa user gesture); ou
  `createMediaElementSource()` foi chamado **duas vezes** no mesmo `<audio>`
  (InvalidStateError) — só pode chamar uma vez por element.

### Performance ruim em mobile
O loop é leve (mexe transforms + display), mas o **path data** das 12 formas de
boca + 5 grupos de pose pode pesar no parse inicial (~2.7MB de SVG). Se notar
lag na primeira carga: gzip o `.svg` no servidor (vira ~200KB), use cache
agressivo, e considere fazer collectstatic com hash pra evitar revalidação.

### Reduced-motion: Kevin continua se mexendo
O motor **não respeita** `prefers-reduced-motion` internamente. A integração
deve checar e chamar `setMode("off")`. Exemplo já implementado em
`kevin-puppet-integration.js`:
```js
const initialMode = matchMedia('(prefers-reduced-motion: reduce)').matches
  ? 'off' : 'standby';
await kevin.setMode(initialMode);
```

### `destroy()` deixou o personagem na tela
`destroy()` (linha 1618) faz `stage.remove()`. Se você reanexou o container
manualmente em outro pai antes do destroy, o `.kevin-stage` filho some, mas se
o motor mantinha referência ainda viva (closure), pode haver leak. Sempre
descarte a referência do API retornada (`kevin = null`) após `destroy()`.

---

## 12. Como testar mudanças

O harness oficial é `demo.html` nesta pasta. Workflow rápido:

```sh
cd animacao/export
python3 -m http.server 8123
# abre http://localhost:8123/demo.html
```

Pra debugar visualmente:
- **Ver o esqueleto**: no inspetor, encontre `[id="Bones_Left_Arm"]` e mude
  `display:none` pra `display:inline`. Os bones aparecem por cima.
- **Forçar uma pose**: no console, chame `puppet.querySelector('[id="_x2B_Frontal"]').style.display = 'none'` (some) e mostre outra.
- **Logar nível de áudio**: no console:
  ```js
  setInterval(() => console.log(kevin.getMode(), activeAudioInput.level), 200);
  ```
  (vai precisar expor `activeAudioInput` na API pra debug — adicione um getter
  temporário).

### Workflow pra ajustar uma constante

1. Mude o valor em `kevin-puppet.js`.
2. Recarregue `demo.html` (sem cache: Ctrl+Shift+R).
3. Clique entre os modos pra ver a transição.
4. Se o cycle de troca for longo (ex: gestos), use `setInterval` pra clicar nos
   modos automaticamente e observar acelerado.

---

## 13. Coisas que o motor **propositalmente** não faz

São oportunidades pra estender, não bugs:

- **Não respeita `prefers-reduced-motion`** — deixe a integração lidar.
- **Não tem hook `onModeChange`** — você não pode reagir a transições do lado
  de fora. Adicionar é trivial: emita `container.dispatchEvent(new CustomEvent('kevin-mode', { detail: { from, to } }))` no `setMode`.
- **Não expõe `setMouthShape` na API pública** — pra integrações que querem
  driver de fonema com timestamp você precisa expor.
- **Não tem queue de modos** — se setar 5 modos em sequência, o usuário vai ver
  só o último. Aceitável pra UX atual.
- **Não tem fallback de SVG simples** — se o rigged falha, ele só loga e a
  página fica vazia. A integração da Bebelingue (`_showFallback` em
  `kevin-puppet-integration.js`) lida com isso fora.
- **Áudio em `speaking` precisa user gesture** — autoplay policy. Use `unlock()`
  num clique do usuário antes da primeira chamada de `speaking`.

---

## 14. Checklist antes de mergear uma extensão

- [ ] Constantes novas têm comentário explicando unidades (graus? px? ms?).
- [ ] `init…State()` semeia valores a partir do estado anterior (não sobreescreve com defaults).
- [ ] Toda mudança de transform é via `lerp(curr, target, factor)`, não atribuição direta.
- [ ] Se introduziu um modo novo: está na allow-list de `setMode` (linha 1585).
- [ ] Se o modo precisa de áudio: `setMode` chama `start()/stop()` corretamente
      e respeita o retorno `false`.
- [ ] Se mexeu no SVG: rodou `grep 'id="..."' kevin-rigged.svg | sort | uniq -d`
      pra checar ids duplicados.
- [ ] Testou os 4 modos em sequência (standby → thinking → speaking → off → standby)
      pra confirmar continuidade.
- [ ] Testou em prefers-reduced-motion (DevTools → Rendering → "Emulate CSS prefers-reduced-motion").
- [ ] Não introduziu novo `console.error` em fluxo normal (use `onError` para erros).
- [ ] Atualizou este `IMPLEMENTACAO.md` se a mudança é estrutural.

---

## 15. Diretórios e arquivos correlatos

| Arquivo | O quê |
|---|---|
| `kevin-puppet.js` | Motor (este documento) |
| `kevin-puppet.css` | Estilos do `.kevin-stage`/`.kevin-puppet-mount` criados pelo motor |
| `kevin-rigged.svg` | Personagem rigado — IDs hardcoded no motor |
| `background-forest.png` | Fundo padrão do demo (opcional) |
| `demo.html` | Harness com 4 botões pra testar |
| `README.md` | Como **integrar** o motor numa app |
| `IMPLEMENTACAO.md` | Este documento — como **estender** o motor |

No projeto Bebelingue:
- `static/js/kevin-puppet/` — cópia destes arquivos servida pelo Django
- `static/js/kevin-puppet-integration.js` — facade que conecta o motor ao chat
- `templates/professor/aula_detail.html` — onde o motor é montado
