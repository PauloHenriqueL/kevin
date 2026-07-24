# Vitor (animador) — guia, contrato e mensagens

> **Tudo que diz respeito ao animador está aqui.** Guia para a IA dele, o bloco
> que ele cola no `CLAUDE.md` do projeto dele, e o histórico de mensagens
> trocadas.
>
> Mensagens para o **cliente** e para o **Arthur** ficam em `mensagens.md`.

## Índice

| Parte | O que é | Para quem |
|---|---|---|
| [A — Guia da animação](#parte-a--guia-para-o-animador-e-a-ia-dele) | Explica o projeto, o contrato técnico e as regras de export | Colar no sistema de IA dele |
| [B — Bloco do CLAUDE.md](#parte-b--bloco-para-o-claudemd-do-vitor) | Instrução operacional: estrutura do export + validador | Colar no fim do `CLAUDE.md` dele |
| [C — Mensagens trocadas](#parte-c--mensagens-trocadas) | Histórico: o que foi pedido e respondido (C.4 = a mais recente) | Referência |

**Arquivo do validador:** `scripts/validar_export.py` (enviar como anexo).

---

# PARTE A — Guia para o animador e a IA dele


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

## A.1 — O que é o projeto Kevin

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

## A.2 — Como o sistema usa o export (o contrato técnico)

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

## A.3 — Questionário para a IA de animação

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

## A.4 — Regras de exportação

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
Illustrator renumerar → **motor quebra**. Ver a lista de IDs em A.2.

⚠️ Se rodar SVGO, use **`cleanupIds: false`**.

---

## A.5 — Como testar antes de enviar

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

---

# PARTE B — Bloco para o CLAUDE.md do Vitor

> Cole o bloco abaixo no fim do `CLAUDE.md` do projeto do Vitor.
> É instrução para a IA dele executar.

````markdown
## Padrão e validação do export do Kevin

Este projeto gera um `export/` consumido pelo sistema da Bebelingue. O export
**precisa seguir a estrutura abaixo e passar no validador** antes de ser
entregue.

### Estrutura obrigatória do export

Entregue **sempre** esta árvore, com estes nomes exatos:

```
export/
├── kevin-rigged.svg              arte do personagem (≤ 2,5 MB)
├── kevin-puppet.js               motor de animação
├── kevin-puppet.css              estilos do motor
├── demo.html                     harness de teste (obrigatório)
├── README.md                     changelog desta versão
└── assets/
    ├── backgrounds/              cenários (≤ 600 KB cada, mesma resolução)
    │   ├── floresta.png
    │   ├── quarto.png
    │   ├── banheiro.png
    │   ├── escola-int.png
    │   ├── escola-ext.png
    │   ├── hospital.png
    │   └── hospital-int.png
    └── videos/
        └── mudanca-cenario.webm  transição entre cenários
```

**Regras da estrutura:**

- **Não inclua arquivos soltos na raiz** além dos listados. (O `export_2` trouxe
  um `background-forest.png` na raiz, duplicando o `assets/backgrounds/floresta.png`
  — isso confunde qual é o arquivo válido.)
- **Nomes de cenário em minúsculas, sem acento, com hífen** para separar:
  `escola-int`, `hospital-int`. O sistema usa esses nomes como chave no banco —
  **renomear um cenário quebra as aulas que apontam para ele**.
- **Não renomeie os arquivos principais.** `kevin-rigged.svg`,
  `kevin-puppet.js` e `kevin-puppet.css` são referenciados por caminho.
- **Mantenha o `demo.html`** — é como testamos o export isolado dos dois lados.

### Entrega e versionamento

- Nomeie o zip como **`export_N.zip`** (N incremental: `export_3`, `export_4`…).
  Nunca reutilize o número de uma entrega anterior.
- No `README.md` do export, escreva **o que mudou nesta versão** — modos novos,
  cenários novos, correções. Duas ou três linhas bastam. É o que nos diz se
  precisamos ajustar algo do nosso lado.
- Se você **renomear, remover ou adicionar um cenário**, avise explicitamente:
  isso exige mudança no banco de dados do nosso lado.

### Validação obrigatória — sempre que gerar ou alterar o export

```bash
python3 validar_export.py export/
```

- **Código de saída 0** → export válido, pode entregar.
- **Código de saída 1** → há problemas. **Corrija cada item ❌ e rode de novo.**
  Não entregue um export que falha no validador.

Se o script de export for automatizado, chame o validador como último passo dele.

### Como corrigir cada falha do validador

| Falha do validador | O que fazer |
|---|---|
| `bone FORA dos grupos Bones_*` | Mova o elemento na árvore do SVG para dentro do grupo `Bones_*` do membro correspondente. O motor esconde o esqueleto varrendo esses grupos — o que está fora **nunca** é escondido e aparece na tela. Não resolve por CSS: o motor sobrescreve com `style.display` inline; o que importa é a **posição na árvore**. |
| `NÃO existe o grupo pai id="Mosca"` | Envolva `Corpo_mosca` e os frames de asa/língua num grupo com `id="Mosca"`. Sem ele, o motor não consegue esconder a mosca no boot e ela aparece ao abrir a aula. |
| `Variante de mão com nome fora do padrão` | Renomeie para o prefixo exato `Mão_` ou `Mao_` (ex.: `Mão_Ukulele`). O motor esconde automaticamente `[id^="Mão_"]`; fora desse prefixo a mão fica sempre visível e aparece uma "mão a mais". A mão neutra é `Mão`/`mão`, sem underscore. |
| `IDs faltando` | Restaure os nomes de camada exatos. O motor localiza tudo por `getNodeById` — renomear quebra. Se usar SVGO, ligue `cleanupIds: false`. |
| `SVG acima de 2,5 MB` | Exporte com **2 casas decimais**, desmarque "Preserve Illustrator Editing Capabilities", styling em Presentation Attributes. |
| `Cenários acima de 600 KB` | Exporte em WebP ou PNG otimizado. |
| `Cenários com resoluções diferentes` | Padronize a resolução de todos (ex.: 1920×1080). O Kevin é ancorado na **base** da imagem — resoluções diferentes mudam onde ele pisa. |

### Regra que o validador NÃO consegue checar (conferir a olho)

**O chão de cada cenário.** O Kevin é ancorado na base da imagem de fundo, então
o piso onde ele pisa precisa estar no **terço inferior**, livre de móveis.

- ❌ No cenário `quarto`, o Kevin apareceu **em cima da cama**.
- ✅ Deixe piso visível na frente dos móveis.

Confira abrindo o `demo.html` e trocando entre todos os cenários.

### Antes de entregar — teste manual no demo.html

```bash
cd export && python3 -m http.server 8000
# abra http://localhost:8000/demo.html
```

Passe por **todos** os modos (Off, Standby, Pensando, Falando, Dormindo, Música,
Tchau) e **todos** os cenários. Confira:

- [ ] Nenhuma linha ou círculo de junta sobre o corpo
- [ ] Exatamente duas mãos em qualquer modo
- [ ] Mosca não aparece sozinha ao abrir
- [ ] Kevin pisa no chão em todos os cenários, não sobre móveis
````

---


---

# PARTE C — Mensagens trocadas

## C.1 — Peso do SVG do puppet (23/07)

**Data:** 23/07/2026
**Canal:** WhatsApp
**Contexto:** ele perguntou "o projeto SVG você diz? do puppet". Resposta à dúvida
dele sobre qual arquivo está pesado e por quê.
**Objetivo:** reexportar mais leve na origem, sem quebrar os IDs que o motor usa
**Status:** ⬜ não enviada

> ⚠️ **O ponto inegociável da mensagem:** o motor identifica as partes do Kevin
> pelos `id` dos elementos (`Mão_Ukulele`, `Cabeça_`, `Prop_`). Qualquer
> otimização que renomeie ou remova IDs quebra o motor inteiro. Isso precisa
> ficar claro pra ele — e para nós, se rodarmos SVGO aqui (`cleanupIds: false`).

---

Isso, o `kevin-rigged.svg` do puppet.

O ponto é o seguinte: ele saiu do Illustrator com *6,6 MB*. A versão anterior tinha 2,7 MB, então dobrou. Como o SVG é texto, ele comprime mal — chega no navegador com uns 5 MB.

O problema não é o disco, é que o Kevin *só aparece na tela depois de baixar o arquivo inteiro*. Como ele é o elemento principal da tela, numa escola com internet ruim o professor clica em "Iniciar aula" e fica olhando pra tela vazia.

O peso não vem de imagem embutida — é geometria mesmo. Duas causas prováveis:

*1) Precisão decimal.* O Illustrator exporta coordenadas tipo `123.456789012` quando `123.46` renderiza igual. Em milhares de pontos, isso sozinho costuma ser metade do arquivo.

*2) Metadata do Illustrator.* O export vem com namespaces e dados de edição que o navegador ignora.

Na hora de salvar como SVG, tem umas opções que resolvem boa parte:

- *Decimal places: 2* (costuma vir em 3 ou mais)
- *Styling: Presentation Attributes* ou Internal CSS
- *Desmarcar "Preserve Illustrator Editing Capabilities"* — isso engorda bastante
- *Responsive: desmarcado*

⚠️ *Uma coisa importante:* o motor identifica as partes do Kevin *pelos IDs* dos elementos — `Mão_Ukulele`, `Cabeça_`, `Prop_`, etc. Se qualquer otimização renomear ou remover esses IDs, o motor quebra inteiro. Então: *manter os nomes das camadas exatamente como estão*.

Se der pra reexportar com essas opções e ver quanto fica, ótimo. Se ainda ficar pesado, a gente roda um otimizador aqui do nosso lado (SVGO, com a proteção dos IDs ligada) — mas é melhor resolver na origem do que ter um passo extra toda vez que você mandar uma versão nova.

Sobre os backgrounds: os PNGs novos estão com ~2 MB cada, e dá pra ficarem em ~300 KB convertendo pra WebP. Esse a gente resolve aqui, não precisa mexer no seu processo.

Sem pressa — não tá bloqueando nada, o que você mandou já dá pra implementar. É só pra não acumular peso nas próximas versões.

---

### Dados de apoio (não enviar — referência interna)

| Arquivo | Tamanho | Observação |
|---|---|---|
| `kevin-rigged.svg` (novo) | 6,6 MB | gzip → 5,1 MB (compressão de só 23%) |
| `kevin-rigged.svg` (atual em prod) | 2,7 MB | dobrou de tamanho |
| `kevin-puppet.js` | 104 KB | era 60 KB — crescimento esperado, 3 modos novos |
| Backgrounds novos (cada) | ~2 MB | 1672×941, PNG sem otimizar |
| `floresta.png` (antigo) | 708 KB | 4000×2250 — **5× mais pixels, 3× menos bytes** |
| Vídeo de transição | 3,8 MB | `.webm`, carrega uma vez |

**Alvo pós-otimização:** SVG ~1,5–2,5 MB · backgrounds ~300 KB (WebP) →
de ~8,6 MB para ~2 MB por aula no primeiro carregamento.

**Decisão tomada:** implementar com os assets como estão. O animador já foi
alinhado para que as próximas entregas venham mais leves. O peso atual entra
como risco declarado na demanda de animações.

---

## C.2 — Envio do validador e do bloco do CLAUDE.md (24/07)

**Data:** 24/07/2026
**Contexto:** o Vitor tem um `CLAUDE.md` e um script que gera o export. O bloco
abaixo é para a **IA dele** — instrução operacional, não explicação.
**Status:** ⬜ não enviada

---

### Mensagem curta de acompanhamento

Vitor, valeu pela análise — você estava certo. Confirmei no código que o motor
já neutraliza os bones via JS, então minha hipótese do `.st36` estava errada.

Seguindo sua pista de que seria estrutural, achei o culpado:

```
Bones dentro dos grupos Bones_* : 34   ✅
Bones fora                      :  1   ❌  Pulso_bone1 → está dentro de "Mão_Ukulele"
```

**É um elemento só.** Como ele está dentro da mão do ukulele, reaparece quando o
modo Música ativa aquela mão — que é exatamente onde a gente via o esqueleto.

Também confirmei o que você previu sobre a mosca: **não existe o grupo
`id="Mosca"`** no export, só o `Corpo_mosca`.

Fiz um **validador** que pega isso sozinho. Segue abaixo um bloco para colar no
fim do seu `CLAUDE.md` — ele instrui a IA a rodar o validador no export e
corrigir o que falhar.

O arquivo do validador está em anexo (`validar_export.py`).

---

### Dados de apoio (não enviar — referência interna)

Saída real do validador no `export_2`:

```
▸ SVG do personagem
  ❌ Peso: 6.5 MB — acima do limite de 2.5 MB
  ✅ IDs obrigatórios presentes (11 checados)
  ❌ 1 elemento(s) de bone FORA dos grupos Bones_*
       · Pulso_bone1  (dentro de: Mão_Ukulele > Left_Arm)
  ❌ Existe "Corpo_mosca" mas NÃO existe o grupo pai id="Mosca"
  ✅ Variantes de mão com prefixo correto

▸ Cenários
  ❌ 7 cenário(s) acima de 500 KB
  ❌ Cenários com resoluções diferentes (2 tamanhos)
       · 1672×941: banheiro, escola-ext, escola-int...
       · 4000×2250: floresta
```

**Aprendizado que vale guardar:** esconder os grupos `Bones_*` inteiros por CSS
**quebra os braços** — o motor move o mesh do braço para dentro desses grupos
(`setupArmDrivers`). Testado e confirmado visualmente. Só dá para esconder bones
soltos individualmente.

---

## C.3 — Resposta: backgrounds → estrutura → SVG (24/07)

**Data:** 24/07/2026
**Contexto:** ele rodou o validador no export dele, confirmou os 5 problemas, e
trouxe uma nuance importante — os 2 bugs estruturais estão sendo *compensados*
por exceções no motor (hardcode do `Pulso_bone1` por nome; fallback da mosca).
Perguntou se deve corrigir a estrutura e/ou otimizar os backgrounds.
**Status:** ⬜ não enviada

---

Perfeito, e obrigado pela nuance — ela é importante e eu confirmei no código:

- `initDefaultVisibility` tem mesmo o hardcode `for (const id of ["Pulso_bone1"])`
- e o fallback `getNodeById("Mosca") ?? getNodeById("Corpo_mosca")?.parentElement`

Você está certo: **funciona hoje, mas por exceção, não por estrutura.** É
exatamente o tipo de coisa que quebra num export futuro sem ninguém entender por
quê. Vale corrigir na origem.

**Resposta: sim para os dois.** Sugiro nesta ordem:

**1º — Backgrounds (maior impacto, mais rápido)**

É o que mais dói hoje: 7 cenários somando ~13 MB. Numa escola com internet ruim,
o professor espera olhando tela vazia. Padronizar resolução resolve dois
problemas de uma vez — peso **e** o "Kevin em cima da cama", porque ele é
ancorado na base da imagem e resoluções diferentes deslocam onde ele pisa.

- Todos na mesma resolução (sugiro **1920×1080**)
- WebP ou PNG otimizado, ≤ 600 KB cada
- No `quarto`, se der, deixe piso visível na frente da cama — hoje o Kevin
  aparece sobre o móvel

**2º — Estrutura do SVG**

Mover `Pulso_bone1` para dentro de `Bones_Left_Arm` e envolver `Corpo_mosca` num
grupo `id="Mosca"`. Como você disse: tira a dependência dos hardcodes.

Se fizer isso, **pode remover as duas exceções do motor** — a regra geral
(varrer os grupos `Bones_*`) passa a cobrir sozinha, e o próximo bone que você
criar já nasce protegido.

**3º — SVG leve (6,5 MB → ≤ 2,5 MB)**

Esse é o mais chato porque é configuração de export, não arte. Se as opções do
Illustrator (2 casas decimais, sem "Preserve Editing Capabilities") não derem
conta, me avisa que a gente vê outra saída — dá pra comprimir do nosso lado, mas
prefiro não criar um passo manual a cada entrega.

---

**Uma coisa que descobri e vale pra você:** tentei esconder os grupos `Bones_*`
inteiros por CSS do nosso lado, como rede de segurança — e **isso apaga os
braços do Kevin**. O motor move o mesh do braço para dentro desses grupos
(`setupArmDrivers`), então esconder o grupo esconde o membro junto. Só dá pra
mirar bones soltos individualmente. Fica o registro caso você tente algo
parecido.

**Do nosso lado, enquanto isso:** deixei um CSS mirando só o `Pulso_bone1` como
segunda camada (redundante com seu hardcode hoje, mas protege se ele sumir).
Quando o `export_3` chegar com a estrutura corrigida, eu removo.

Sem pressa nos três — o sistema está rodando. O que mais destrava pra gente é o
**1º (backgrounds)**, porque é o que o cliente vê.

---

## C.4 — Export aprovado + 3 pedidos (24/07)

**Contexto:** o `export_2` corrigido passou em todas as regras do validador.
Estudamos o projeto dele (`kevin_animador.zip`) e achamos o `entrada-kevin.webm`
pronto mas não ligado ao motor.
**Enviar junto:** `validar_export.py` atualizado (3 checagens novas, limite de
cenário 500 → 600 KB).
**Status:** ⬜ não enviada

---

Vitor, o export passou em tudo. 🎉

```
✅ SVG: 6,5 MB → 0,2 MB          ✅ Bones todos dentro dos grupos
✅ Grupo "Mosca" criado           ✅ Cenários 13 MB → 3,4 MB, resolução uniforme
```

Conferi que a redução do SVG **não perdeu nada** — 633 elementos antes e depois.
Foi só a otimização. Já instalei e testei no nosso sistema: Kevin renderiza
limpo, sem esqueleto, duas mãos, sem mosca ao abrir.

Sua descoberta do `<i:aipgf>` (o backup binário do Illustrator sendo >95% do
peso) foi mais precisa que a minha hipótese inicial — e explica por que o mesmo
arquivo funcionava aí e chegava quebrado aqui. Anotei no nosso lado.

Vi também que você documentou o pipeline no `RESUMO.txt` e automatizou as
correções em scripts. Ficou muito bom.

**Três pedidos, em ordem de impacto:**

**1) Ligar a animação de entrada** ⭐

