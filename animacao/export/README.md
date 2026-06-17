# Kevin Puppet

Motor de animação do personagem Kevin (deformação de SVG + 3 presets de
comportamento), empacotado para ser usado em qualquer aplicação web, sem a UI
de testes do projeto original.

Esta pasta (`export/`) é autocontida: copie os 4 arquivos abaixo para a outra
aplicação e funciona.

```
export/
├── kevin-puppet.js        motor (rig + presets) - ES module
├── kevin-puppet.css       estilos mínimos do card (background + puppet)
├── kevin-rigged.svg       arte do personagem
├── background-forest.png  fundo de exemplo (opcional, troque pelo seu)
├── demo.html              harness de validação (não é necessário copiar)
└── README.md              este arquivo
```

---

## 1. Como implementar na outra aplicação

### Passo 1 — copiar os arquivos

Copie `kevin-puppet.js`, `kevin-puppet.css` e `kevin-rigged.svg` para dentro
do seu projeto, mantendo os três no mesmo diretório (o módulo localiza o SVG
automaticamente ao lado de si mesmo). Copie também a imagem de fundo que for
usar, ou aponte para a sua própria.

### Passo 2 — HTML

```html
<link rel="stylesheet" href="./kevin-puppet.css" />

<!-- O motor cria o card (background + puppet) dentro deste elemento.
     Dimensione-o como quiser via CSS - o conteúdo se ajusta ao tamanho. -->
<div id="kevin-container" style="width: 480px; height: 640px;"></div>

<script type="module">
  import { createKevinPuppet } from "./kevin-puppet.js";

  const kevin = await createKevinPuppet(document.getElementById("kevin-container"), {
    backgroundUrl: "./background-forest.png", // opcional - omita para fundo transparente
  });

  // Pronto - o puppet já está rodando. Chame setMode quando quiser.
  await kevin.setMode("standby");
</script>
```

Não há nenhum botão, slider ou texto na tela — só o puppet animado sobre o
fundo. Todo o controle é programático.

### Passo 3 — conectar ao estado vindo do backend

A ideia é: o backend decide o estado da conversa com a IA, o frontend só
repassa esse estado para o puppet. Não importa o transporte (WebSocket, SSE,
polling) — no fim, é sempre uma chamada a `kevin.setMode(...)`:

```js
// Exemplo com WebSocket
socket.addEventListener("message", async (event) => {
  const { type, mode } = JSON.parse(event.data);
  if (type === "puppet_state") {
    await kevin.setMode(mode); // "standby" | "thinking" | "speaking" | "off"
  }
});
```

Mapeamento sugerido para o ciclo de uma conversa com IA:

| Situação | Modo |
|---|---|
| Sem interação, esperando o usuário | `"standby"` |
| Aguardando a IA processar a resposta | `"thinking"` |
| Áudio da resposta da IA sendo reproduzido | `"speaking"` |

`setMode` é assíncrono e retorna `false` se a troca falhar (hoje, isso só
acontece ao entrar em `"speaking"` sem permissão de áudio concedida) — nesse
caso o puppet permanece no modo anterior.

### Passo 4 — ligar o áudio da fala da IA ao "speaking"

Por padrão, o modo `"speaking"` usa o microfone (via `createMicAudioInput`,
útil para testes). Para sincronizar a boca com o áudio da resposta da IA
tocando no navegador, troque a fonte por um analisador apontando para o
elemento `<audio>`:

```js
import { createKevinPuppet } from "./kevin-puppet.js";

function createTtsAudioInput(audioEl) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const source = ctx.createMediaElementSource(audioEl);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.6;
  source.connect(analyser);
  source.connect(ctx.destination); // mantém o áudio audível
  const dataArray = new Uint8Array(analyser.fftSize);

  return {
    enabled: false,
    level: 0,
    async start() {
      this.enabled = true;
      return true;
    },
    stop() {
      this.enabled = false;
      this.level = 0;
    },
    update() {
      if (!this.enabled) return 0;
      analyser.getByteTimeDomainData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const v = (dataArray[i] - 128) / 128;
        sum += v * v;
      }
      this.level = Math.sqrt(sum / dataArray.length);
      return this.level;
    },
  };
}

const audioEl = document.getElementById("ttsAudio"); // seu <audio>
await kevin.setAudioInput(createTtsAudioInput(audioEl));

// quando a resposta da IA chegar:
audioEl.src = urlDoAudioDaResposta;
audioEl.play();
await kevin.setMode("speaking");
```

`setAudioInput` aceita qualquer objeto com `start()`, `stop()` e `update()`
(retornando um nível de 0 a ~1) — o resto do código de lipsync não precisa
mudar nunca, mesmo se a fonte de áudio mudar no futuro (arquivo, stream,
fonemas com timestamp, etc.).

### API completa

```ts
const kevin = await createKevinPuppet(container: HTMLElement, {
  svgUrl?: string,        // default: kevin-rigged.svg ao lado deste módulo
  backgroundUrl?: string, // default: nenhum (fundo transparente)
  onError?: (msg: string) => void,
});

await kevin.setMode("off" | "standby" | "thinking" | "speaking"); // -> boolean
kevin.getMode(); // -> string
await kevin.setAudioInput(fonteDeAudio);
kevin.destroy(); // para o loop de animação e remove o DOM criado
```

### Testando antes de integrar

`demo.html` (nesta pasta) é um harness mínimo com 4 botões (Off / Stand by /
Pensando / Falando) que usa exatamente esses 4 arquivos, sem nenhuma outra
dependência. Sirva a pasta com qualquer servidor estático e abra no
navegador:

