# Diário — instalação do export do Kevin

> Log corrido do que fazemos a cada rodada de export do Vitor, na ordem em
> que acontece. Ver [ANALISE_EXPORT.md](ANALISE_EXPORT.md) para o
> levantamento técnico completo do export atual. A seção 0 é o roteiro fixo
> pra próxima vez ser rápido; as entradas depois são o histórico real.

---

## 0. Playbook rápido (usar em toda entrega nova)

Isso é o que a análise de hoje decantou. Da próxima vez que o Vitor mandar um
export, seguir esta ordem em vez de reanalisar tudo do zero:

1. **Validar primeiro, sempre.**
   ```bash
   python3 scripts/validar_export.py <pasta-do-export>/
   ```
   Erro (❌) → devolve pro Vitor, não instala. Aviso (⚠️) → decide caso a caso.

2. **Checar se o SVG mudou** antes de qualquer coisa:
   ```bash
   md5 export/kevin-rigged.svg static/js/kevin-puppet/kevin-rigged.svg
   ```
   - **Igual** → risco baixo, só troca JS/CSS/assets.
   - **Diferente** → reler `docs/mensagem.md` §A.4 (Regras 1, 2, 3, 6) e rodar
     o validador com atenção redobrada nos IDs — é onde os bugs de esqueleto
     visível / mão duplicada / mosca aparecendo cedo nascem.

3. **Ler o changelog do export (`README.md` dele) e cruzar com o TODO do
   `CLAUDE.md`** (seção "🚧 ... TODO" → "C. Esperando o animador"). Perguntar:
   o que estava pendente foi resolvido? O que muda de nome/comportamento
   (cenário renomeado, novo modo) que exige mudança no nosso lado?

4. **Diff de arquivo a arquivo** contra o que está em
   `static/js/kevin-puppet/`: `kevin-puppet.js`, `.css`, `assets/`. Objetivo é
   listar **só o que é genuinamente novo** — não vale a pena reler o motor
   inteiro a cada entrega.

5. **Separar em duas colunas** antes de escrever qualquer linha de código:
   - **Mecânico** (copiar arquivo, bump de cache-buster, registrar
     background novo em `BACKGROUND_CHOICES`) → pode fazer direto.
   - **Precisa de decisão de escopo** (quando um modo novo dispara, a que
     entidade do domínio um asset novo se liga) → **não inventar**; registrar
     como pergunta pro Paulo (ou como demanda nova em `docs/demandas.md`,
     conforme o fluxo do `CLAUDE.md`).

6. **Copiar os arquivos**, seguindo a tabela de destino (a mesma desde a
   Demanda 9): `.js`/`.css`/`.svg` → Git; `assets/` (mídia) → fora do Git
   quando for produção (R2), mas ok em `static/` local em dev.

   ⚠️ **Conferir os defaults da "API completa" no README do export contra o
   que `kevin-puppet-integration.js` passa explicitamente pro
   `createKevinPuppet(...)`.** Um default novo pode mudar comportamento sem
   avisar — foi o caso do `autoOpening: true` (entrada 3 abaixo), que criou
   um popup de "Iniciar" próprio do motor, colidindo com a tela de espera que
   o app já tem. Não basta olhar "o que tem de novo"; olhar também "o que
   mudou de comportamento *sem* eu pedir".

7. **Bump do `?v=N`** em `templates/professor/aula_detail.html` — sem isso o
   navegador mantém o cache antigo e "não muda nada" continua sendo a causa
   nº 1 de confusão.

8. **Validar no browser** (Playwright ou manual): abrir uma aula, todos os
   modos, `demo.html` como referência lado a lado. **Olhar o screenshot.**

9. **Commitar só o que versiona** (código), nunca `export_*.zip` nem mídia.

---

## Entrada 1 — 07/09/2026 — Análise do export novo

