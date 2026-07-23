# Kevin — Guia para o animador e a IA de animação

> **Para quem é:** o animador (Vitor) e a **IA que ele usa para gerar/animar o
> Kevin**. Cole este documento no sistema de IA dele.
>
> **O que este documento faz:**
> 1. Explica **o que é o projeto Kevin** e onde a animação entra
> 2. Explica **como o sistema usa o export** (o contrato técnico)
> 3. Faz um **questionário para a IA do animador** explicar o processo dela —
>    para acharmos exatamente onde os bugs nascem
> 4. Lista as **regras de exportação** e os **bugs recorrentes** com a causa raiz
>
> **Por que existe:** a animação funciona no ambiente do animador, mas os
> exports chegam ao nosso sistema com defeitos (esqueleto visível, mãos
> duplicadas, Kevin mal posicionado). Os defeitos vêm da **exportação**, não da
> arte. Este guia serve para os próximos exports saírem certos de primeira.

---

## Parte 1 — O que é o projeto Kevin

**Kevin** é uma plataforma que ajuda professores a dar aulas de inglês para
crianças. O Kevin é um **mascote (um camaleão amarelo/verde)** que aparece numa
tela grande na sala de aula — tipo uma chamada de vídeo — e conversa com o
professor por voz, ajudando a conduzir a aula.

**Onde a animação entra:** o Kevin precisa parecer **vivo**. Ele:
- fica em standby (parado, respirando, olhando em volta) esperando o professor
- "pensa" quando a IA está processando uma resposta
- "fala" com a boca sincronizada ao áudio
- "dorme" se ninguém interage por muito tempo
- **canta com um ukulele** quando a aula tem música
- se despede acenando

Tudo isso o **animador cria**. É o diferencial visual do produto — uma criança
de 8 anos precisa achar o Kevin simpático.

**A tela onde ele aparece:** um cenário de fundo (floresta, quarto, escola,
hospital…) que **muda conforme a aula**, com o Kevin na frente e botões de
controle embaixo (falar, música, chat).

---

## Parte 2 — Como o sistema usa o export (o contrato técnico)

Isto é o mais importante para a IA de animação entender.

**O sistema NÃO reproduz um vídeo.** Ele carrega:
- `kevin-rigged.svg` — a **arte estática** do Kevin (vetor)
- `kevin-puppet.js` — o **motor** que anima o SVG em tempo real
- `kevin-puppet.css` — estilos
- `assets/backgrounds/*` e `assets/videos/*` — cenários

O motor **recalcula o SVG a cada frame** — move braços, boca, olhos, pernas,
mudando atributos `transform` e `d` (path). Para isso, ele **encontra cada parte
do Kevin pelo `id` da camada**. Se um `id` estiver errado ou faltando, o motor
não acha a parte e **quebra**.

**O contrato de modos** — o sistema pede ao motor um destes estados:

| Modo | Quando | O que o Kevin faz |
|---|---|---|
| `standby` | esperando o professor | parado, respira, olha em volta, mão na cintura |
| `thinking` | IA processando | cabeça inclinada, mão perto do rosto |
| `speaking` | tocando resposta em áudio | boca sincronizada ao som |
| `sleeping` | ocioso há muito tempo | olhos fechados, "Zzz" |
| `musica` | aula com música | pega o ukulele e toca |
| `tchau` | despedida | acena e volta sozinho |
| Mosca | evento ocasional | uma mosca voa, Kevin segue com os olhos e a língua |

**O contrato de nomes (IDs) que o motor procura** — estes nomes de camada
**não podem mudar**:

```
Corpo:     Body, Head, Left_Arm, Right_Arm, Left_Leg, Right_Leg,
           Perna_direita, Perna_esquerda, Pé_direito, Pé_Esquerdo,
           Pelvis, Tail, Sombra
Mãos:      Mão, mão (neutras) · Mão_Ukulele, Mão_tchau, Mão_fechada (variantes)
Boca/olhos: Head, Lingua
Rig:       Bones_Body, Bones_Left_Arm, Bones_Right_Arm, Bones_Right_leg,
           Deform_Left_Elbow, Deform_Right_Elbow, Joelho_core, Pelvis_Core
Mosca:     Corpo_mosca, Mosca, frames de asa e língua
```