Achei o `assets/videos/entrada-kevin.webm` no seu projeto — 2 MB, pronto. Mas
ele **não está no export** e o motor não o usa (procurei referência no
`kevin-puppet.js`, não há).

Era justamente o que faltava: quando o professor clica em "Iniciar aula", a ideia
é o cenário "abrir" revelando o Kevin, em vez de ele simplesmente aparecer. Você
já tem o vídeo e o motor já tem a mecânica de overlay de vídeo (usa no
`setBackground` para a transição de cenário).

Seria possível expor algo como `kevin.playEntrada()` — tocando o vídeo por cima
e revelando o Kevin ao fim? E incluir o `entrada-kevin.webm` no `assets/videos/`
do export.

**2) O chão do cenário `quarto`**

Esse é o último defeito visual que sobrou. O Kevin aparece **em cima da cama** —
como ele é ancorado na base da imagem, e nesse cenário a cama ocupa a faixa
inferior, ele pousa sobre o móvel.

Se der para reposicionar o enquadramento do quarto deixando piso livre na frente
da cama, resolve. (Mando um print se ajudar.)

**3) Changelog no README do export**

Regra pequena que passou batido: o `README.md` do export continua sendo a
documentação técnica do motor, sem dizer **o que mudou nesta versão**. Duas ou
três linhas no topo bastam:

```markdown
## Mudanças nesta versão
- SVG otimizado (6,5 MB → 0,2 MB): removido metadata do Illustrator
- Pulso_bone1 movido para Bones_Left_Arm
- Grupo id="Mosca" criado
- Cenários recomprimidos e padronizados em 1672×941
```

É o que nos diz se precisamos ajustar algo aqui (ex.: cenário renomeado exige
mudança no banco).

---

**Mando o `validar_export.py` atualizado.** Mudanças:

- Checa se o README tem seção de mudanças
- Avisa sobre arquivos soltos na raiz (pegou o `background-forest.png`, que
  duplica o `assets/backgrounds/floresta.png` — pode remover)
- Checa o `mudanca-cenario.webm` e avisa se algum `.mov` viajar no zip
- **Limite de cenário: 500 → 600 KB.** Vi que seus arquivos ficaram em 492–499
  KB, espremidos contra o teto. Como só um cenário carrega por aula, 600 KB
  mantém o carregamento rápido e te dá folga para a qualidade da arte.

Sem pressa nos três. O sistema está rodando com o export atual.