```sh
cd export
python3 -m http.server 8123
# abra http://localhost:8123/demo.html
```

---

## 2. Como funciona a lógica

### O rig (esqueleto + deformação)

O Kevin é um SVG estático exportado do Illustrator. Não há nenhuma animação
nativa nele — todo movimento é feito em runtime, recalculando atributos
`transform` e `d` (path data) a cada frame.

- **Rotação rígida** (ombro, cotovelo, joelho, cabeça, quadril): aplica
  `rotate(deg cx cy)` em torno do pivô daquela junta. Os pivôs (coordenadas
  fixas no espaço do SVG original) estão em `LEFT_ARM_PIVOTS`,
  `RIGHT_LEG_PIVOTS` etc.
- **Deformação de mesh** (`deformArmPoint`, `deformLegPoint`,
  `deformTorsoPoint`): além da rotação rígida, os pontos do `path` da malha
  do braço/perna/torso são levemente recalculados perto da junta, para
  simular dobra de "pele" (squeeze/bulge) em vez de um corte reto. O path
  original é convertido para coordenadas absolutas uma vez
  (`parsePathDataToAbsolute`) e depois sempre deformado a partir dessa base,
  nunca a partir do resultado do frame anterior (evita acúmulo de erro).
- **Esqueleto** (os bonecos de "ossos" visíveis na demo original) sempre fica
  oculto nesta exportação — não há toggle. Eles ainda existem na estrutura
  interna do rig (são usados para aninhar a malha corretamente), só não são
  desenhados.

### Os 3 presets

Cada preset é uma função que, a cada frame (`requestAnimationFrame`), decide
os ângulos de braço/perna/cabeça e a altura do agachamento. Os três
compartilham mecanismos para a transição entre eles ser suave:

- **Continuidade de braço**: toda vez que um braço é movido
  (`animateArmWithValues`), o motor grava o último ângulo aplicado
  (`arm.lastShoulder` / `arm.lastElbow`). Quando um preset novo é ativado, ele
  lê esses valores como ponto de partida do seu próprio `lerp`, em vez de
  saltar de um ângulo fixo - por isso o braço "continua de onde estava" ao
  trocar de Pensando para Stand by, por exemplo.
- **Continuidade de agachamento**: a altura do agachamento (`bodyDropY`) é
  sempre aproximada por `lerp(valorAtual, novoAlvo, 0.06)`, nunca atribuída
  direto. Como Stand by oscila 0–10px e Pensando oscila 0–40px, sem esse lerp
  a troca causaria um salto de altura perceptível.
- **Continuidade de inclinação de cabeça**: mesma ideia, via `idleTiltExtra`.

**Stand by** (`animateIdlePose` com `allowHeadTurn: true`): agachamento lento
sincronizado com o bob da cauda; braços alternam entre "descanso" e "mão na
cintura" a cada 5–11s; ocasionalmente um dos braços (nunca os dois) faz um
gesto exclusivo - mão no queixo ou coçando a cabeça - por 2–4.5s; a cabeça dá
olhadas rápidas para os lados (0.7–1.6s) e volta para frente (fica ali
4–10s); inclinação de cabeça oscila bem suavemente entre -5° e 5°.

**Falando** (`animateIdlePose` com `allowHeadTurn: false`): idêntico ao Stand
by, exceto que o giro de cabeça é travado em frontal e a boca é dirigida pelo
nível de áudio (`setMouthByAudioLevel`) em vez de ficar neutra. O nível de
áudio passa por um envelope attack/release (abre rápido, fecha mais devagar)
e a troca de forma da boca acontece a cada 120–220ms (perto do ritmo de
sílabas), nunca a cada frame - isso evita o tremor mecânico que um lipsync
ingênuo baseado em volume bruto teria.

**Pensando** (`animateThinkingPose`): cabeça travada em 3/4 direita;
inclinação de cabeça oscila lentamente entre 0° e 20°; agachamento até 40px;
braços vão (via lerp) até uma pose fixa (mão perto do rosto) a partir de onde
estavam.

### O loop principal

```
requestAnimationFrame -> animate(now)
  decide o branch pelo currentMode ("off" | "standby" | "speaking" | "thinking")
  se o modo mudou desde o frame anterior -> chama o init/reset daquele branch
  aplica a pose do preset ativo
  aplica a compensação de pernas do agachamento (igual para todos os modos)
  atualiza pupila (drift natural) e blink (sempre, independente do modo)
  define a forma da boca (Neutral, ou por áudio em "speaking")
  agenda o próximo frame
```

### Entrada de áudio plugável

`activeAudioInput` (estado interno) é qualquer objeto com `start()`,
`stop()` e `update()` retornando um nível 0–1. Por padrão é o microfone
(`createMicAudioInput`). `kevin.setAudioInput(novaFonte)` troca isso em
runtime - nenhuma outra parte do motor depende de qual é a fonte real.

### O que foi deixado de fora desta exportação

Em relação ao projeto de testes original, foram removidos: todos os
sliders/botões manuais (ombro, cotovelo, cabeça, agachamento), o sistema de
"preset por membro" (ligar braço/perna/cauda individualmente), o toggle de
esqueleto, o botão de pausar animação, e o balão de fala com frases
aleatórias. Nada disso fazia sentido numa aplicação onde o estado é decidido
pelo backend e a única coisa visível é o personagem.