> Se a IA de animação gera esses nomes, ótimo. Se ela renumera (`.st0`, `.st1`…)
> ou renomeia a cada export, o motor quebra. **Preservar os IDs é regra número
> zero.**

---

## Parte 3 — Questionário para a IA de animação

> **Instrução para o animador:** peça à sua IA para responder cada pergunta
> abaixo. As respostas nos dizem **onde no processo dela os bugs nascem** — hoje
> a animação funciona no seu ambiente mas quebra no nosso, e precisamos entender
> a tradução.

### Sobre o processo

1. **Como você gera o SVG do Kevin?** (Illustrator exportando? Gera o XML do SVG
   direto? Outra ferramenta?)
2. **Quem escreve o `kevin-puppet.js`** — você gera do zero a cada versão, ou
   parte de um motor existente e ajusta?
3. **Como você cria um modo novo** (ex.: música)? O que muda no SVG e o que muda
   no JS?
4. **O que exatamente entra no `export`** que você entrega? Você monta o zip
   manualmente ou tem um passo automático?

### Sobre a exportação (onde suspeitamos do bug)

5. **No seu ambiente, os "bones" (esqueleto de rig) estão visíveis ou ocultos?**
   Como você os esconde — camada oculta, opacidade, `display:none`?
6. **Quando você exporta o SVG, o que acontece com a camada dos bones?** Ela sai
   com `stroke`/`fill` visível, ou some?
   > No `export_2` que recebemos, a classe dos bones saiu `.st36 { stroke:#000 }`
   > — ou seja, **visível**. É por isso que vemos o esqueleto. Queremos entender
   > por que a exportação faz isso.
7. **Como você controla as variantes de mão?** Quando o Kevin pega o ukulele
   (`Mão_Ukulele`), a mão neutra (`Mão`) fica escondida no seu ambiente? Como?
8. **A mosca (`Corpo_mosca`) começa visível ou oculta** no seu export?
9. **Você roda algum otimizador de SVG** (SVGO, etc.) antes de entregar? Ele
   renomeia IDs?

### Sobre os cenários

10. **Como você decide onde o Kevin "pisa"** em cada cenário? Os backgrounds têm
    o "chão" na mesma altura?
    > No cenário **quarto**, o Kevin apareceu **em cima da cama** em vez do chão.

### Sobre testar

11. **Você testa o export antes de entregar?** Roda o `demo.html`? Passa por
    todos os modos?

---

## Parte 4 — Regras de exportação (o que precisa sair certo)

### ✅ Checklist antes de enviar

- [ ] **Esqueleto (bones) NÃO aparece** em nenhum modo — regra 1
- [ ] **Uma mão por lado** — sem mãos duplicadas — regra 2
- [ ] **Mosca começa escondida** — regra 3
- [ ] **Kevin pisa no chão** de cada cenário, não sobre móveis — regra 4
- [ ] **SVG ≤ ~2,5 MB** — regra 5
- [ ] **IDs preservados** exatamente — regra 6
- [ ] Testado no `demo.html`, todos os modos, sem defeito

---

### Regra 1 — O esqueleto (bones) NÃO pode aparecer ⭐ PRINCIPAL

**Sintoma:** as linhas e círculos das juntas (ombros, cotovelos, joelhos,
pulsos) aparecem desenhados **sobre o Kevin** no nosso sistema — mas não no seu.

**Causa raiz (achada no `export_2`):** a classe dos bones sai assim do
Illustrator:

```css
.st36 { stroke: #000; }     /* ← linha PRETA = VISÍVEL */
```

A exportação **traduziu "oculto" (no seu ambiente) para "linha preta"** (no SVG).

