# Mensagens

Rascunhos de comunicação do projeto Kevin. Copiar e colar.

| # | Para | Assunto | Status |
|---|---|---|---|
| [1](#1-whatsapp--perguntas-bloqueantes-antes-da-reunião) | Bebelingue (cliente) | 5 perguntas que bloqueiam a remodelagem do banco | ⬜ não enviada |
| [2](#2-alinhamento-com-o-arthur--contexto-novo-do-projeto) | Arthur (dev) | Contexto novo, prompt e roteiro | ⬜ rascunho |
| [3](#3-vitor-tostes-animador--peso-do-svg-do-puppet) | Vitor Tostes (animador) | Peso do `kevin-rigged.svg` | ⬜ não enviada |
| [4](#4-vitor-animador--bloco-para-o-claudemd-dele) | Vitor (animador) | **Bloco para o CLAUDE.md dele** — padrão do export + validador | ⬜ não enviada |
| [5](#5-vitor--resposta-sim-para-os-dois-nesta-ordem) | Vitor (animador) | Resposta: corrigir backgrounds → estrutura → SVG | ⬜ não enviada |

---

## 1. WhatsApp — perguntas bloqueantes antes da reunião

**Data:** 23/07/2026
**Canal:** WhatsApp
**Objetivo:** destravar as 5 dúvidas que impedem começar a remodelagem do banco
**Contexto:** reunião marcada para a semana seguinte. Estas 5 são as que bloqueiam
o trabalho; as outras 30 estão em [PERGUNTAS_REUNIAO_CLIENTE.md](PERGUNTAS_REUNIAO_CLIENTE.md)
e ficam para a reunião.
**Status:** ⬜ não enviada

---

Oi pessoal, tudo bem?

Estamos preparando a atualização do Kevin pra ele funcionar com a metodologia de vocês de verdade — e não do jeito genérico que eu tinha montado no começo.

Analisamos o material que vocês mandaram (o TG de março do Year 5, o formulário de Class Feedback e a prova da Unit 1) e conseguimos mapear bastante coisa. Mas antes da nossa reunião da semana que vem, tem *5 pontos* que travam nosso trabalho. Se der pra responder por aqui, adiantamos muito — e a reunião fica pra discutir o resto com calma.

*1) O TG é igual pra todas as escolas?*
O currículo que vocês montam vale igual pra todo mundo, ou alguma escola pede adaptação? Vocês já entregaram TGs diferentes pra clientes diferentes no mesmo Year?

_(Esse é o mais importante — muda a estrutura inteira do sistema.)_

*2) Existe um documento com as regras dos jogos?*
Só no TG de março contei mais de 25 jogos diferentes: Simon Says, Hot Potato, Hangman, Four Corners, Pictionary, Board Race, Password, Dodgeball…

Pro Kevin ajudar o professor a conduzir esses jogos, ele precisa saber como cada um funciona. Vocês têm isso escrito em algum lugar? Se sim, podem mandar. Se não existir, a gente precisa combinar quem escreve — e isso entra no prazo.

*3) Podem mandar o BeBooklet?*
O formulário de Class Feedback cita o "BeBooklet" umas duas vezes, falando das técnicas (Sandwich Technique, Instant Translation, técnicas de repetição). A gente não tem esse arquivo.

Ele é importante porque, sem o texto original de vocês, o Kevin vai explicar a metodologia com as palavras dele — que é justamente o que a gente quer evitar.

*4) O que significa "3x" no nome do arquivo do TG?*
O arquivo se chama "Modelo TG - Share With Friends Y5 (KEVIN AI) - March - 3x". Isso quer dizer 3 aulas por semana? Existem escolas com 2 aulas? Isso muda por escola ou é sempre igual?

*5) Como vocês sabem hoje que um professor está atrasado no conteúdo?*
Vocês falaram que a métrica principal é a do professor, e a gente quer acertar isso.

Na prática hoje: alguém acompanha se a turma está na aula certa? O que vocês olham pra saber? E o que é um atraso aceitável — uma aula? Duas semanas? Ou isso não é acompanhado de perto?

Se der pra responder, mesmo que resumido, já ajuda demais. O que não der, a gente discute na reunião.

Abraço!

---

### Rastreio das respostas