**O que foi pedido:** o Paulo trouxe um export novo em `export/` e pediu só
análise por enquanto — entender como a última instalação foi feita, pra
repetir o processo e deixar mais rápido da próxima vez. Nada de código nesta
rodada.

**O que foi feito:**
- Rodado `validar_export.py` contra `export/` → **passou 100%**, 0 erros, 0
  avisos.
- Comparado com o que está rodando hoje em `static/js/kevin-puppet/`:
  - SVG **idêntico** (mesmo MD5) → sem risco de quebra de ID desta vez.
  - `kevin-puppet.js` cresceu de 106 KB → 126 KB; `kevin-puppet.css` ganhou
    ~60 linhas novas.
  - 3 recursos genuinamente novos: modo `celebrate`, `kevin.playEntrada()`
    (o vídeo de entrada que estava pendente no TODO desde a última rodada) e
    o quadro de vocabulário (`showTeachingVocabulary`/`setVocabularyItems`).
  - Pasta `assets/` inteira é nova no projeto (vídeos, efeito sonoro,
    quadro-negro, imagens de vocabulário) — hoje não existe nada disso em
    `static/`.
- Revisado o histórico da última instalação em `docs/demandas.md`
  (Demandas 9 e 10) e o contrato do animador em `docs/mensagem.md` — foi daí
  que veio a tabela de destino de arquivo e a lógica de "mecânico vs precisa
  de decisão" usada no playbook acima.
- Encontrados 2 achados que não bloqueiam a instalação mas valem registrar:
  - 8 dos 14 itens padrão de vocabulário não têm imagem entregue (só texto).
  - 2 nomes de arquivo de imagem com erro de digitação (`wahs-my-face.png`,
    `take-a-shower .png` com espaço) — funcionam porque o código referencia
    o nome exato, mas são frágeis a qualquer correção manual futura.
- Identificada 1 decisão de escopo em aberto: **quando** `celebrate` e o
  quadro de vocabulário disparam na aula real. Isso não estava no export nem
  dá pra inferir do código — é decisão pedagógica/de produto.

**Resultado:** `ANALISE_EXPORT.md` criado com o levantamento completo. Nenhum
arquivo de código foi tocado.

**Próximo passo (não feito ainda, esperando sinal do Paulo):**
- [ ] Decidir gatilho do `celebrate` (concluir aula? acerto no chat? botão
      manual?)
- [ ] Decidir vínculo do quadro de vocabulário no domínio (ou deixar de fora
      do escopo por ora)
- [x] ~~Confirmar com o Vitor se os 8 itens de vocabulário sem imagem foram
      esquecidos ou é entrega parcial de propósito~~ — resolvido (ver
      Entrada 2): ele completou as 14 imagens.
- [ ] Depois disso: instalar seguindo o Playbook (§0) — a parte mecânica
      (copiar arquivos, `playEntrada()` no botão "Iniciar aula", cache-buster)
      pode ser feita independente da decisão acima, já que não depende de
      domínio novo.

---

## Entrada 2 — 07/09/2026 — Vocabulário completo

**O que aconteceu:** o Vitor atualizou `export/assets/img/vocabulario/` —
agora tem as **14 imagens**, uma pra cada ID de `DEFAULT_VOCABULARY_ITEMS`
(as 6 que já existiam + `go-to-school`, `make-breakfast`, `ride-a-bicycle`,
`take-a-taxi`, `take-the-bus`, `take-the-subway`, `take-the-train`, `walk`).

**Conferido:** `ls export/assets/img/vocabulario/` → 14 arquivos, batendo
1:1 com a lista fixa no motor.

**O que não mudou:** os dois nomes tortos (`wahs-my-face.png` com typo,
`take-a-shower .png` com espaço) continuam do jeito que estavam — funcionam,
mas seguem valendo o aviso ao Vitor pra próxima entrega.

**Atualizado:** `ANALISE_EXPORT.md` §5.1 marcado como resolvido.