**Importante:** os bones **precisam existir** — o motor os usa para montar o rig.
O que não pode é serem **desenhados**.

**Correção na exportação:** garanta que a classe/camada dos bones saia com
`display: none` (não com `stroke`). Se a IA gera o `<style>` do SVG, a regra dos
bones deve ser `display:none`, não `stroke:#000`.

**Teste:** no `demo.html`, passe por todos os modos. **Nenhuma** linha ou círculo
de junta pode aparecer sobre o corpo.

---

### Regra 2 — Uma mão por lado

**Sintoma:** durante a música, aparece uma **mão a mais** (translúcida) além das
que seguram o ukulele.

**Causa:** o Kevin tem mão **neutra** (`Mão`, `mão`) e **variantes**
(`Mão_Ukulele`, `Mão_tchau`, `Mão_fechada`). Quando uma variante entra, a neutra
do mesmo braço **tem que sumir**. No export as duas ficaram visíveis.

**Correção:** as variantes (`Mão_*`) começam **ocultas**; o motor troca a neutra
pela variante. Garanta que cada variante ocupe o mesmo espaço da neutra e que
nada force a neutra a reaparecer junto.

**Teste:** modo Música → conte as mãos: **exatamente duas**, ambas no ukulele.

---

### Regra 3 — A mosca começa escondida

**Sintoma:** a mosca ("vilão") aparece **logo ao abrir**, sem o sistema pedir.

**Correção:** `Corpo_mosca` (e frames associados) nasce com `display:none`. A
mosca é um evento que o **sistema dispara** — nunca inicia sozinha.

**Teste:** ao carregar o `demo.html` (standby), **não pode haver mosca**.

---

### Regra 4 — O Kevin pisa no chão do cenário

**Sintoma:** no cenário **quarto**, o Kevin apareceu **sobre a cama**.

**Causa:** o sistema alinha o Kevin à **base** da imagem de fundo. Se o "chão" de
um cenário está numa altura diferente, o Kevin pousa errado.

**Correção nos backgrounds:**
- **Mesma proporção e resolução** em todos (ex.: 1920×1080).
- O **chão (onde o Kevin pisa) no terço inferior** da imagem, **livre de móveis**.
- No **quarto**, deixe chão visível na frente da cama.

**Teste:** troque entre cenários no `demo.html`. Em todos, os pés do Kevin tocam
um piso plausível.

---

### Regra 5 — Peso dos arquivos

**Sintoma:** `kevin-rigged.svg` veio com **6,6 MB** (dobrou). SVG pesado = Kevin
demora a aparecer.

**SVG (alvo ≤ 2,5 MB):**
- Casas decimais: **2** (o Illustrator costuma vir com 3+ — corta metade)
- **Desmarque** "Preserve Illustrator Editing Capabilities"
- Estilo: Presentation Attributes ou Internal CSS
- Responsive: desmarcado

**Backgrounds (alvo ~300–400 KB):** WebP ou PNG otimizado, mesma resolução.

---

### Regra 6 — Nomes de camada (IDs) — NÃO renomear

O motor acha cada parte pelo `id`. Renomear, mover de classe, ou deixar o
Illustrator renumerar → **motor quebra**. Ver a lista de IDs na Parte 2.

⚠️ Se rodar SVGO, use **`cleanupIds: false`**.

---

## Parte 5 — Como testar antes de enviar (obrigatório)

O `demo.html` do export é um harness de teste:

```
cd export
python3 -m http.server 8000
# abra http://localhost:8000/demo.html
```

Clique em **cada modo** e no botão de **Mosca**, trocando entre **todos os
cenários**. Confira o checklist. **Só envie se passar em tudo.**

---

## Resumo de uma linha

> Kevin inteiro, no chão, duas mãos, sem esqueleto e sem mosca ao abrir; SVG
> leve; IDs preservados. Bones com `display:none` (não `stroke`). Teste no
> `demo.html` antes de enviar.
