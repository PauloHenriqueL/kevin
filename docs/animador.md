# Guia de exportação — animação do Kevin (para o animador)

> **Para quem é este documento:** o animador (e a IA que o ajuda a gerar o
> `export`). Ele descreve **como o Kevin precisa sair do seu processo** para
> funcionar no sistema da Bebelingue sem defeitos.
>
> **Por que existe:** o `export_2` chegou com problemas que travaram a
> integração — esqueleto visível, mãos duplicadas, Kevin mal posicionado no
> cenário, SVG pesado demais. Este guia lista cada regra para os próximos
> exports não repetirem isso.

---

## Como o sistema usa o seu export

O sistema **não** roda animação pronta. Ele carrega o seu `kevin-rigged.svg`
(arte estática) e o `kevin-puppet.js` (motor) **anima em tempo real** — move
braços, boca, olhos recalculando o SVG a cada frame. Por isso a arte precisa
seguir convenções exatas: o motor encontra cada parte **pelo `id`** da camada.

Entregue sempre a mesma estrutura de pasta:

```
export/
├── kevin-rigged.svg          arte do personagem
├── kevin-puppet.js           motor
├── kevin-puppet.css          estilos
├── assets/
│   ├── backgrounds/*.png     cenários
│   └── videos/*.webm         transição de cenário
└── demo.html                 harness de teste (use antes de enviar!)
```

---

## ✅ Checklist antes de enviar (o essencial)

- [ ] **Esqueleto NÃO aparece** em nenhum modo (ver regra 1)
- [ ] **Uma mão por lado** — sem mãos duplicadas ou sobrepostas (regra 2)
- [ ] **Mosca começa escondida** (regra 3)
- [ ] **Kevin pousa no "chão"** de cada cenário, não sobre móveis (regra 4)
- [ ] **SVG abaixo de ~2,5 MB** (regra 5)
- [ ] **IDs das camadas preservados** exatamente (regra 6)
- [ ] Testado no `demo.html`, todos os modos, sem defeito visível

---

## Regra 1 — O esqueleto (bones) NÃO pode aparecer

> **⭐ ESTE É O PROBLEMA PRINCIPAL.** Você vê a animação funcionar no seu
> ambiente, mas aqui o esqueleto aparece. **Descobrimos exatamente por quê** —
> leia abaixo, é uma correção simples de exportação.

**O sintoma:** as linhas e círculos das juntas (ombros, cotovelos, joelhos,
pulsos, pelve) aparecem **desenhados sobre o Kevin** no nosso sistema — mas não
no seu.

**A causa raiz (investigada no seu `export_2`):** no seu ambiente os bones estão
ocultos. Mas quando o Illustrator exporta o SVG, a classe dos bones (no
`export_2` chamada `st36`) sai assim:

```css
.st36 { stroke: #000; }     /* ← stroke PRETO = VISÍVEL */
```

Ou seja: a exportação **traduziu "oculto" para "linha preta visível"**. Por isso
você vê certo (no seu ambiente os bones estão numa camada oculta) e nós vemos o
esqueleto (o SVG exportado desenha os bones com stroke preto).

**Importante:** os bones **precisam existir** no SVG — o motor os usa para
montar o rig (mover braços, pernas). O que não pode é eles serem **desenhados**.

**A correção (escolha uma):**

1. **A mais simples — deixe a classe dos bones invisível na exportação.** Garanta
   que a classe de rig saia com `display: none` em vez de `stroke: #000`:
   ```css
   .st36 { display: none; }
   ```
   Se der para controlar isso no Illustrator (camada de rig com opacidade 0 /
   oculta que exporte como `display:none`), melhor ainda.

2. **Ou não estilize os bones com stroke visível.** Se a camada de esqueleto sair
   sem `stroke`/`fill`, ela não aparece.

**Teste:** abra o `demo.html`, passe por **todos** os modos (Standby, Música,
Dormindo, Pensando). Se você vê **qualquer linha ou círculo de junta** sobre o
corpo, os bones estão com estilo visível — corrija a classe deles.

> 💡 Do nosso lado, dá para "tapar" isso com um CSS (`.st36 { display:none }`),
> mas o certo é resolver na exportação — senão toda entrega nova traz o problema
> de volta e alguém precisa lembrar de tapar de novo.

---

## Regra 2 — Uma mão por lado (sem mãos extras)

**O problema no export_2:** durante a música (Kevin com ukulele) apareceu uma
**mão a mais** — uma mão translúcida além das que seguram o instrumento.

**A causa:** o Kevin tem uma mão **base** (`Mão`, `mão`) e **variantes** para
poses específicas (`Mão_Ukulele`, `Mão_tchau`, `Mão_fechada`). Quando uma
variante entra, a mão base do mesmo braço **tem que sumir**. No export_2 as duas
ficaram visíveis ao mesmo tempo.

**A regra:**
- Nomeie a mão neutra como `Mão` / `mão` (uma por braço).
- Nomeie cada variante com o prefixo `Mão_` + descrição (`Mão_Ukulele`,
  `Mão_tchau`, `Mão_fechada`).