| # | Pergunta | Ref. na pauta | Resposta |
|---|---|---|---|
| 1 | TG igual pra todas as escolas | §2.6 | ⬜ |
| 2 | Documento com regras dos jogos | §3.1 | ⬜ |
| 3 | BeBooklet | §3.2 | ⬜ |
| 4 | Significado do "3x" | §1.1 | ⬜ |
| 5 | O que é "professor atrasado" | §5.1 | ⬜ |

**Por que cada uma bloqueia:**

- **1** — se o TG variar por escola, a Demanda 1 muda inteira (currículo deixa de ser global). É a decisão mais cara de reverter.
- **2** — sem as regras escritas, o Kevin não sabe conduzir os jogos. Se o documento não existir, alguém da Bebelingue precisa escrever ~27 regras, e isso entra no cronograma.
- **3** — mesma lógica da 2, para as técnicas da metodologia.
- **4** — define se `Turma.aulas_por_semana` precisa existir.
- **5** — define a Demanda 4 inteira. Foi a dedução mais frágil de todo o documento.

---

## 2. Alinhamento com o Arthur — contexto novo do projeto

**Canal:** a definir
**Objetivo:** passar o contexto que mudou depois que ele começou, evitar trabalho
duplicado no prompt, e deixar claro o que ele pode tocar enquanto o resto está parado
**Status:** ⬜ não enviada · rascunho

---

Fala Arthur, beleza?

Vi seu commit e preciso te passar um contexto que mudou aqui — não tem como você saber, porque aconteceu depois que você começou. Vou ser detalhado porque muda bastante coisa daqui pra frente.

### Primeiro: o telão ficou muito bom

A tela de chamada com o Kevin em tela cheia, o standby com "Iniciar aula", os controles de voz no centro e o chat virando drawer — isso é uma decisão de produto boa, e melhor do que estava antes. **Vamos manter como base.** Não joga nada fora.

Duas coisas que você acertou e que talvez nem tenha percebido o tamanho:

- **Usar o clique do "Iniciar aula" como user gesture pra destravar o AudioContext.** Sem isso o TTS não toca sozinho, o navegador bloqueia. Vi que você fez de propósito e comentou no código.
- **O standby resolveu um problema que ninguém tinha notado:** antes a aula não tinha começo definido, o professor caía numa tela já "ligada". Agora tem um momento claro de "a turma está pronta, vamos".

### O contexto que mudou

O cliente (Bebelingue) fechou a compra e mandou o material real da metodologia deles — o Teacher's Guide de verdade, formulário de avaliação de professor, provas. E ficou evidente uma coisa: **o banco que eu modelei no começo não representa como eles trabalham.**

Eu tinha imaginado "aula tem título, descrição e três campos de texto (warm up, development, closure)". A realidade deles é bem mais estruturada:

- O currículo é uma **grade mensal**: mês → semana → aula. A aula se chama `MAR W1C1`, não `Y1U1W1C1` como está hoje.
- Cada aula tem um **tipo** (Content, Communication, Culture) e o roteiro muda de forma conforme o tipo.
- O roteiro é uma **lista de blocos numerados**, não texto corrido.
- E os blocos referenciam **coisas nomeadas e reutilizáveis**: jogos (Simon Says, Hot Potato, Hangman — contei mais de 25 só num mês), técnicas da metodologia (Sandwich Technique, Instant Translation), rotinas fixas (BeCalendar, Songs Collection, I Can Routine).

Escrevi tudo isso num `demandas.md` na raiz do projeto, em formato de história de usuário, com o modelo de dados alvo e plano de migração. **Dá uma lida quando puder** — é o que vai guiar o trabalho dos próximos meses.

### O que isso muda pro seu lado

*1) O prompt do Kevin fica em `apps/chat/tasks.py`*

Vi que você escreveu o roteiro da Aula 1 no `exemplo/server.py`. O prompt oficial é o `SYSTEM_PROMPT_BASE` do `apps/chat/tasks.py` — o `exemplo/` é sandbox de protótipo, não vai pra produção.

Não é implicância com organização: é que com duas fontes de prompt, elas divergem em silêncio e ninguém percebe até o Kevin responder errado em produção. Anotei a regra no `CLAUDE.md` pra ficar registrado.

*2) Roteiro de aula não é prompt — vai virar dado no banco*

Esse é o ponto principal, e é onde eu quero deixar claro que **você não fez nada errado**. Você precisava de um roteiro pra Aula 1 e não tinha onde colocar, então escreveu na mão dentro de uma string Python. Foi a única saída disponível — e é exatamente o problema que as demandas vão resolver.