**Ainda em aberto:** as duas decisões de escopo (gatilho do `celebrate` e
vínculo do quadro de vocabulário no domínio) — vocabulário completo não muda
isso, só remove a dúvida de "faltou entregar ou foi de propósito".

---

## Entrada 3 — 07/09/2026 — Segunda versão do export + README (achado crítico)

**O que aconteceu:** o Paulo atualizou `export/kevin-puppet.js`,
`kevin-puppet.css` e `README.md` no mesmo dia — uma entrega bem maior que a
anterior. `kevin-rigged.svg` **não mudou** (mesmo MD5 de sempre).

**Validado:** `python3 scripts/validar_export.py export/` → **100%, 0 erros,
0 avisos**, igual à rodada anterior.

**O que essa versão traz de novo:**
- Teaching de verdade: `startTeaching()`/`stopTeaching()`/`isTeachingActive()`
  — câmera + quadro-negro deslizam animados (~1-2s), em vez do
  mostrar/esconder instantâneo de antes.
- `showTeachingVocabulary(...)` passou a acionar essa sequência animada.
  **Mudança de comportamento**: `hideTeachingVocabulary()` não é mais
  instantâneo.
- Modo `celebrate` ganhou confete + som (já estava na primeira rodada, o
  README só detalhou melhor).
- Mod novo `playCamuflage()` — gira a cor do Kevin, disparo único.
- Áudio ambiente: música de fundo em loop (junto com `playEntrada`) + ronco
  durante `sleeping`. **Só que os arquivos (`trilha-padrao.mp3`,
  `ronco-kevin.mp3`) não estão na pasta entregue** — o README promete, a
  pasta não tem. Não quebra nada (o motor engole o erro de áudio com
  `.catch(() => {})`), mas é uma inconsistência a reportar ao Vitor.