- Garanta que **cada variante ocupe o mesmo espaço lógico** da mão base, para o
  motor trocar uma pela outra sem sobreposição.
- Todas as variantes (`Mão_*`) começam **escondidas**; só a mão base aparece no
  standby.

**Teste:** no `demo.html`, entre no modo Música. Conte as mãos: **exatamente
duas**, ambas no ukulele. Nenhuma mão "fantasma" flutuando.

---

## Regra 3 — A mosca começa escondida

**O problema no export_2:** a mosca ("vilão") aparecia **logo ao abrir**, sem o
sistema pedir.

**A regra:** o `Corpo_mosca` (e frames de asa/língua associados) deve nascer com
`display:none`. A mosca é um evento que o **sistema dispara** quando quer — nunca
inicia sozinha.

**Teste:** no `demo.html`, ao carregar (modo `off`/`standby`), **não pode haver
mosca** na tela. Ela só surge se você clicar no botão de mosca do harness.

---

## Regra 4 — O Kevin pousa no "chão" do cenário

**O problema no export_2:** no cenário **quarto**, o Kevin apareceu **em cima da
cama** em vez de no chão.

**A causa:** o sistema alinha o Kevin à **base inferior** da imagem de fundo.
Se o "chão" de um cenário está numa altura diferente de outro, o Kevin pousa no
lugar errado.

**A regra para os backgrounds:**
- **Mesma proporção em todos** (ex.: 16:9). Ver regra 5 para tamanho.
- O **"chão" onde o Kevin pisa deve estar na MESMA faixa vertical** em todos os
  cenários — de preferência, o **terço inferior** da imagem deve ser piso livre
  (sem móveis, camas, mesas) onde o personagem possa ficar de pé.
- No cenário **quarto**, o chão precisa estar visível na frente da cama — o
  Kevin pisa ali, não sobre o móvel.
- Deixe uma faixa de "respiro" na base: o personagem não deve encostar na borda
  inferior.

**Teste:** troque entre os cenários no `demo.html`. Em **todos**, os pés do
Kevin devem tocar um piso plausível — nunca flutuando nem sobre um móvel.

---

## Regra 5 — Peso dos arquivos

**O problema no export_2:** o `kevin-rigged.svg` veio com **6,6 MB** (dobrou em
relação à versão anterior). SVG pesado faz o Kevin demorar a aparecer — numa
escola com internet ruim, o professor olha uma tela vazia por segundos.

**As regras:**

**SVG (alvo: ~2,5 MB ou menos):**
- **Casas decimais: 2** na exportação (o Illustrator costuma vir com 3+; isso
  sozinho corta metade do arquivo).
- **Desmarque** "Preserve Illustrator Editing Capabilities" — engorda muito.
- Estilo: **Presentation Attributes** ou Internal CSS.
- **Responsive: desmarcado.**

**Backgrounds (alvo: ~300–400 KB cada):**
- Exporte em **WebP** se possível (ou PNG otimizado).
- **Mesma resolução em todos** — ex.: 1920×1080. (No export_2 havia mistura:
  floresta 4000×2250 e quarto 1672×941 — padronize.)

---

## Regra 6 — Nomes de camada (IDs) — NÃO renomear

O motor encontra cada parte do Kevin **pelo `id` da camada**. Se você renomear,
mover para outra classe, ou deixar o Illustrator renumerar automaticamente, **o
motor quebra**.

**Mantenha exatamente** estes nomes (e os equivalentes que o motor já usa):

| Parte | ID esperado |
|---|---|
| Mão neutra | `Mão`, `mão` |
| Mão com ukulele | `Mão_Ukulele` |
| Mão de tchau | `Mão_tchau` |
| Mão fechada | `Mão_fechada` |
| Variantes de cabeça | `Cabeça_*` / `Cabeca_*` |
| Props | `Prop_*` |
| Mosca | `Corpo_mosca` + frames de asa/língua |
| Grupos de esqueleto | `Bones_*` (ocultos — regra 1) |

⚠️ **Se você rodar um otimizador de SVG (SVGO ou similar), DESLIGUE a opção de
"limpar/renomear IDs"** (`cleanupIds: false`). Renomear IDs quebra o motor
inteiro.

---

## Como testar antes de enviar (obrigatório)

O `demo.html` que vem no export é um harness de teste. Rode-o localmente:

```
cd export
python3 -m http.server 8000
# abra http://localhost:8000/demo.html
```

Clique em **cada modo** (Off, Standby, Pensando, Falando, Dormindo, Música) e no
botão de **Mosca**, trocando entre **todos os cenários**. Confira o checklist do
topo deste documento. **Só envie se passar em todos.**

---

## Resumo de uma linha

> Kevin inteiro, no chão, com duas mãos, sem esqueleto e sem mosca ao abrir; SVG
> leve; IDs preservados. Teste no `demo.html` antes de enviar.