Só que ele fica com dois defeitos que valem entender: só serve pra Aula 1 (a Aula 2 exigiria outra string), e o Kevin não consegue reutilizar nada — se o "True or False" aparecer em outras 10 aulas, é copiar e colar 10 vezes.

No modelo novo, aquilo vira:

```
Aula "Y5-MAR-W1C1"
 └── BlocoAula (warm_up, ordem 1) → Atividade "True or False" (jogo, do catálogo)
                                     + instruções específicas desta aula
 └── BlocoAula (development, 1)   → Atividade "Class Deals" (rotina)
 └── BlocoAula (development, 2)   → Atividade "Instant Translation" (técnica)
```

E o Kevin recebe, no contexto, a descrição completa de cada atividade vinda do catálogo. Ou seja: ele passa a *saber* conduzir o True or False, em vez de improvisar em cima do nome.

*3) Seu roteiro virou caso de teste do modelo*

Isso é sério, não é consolo: peguei o que você escreveu e mapeei linha por linha pro modelo novo. Se o banco não conseguir representar aquele roteiro sem perder nada, é sinal de que o modelo está errado e a gente refaz. Está documentado na **seção 1.6 do `demandas.md`**, e virou critério de aceite da Demanda 1.

Achei três coisas ali que nem estavam no material do cliente — "True or False", "Class Deals" e "Instant Translation". Já entraram na lista de perguntas pra eles.

*4) Quem conversa com o Kevin*

Confirmei com o cliente como a aula acontece de verdade, porque isso muda o prompt:

O Kevin fica projetado na TV da sala. **Quem conversa com ele é o professor**, principalmente por áudio. Em certos momentos o professor abre pra turma ("agora vocês falam com o Kevin") e depois fecha e retoma. O Kevin **não toma a iniciativa** de se dirigir às crianças.

No seu roteiro tem trechos onde ele fala direto com a turma e aguarda resposta delas — tipo o "Aguarde os alunos digitarem 'Bye, Kevin'". Quando a gente portar, ajusta pra esse modelo. Não precisa mexer agora.

*5) O kickoff vira dinâmico*

O `KEVIN_KICKOFF` fixo no template vai virar campo no banco, com fallback por tipo de aula. A ideia é sua e continua — só sai do HTML, porque o texto certo pra Aula 1 ("hoje é dia de se conhecerem") não serve pra uma aula de revisão.

### Status: tudo parado até semana que vem

Não mexe em `models.py`, migrations nem views por enquanto. Tem umas definições de estrutura que dependem de respostas do cliente — a principal é se o currículo é igual pra todas as escolas ou se cada uma adapta. Se for adaptável, metade da modelagem muda.

Reunião com eles é semana que vem. Te aviso assim que liberar.

### Se quiser pegar algo nesse meio tempo

Duas coisas do telão, que são independentes do banco e não vão colidir com nada:

**a) O drawer do chat cobre os botões de voz?**
Cenário: o professor abre o chat pra reler o que o Kevin disse e, no meio disso, quer falar. Se ele tiver que fechar o drawer pra alcançar o microfone, é atrito no meio da aula com 20 crianças esperando. Vi que você tem a classe `.drawer-open` no root, parece que já tentou empurrar o conteúdo — vale testar na tela real e ajustar.

**b) Testar o telão numa TV de verdade**
O layout foi pensado pra projeção mas, até onde vi, só foi testado em monitor. Numa TV a distância de leitura é outra — texto do chat, tamanho do Kevin, contraste dos botões. Se der pra testar numa tela grande e ajustar, é ganho direto.

E se quiser entender pra onde o produto vai, o `demandas.md` tem o desenho completo. Qualquer dúvida me chama.

Valeu!

---

## 3. Vitor Tostes (animador) — peso do SVG do puppet

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

## 4. Vitor (animador) — bloco para o CLAUDE.md dele

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

### 📋 Bloco para colar no fim do CLAUDE.md do Vitor

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
    ├── backgrounds/              cenários (≤ 500 KB cada, mesma resolução)
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
| `Cenários acima de 500 KB` | Exporte em WebP ou PNG otimizado. |
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

## 5. Vitor — resposta: sim para os dois, nesta ordem

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
- WebP ou PNG otimizado, ≤ 500 KB cada
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