- **Achado crítico:** `autoOpening` (sequência de abertura própria do motor)
  agora é `true` por padrão. Isso faz o motor desenhar seu próprio popup de
  "Iniciar" por cima da cena — que colide direto com a tela de espera que o
  app já tem (`#call-standby`/`#btn-iniciar-aula`) e trava aberto, porque
  nada no nosso código clica no botão *interno* do motor. **Instalar sem
  passar `autoOpening: false` explicitamente quebra o fluxo de abrir aula.**
  Isso não é uma decisão de produto em aberto — é uma correção obrigatória
  de configuração, documentada no próprio README do export (\"Desative com
  `autoOpening: false` se a aplicação externa preferir orquestrar isso na
  mão\" — e é exatamente o nosso caso).

**Atualizado:** `ANALISE_EXPORT.md` reescrito com uma seção 0 dedicada ao
achado do `autoOpening`, tabelas atualizadas e os novos itens de atenção
(§5.2 áudio ambiente ausente, §5.4 mudança de comportamento do
`hideTeachingVocabulary`). Também adicionado ao Playbook (§0 acima) o passo
de conferir os *defaults* da API, não só o que é novo.

**Ainda em aberto (sem mudança nesta entrada):**
- [ ] Gatilho do `celebrate`
- [ ] Vínculo do Teaching/vocabulário no domínio
- [ ] Se `playCamuflage` tem algum uso pedagógico previsto ou fica só
      disponível na API
- [ ] Confirmar com o Vitor os arquivos de áudio ambiente faltando

**Próximo passo mecânico (não depende das decisões acima):** instalar
seguindo o Playbook (§0), com atenção obrigatória ao `autoOpening: false` na
chamada de `createKevinPuppet(...)` em `kevin-puppet-integration.js`.

---

## Entrada 4 — 07/09/2026 — Decisões do Paulo + instalação mecânica

**Decisões recebidas:**
1. **Gatilho do `celebrate`**: ao acertar algo no chat. *Ainda falta definir
   o mecanismo* — hoje o `Mensagem`/chat não tem nenhum conceito estruturado
   de "resposta certa" (só `role`/`tipo`/`conteudo` texto livre em
   `apps/chat/models.py`). Perguntei ao Paulo qual abordagem usar antes de
   mexer no prompt do Kevin (arquivo sensível, compartilhado por toda
   conversa) — ver pergunta feita logo após esta entrada.
2. **Teaching/vocabulário**: vínculo no domínio fica pra quando a
   construção da aula (área da coordenação) for remodelada — não é escopo
   agora. Registrar como TODO futuro, não implementar vínculo nenhum hoje.
3. **Camuflage**: fica só disponível na API, sem gatilho. Nada a fazer.
4. **Áudio ambiente**: o Vitor acrescentou a pasta.
   `export/assets/audio/backsound/` agora tem `trilha-padrao.mp3` (o default
   documentado) **e também** `forest-ambience.mp3` (extra, não referenciado
   por nenhum default da API — provavelmente pensado pra uso futuro por
   cenário). `export/assets/audio/voz-kevin/ronco-kevin.mp3` também chegou.
   Validador re-rodado → **100%, 0 erros, 0 avisos**, sem mudança.

**Instalação mecânica feita** (não dependia de nenhuma decisão acima):
- Copiado `kevin-puppet.js`/`.css` para `static/js/kevin-puppet/`
  (SVG não copiado — continua idêntico).
- Criadas as pastas novas em `static/js/kevin-puppet/assets/`: `videos/`,
  `audio/efeitos-sonoros/`, `audio/backsound/`, `audio/voz-kevin/`, `obj/`,
  `img/vocabulario/` — todos os arquivos do export copiados pra lá
  (backgrounds continuam de fora, já existem como `.webp`).
- `.gitignore` ampliado: as pastas novas de mídia (`audio/`, `obj/`, `img/`)
  entraram na mesma regra que já existia pra `backgrounds/`/`videos/` — só
  código (JS/CSS/SVG) fica no Git.
- `autoOpening: false` adicionado na chamada de `createKevinPuppet(...)` em
  `kevin-puppet-integration.js` — com comentário explicando o porquê (evita
  reintroduzir o bug se alguém remover "sem querer" no futuro).
- Novo método `playEntrada()` na fachada `KevinPuppetIntegration`, chamado em
  `iniciarAula()` (`kevin_chat.js`) logo após destravar o áudio e antes do
  kickoff — a cortina abre, revela o Kevin, *depois* a conversa começa.
- Cache-buster bumpado: `kevin-puppet-integration.js` `?v=3→4`, `kevin_chat.js`
  `?v=19→20`, e um `?v=2` novo adicionado no *import* interno de
  `kevin-puppet.js` dentro da integração (sem isso, só bumpar o `?v=` do
  script externo não força o navegador a rebaixar o módulo importado, que é
  cacheado pela própria URL sem query string).

**Ainda não feito:**
- [ ] Teste visual no browser (Docker não estava rodando nesta sessão) — falta
      confirmar todos os modos, a entrada, e que os controles não invadem
      mais o cenário (fix da conversa anterior) juntos com o motor novo.
- [x] ~~Mecanismo do gatilho do `celebrate`~~ — decidido e implementado, ver
      Entrada 5.
- [ ] Registrar formalmente a demanda de Teaching/vocabulário em
      `docs/demandas.md` quando a remodelagem da construção de aula entrar em
      pauta (por ora só está registrado aqui).

---

## Entrada 5 — 07/09/2026 — Gatilho do `celebrate`: tool-calling

**Pergunta feita:** como o frontend saberia que uma resposta do Kevin no chat
foi um "acerto", pra disparar o `celebrate`? Três opções apresentadas
(marcador no texto / heurística por palavra-chave / tool-calling estruturado)
mais a opção de adiar. **Paulo escolheu tool-calling estruturado** — mais
robusto, mesmo custando mais esforço (mexe nos dois providers plugáveis).
Decisão registrada como **D38** em `docs/demandas.md`.

**Design implementado:**
- Nova tool `celebrar_acerto` (sem parâmetros), com a mesma descrição
  compartilhada entre os dois providers — o modelo a chama **junto** com o
  texto normal quando o Teacher/turma acerta algo. `apps/chat/providers/ia.py`.
- **Caso de risco tratado:** se o modelo chamar a tool numa rodada SEM
  texto (alguns modelos fazem isso), isso celebraria com uma mensagem vazia
  e sem nada pro TTS falar. Tratado com uma rodada de continuação: devolve
  um `tool_result`/`tool` trivial (`"ok"`) e pede a fala de verdade antes de
  salvar a `Mensagem`.
- `BaseIAProvider.chat()` mudou de assinatura: retorna `(texto, celebrar)`
  em vez de só `str`. Only 2 implementações (Anthropic, OpenAI) e nenhum
  teste antigo dependia do formato antigo (chat app não tinha teste nenhum
  até agora).
- `Mensagem.celebrar` (BooleanField, default False) — migração
  `chat/0002_mensagem_celebrar.py`, gerada e testada com sqlite (Docker não
  estava rodando).
- `MensagemSerializer` expõe `celebrar` — chega no frontend tanto pelo
  endpoint síncrono (`?sync=1`) quanto pelo polling assíncrono
  (`GET /conversas/<id>/`).
- Frontend: `KevinPuppetIntegration.celebrate()` (nova, dispara
  `setMode('celebrate')`) + helper `celebrarSeNecessario()` em
  `kevin_chat.js`, plugado nos **3 fluxos** que produzem resposta do
  assistente (envio de texto assíncrono/polling, `sendTextAndSpeak` do modo
  chamada, e o fluxo de áudio/mic). Como o motor não expõe uma Promise que
  resolve ao fim do Celebrate, uso um delay fixo (1800ms) antes de seguir
  pro TTS, pra não cortar o gesto no meio.

**Testado:**
- 6 testes novos em `apps/chat/tests.py`, mockando os clients Anthropic/
  OpenAI (sem chave real) — cobrem: sem celebrar, celebrar com texto na
  mesma rodada, celebrar sem texto (pede continuação, confere o id do tool
  call na segunda chamada).
- Suíte completa: **61/61 testes passando** (55 antigos + 6 novos), rodada
  com sqlite via venv descartável em `/tmp` (Docker não estava disponível
  nesta sessão). `manage.py check` limpo.
- `node --check` nos 3 arquivos JS tocados — sem erro de sintaxe.

**⚠️ Não testado (e não dá pra testar sem chave real):** o comportamento
*de verdade* do modelo decidindo quando chamar a tool, e o formato exato que
a API da Anthropic/OpenAI devolve em produção. Os testes mockam a forma dos
objetos de resposta com base na documentação oficial de tool-use/function-
calling das duas APIs, mas isso não substitui rodar com uma chave real —
segue a mesma cautela que o README do projeto já registrava ("não mexer em
integração de IA sem chaves reais em mãos"). Antes de usar isso na frente de
uma turma, alguém com uma `ANTHROPIC_API_KEY`/`OPENAI_API_KEY` real precisa
testar uma conversa de ponta a ponta e ver o Kevin celebrar de verdade.

**Ainda em aberto:**
- [ ] Testar com chave real (Anthropic e/ou OpenAI) antes de confiar em
      produção/demo pro cliente.
- [ ] Teste visual completo do motor novo no browser (item repetido da
      Entrada 4 — ainda pendente).

---

## Entrada 6 — 07/09/2026 — Teste visual no browser + bug do background

**O que foi feito:** Docker estava instalado no Mac do Paulo mas o daemon não
estava rodando. Subi o Docker Desktop, esperei o daemon, rodei
`docker compose up -d --build` (build limpo, ~poucos minutos), `migrate`
(aplicou a `chat.0002_mensagem_celebrar` sem problema) e `seed_demo`. App no
ar em `http://localhost:8000`, confirmado por `curl` (login 200,
`kevin-puppet.js` servindo os 141.690 bytes certos).

**Bug encontrado ao testar:** o background do cenário não aparecia. Causa:
`static/js/kevin-puppet/assets/backgrounds/*.webp` **não existem** neste
checkout — a pasta nem existe em `static/`. Isso é consequência direta da
regra do `.gitignore` (mídia do puppet fica fora do Git, vai pro R2 em
produção) **combinada com** o fato de que ninguém nunca colocou esses 7
arquivos localmente neste clone. Não é bug desta instalação — já estava
quebrado antes, só que ninguém tinha rodado o telão neste checkout ainda pra
notar.

**Correção:** achei cópias boas dos 7 `.webp` dentro de `staticfiles/` (saída
de um `collectstatic` rodado em algum momento anterior neste mesmo Mac — ficou
no disco). Copiei de lá pra `static/js/kevin-puppet/assets/backgrounds/` e
confirmei os 7 servindo 200 via `curl`. Não precisou reiniciar o container —
`runserver` com `DEBUG=True` lê `static/` direto do disco a cada request.

**⚠️ Descoberta à parte, importante:** esta pasta **não é um repositório git**
(`git status` → "not a git repository"). Ou seja, nada do que foi feito nesta
sessão inteira — nem a instalação do export, nem o CSS, nem o `celebrate` —
está com qualquer proteção de versionamento. Isso é uma dívida séria dado que
o `CLAUDE.md` inteiro descreve um fluxo de branch/PR que pressupõe git. Avisei
o Paulo — decisão dele se/quando rodar `git init` e recuperar o histórico (se
houver um remoto) antes de continuar.

**Correção na análise anterior:** o `ANALISE_EXPORT.md` §6 dizia "backgrounds
já existem como `.webp` em produção, não copiar" — isso foi verificado só
olhando o template (que referencia os `.webp`), **não o disco**. Lição:
verificar o arquivo, não só quem o referencia. Não muda a decisão (os
backgrounds do `export/` continuam sendo PNGs de exemplo, não a versão
otimizada) — só o "não copiar" precisava, na real, virar "restaurar os que já
deveriam estar aqui".

**Ainda pendente:**
- [x] ~~Confirmar visualmente que o Kevin ficou com proporção/posição igual ao
      `export/demo.html` e que os controles não invadem mais o cenário~~ — o
      Paulo olhou e pediu um redesenho (ver Entrada 7): o palco volta a ser
      full-bleed, os controles agora sobrepõem de propósito, só que discretos.
- [ ] Investigar por que `staticfiles/` (build artifact) está versionado —
      possível dívida a resolver separadamente (não é escopo desta sessão).

---

## Entrada 7 — 08/09/2026 — Redesenho do palco e dos controles

**Pedido do Paulo**, depois de ver rodando:
1. O palco do Kevin deve ocupar **100% da tela abaixo do header** — reverte a
   "caixa" com proporção travada da Entrada 4 (isso tinha sido uma decisão
   minha, não pedida, pra resolver o overlap; o Paulo prefere full-bleed).
   Mantendo, ainda assim, a proporção/posição exatas do personagem — que
   nunca dependeu do tamanho do palco, é 100% controlada pelo próprio motor
   (`kevin-puppet.css`: `min(92%,760px)`, `padding-bottom:3%`). O bug real da
   vez passada era o hack `bottom: var(--controls-safe)` que eu tinha
   adicionado pra empurrar o Kevin pra cima — removido, não existe mais
   nenhuma sobrescrita da posição dele.
2. Os controles voltam a **sobrepor** o palco (de propósito, não é mais bug)
   — mas pequenos, discretos, no canto inferior esquerdo, com opacidade baixa
   por padrão e hover que acende. Pedidos específicos: música do mesmo
   tamanho dos outros botões (antes usava a classe genérica `.btn-musica`,
   48px, enquanto os mics no telão eram 88px) e todos 40% menores depois de
   igualados → 88px × 0,6 ≈ 53px pra todos.
3. Chat: sem mudança — já está numa camada acima (z-index 6/7/9) e o
   comportamento de expandir sobrepondo está correto.

**O que mudou em `static/css/style.css`:**
- `.call-stage` voltou a `position:absolute;inset:0` (full-bleed). Removida
  toda a lógica de `aspect-ratio`/`min()`/`--controls-safe` da Entrada 4.
- `.call-controls`: de pílula centralizada (fundo translúcido, blur, sombra,
  88px) pra cluster discreto canto-inferior-esquerdo — sem fundo/blur/sombra
  próprios (cada botão já tem o seu), `opacity:0.5` por padrão,
  `:hover`/`:focus-within` → `opacity:1`. Adicionei também
  `:has(.recording|.active|[data-playing="true"])` → sempre opacity 1, pra um
  botão em uso (gravando, ao vivo, tocando) nunca ficar apagado esperando
  hover.
- `.call-controls .btn-mic/.btn-mic-live/.btn-musica` unificados em 53×53px
  (raio 17px, ícone 23px) — inclui `.btn-musica` na lista agora, que antes
  não tinha override nenhum no contexto do telão.
- Media query mobile: removida a reserva de `--controls-safe` e o resize dos
  botões (não precisa mais, já são pequenos); só ajustei `left`/`bottom`/`gap`
  pra caber melhor em tela estreita.
- Cache-buster do `style.css` bumpado (`base.html`, `?v=23→24`).

**Testado:** `curl` confirmando HTTP 200 e o novo CSS presente no corpo da
resposta servida pelo container `web` (já rodando desde a Entrada 6 — não
precisou rebuild, só o navegador buscar de novo com o `?v=24`).

**Ainda pendente:** o Paulo olhar de novo no browser dele e confirmar se o
resultado bate com o que ele pediu (tamanho dos botões, posição, opacidade).

---

## Entrada 8 — 08/09/2026 — 4 ajustes finos (entrada congelada, camuflage, drawer, alinhamento)

**Pedidos do Paulo**, depois de testar a Entrada 7:

1. **Frame congelado atrás do popup "Iniciar"** — hoje, atrás da tela de
   espera (`#call-standby`), aparecia o Kevin já animando em standby. Ele
   queria o **1º frame da entrada, congelado**, como o próprio motor faria
   sozinho se `autoOpening` estivesse ligado (mas continuamos com ele
   desligado, orquestrando na mão).
   - Implementado `freezeEntrada(url)`/`dismissFreeze()` em
     `kevin-puppet-integration.js`: cria um `<video>` com a MESMA classe que
     o motor usa internamente pro vídeo de entrada (`kevin-transition-overlay`,
     já vem com `position:absolute;inset:0;object-fit:cover` do
     `kevin-puppet.css` — não precisei de CSS novo), pausado no frame 0, por
     cima do puppet. `playEntrada()` chama `dismissFreeze()` bem antes de
     tocar o vídeo de verdade — como é o mesmo arquivo no mesmo frame, a
     troca é invisível.
   - `kevin_chat.js` chama `kevinChat.freezeEntrada(...)` logo após
     `init()`. URL nova em `window.KEVIN_RIG_CONFIG.entradaVideoUrl`
     (`aula_detail.html`).

2. **Camuflage como variação de standby, igual a mosca** — adicionado
   `_scheduleCamuflage()` em `kevin-puppet-integration.js`, espelhando
   `_scheduleMosca()` (mesma cadência 40-90s, mesmo guard de só disparar em
   standby ocioso). Guard extra: não dispara se a mosca já estiver ativa,
   pra não competir pela atenção ao mesmo tempo.

3. **Chat não pode "empurrar" o Kevin** — auditei todo o CSS/JS (`grep` em
   `drawer-open`, `chat-drawer`, `call-stage`, `kevin-rig-mount`) e **não
   encontrei nenhuma regra que desloque o palco do Kevin** quando o drawer
   abre — o drawer já é `position:absolute` (fora do fluxo) desde sempre.
   Ainda assim, adicionei `contain: layout` em `.call-stage`, que é a garantia
   formal em CSS de que nada de fora afeta o layout interno dele (e
   vice-versa). **Não decidi sozinho que era isso** — registrando aqui pro
   Paulo confirmar se resolveu ou se o que ele viu era outra coisa (nesse
   caso preciso de um print/vídeo pra achar a causa real).

4. **Alinhar título com a pill de status** — causa raiz: `.call-title`
   ficava centralizado via flexbox `justify-content:space-between` (posição
   depende da largura do botão de voltar vs. dos botões de ação — só fica no
   centro verdadeiro se os dois lados tiverem a mesma largura), enquanto
   `.kevin-status-pill` usa `left:50%;transform:translateX(-50%)` (centro
   verdadeiro sempre). Dois mecanismos diferentes = desalinhado. Troquei
   `.call-topbar` pra CSS Grid (`grid-template-columns: 1fr auto 1fr`) com
   `justify-self: start/center/end` nos 3 filhos — a coluna do meio agora
   fica no mesmo eixo que a pill, sempre.

**Testado:** `node --check` nos 2 JS tocados, `curl` confirmando os arquivos
novos servindo (CSS `v=25`, integration `v=5`, chat `v=21`) com o conteúdo
esperado no corpo da resposta. Container já estava rodando desde a Entrada 6,
não precisou rebuild.

**Ainda pendente:** confirmação visual do Paulo nos 4 itens — principalmente
o item 3, que é o único onde não tive certeza da causa raiz.

---

## Entrada 9 — 08/09/2026 — Aceno antes do "pensando" no kickoff

**Pedido do Paulo:** ao entrar na aula, o Kevin já ia direto pra "pensando"
(disparado por `showTyping()` dentro de `sendTextAndSpeak`, antes da chamada
à API de IA). Ele queria um aceno **antes** dessa sequência — ou seja: aceno
→ (só depois) a ação que dispara "pensando" → chamada da API.

**Causa/contexto:** o motor não tem um gesto de "oi" dedicado — só um aceno
de disparo único, que é o modo `tchau` (a mesma animação serve pra
cumprimentar; README do export não menciona um "hello" separado). Reusei
`tchau` com esse propósito.

**Implementado:**
- `waveHello()` em `kevin-puppet-integration.js`: dispara `setMode('tchau')`
  e espera ~2,6s (3 ciclos de aceno a 1,5Hz + entrada/saída — constantes
  `TCHAU_WAVE_*` em `kevin-puppet.js`) antes de resolver, já que o motor não
  expõe uma Promise que resolve ao fim do gesto (mesma limitação do
  `celebrate`).
- Chamado em `iniciarAula()` (`kevin_chat.js`), **depois** do vídeo de
  entrada e **antes** de `sendTextAndSpeak(kickoff)` — que é quem contém a
  chamada a `showTyping()` (dispara "pensando") seguida da chamada real à
  API. Ordem final: entrada → aceno (tchau) → "pensando" → API.
- Ao terminar o aceno, o motor já volta sozinho pra `standby` (conferido no
  código: `cleanupTchau()` seguido de `currentMode = "standby"` — o
  README dizia "volta pra off", mas o código real assenta em standby quando
  não é o autoOpening nativo chamando).

**Testado:** `node --check` nos 2 arquivos, `curl` confirmando
`kevin-puppet-integration.js?v=6` e `kevin_chat.js?v=22` servindo com
`waveHello` presente no corpo.
