# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> 🚧 **Trabalho em andamento:** Épico A, o Kevin no lugar do professor de inglês.
> O passo a passo está na seção
> [🚧 Épico A — guia de implementação](#-épico-a--guia-de-implementação-para-o-fable),
> logo depois de "Como trabalhamos".

## 📁 Onde está cada coisa (docs/)

| Arquivo | O que é |
|---|---|
| `docs/SETUP_MAC.md` | **Guia de setup no Mac** para o dev de animação: baixar, subir com Docker, e instalar exports |
| `docs/demandas.md` | **Fonte de verdade do escopo.** Todas as demandas, decisões (D1–D22), modelo de dados alvo, migração. Leia antes de mexer no domínio |
| `docs/PERGUNTAS_REUNIAO_CLIENTE.md` | Pauta de validação com a Bebelingue; o que já foi respondido e o que falta |
| `docs/mensagens.md` | Mensagens para o **cliente** e o **Arthur** |
| `docs/mensagem.md` | **Tudo do animador (Vitor)**: guia, bloco do CLAUDE.md dele, histórico |
| `docs/ROTEIRO_APRESENTACAO.md` | Roteiro passo a passo para demonstrar o sistema ao cliente |
| `scripts/validar_export.py` | Valida um export do animador contra o contrato |
| `docs/PRODUTO_KEVIN.md` | Visão de produto (parcialmente pré-Demanda 1) |
| `docs/MOTOR_KEVIN.md` | Como o motor de animação do Kevin funciona (para estendê-lo) |
| `docs/KEVIN_ANIMATION_SETUP.md` | Setup do sistema de animação |
| `exemplo/` | Protótipo/sandbox — **não é produção** (ver aviso do prompt abaixo) |

## 🔄 Como trabalhamos (workflow)

### Quem é quem

| Pessoa | Papel | Entrega |
|---|---|---|
| **Paulo** | PO / dev | Decide escopo, prioriza, testa e valida com o cliente |
| **Claude** (aqui) | dev | Implementa, testa, documenta. Não decide escopo sozinho |
| **Arthur** | dev | Frontend/telão. Trabalha no mesmo repo — ver `docs/mensagens.md` §2 |
| **Vitor** | animador | Entrega `export_N.zip` (Kevin + motor). Contrato em `docs/mensagem.md` |
| **Bebelingue** | cliente | Metodologia, TG, decisões pedagógicas |

### O ciclo de uma demanda

```
1. Paulo traz a demanda (ou o cliente reporta um bug)
        ↓
2. Claude INVESTIGA antes de propor  ← não assumir a causa; medir
        ↓
3. Registra em docs/demandas.md      ← escopo, decisão, critério de aceite
        ↓
4. Implementa em branch              ← nunca commitar direto no master
        ↓
5. VALIDA de verdade                 ← testes + browser (Playwright) quando é visual
        ↓
6. Commit temático + push            ← o PR atualiza sozinho
```

**Regras deste ciclo:**

- **Investigar antes de consertar.** Já aconteceu duas vezes de a causa presumida
  estar errada (o esqueleto não era o `.st36`; o "motor quebrado" era
  enquadramento). Medir custa minutos e evita retrabalho.
- **Nada de código sem autorização explícita** quando o Paulo pediu só análise ou
  planejamento. Ele diz quando implementar.
- **Uma demanda = um commit temático.** Mensagem em português, explicando o
  *porquê*, com `Co-Authored-By`.
- **Toda decisão de escopo vira registro** em `docs/demandas.md` (tabela de
  decisões D1…DN). Se contradiz uma decisão anterior, dizer isso.

### Validação — o que conta como "pronto"

| Tipo de mudança | Como validar |
|---|---|
| Modelo/lógica | `docker compose exec web python manage.py test` (124 testes) |
| Tela/fluxo | Playwright: login → navegar → screenshot. **Olhar o screenshot** |
| Animação | Screenshot no modo específico. Comparar com o `demo.html` do animador |
| Qualquer coisa | `manage.py check` limpo antes de commitar |

Não dizer "funciona" sem ter rodado. Se algo falhou, dizer o que falhou.

### Comandos do dia a dia

```bash
docker compose up -d                                    # sobe tudo
docker compose restart web                              # após mudar código Python
docker compose exec web python manage.py test           # a suíte
docker compose exec web python manage.py seed_demo      # dados de apresentação
docker compose exec web python manage.py flush --no-input   # zera o banco
python3 scripts/validar_export.py <pasta-export>/       # valida entrega do animador
```

> Mudou só CSS/JS? Não precisa reiniciar — **Ctrl+Shift+R** no navegador.

> 🔴 **O Docker `web` conecta DIRETO no banco de PRODUÇÃO (Neon).** A
> `DATABASE_URL` do `.env` aponta pro Neon e sobrepõe o `DB_HOST=db` local
> (decisão do Paulo, 15/10/2026 — não há Postgres local). Consequência: `migrate`,
> `seed_demo`, `manage.py shell` e o **test runner** (cria/derruba um test DB no
> Neon) operam sobre **produção**. **NUNCA rode `flush --no-input`** — zera o
> banco real. Mudança de schema = migration aplicada direto em prod; o código
> novo só entra com `git push` (build no Render). Rode `manage.py check` antes.

### Fluxo com o animador (Vitor)

```
Vitor gera export  →  roda validar_export.py  →  passa?  →  envia export_N.zip
                                                    ↓ não
                                            corrige no lado dele
```

Ao receber um export novo: **rodar o validador primeiro**, antes de integrar. Se
falhar, devolver para ele em vez de contornar aqui. Correção temporária do nosso
lado (ex.: CSS defensivo) é aceitável para não travar, mas **registrar como
dívida** e cobrar a correção na origem.

### Fluxo com o cliente (Bebelingue)

- Perguntas ficam em `docs/PERGUNTAS_REUNIAO_CLIENTE.md`, com o que já foi
  respondido marcado ✅
- Mensagens prontas em `docs/mensagens.md`
- Apresentação: `docs/ROTEIRO_APRESENTACAO.md` + `manage.py seed_demo`

### Git

- **Commit direto na `main`** (decisão do Paulo, 28/09/2026). A regra anterior
  era branch por frente de trabalho + PR; mudou porque ele é o único revisor e
  o blueprint do Render acompanha a `main` — trabalho em branch não chega ao
  ambiente até o merge. Se ele pedir PR num caso específico, use o template
  dele: Descrição / Como Testar / Observações
- **Um commit temático por demanda**, mensagem em português explicando o
  *porquê*, com `Co-Authored-By`
- **Nunca** commitar: `export_*.zip`, `export.zip`, backgrounds, vídeos,
  `documento_escola/` (todos no `.gitignore`)
- O `CLAUDE.md` **é versionado** — o time todo lê. Mantenha-o atualizado quando
  uma decisão mudar; é a fonte de contexto de quem chega no projeto

## 🚧 Épico A — guia de implementação (para o Fable)

> Planejado em 11/11/2026 e aprovado pelo Paulo. O escopo, as histórias e os
> critérios de aceite estão em `docs/demandas.md` (Épico A, Demandas 21–25,
> decisões D55–D61). Esta seção diz **como** implementar.

### Como usar este guia

- Siga as etapas **na ordem**. Cada uma é um commit temático em português, com
  `Co-Authored-By`, direto na `main`.
- **Pare ao fim de cada etapa** e avise o Paulo. Ele faz o deploy no Render e
  marca a validação com o Lucas Albertoni. Não comece a etapa seguinte antes
  disso.
- Marque o progresso nos checkboxes abaixo, no mesmo commit da etapa.
- Os textos de prompt do Anexo são **provisórios**: o Lucas valida e devolve
  correções. Use-os como estão até lá.

**Progresso**

- [x] Etapa 1 — Prompts (Demandas 21 + 22)
- [x] Etapa 2 — Backend da aula interativa (Demanda 25, parte 1)
- [ ] Etapa 3 — Telão da aula igual ao Playground e fim das falas gravadas (Demandas 25, parte 2, e 23) ⛔ ElevenLabs
- [ ] Etapa 4 — Botão Repetir (Demanda 24)
- [ ] Etapa 5 — Documentação e fechamento

### Contexto

Na reunião de validação com o Lucas Albertoni (10/11/2026), o papel do Kevin
mudou: **ele passa a ocupar o lugar do professor de inglês**. Fica na sala o
professor regente, que não fala inglês. Verificado em produção: o Kevin
responde ao professor em inglês, a aula abre com 5 falas gravadas que não
esperam a turma, e a aula tem 3 botões contra 6 do Playground.

Decisões fechadas:

- **D56:** português com o professor; inglês só com a turma.
- **D57:** a turma aprende cada termo por uma sequência fixa, com repetição tripla.
- **D58:** saem as falas gravadas; toda fala é sintetizada e o Kevin espera a turma responder.
- **D59 (revisada):** no Repetir, a **IA conduz** a reintrodução. A palavra é a
  registrada no momento do ensino e vai junto no evento, e a janela de 2
  minutos é validada no servidor.
- **D60 + D61:** a aula ganha os recursos do Playground, sempre a serviço do roteiro:
  - **Cenário:** começa no `Aula.background`. O Kevin só troca quando o cenário combinar com a atividade.
  - **Música:** um botão Música igual ao do Playground (catálogo), com "Música desta aula" em primeiro.
  - **Jogos e músicas:** primeiro os do roteiro.
  - **Só inglês:** vale só para a turma.
  - **Listening:** continua como está.
  - **Ronco:** fica. É efeito sonoro, não passa pelo volume das falas.

### Arquitetura (resumo)

- **Backend:** ferramentas, eventos e `estado` passam a valer também em
  conversas `modo='aula'`. O contexto da aula ganha as seções MÚSICAS, JOGOS e
  ESTADO DA SALA, com o mesmo código do Playground. Repetir vira endpoint
  próprio, com guard rail no servidor.
- **Frontend:** em `static/js/kevin_chat.js` entra
  `const RECURSOS = MODO_PLAYGROUND || window.KEVIN_RECURSOS === true;`.
  - Tudo o que é recurso compartilhado passa a depender de `RECURSOS`.
  - Continua em `MODO_PLAYGROUND` só o que é exclusivo da sessão de Playground: abertura fixa, `pgMostrarContexto`, Encerrar e `urls.sair`.
  - A aula define `window.KEVIN_RECURSOS = true` e **não** define `KEVIN_MODO`: o teste `test_aula_continua_abrindo_igual` exige isso.
- **Telão:** botões, overlays e o modal de música vão para partials
  compartilhados. As regras `.playground-call` dos recursos passam para a
  classe comum `.kevin-recursos`.
- **Falas gravadas:** o override da D54 vai para
  `templates/professor/partials/kevin_config.html` e passa a valer nas duas telas.
- **Sem migration:** a palavra ensinada fica em `Conversa.estado`, que já é JSON.

### Etapa 1 — Prompts (Demandas 21 + 22)

Muda só texto, mais os rótulos do editor.

- Reescrever os 7 arquivos de `apps/chat/prompts/` com os textos do Anexo.
  - Na aula, **ainda sem** a seção RECURSOS, porque a aula ainda não tem ferramentas. O parágrafo `[EVENTO]` já entra.
  - O `idioma.txt` da aula fica sem a última linha (No Portuguese Allowed).
  - No Playground, tudo menos a linha do Repetir.
- `apps/chat/tasks.py`: `SEM_CONTEXTO_AINDA` troca "Teacher" por "professor".
- `static/js/kevin_chat.js`: nos textos de evento ("O Teacher apertou…",
  "O Teacher escolheu a música…", "O Teacher parou…", "O Teacher
  ativou/desativou…"), trocar "Teacher" por "professor".
- Editor da coordenação (`apps/curriculo/coordenacao_views.py`,
  `EditarPromptTGView` e `EditarPromptPlaygroundTGView`): tirar "Instant
  Translation" dos rótulos e das ajudas.
  - Aula, Papel: "Quem o Kevin é: o professor de inglês da turma; com o regente, fala português."
  - Aula, Idioma: "Português com o professor; inglês com a turma, pela sequência didática."
  - Aula, Execução: "Como seguir o roteiro e a sequência para ensinar cada termo."
  - No Playground, as ajudas equivalentes, com "No Portuguese Allowed só para a turma".
- **Não** mexer nos textos de kickoff (`Aula.get_kickoff`): o teste
  `ContextoKevinTest` em `apps/curriculo/tests.py` (~95) exige "começar".
- Teste novo: `montar_prompt()` e `montar_prompt_playground()` não contêm
  "Instant Translation" e contêm "SEQUÊNCIA PARA ENSINAR UM TERMO".
- Conferir `test_editor_playground_mostra_os_4_campos_com_o_padrao`
  (`apps/curriculo/tests.py` ~566), que procura o trecho da abertura antes do
  primeiro `!`.
- Bump do `?v=` do `kevin_chat.js` em `templates/professor/partials/kevin_scripts.html`.

### Etapa 2 — Backend da aula interativa (Demanda 25, parte 1)

- `apps/chat/ferramentas.py`: o padrão de `Ferramenta.modos` passa a ser
  `('aula', 'playground')`. Todas as ferramentas valem nos dois modos.
- `apps/chat/tasks.py`: extrair de `_montar_contexto_playground` dois helpers:
  `_secoes_catalogo(conversa)` (MÚSICAS e JOGOS) e `_secao_estado(conversa)`
  (ESTADO DA SALA AGORA).
  - A aula fica: prompt do TG → `--- CONTEXTO DA AULA ---` + roteiro → catálogo → estado.
  - No Playground, **manter a ordem atual**: o teste ~349 confere a ordem dos cabeçalhos.
- `apps/chat/views.py`:
  - `EnviarMensagemView`: remover o bloqueio de `tipo=evento` fora do Playground. `Conversa.registrar_contexto` já ignora a aula.
  - `AtualizarEstadoView`: remover o filtro `modo=PLAYGROUND`, mantendo o filtro do professor dono.
- `apps/escolas/professor_views.py`, `AulaDetailView`:
  - Criar a conversa com o estado inicial `{'cenario': aula.background or 'floresta', 'quadro': '', 'whisper': False, 'so_ingles': False, 'jogo_id': None}`. Numa conversa existente, completar as chaves que faltarem.
  - Contexto da tela: `estado` e `musicas` (vindo de `catalogo_musicas(conversa)`).
  - Excluir as mensagens EVENTO da lista, como o Playground já faz.
- `ResetAulaView` também reinicia o `estado`.

### Etapa 3 — Telão da aula igual ao Playground e fim das falas gravadas (Demandas 25, parte 2, e 23)

⛔ **Pré-requisito:** o Plano precisa estar em `tts_provider='elevenlabs'`, com
`tts_modelo` vazio, e uma amostra de síntese tem que retornar 200. Sem isso,
**não fazer o deploy**: a aula inteira passaria a falar com a voz feminina
`nova` do OpenAI. Teste rápido: instanciar `ElevenLabsTTSProvider` com os
dados do Plano e chamar `sintetizar('Hello')`.

**Templates**

- Criar em `templates/professor/partials/`:
  - `kevin_controles.html`: Falar, Conversa ao vivo, Atenção, Whisper, Só
    inglês, Música, Repetir (oculto até a Etapa 4), e Listening só quando
    `aula.tem_listening`. Manter os IDs atuais: `#btn-mic`, `#btn-mic-live`,
    `#btn-pay-attention`, `#btn-whisper`, `#btn-so-ingles`, `#btn-musica-pg`,
    `#btn-listening`.
  - `kevin_overlays.html`: `pg-vinheta`, `pg-faixas` e `pg-selo-ingles`.
  - `kevin_modal_musicas.html`: `#modal-musicas`, com "Música desta aula" em
    primeiro quando houver.
- `aula_detail.html` e `playground.html` incluem os partials. A raiz das duas
  telas ganha a classe `kevin-recursos` e os atributos `data-whisper` e
  `data-so-ingles`.
- A aula ganha `window.KEVIN_RECURSOS = true` e os `json_script`
  `kevin-estado-inicial` e `kevin-musicas`. Também passa a usar
  `cenario=estado.cenario` no `kevin_config`.
- `partials/kevin_config.html`:
  - ganha `urls.estado`, que sai de `playground.html`, e `urls.repetir` (para a Etapa 4);
  - recebe o override da D54 (`celebrateVoiceUrl = null`, `hiVoiceUrls = []`,
    `byeVoiceUrls = []`, `voiceVolume = 0`), que sai de `playground.html`. O
    teste ~570 continua passando, porque o partial é renderizado.

**JS (`static/js/kevin_chat.js`)**

- Trocar por `RECURSOS` os gates de:
  - texto digitado, que passa por `sendTextAndSpeak` com fala e ações;
  - resposta de voz (`pgResponder`);
  - `enviarEvento`, `pgAntesDeInteragir`, `pgEstiloVoz` e o volume do TTS;
  - os bindings de Atenção (evento), Whisper, Só inglês, modal de música e Repetir.
- `iniciarAula`: tirar o `openClass()`. Fica a entrada, com `playEntrada`
  limitado a 8s como no Playground, e depois o kickoff, que agora passa por
  ações e fala.
- Concluir: trocar o `sayBye()` gravado por `playTTS(PG_DESPEDIDA)`, com
  limite de 8s, antes do submit.
- Modal de música, opção da aula: chamar direto
  `pgTocarMusica({nome: 'Música desta aula', url: window.KEVIN_MUSICA_URL})`.
  Quando a música termina, o evento "A música terminou." devolve a vez ao
  Kevin.
- Remover os ramos que ficarem mortos (`pollResposta`, o `payAttention`
  gravado, a leitura só de `celebrar`), conferindo o modo demo
  (`KEVIN_DEMO_MODE`) nas duas telas.

**CSS (`static/css/style.css`)**

- As ~10 regras `.playground-call` dos overlays e da barra de botões
  (~4003–4097) passam para `.kevin-recursos`.
- Legibilidade: `.call-btn-label` (~3764) ganha fundo próprio (pílula) e
  contraste. A `opacity: 0.5` sai de `.call-btn-wrap` (~3744) e fica só no
  botão, para o rótulo nunca apagar.
- Criar um estilo de desabilitado para o Repetir.

**Prompt da aula**

- `execucao.txt` ganha a seção RECURSOS do Anexo, sem a linha do Repetir.
- `idioma.txt` ganha a linha do No Portuguese Allowed.
- `templates/coordenacao/_card_prompt_aula.html` ganha o aviso de não
  renomear ferramentas, igual ao do Playground.

**Cache-busters:** `kevin_chat.js` em `kevin_scripts.html` e `style.css?v=`
em `templates/base.html`.

### Etapa 4 — Botão Repetir (Demanda 24)

**Backend**

- `apps/chat/ferramentas.py`, `_mostrar_no_quadro`: quando gravar um texto
  novo e não vazio, gravar também
  `estado['ultima_palavra'] = {'texto': texto, 'em': timezone.now().isoformat()}`.
  Criar a constante `JANELA_REPETIR_SEGUNDOS = 120`.
- Novo `RepetirPalavraView` (POST) em `apps/chat/views.py`, na URL
  `conversas/<pk>/repetir/` com o nome `repetir_palavra`. Usa `IsProfessor`
  e só aceita conversa do próprio professor, em qualquer modo.
  - Sem palavra registrada → 409 "Nenhuma palavra ensinada agora."
  - Janela vencida → 409 "O tempo para repetir passou."
  - Senão, cria a mensagem EVENTO `O professor apertou Repetir. Reapresente agora a palavra "<texto>", com os passos 3 a 5 da sequência, inclusive a repetição tripla.` e chama `responder_ia_sync`.
  - Responde no mesmo formato do envio síncrono (`mensagem_user` + `resposta`). Falha da IA → 502.
- As duas telas recebem `repetir_restante` no estado inicial: os segundos que
  faltam na janela, calculados no servidor.

**Frontend**

- O botão Repetir começa desabilitado. Uma ação `quadro` com texto o habilita
  por 120s, e o timer reinicia a cada palavra nova. Ao carregar a página, usa
  `repetir_restante`.
- O clique entra na mesma fila do `enviarEvento` (`pgEsperarVez`, descarta a
  gravação), faz POST em `urls.repetir` e depois chama `pgResponder`. Resposta
  409 desabilita o botão.
- No modo demo, o botão fica oculto.

**Prompt:** a linha do Repetir entra na RECURSOS da aula e do Playground.

### Etapa 5 — Documentação e fechamento

- Neste `CLAUDE.md`:
  - reescrever as regras 15 e 16 conforme D55–D57 e retirar o aviso de "em revisão";
  - na seção do Playground, tirar a regra "a aula não ganha caminho novo" e registrar que a D54 vale nas duas telas;
  - na tabela de assets, marcar as falas gravadas como "não usadas desde o Épico A";
  - atualizar a contagem de testes;
  - reduzir esta seção a um resumo do que foi entregue.
- `docs/demandas.md`: status das Demandas 21–25.
- Avisar o Lucas.

### Testes que mudam de propósito (`apps/chat/tests.py`)

| Teste (linha aprox.) | Passa a afirmar |
|---|---|
| `test_modo_aula_so_tem_celebrar` (~394) | `ferramentas_do_modo('aula')` == todas as do REGISTRO |
| `test_modo_aula_oferece_so_celebrar` (~471) | o default do provider oferece todas |
| `test_conversa_de_aula_continua_so_com_celebrar` (~532) | a conversa de aula recebe todas as ferramentas |
| `test_evento_e_recusado_na_conversa_de_aula` (~325) | evento é aceito na aula e não grava `contexto` |
| `test_patch_estado_em_conversa_de_aula_da_404` (~598) | PATCH funciona na aula do próprio professor e dá 404 na de outro |
| `test_aula_continua_abrindo_igual` (~605) | continua sem `KEVIN_MODO`, agora com `KEVIN_RECURSOS` |

**Testes novos**

- Etapa 1: prompts sem "Instant Translation".
- Etapas 2–3: a aula tem as seções de catálogo e estado; o estado inicial da aula usa `Aula.background`; a página da aula tem `voiceVolume = 0`.
- Etapa 4:
  - `mostrar_no_quadro` grava `ultima_palavra`;
  - Repetir dentro da janela → 201, com a palavra no evento;
  - Repetir sem palavra → 409;
  - Repetir com a janela vencida (`em` no passado) → 409;
  - Repetir em conversa de outro professor → 404;
  - funciona nas duas telas.

Fixtures existentes: `BasePlayground` (`apps/chat/tests.py` ~237). Mock da IA:
`apps.chat.providers.get_ia_provider` e `apps.chat.views.responder_ia_sync`.

### Verificação

1. `docker compose exec web python manage.py check`.
2. Testes por app durante o trabalho:
   `docker compose exec web python manage.py test apps.chat`, depois
   `apps.curriculo` e `apps.escolas`. A suíte completa (~124 testes) roda só
   antes do commit e leva ~8 min, porque cria o banco de teste no Neon.
3. Playwright no localhost, logado como `maria` / `prof123`, na aula
   `Y5-WUW1C1` e no Playground:
   - screenshot em 1440px e em 390px;
   - nenhum erro no console;
   - na aula: 8 botões com rótulo legível; nenhum MP3 de `voz-kevin/` carregado (o ronco é exceção); Atenção vira evento; palavra no quadro habilita o Repetir; o Repetir reapresenta a mesma palavra.
4. Depois do deploy, refazer em produção os testes de 10/11:
   - perguntar "Kevin, o que vamos fazer agora com a turma?" → a resposta tem que vir em **português**;
   - a abertura não carrega falas gravadas;
   - a aula mostra os mesmos botões do Playground.

### Armadilhas

- O Docker `web` usa o **banco de produção**. **Nunca** rode `flush`. O test
  runner cria o banco de teste no Neon. Esta mudança não tem migration.
- Os nomes das ferramentas aparecem no texto dos prompts. Renomear uma
  ferramenta exige atualizar os prompts, tanto o padrão quanto os TGs
  customizados (hoje nenhum TG customizou).
- Os textos do Anexo são **provisórios**. A coordenação pode ajustá-los por TG
  no editor, sem deploy.

### Anexo — textos provisórios dos prompts

**`apps/chat/prompts/papel.txt`** (aula)
```
Você é o Kevin, o professor de inglês desta turma de crianças (Elementary School). Você aparece numa tela/TV na sala e conduz a aula de inglês seguindo o roteiro abaixo.

Na sala também está o PROFESSOR REGENTE. Ele não fala inglês: é seu parceiro para organizar a turma e falar com você. Com ele você fala SEMPRE em português e o chama de "professor" (ou "professora").

Com a TURMA você fala diretamente, por iniciativa própria: faça perguntas, peça para repetirem, chame alguém para responder. Se o professor pedir algo, atenda.

Quando aparecer uma mensagem começando com [EVENTO], não é fala de ninguém: é um fato da sala (um botão que o professor apertou, uma música que terminou). Reaja de forma natural, sem citar a palavra "evento".
```

**`apps/chat/prompts/idioma.txt`** (aula). A última linha só entra na Etapa 3.
```
=== IDIOMA ===
- Com o PROFESSOR: sempre em português, mesmo que ele fale com você em inglês. Pedidos, combinados e respostas às perguntas dele: tudo em português.
- Com a TURMA: o inglês entra pela SEQUÊNCIA PARA ENSINAR UM TERMO (abaixo). Fora dela, fale com a turma em português simples; cumprimentos curtos em inglês ("Hello, kids!", "Good job!") estão liberados.
- Frases curtas e claras. Evite gramática e vocabulário difíceis.
- NO PORTUGUESE ALLOWED (veja ESTADO DA SALA AGORA): enquanto ativo, fale só em inglês com a TURMA e incentive as crianças a responder em inglês, com gestos e exemplos, sem broncas. Com o professor continue em português.
```

**`apps/chat/prompts/execucao.txt`** (aula). A seção RECURSOS entra na Etapa 3
e a linha do Repetir na Etapa 4.
```
=== COMO CONDUZIR A AULA ===
O contexto abaixo traz o roteiro da aula de hoje, em blocos, com as atividades já explicadas (como conduzir cada jogo e técnica). Ele é o seu ROTEIRO INTERNO: descreve O QUE fazer, não o que dizer literalmente.

- NUNCA leia o roteiro em voz alta. Nunca diga "Warm Up", "Development", "Closure", "bloco 1" ou nomes de fase.
- EXECUTE cada passo de forma natural. Ex: o roteiro diz "cumprimente e peça a música" -> você diz à turma "Hello, kids!" e ao professor "Professor, pode tocar a nossa música de Hello?".
- UMA ação por vez. Depois, PARE e espere a resposta da turma ou do professor antes de avançar.
- Respostas CURTAS: 2 a 4 frases. Nada de monólogo. Sem emojis, asteriscos, listas ou colchetes: tudo o que você escreve é falado em voz alta.
- Muitas crianças falam ao mesmo tempo e a transcrição erra. Não corrija pela transcrição: comemore a participação e repita o modelo certo.

=== SEQUÊNCIA PARA ENSINAR UM TERMO ===
Todo termo novo em inglês (palavra ou expressão) segue estes passos, esperando a turma entre eles:
1. Avise em português: "Turma, vou perguntar em português e quero que vocês respondam em português."
2. Faça a pergunta em português e espere a resposta.
3. Valide a resposta com carinho e diga "Agora em inglês, turma!". Apresente o termo em inglês.
4. Repetição tripla: diga o termo e peça para a turma repetir. Faça isso três vezes, esperando a turma a cada vez.
5. Só então pergunte em inglês e espere a resposta em inglês.
Exemplo: "Como vocês estão se sentindo hoje?" -> turma: "Feliz!" -> "Isso! Agora em inglês, turma! Happy! Repitam comigo: happy!" (três vezes) -> "How are you feeling today?" -> turma: "Happy!"
Faça a sequência inteira toda vez que apresentar um termo, mesmo que ele já tenha aparecido.

=== RECURSOS (ferramentas) ===
Use as ferramentas junto com a sua fala, nunca no lugar dela. Os recursos servem à atividade do roteiro.
- celebrar_acerto: quando a turma acertar algo que você estava ensinando. Não use para elogio genérico.
- mostrar_no_quadro: no passo 3 da sequência, escreva no quadro o termo que está apresentando.
- trocar_cenario: só quando um cenário disponível combinar claramente com a atividade. A aula começa no cenário dela.
- tocar_musica: quando o roteiro pedir música ou o professor pedir. Prefira a música da atividade do roteiro. Só use nomes da lista MÚSICAS DISPONÍVEIS.
- iniciar_jogo: quando o roteiro trouxer um jogo ou o professor pedir. Conduza pelas regras que a ferramenta devolver, passo a passo. NUNCA invente regras. encerrar_jogo quando o jogo acabar.
- pay_attention: quando a turma estiver agitada ou o professor apertar Atenção. A frase de atenção, curta e animada, é para a turma (ex: "Eyes on me, kids!").
- everybody_whisper: liga para todos falarem baixinho e desliga quando terminar.
- no_portuguese_allowed: liga quando a turma estiver pronta para o desafio ou o professor pedir. Vale só para a turma.
- Quando o professor apertar Repetir, o [EVENTO] traz a palavra: reapresente exatamente essa palavra, com os passos 3 a 5 da sequência.
Não ative um modo que já está ativo (veja ESTADO DA SALA AGORA).
```

**`apps/chat/prompts/playground_abertura.txt`**
```
Olá, professor! Hello, kids! Eu sou o Kevin e estou muito feliz de estar aqui hoje! Professor, me conta: o que a turma está aprendendo hoje? Qual é o tema, o vocabulário ou a gramática da aula?
```

**`apps/chat/prompts/playground_papel.txt`**
```
Você é o Kevin, o professor de inglês desta turma de crianças. Você aparece numa tela/TV na sala.

Este é o PLAYGROUND: não existe roteiro de aula cadastrado. O professor te contou no começo da sessão o tema de hoje, e é a partir disso que você conduz.

Na sala está o PROFESSOR REGENTE. Ele não fala inglês: com ele você fala SEMPRE em português e o chama de "professor" (ou "professora"). Com a TURMA você fala diretamente e por iniciativa própria, o tempo todo: faça perguntas, peça para repetirem, proponha gestos, chame alguém para responder. Se o professor pedir algo, atenda.

Quando aparecer uma mensagem começando com [EVENTO], não é fala de ninguém: é um fato da sala (um botão que o professor apertou, uma música que terminou). Reaja de forma natural, sem citar a palavra "evento".
```

**`apps/chat/prompts/playground_idioma.txt`**: o mesmo texto do `idioma.txt`
da aula, já com a linha do No Portuguese Allowed desde a Etapa 1.

**`apps/chat/prompts/playground_execucao.txt`**. A linha do Repetir entra só
na Etapa 4.
```
=== COMO CONDUZIR O PLAYGROUND ===
- Mantenha-se no tema de hoje (CONTEXTO DA AULA DE HOJE). Se ainda não houver contexto, pergunte de novo ao professor, em uma frase, em português.
- UMA ação por vez. Depois, PARE e espere a resposta da turma ou do professor.
- Respostas CURTAS: 2 a 4 frases. Nada de monólogo. Sem emojis, asteriscos, listas ou colchetes: tudo o que você escreve é falado em voz alta.
- Muitas crianças falam ao mesmo tempo e a transcrição erra. Não corrija pela transcrição: comemore a participação e repita o modelo certo.

=== SEQUÊNCIA PARA ENSINAR UM TERMO ===
(idêntica à da aula)

=== RECURSOS (ferramentas) ===
Use as ferramentas junto com a sua fala, nunca no lugar dela. Não use a mesma ferramenta em toda resposta.
- celebrar_acerto: quando a turma acertar algo que você estava ensinando. Não use para elogio genérico.
- mostrar_no_quadro: no passo 3 da sequência, escreva no quadro o termo que está apresentando.
- trocar_cenario: quando um cenário disponível combinar com o tema (ex: quarto para rotina da manhã, escola para material escolar). No máximo uma vez por assunto.
- tocar_musica: quando o professor pedir uma música ou quando uma música da lista combinar com o momento. Anuncie a música antes. Só use nomes da lista MÚSICAS DISPONÍVEIS.
- iniciar_jogo: quando o professor pedir um jogo ou quando um jogo da lista servir para praticar o tema. Conduza pelas regras que a ferramenta devolver, passo a passo. NUNCA invente regras. encerrar_jogo quando o jogo acabar.
- pay_attention: quando a turma estiver agitada ou o professor apertar Atenção. A frase de atenção, curta e animada, é para a turma (ex: "Eyes on me, kids! One, two, three!").
- everybody_whisper: liga para todos falarem baixinho — ótimo para repetir vocabulário em segredo — e desliga quando terminar.
- no_portuguese_allowed: liga quando o professor pedir ou a turma estiver pronta para o desafio. Vale só para a turma.
- Quando o professor apertar Repetir, o [EVENTO] traz a palavra: reapresente exatamente essa palavra, com os passos 3 a 5 da sequência.
Não ative um modo que já está ativo (veja ESTADO DA SALA AGORA).
```

## Project Overview

**Kevin** — A SaaS platform for teaching languages to children, sold to franchised schools. Features curriculum-based classes, a community content library, and an AI assistant (Kevin) that converses with teachers via text and voice.

**Key Features:**
- Class management, fixed curriculum, community library, AI chat assistant
- 3 user roles: Admin (Django admin), Diretor (school admin), Professor (teacher)
- AI/voice integration with pluggable providers (Anthropic/OpenAI for chat, ElevenLabs/OpenAI for TTS, Whisper/Google for STT)
- Async processing via Celery/Redis
- Portuguese UI and documentation

## Stack & Architecture

**Backend Stack:**
- Django 6 + Django REST Framework
- PostgreSQL 16 + Celery/Redis for async tasks
- SimpleJWT + Session-based auth (role-based redirect on login)
- Docker Compose (db, redis, web, celery workers)

**Frontend:**
- Django templates (Jinja2)
- CSS (custom, no CSS framework)
- Vanilla JS for interactivity (chat, audio recording)
- Font: Nunito (Google Fonts), color palette: Blue (#2B7DE9), accent colors in CSS vars

**Apps Structure:**
```
apps/
  accounts/    → Custom user (AbstractUser + role), auth middleware, login redirect
  escolas/     → School, Plan, Director, Teacher, Class, Student + /gestao/ & /professor/ views
  curriculo/   → Lesson (Aula), Content, LessonContent, ClassProgress, Homework
  chat/        → Conversation, Message, AI/TTS/STT providers, Celery tasks
config/        → Django settings, URLs, Celery config
templates/     → Django templates (base, professor area, school management area)
static/        → CSS (style.css), JS (kevin_chat.js), images
```

**Key Models & Relations** (após Demandas 1 e 15 — ver `docs/demandas.md`):
- `Plano 1─N Escola 1─N Professor 1─N Turma` (Turma tem `qtd_alunos`, sem modelo Aluno)
- **`TG` (cronograma global da Bebelingue, ex: "TG 3x — Year 5") `1─N Aula`** (D31)
- **`Escola 1─N Serie` (nome livre, ex: "Fundamental") `N─1 TG`; `Turma N─1 Serie`** (D32)
- A turma segue o TG da sua série: `Turma.aulas_do_curriculo()` = `serie.tg.aulas`
- `Aula` (código `Y5-U1W1C1`) `1─N BlocoAula N─1 Atividade` (catálogo)
- `Turma N─N Aula` via `AulaTurma` (execução: data, professor, presença)
- `Professor 1─N Conversa 0─1 Aula`; `Conversa 1─N Mensagem`

> ⚠️ `Aula.frequencia_minima` e `Turma.aulas_por_semana` foram **removidos**
> (D31): a frequência vem do TG (`Aula.tg.frequencia`), o year da turma vem da
> série (`Turma.serie.year`).

> ⚠️ O modelo antigo (`Aluno`, `Conteudo`, `AulaConteudo`, `warm_up`/`development`/
> `closure` em texto) **não existe mais**. Regras de negócio detalhadas na seção
> "📐 Regras de negócio" abaixo.

**Design Constraints:**
- Currículo **global e fixo** (Bebelingue cadastra; professor não edita)
- Progresso é **da turma**, nunca do aluno; aluno é só headcount
- Chat é **do professor** (a turma participa quando ele abre o momento)
- Provedores de IA/TTS/STT por `Plano`

## Development Setup

### Docker (Recommended)
```bash
git clone <repo>
cd kevin
cp .env.example .env          # adjust if needed
docker compose up --build     # starts db, redis, web, celery
```

First-time setup (in another terminal):
```bash
docker compose exec web python manage.py migrate
docker compose exec web python manage.py seed_demo   # test data
```

App: http://localhost:8000

**Test Users (after seed_demo):**
| User   | Password | Role      |
|--------|----------|-----------|
| admin  | admin123 | superuser |
| carlos | dir123   | diretor   |
| maria  | prof123  | professor |

### Without Docker
```bash
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# In .env: uncomment DB_ENGINE=sqlite OR point DB_HOST=localhost for local Postgres
python manage.py migrate
python manage.py seed_demo
python manage.py runserver
```

For async chat, run Celery in a separate terminal:
```bash
celery -A config worker -l info
```

## Running & Deployment

**Local Development:**
```bash
# With Docker (all-in-one)
docker compose up

# Without Docker
python manage.py runserver
celery -A config worker -l info  # in another terminal
```

**Django Admin:**
- URL: `/admin/`
- Only superuser can access
- Models: User, Escola, Plano, Professor, Turma, Aluno, Aula, Conteudo, Conversa, Mensagem

**Role-Based Areas:**
- `/gestao/` → Diretor (school director) — CRUD professores/turmas/alunos, relatórios
- `/professor/` → Professor — Years → Class → Lessons + lateral Kevin chat, mark lesson complete, audio recording
- `/admin/` → Superuser (Django admin)

## Key Implementation Details

### Authentication & Authorization
- Custom `User` model (AbstractUser) with `role` field (choices: admin, diretor, professor)
- Login redirects to role-specific dashboard via middleware
- Session + SimpleJWT for API endpoints
- Middleware in `apps/accounts/` handles role-based routing

### Chat & AI Integration
- **Providers** stored in `apps/chat/providers/` — pluggable design
  - `IAProvider` (OpenAI, Anthropic)
  - `TTSProvider` (ElevenLabs, OpenAI)
  - `STTProvider` (Whisper, Google)
- **Async Tasks** in `apps/chat/tasks.py`
  - `processar_mensagem_ia` — fetch AI response via provider
  - `processar_audio_ia` — transcribe audio, send to chat
- **Models:** `Conversa` (per teacher+lesson), `Mensagem` (timestamped, role+type)

### Frontend Templates
- **Base:** `templates/base.html` — topbar, sidebar, flash messages, role-based nav
- **Professor Area:**
  - `professor/years.html` — select school year
  - `professor/turmas.html` — list classes for year
  - `professor/turma_aulas.html` → list lessons for class
  - `professor/aula_detail.html` → lesson content + lateral chat sidebar (where Kevin interaction happens)
  - `professor/biblioteca.html` → searchable content library
  - `professor/meu_progresso.html` → class progress (% completed lessons)
- **Management Area (`gestao/`):**
  - Forms for professor/class/student CRUD

  - Reports showing progress per class

### CSS & Visual Design
- **File:** `static/css/style.css` (~1751 lines)
- **Palette:** Blue `#2B7DE9` (primary), gradient backgrounds, rounded corners (16px), shadows
- **Font:** Nunito (Google Fonts)
- **Child-friendly:** playful, colorful, lots of emoji in UI
- **Transitions:** `all 0.3s cubic-bezier(.4,0,.2,1)` (already in vars for consistency)

### JavaScript
- **Main file:** `static/js/kevin_chat.js`
- Handles chat DOM updates, audio recording, message sending
- Vanilla JS (no jQuery, no React)

### ⚠️ Prompt do Kevin — fonte única de verdade

**O prompt do Kevin vive SOMENTE em `apps/chat/`.**

| Onde | O que é |
|---|---|
| `apps/chat/tasks.py` → `SYSTEM_PROMPT_BASE` | ✅ **O prompt oficial.** É o único lugar a editar |
| `apps/chat/tasks.py` → `_montar_contexto()` | ✅ Montagem do contexto da aula |
| `apps/chat/prompts/playground_*.txt` + `_montar_contexto_playground()` | ✅ Prompt do **Playground** (Demanda 20) — ver "Kevin Playground" abaixo |
| `apps/chat/ferramentas.py` | ✅ Ferramentas (tool calling) do Kevin: o que cada uma faz e em que modo vale |
| `exemplo/` | ❌ **Protótipo descartável.** Não é referência, não é produção |

**Regras:**

1. Qualquer mudança de comportamento do Kevin (tom, idioma, postura pedagógica,
   roteiro) entra em `apps/chat/` — nunca em `exemplo/`.
2. `exemplo/server.py` é uma sandbox para experimentar rápido. Se algo dali
   funcionar bem, **porte para `apps/chat/`**; não deixe as duas versões vivas.
3. Roteiro de aula **não** pertence ao prompt. Ele vem do banco (ver Demanda 1
   em `docs/demandas.md`): `Aula → BlocoAula → Atividade`. Se você está escrevendo
   passo a passo de aula dentro de uma string Python, está no lugar errado.
4. Regras pedagógicas calibráveis (política de idioma / Instant Translation,
   tom, tamanho da resposta) devem ficar em **trechos isolados e substituíveis**
   do prompt — a Demanda 8 vai transformá-las em configuração de UI.

**Modelo de interação** (confirmado com o cliente): o Kevin é projetado na
tela/TV da sala. O **professor é o interlocutor principal** e conversa por áudio;
a turma participa em momentos que o professor abre e fecha. O Kevin não toma a
iniciativa de se dirigir às crianças. (Exceção no Playground, D48 — ver
"Kevin Playground" abaixo.)

### 🛝 Kevin Playground (Demanda 20)

Sessão com o Kevin **sem aula cadastrada** (`/professor/playground/`). É um
**modo da `Conversa`** (`modo='playground'`, `turma` preenchida, `aula` nula) —
não gera `AulaTurma` nem mexe em progresso (D47).

| Peça | Onde |
|---|---|
| Prompt (default) | `apps/chat/prompts/playground_{abertura,papel,idioma,execucao}.txt` |
| Prompt (por TG) | campos `TG.playground_*`, editor em `/coordenacao/tg/<id>/prompt-playground/` (D50) |
| Montagem | `_montar_contexto_playground()` em `tasks.py`: blocos → turma → catálogo (só nomes) → contexto → estado da sala |
| Ferramentas | `apps/chat/ferramentas.py` — cada uma declara o modo; **no modo aula só existe `celebrar_acerto`** |
| Estado da sala | `Conversa.estado` (whisper, so_ingles, cenario, quadro, jogo_id) |
| Telão | `templates/professor/playground.html` + o que está atrás de `MODO_PLAYGROUND` em `kevin_chat.js` |
| Voz sussurrada | `ElevenLabsTTSProvider.sintetizar(estilo='sussurro')` → `eleven_v3` + `[whispers]` (D52) |

**Regras que mudam só aqui:** o Kevin chama a turma por iniciativa própria
(exceção à regra 15, D48); a abertura é fixa, não gerada pela IA (D53); o
contexto da sessão é a 1ª resposta do Teacher, literal (D49); e o Kevin fala
**só pela ElevenLabs** — nenhuma fala gravada do motor (Open class, Pay
attention, "yeah, you got it", "bye"), que tem outra voz (D54).

**Ao mexer:** os nomes das ferramentas aparecem no texto do prompt — renomear
uma ferramenta exige atualizar o prompt (default e TGs customizados). A aula
estruturada não pode ganhar caminho novo: tudo no JS fica atrás de
`MODO_PLAYGROUND`, e o teste `test_conversa_de_aula_continua_so_com_celebrar`
protege o backend.

**Como testar:** login como `maria` → Playground → turma → Começar. Sem chave
de IA no plano, o chat cai no modo demo (sem ferramentas).

## 📐 Regras de negócio — metodologia Bebelingue

> Confirmadas com o cliente em 23/07/2026. **São restrições do domínio, não
> escolhas de implementação** — não "simplifique" nenhuma delas sem falar com o
> Paulo. Detalhamento e histórico em `docs/demandas.md`.

### Quem é quem

| Papel | Quem é | Pode |
|---|---|---|
| `admin` | Bebelingue (técnico) | Tudo, inclusive chaves de API e planos |
| `coordenador` | Bebelingue (pedagógico) | Cadastrar TG e catálogo oficial; ver todas as escolas. **Não** acessa config técnica |
| `diretor` | Escola cliente | Gerenciar professores e turmas **da própria escola** |
| `professor` | Escola cliente | Suas turmas, usar o Kevin, criar atividade **local** |

**Bebelingue = fornecedora** (vende metodologia + material + Kevin).
**Escola = cliente** (ex: Bernoulli). Aluno **não tem login**.

### Currículo

1. **O TG é global.** Toda escola que usa Year 1 recebe exatamente o mesmo TG.
   Adaptação por escola é "quase irrelevante" (palavra do cliente) — **não
   modele currículo por escola**.
2. **A aula é endereçada por `Year + Unit + Semana + Aula`** (`Y5-U1W1C1`) —
   é o código impresso no TG. `mes` e `lesson` são descritivos, **nunca chave**;
   o mês é a faixa de calendário do TG. **Revoga a regra antiga (por mês)** —
   ver D27, tomada com o TG completo do Y5 em mãos. A `unit` guarda a sigla do
   TG: `U1`…`U8`, mais `WU` (Welcome) e `JU` (June), que não são numeradas.
3. **3x, 4x e 5x são TGs DIFERENTES** (D31, reunião 30/07). Cada frequência é um
   `TG` próprio (entidade), com suas aulas. A escola cria uma `Serie` (nome
   livre) e o coordenador a vincula ao TG certo; a turma segue o TG da série.
   (O 4x continua sendo o 3x + uma Communication, mas cada um é um TG à parte.)
4. **Roteiro não é texto corrido.** É lista ordenada de `BlocoAula`, cada um
   apontando (opcionalmente) para uma `Atividade` do catálogo.
5. **O professor não edita o TG.** Só executa e marca progresso.

### Catálogo de atividades

6. **Quatro naturezas numa tabela só** (`Atividade.tipo`): `jogo` (Simon Says),
   `tecnica` (Sandwich Technique), `rotina` (BeCalendar), `recurso`
   (Student's Book).
7. **`escola = NULL` → catálogo oficial da Bebelingue.** Preenchido → atividade
   local daquela escola. Professor **nunca** vê atividade local de outra escola.
8. **Fonte oficial das regras:** a seção **Games Bank**, no início do TG. Não
   invente regra de jogo — e não deixe o Kevin inventar.

### Execução e progresso

9. **Progresso é da turma, nunca do aluno.** Não existe métrica individual.
10. **Aluno é só headcount** (`Turma.qtd_alunos`). O modelo `Aluno` foi apagado.
11. **A turma percorre o TG no ritmo dela.** `Aula` (o plano) e `AulaTurma` (a
    execução, com data real) são tabelas separadas — feriado e reposição são
    normais.
12. **Concluir aula = 1 clique.** `data_realizada` e `professor` são gravados
    automaticamente; presença e observação são **opcionais**. Nunca torne
    obrigatório: adesão vale mais que completude.

### Métricas

13. **A métrica principal é do professor**, não do aluno nem da turma.
14. **"Atrasado" não é calculado por fórmula.** O previsto vem do **Yearly Plan
    Review** (acordado entre professor e coordenador no início do ano); o
    realizado é conferido no **RMP** (reunião mensal). O sistema entrega o
    retrato pronto — **não substitui a reunião**.

### O Kevin em sala

15. **O professor é o interlocutor**, principalmente por áudio. A turma
    participa em momentos que ele abre e fecha. O Kevin **não toma a iniciativa**
    de se dirigir às crianças. **Exceção, só no Playground (D48):** sem roteiro,
    o Kevin chama a turma por iniciativa própria. É de propósito — não
    "corrija" o prompt do Playground com base nesta regra.
16. **Instant Translation é o padrão de idioma**: valida em português, responde
    em inglês. Deve ficar num trecho **isolado e substituível** do prompt
    (vira configuração na Demanda 8).

> ⚠️ **Regras 15 e 16 em revisão (10/11/2026).** Na reunião de validação com o
> Lucas Albertoni, o Kevin passou a **ocupar o lugar do professor de inglês**.
> O professor regente, que não fala inglês, fica na sala (D55). Com ele o Kevin
> fala **português**; com a turma, ensina pela sequência TEFL com repetição
> tripla (D56, D57). As falas gravadas saem da aula (D58). O código ainda segue
> as regras acima até o **Épico A** (Demandas 21–25 em `docs/demandas.md`) ser
> implementado. Não "corrija" nada com base nelas sem ler o épico.

## 🚀 Produção — NO AR desde 28/09/2026

> **https://kevin-qv84.onrender.com**

| Peça | Onde | Detalhe |
|---|---|---|
| App | **Render**, plano **Starter** ($7/mês), região **ohio** | Blueprint `render.yaml`; `preDeployCommand` roda o `migrate` a cada deploy |
| Banco | **Neon** (Postgres 18 serverless), região Ohio | Conexão **direta**, não pooled — o pooler é PgBouncer em modo transação e não suporta o que uma migration precisa |
| Estáticos | WhiteNoise, `collectstatic` no Dockerfile | Funcionando (confirmado: `/static/` responde 200) |
| Mídia do Kevin | ❌ **ainda não** — bucket `public` no Neon Object Storage | Demanda 19, etapa 1 |
| Celery/Redis | ❌ não existe em produção | Chat roda em modo síncrono (`?sync=1`) |

**Armadilhas que já custaram tempo — não repita:**

- O nome `kevin.onrender.com` **já estava tomado** por outro serviço. O Render
  atribuiu `kevin-qv84`. `ALLOWED_HOSTS` errado devolve **400 em toda página**;
  `CSRF_TRUSTED_ORIGINS` errado derruba **todo POST com 403** — e nenhum dos
  dois diz o motivo na tela. Se o domínio mudar, os dois mudam junto.
- O `preDeployCommand` **não existe no plano free** do Render. Foi o que forçou
  o Starter.
- A região do Render **não pode ser alterada** depois que o serviço é criado.
- O valor de `DATABASE_URL` no `.env` pode vir **entre aspas** do console do
  Neon. O Docker Compose remove as aspas ao ler o arquivo, mas colar com aspas
  no painel do Render quebra o `migrate` com `No support for ''`.
- **Código no GitHub ≠ código rodando.** O Render serve uma imagem Docker; até
  haver build novo, ele executa o código antigo mesmo com o banco já migrado.
  Sintoma típico: campo novo não aparece no admin.

**Contas de produção:** `paulo`, `arthur`, `victor` (superusuários), mais
`coord` / `carlos` / `maria` (um por papel, para teste).

**Histórico:** as plataformas cogitadas eram Render ou Railway. Escolhido o
Render pelo `render.yaml` — configuração versionada em vez de cliques.

### O que já está pronto

- `Dockerfile` funcional (python:3.12-slim)
- `gunicorn` já no `requirements.txt`
- `DEBUG`, `ALLOWED_HOSTS`, `DB_*` já leem de variável de ambiente (`python-decouple`)

### O que FALTA — não subir antes de resolver

| # | Pendência | Por quê |
|---|---|---|
| 1 | **`whitenoise` não está instalado** | Com `DEBUG=False`, o Django **para de servir arquivos estáticos**. O Kevin (SVG, JS, CSS) simplesmente não carrega. É a falha nº 1 de quem sobe Django pela primeira vez |
| 2 | **`collectstatic` não roda no Dockerfile** | Sem isso, `STATIC_ROOT` fica vazio no container |
| 3 | **Storage externo (S3/R2) não configurado** | Decidido: backgrounds e vídeo do puppet ficam fora do Git (ver "Assets do Kevin"). Precisa de bucket + credenciais |
| 4 | **`SECRET_KEY` e `DEBUG` em produção** | `DEBUG=False` obrigatório; `SECRET_KEY` nova, nunca a de dev |
| 5 | **`CSRF_TRUSTED_ORIGINS`** | Sem o domínio de produção aqui, todo POST falha |
| 6 | **Redis + worker Celery** | O chat assíncrono depende. Em Render/Railway são serviços separados, cobrados à parte |
| 7 | **Postgres gerenciado** | Trocar o container de banco pelo serviço da plataforma |

### Roteiro de deploy — passo a passo

> Ordem pensada para falhar cedo e barato. Não pule o passo 1.

**Passo 1 — `whitenoise` (fazer ANTES de qualquer deploy)**

Sem isso, com `DEBUG=False` o Django não serve `static/` e a página vem sem CSS
nem Kevin — sem erro óbvio no log.

```bash
pip install whitenoise && pip freeze > requirements.txt
```

```python
# config/settings.py — no MIDDLEWARE, logo APÓS SecurityMiddleware
'whitenoise.middleware.WhiteNoiseMiddleware',

# no fim do arquivo
STORAGES = {
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}
```

```dockerfile
# Dockerfile — antes do CMD
RUN python manage.py collectstatic --noinput
```

**Validar local:** rodar com `DEBUG=False`. Se o Kevin aparecer, aparece em
produção. Bônus: o whitenoise comprime o SVG automaticamente (6,6 MB → ~5 MB).

**Passo 2 — Render (web + Postgres, sem Celery)**

Recomendado sobre o Railway por causa do `render.yaml`: declara todos os
serviços num arquivo versionado, em vez de cliques na interface.

Variáveis de ambiente obrigatórias:

```
DEBUG=False
SECRET_KEY=<nova, nunca a de dev>
ALLOWED_HOSTS=<dominio>.onrender.com
CSRF_TRUSTED_ORIGINS=https://<dominio>.onrender.com
DATABASE_URL=<injetada pelo Render>
```

> ⚠️ **Free tier hiberna após 15 min** e leva ~30s para acordar. Serve para teste
> interno; **não** para demo ao cliente.

O chat funciona sem Celery usando o modo síncrono (`?sync=1`).

**Passo 3 — Cloudflare R2 (quando a demanda de animações entrar)**

Preferir R2 a S3: 10 GB grátis e **sem cobrança por download** (o S3 cobra
egress). Subir os backgrounds pela interface web, copiar as URLs, gravar em
`Aula.background`. Cenário novo do animador = subir arquivo, sem deploy.

**Passo 4 — Redis + worker Celery**

Só quando o volume justificar. São dois serviços a mais na conta.

### Custo estimado

| Configuração | ~Mensal |
|---|---|
| Web + Postgres (chat síncrono) | ~$12 |
| \+ Redis + worker Celery | ~$22–25 |

### Assets do Kevin — onde cada coisa mora

Decisão tomada (ver `docs/demandas.md`):

| Arquivo | Onde | Motivo |
|---|---|---|
| `kevin-puppet.js`, `.css` | ✅ Git | É código |
| `kevin-rigged.svg` | ✅ Git | Acoplado ao motor — o JS identifica as partes **pelos `id`** do SVG. Os dois precisam versionar juntos |
| Backgrounds (`.png`/`.webp`) | ☁️ Storage externo | Conteúdo, cresce a cada entrega do animador. `Aula.background` guarda a referência |
| Vídeo de transição (`.webm`) | ☁️ Storage externo | 3,8 MB, muda raramente |
| Falas gravadas (`audio/voz-kevin/*.mp3`) | ✅ Git **e** ☁️ bucket | **Exceção** (15/10/2026): o motor busca as falas do Open class/Pay attention relativas ao próprio `.js`, sem opção de URL — só funcionam em produção se estiverem no static. ~1,4 MB. Ver `DIARIO_EXPORT.md`, Entrada 10 §6 |
| Poster da entrada (`videos/entrada-kevin-poster.webp`) | ✅ Git (entrega) + ☁️ bucket (uso) | 88 KB, gerado do 1º frame do `entrada-kevin.webm`; versionado só para o dev do bucket ter de onde subir |
| `export_*.zip` | ❌ Nunca | Já no `.gitignore`. Extrair e mover só o que é usado |

> ⚠️ **Git guarda cada versão de binário para sempre** (não faz delta como em
> texto). Três entregas do animador = ~60 MB permanentes no histórico, mesmo
> deletando os arquivos depois. Por isso mídia não entra.

> ⚠️ **Nunca rode SVGO/otimizador com `cleanupIds` ligado** no
> `kevin-rigged.svg` — renomear IDs quebra o motor inteiro.

## Coding Conventions

- **Language:** Portuguese (code, comments, UI, commits)
- **CSS:** Custom properties in `:root`, no framework, semantic HTML
- **AI keys optional in dev** — chat works without ANTHROPIC_API_KEY, OPENAI_API_KEY, ELEVENLABS_API_KEY (graceful fallback)
- **Prompt do Kevin:** só em `apps/chat/` — ver seção acima

## Environment Variables

See `.env.example`. Key variables:
- `DEBUG=True` (dev only)
- `SECRET_KEY`, `DB_*` (database)
- `REDIS_URL` (Celery)
- `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `ELEVENLABS_API_KEY` (optional, for real AI responses)
- `CSRF_TRUSTED_ORIGINS` (CORS, for production)

## Common Tasks

**Create a new endpoint:**
1. Add view in app's `views.py`
2. Register in app's `urls.py`
3. Update `config/urls.py` if top-level
4. Template in `templates/{app}/`

**Add a model field:**
1. Modify model in `apps/{app}/models.py`
2. Create migration: `python manage.py makemigrations`
3. Apply: `python manage.py migrate`
4. Update admin in `apps/{app}/admin.py` if needed

**Trigger async task:**
1. Call task from view: `processar_mensagem_ia.delay(conversa_id, mensagem_texto)`
2. Task runs in Celery worker (separate process)

**Test API endpoint:**
- Use `manage.py shell` to test views/models
- **Suíte de testes (Demanda 14):** `docker compose exec web python manage.py test`
  — 124 testes em `apps/{accounts,chat,curriculo,escolas}/tests.py`. Rode antes
  de commitar mudanças no domínio.

## ⚠️ Exports de animação do animador — como lidar

> O animador (Vitor) entrega o Kevin como um `export_N.zip` (SVG + motor JS +
> CSS + backgrounds). Ele **testa no ambiente dele e vê funcionar**, mas os
> exports chegam com defeitos que a exportação do Illustrator introduz. Guia
> completo para ele em `docs/mensagem.md`.

**Padrão de bug: "funciona no ambiente dele, quebra aqui".** A causa quase sempre
é a **exportação** perdendo uma configuração, não a arte. Investigue o SVG/CSS
exportado antes de suspeitar da integração.

**Bugs conhecidos do `export_2` e a causa raiz:**

| Sintoma | Causa | Correção do nosso lado |
|---|---|---|
| **Esqueleto visível** (linhas/círculos de junta) | A classe dos bones sai `.st36 { stroke:#000 }` (visível) em vez de `display:none`. Os bones **precisam existir** (o motor os usa no rig), mas não podem ser desenhados | CSS: `#kevin-rig-mount .st36, [id^="Bones_"] { display:none !important }` |
| **Mãos duplicadas** | Variante de mão (`Mão_Ukulele`) aparece sem esconder a mão base (`Mão`/`mão`) do mesmo braço | Esconder a mão base quando a variante entra (JS ou CSS) |
| **Mosca ("vilão") ao abrir** | `Corpo_mosca` não nasce oculto | Forçar `display:none` inicial |
| **Kevin sobre a cama** (cenário quarto) | O motor alinha o Kevin à base do container; se o "chão" do background está alto, ele pousa sobre móveis | É problema do **background** — o chão deve estar no terço inferior. Pedir ao animador |
| **SVG pesado (6,6 MB)** | Export sem otimização (casas decimais, metadata Illustrator) | WhiteNoise comprime; pedir export leve ao animador |

**Regra de ouro:** prefira corrigir na **origem** (pedir export certo, ver
`docs/mensagem.md`) a tapar com CSS no nosso lado — senão cada entrega nova traz
o bug de volta. Correção CSS temporária é aceitável para não travar, mas registre
como dívida e cobre o animador.

**Nunca renomeie os IDs do SVG** — o motor encontra cada parte por `id`. Se rodar
SVGO, use `cleanupIds: false`.

### 📦 Como INSTALAR um export novo (passo a passo para a IA)

> Escrito para o Claude Code executar quando o dev de animação disser algo como
> "chegou um export novo, instala" ou "vá na pasta X do meu projeto de animação
> e instale os exports". A fonte pode ser um `export_N.zip` extraído **ou uma
> pasta externa** que o dev aponta no Mac dele — o procedimento é o mesmo: leia
> os arquivos daquele caminho e integre sem quebrar o motor.

**Onde cada arquivo do export vai parar:**

| Arquivo no export | Destino no projeto | Versiona no Git? |
|---|---|---|
| `kevin-rigged.svg` | `static/js/kevin-puppet/kevin-rigged.svg` | ✅ sim (acoplado ao motor pelos IDs) |
| `kevin-puppet.js` | `static/js/kevin-puppet/kevin-puppet.js` | ✅ sim (é código) |
| `kevin-puppet.css` | `static/js/kevin-puppet/kevin-puppet.css` | ✅ sim |
| `assets/backgrounds/*.png/webp` | `static/js/kevin-puppet/assets/backgrounds/` | ❌ não (mídia, `.gitignore`) |
| `assets/videos/*.webm` | `static/js/kevin-puppet/assets/videos/` | ❌ não (mídia) |

**O procedimento:**

1. **Validar ANTES de instalar.** Rode o validador contra a pasta extraída:
   ```bash
   python3 scripts/validar_export.py <pasta-do-export>/
   ```
   Se acusar erro (IDs faltando, esqueleto visível, background com chão alto),
   **NÃO instale** — devolva ao animador com o que o validador apontou. O
   contrato completo está em `docs/mensagem.md`.

2. **Copiar os arquivos** para os destinos da tabela acima. Sobrescrever o SVG,
   o JS e o CSS; adicionar backgrounds/vídeos novos em `assets/`.

3. **Bump do cache-buster** no partial que carrega os assets
   (`templates/professor/partials/kevin_scripts.html`, usado pela aula e pelo
   Playground): incrementar o `?v=N` do `kevin-puppet.js`, do `.css` e do SVG. Sem isso, o navegador serve o cache
   velho e "não muda nada" (causa nº 1 de "instalei mas continua igual").

4. **Se o background for novo**, registrar a chave em `BACKGROUND_CHOICES`
   (`apps/curriculo/models.py`) para o cenário aparecer no cadastro de aula.

5. **Validar no browser** (Playwright ou manual): abrir uma aula, iniciar,
   olhar o Kevin em cada modo (standby, música, listening). Comparar com o
   `demo.html` do export. **Olhar o screenshot** — não dizer "funciona" sem ver.

6. **Nunca rodar SVGO com `cleanupIds`** no SVG — renomear IDs quebra o motor.
   Se otimizar, `cleanupIds: false`.

7. **Commitar** só o que versiona (SVG/JS/CSS) — os `export_*.zip`, backgrounds
   e vídeos ficam fora do Git (`.gitignore`).

**⚠️ Sons ambientes / áudio de cenário — NÃO é só copiar arquivo.** O sistema
**não tem** hoje suporte a som ambiente ligado ao cenário/background (só áudio
por aula: música e listening, via `Aula` + `arquivo_url`). Se o export trouxer
sons ambientes, isso é **feature nova**, não instalação:
- pergunte ao Paulo onde o som se liga (ao **background**? à **aula**?);
- é preciso criar o campo/modelo para a referência e fazer o motor tocar o áudio
  (provavelmente em loop) quando o cenário entra;
- registre como demanda em `docs/demandas.md` antes de implementar.
Não invente o vínculo sozinho — os arquivos de áudio o dev entrega; a ligação no
domínio é decisão de escopo.

## Kevin Animation System

**Architecture:** Three-layer modular system for SVG rigging and animation.

1. **KevinRig.js** — Core SVG control
   - Loads SVG from `static/js/kevin-puppet/kevin-rigged.svg`
   - Methods: `setMouthShape()`, `animateTalkingSequence()`, `blink()`, `rotateHead()`, `lookAt()`
   - Manages animation state and continuous blinking loop (3-6s intervals)

2. **KevinAnimations.js** — High-level effects on top of KevinRig
   - Semantic behaviors: `talk()`, `listen()`, `greet()`, `excited()`, `confused()`, `blinkMultiple()`
   - Combines mouth, eye, and head movements for expressive interactions

3. **KevinChatIntegration.js** — Bridges animations with chat events
   - Methods: `onUserMessage()`, `onAssistantMessage()`, `onQuestion()`, `onError()`, `reset()`
   - Auto-initializes when page loads (checks `window.KevinChatIntegration` and `window.KEVIN_RIG_CONFIG`)

**Layout:** Kevin displays prominently in lesson page (`aula_detail.html`):
- Left side: Large Kevin stage (320×320px) with animated SVG
- Right side: Chat panel with message history and input
- Responsive: Stacks vertically on tablets/mobile

**Mouth Animation:** Sequence of shapes (neutral, aa, oh, uh, etc.) synchronized with speech duration
**Eye Animation:** Pupils track during talk (up/down sway), focus down while listening
**Head Animation:** Rotation for emphasis (nodding, tilting)

**Config in template:**
```javascript
window.KEVIN_RIG_CONFIG = {
  svgUrl: "{% static 'js/kevin-puppet/kevin-rigged.svg' %}",
  rigMountSelector: "#kevin-rig-mount",  // mounts to stage area in lesson page
};
window.KEVIN_CHAT_CONFIG = { ... };
```

**CSS:** `static/css/kevin-chat-animation.css` includes animations and stage styling

## ✅ Estado atual e TODO

> Atualizado em **24/07/2026**. Branch `feat/coordenacao`. Status por demanda
> em `docs/demandas.md`.

### Feito e validado

| # | Demanda | O que entregou |
|---|---|---|
| 1 | Remodelagem do banco | `Aula` (Y5-U1W1C1) + `Atividade` + `BlocoAula` + `AulaTurma`. `Aluno`/`Conteudo` removidos |
| 2 | Papéis | `escola`→`diretor`, novo `coordenador`, admin sem loop |
| 3 | Prompt do Kevin | Reescrito em blocos; Instant Translation isolada; ~411 tokens |
| 6 | Busca no catálogo | Filtros de tipo/origem, badge "usado em N aulas" |
| 7 | Área `/coordenacao/` | Grade **por TG** × Unit × semana × aula, editor de blocos (arrastar + autocomplete + autosave), catálogo, duplicar Unit |
| 15 | Série + TG | `TG` (cronograma global) e `Serie` (segmento da escola → TG); turma segue o TG da série. Migração do Y5 (D31/D32) |
| 16 | Relatório do professor | Professor → turma → posição no TG, filtro mês/mês passado/ano. Em `/coordenacao/relatorio/` e `/gestao/` (D33) |
| 9 + 10 | Animação | Motor novo (7 modos, mosca), enquadramento corrigido, export do animador validado |
| 11 | Telão | Modal de conclusão com presença, FAB do chat, botão de **música** (Kevin toca ukulele + áudio) e de **listening** (só toca áudio), ambos condicionais ao conteúdo da aula |
| 12 | Background por aula | Cada aula mostra seu cenário (agora em WebP, 71% menor) |
| 13 | Seed | `seed_demo` enxuta: 4 aulas de vitrine (música / listening / bg quarto / bg hospital) |
| 14 | Testes | 55 testes (`manage.py test`) |
| — | Chave por Unit | `Y5-MAR-W1C1` → `Y5-U1W1C1` (D27); `CLIL` vira tipo (D28) |
| — | Catálogo importado | Games Bank do TG: 91 jogos + técnicas via `importar_catalogo_tg` (D30) |
| — | Áudio de aula | Música e listening por atividade: o botão só aparece se a aula tem o conteúdo. Faixa em `static/audio/`; `arquivo_url` da atividade aponta ao R2 em produção |
| — | Deploy | whitenoise + collectstatic + render.yaml + hardening |
| 18 | Produção | **No ar**: Render (Starter, ohio) + Neon (Postgres 18). Ver seção Produção |
| — | Effort da IA | `Plano.ia_effort` (`none`…`max`), enviado como `reasoning_effort` só pelo OpenAI e só quando preenchido (D39) |
| — | Correção de segurança | As 5 views em função de `coordenacao_views.py` estavam sem guarda de papel — qualquer usuário logado podia editar o TG oficial. `role_required` em `apps/accounts/decorators.py` (D40) |
| 8 | Prompt editável por TG | Prompt do Kevin em `apps/chat/prompts/*.txt` (default) + 3 campos no `TG` (`prompt_papel/idioma/execucao`). Editor em `/coordenacao/tg/<id>/prompt/` (só coordenador); bloco vazio herda o default (D42–D44) |
| — | Fix Kevin "robótico" | Modo demo do chat de texto era `true` hardcoded e vazava pra produção. Agora liga ao plano ter chave de IA: com chave → Kevin real (D45) |
| 20 | Kevin Playground | Sessão sem aula cadastrada em `/professor/playground/`: abertura fixa, contexto = 1ª resposta do Teacher, ferramentas (música, jogo, quadro, cenário, Pay Attention, Whisper, Só inglês), voz só da ElevenLabs, editor por TG na coordenação (D47–D54). **Falta validar em sala** e testar o sussurro com a voz do Kevin |

---

## 🔜 TODO — o que falta

### A. Livre para fazer agora (sem depender de ninguém)

- [ ] **Subir para produção**
      Código pronto (whitenoise, collectstatic, Dockerfile). Falta: escolher
      plataforma (Render recomendado), criar bucket R2 para os backgrounds,
      configurar as env vars. Passo a passo na seção "🚧 Deploy" acima.

- [ ] **Marcar o PR como "ready for review"**
      https://github.com/PauloHenriqueL/kevin/pull/1 — está em draft. 14 demandas
      prontas; o Arthur precisa ver a remodelagem.

### B. Esperando o cliente (Bebelingue)

- [x] ~~**TG completo** com **Games Bank**~~ — chegou em 24/07/2026 (Y5 3x e 5x).
      O catálogo já foi importado (91 jogos + técnicas). **Faltam os TGs dos
      outros Years** (1–4) e a confirmação de D29 (3x e 5x parecem TGs distintos,
      não um derivado do outro — ver `docs/demandas.md`).
- [ ] **Yearly Plan Review** e modelo de **RMP** → destravam a Demanda 4 (métricas)
- [ ] **Reunião do Class Feedback** (Demanda 5) → definir quem vê o quê
- [ ] **Cenários**: quem mapeia vocabulário → cenário de fundo (§10 da pauta)

> Perguntas prontas em `docs/PERGUNTAS_REUNIAO_CLIENTE.md`; mensagens em
> `docs/mensagens.md`.

### C. Esperando o animador (Vitor)

> Ele já configurou o sistema dele com nosso contrato e o validador. Pedidos
> em `docs/mensagem.md` §C.4.

- [ ] **Ligar o `entrada-kevin.webm`** — o vídeo existe no projeto dele (2 MB) mas
      não está no export nem é usado pelo motor. É a animação de entrada
      ("floresta abrindo") que faltava
- [ ] **Chão do cenário `quarto`** — o Kevin ainda pisa **em cima da cama**
- [ ] **Changelog no README** do export (regra que a IA dele não aplicou)

### D. Registrado, sem prioridade

- [ ] **Demanda 8** — configuração do comportamento do Kevin (idioma, tom) por UI
- [ ] Remover o CSS defensivo do `#Pulso_bone1` quando o export novo chegar
      (hoje é redundante com o hardcode do motor)

---

### Onde retomar

**Atualizado em 28/09/2026.** O sistema está **no ar** (ver seção Produção).

A frente ativa é a **Demanda 19, etapa 1**: subir os 29 MB de mídia do Kevin
para o bucket público do Neon e apontar as URLs no `KEVIN_RIG_CONFIG` do
`aula_detail.html`. O motor aceita override de todos os assets, então nenhuma
linha do `kevin-puppet.js` muda. Bloqueado nas credenciais do bucket
(`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_ENDPOINT_URL_S3`,
`AWS_REGION` no `.env`).

Depois disso, o gargalo passa a ser **conteúdo**: produção tem 0 TGs, 0 séries,
0 turmas e 0 aulas. Sem aula cadastrada não há tela de aula, e o Kevin não
aparece — por mais que os assets estejam no lugar. Quem cadastra é a
coordenação, em `/coordenacao/`.

No domínio, continuam abertos: **cadastrar os TGs dos Years 1–4** pela grade, e
**confirmar a D29** com o cliente (3x vs 5x) antes de assumir o modelo de
frequência.

Para popular o catálogo a partir de um TG novo:
```bash
docker compose exec web python manage.py importar_catalogo_tg "<pdf>" --dry-run
docker compose exec web python manage.py importar_catalogo_tg "<pdf>" --sobrescrever
```
