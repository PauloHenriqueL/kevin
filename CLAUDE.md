# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> ✅ **Último trabalho grande:** Épico A, o Kevin no lugar do professor de inglês
> (11/11/2026) — código pronto, **deploy travado** até a chave do ElevenLabs.
> Resumo e pendências na seção
> [✅ Épico A](#-épico-a--kevin-no-lugar-do-professor-de-inglês-entregue-em-11112026),
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
| Modelo/lógica | `docker compose exec web python manage.py test` (134 testes) |
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

## ✅ Épico A — Kevin no lugar do professor de inglês (entregue em 11/11/2026)

> O escopo está em `docs/demandas.md` (Épico A, Demandas 21–25, D55–D61). O
> guia de implementação original foi reduzido a este resumo depois de
> executado. As regras de negócio 15–17 abaixo refletem o estado atual.

**O que mudou, por etapa (um commit cada):**

1. **Prompts** (`apps/chat/prompts/*.txt`): o Kevin é o professor de inglês;
   fala português com o regente e ensina a turma pela sequência didática
   (pergunta em português → termo em inglês → turma repete duas vezes). Rótulos do editor da coordenação sem "Instant
   Translation". **Textos do Lucas Albertoni (12/11/2026)** — os provisórios foram substituídos.
2. **Backend da aula**: `Ferramenta.modos` vale nos dois modos; eventos e
   `PATCH estado/` aceitos na aula; contexto da aula ganha MÚSICAS, JOGOS e
   ESTADO DA SALA (`_secoes_catalogo`, `_secao_estado` em `tasks.py`); a
   conversa nasce com `estado` no `Aula.background` (`_estado_inicial_aula`).
3. **Telão**: barra de botões, overlays e seletor de música em partials
   compartilhados; `RECURSOS` no JS; aula sem Open class gravado, despedida
   por TTS, override das falas gravadas em `kevin_config.html`; rótulos com
   fundo próprio. Prompt da aula ganha RECURSOS e Só inglês.
4. **Repetir**: `mostrar_no_quadro` grava `estado.ultima_palavra` com hora;
   `RepetirPalavraView` (`conversas/<id>/repetir/`) valida a janela de 2 min
   e manda o evento com a palavra; botão habilita com a ação `quadro` e
   recebe `repetir_restante` no load.

**Pendências para fechar o épico:**

- ⛔ **Deploy travado pelo ElevenLabs.** O Plano ainda está em
  `tts_provider='openai_tts'` (voz `nova`, feminina) e a chave do ElevenLabs no
  campo `tts_api_key` responde **401**. Antes de subir: colocar a chave
  `sk_…` válida, `tts_provider='elevenlabs'`, `tts_modelo` vazio, e testar com
  `ElevenLabsTTSProvider(...).sintetizar('Hello')` → 200. Sem isso, a aula
  inteira passa a falar com a voz feminina.
- **Validação do Lucas**: os textos dele já estão nos arquivos (12/11/2026);
  falta o teste em sala, uma etapa por vez, como combinado. Página com os prompts para ele: ver `docs/demandas.md`,
  Épico A, A.5.
- Depois do deploy, refazer em produção: pergunta em português ao Kevin →
  resposta em **português**; abertura sem MP3 de `voz-kevin/`; aula com os
  mesmos botões do Playground.

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
| Ferramentas | `apps/chat/ferramentas.py` — **todas valem na aula e no Playground** (D60, Épico A); o que muda entre os modos é o prompt |
| Estado da sala | `Conversa.estado` (whisper, so_ingles, cenario, quadro, jogo_id, ultima_palavra) — a aula nasce no `Aula.background` (D61) |
| Telão | partials compartilhados em `templates/professor/partials/` (`kevin_controles`, `kevin_overlays`, `kevin_modal_musicas`, `kevin_config`); no JS, os recursos ficam atrás de `RECURSOS` (a aula liga com `KEVIN_RECURSOS = true`) e só abertura fixa + Encerrar atrás de `MODO_PLAYGROUND` |
| Voz sussurrada | `ElevenLabsTTSProvider.sintetizar(estilo='sussurro')` → `eleven_v3` + `[whispers]` (D52) |
| Repetir | `POST /api/chat/conversas/<id>/repetir/`: reapresenta `estado.ultima_palavra` (gravada por `mostrar_no_quadro`) dentro de 2 min; 409 fora disso (D59) |

**Regras que mudam só aqui:** a abertura é fixa, não gerada pela IA (D53); o
contexto da sessão é a 1ª resposta do professor, literal (D49). O resto
(Kevin chama a turma, só voz sintetizada, recursos) vale também na aula
desde o Épico A.

**Ao mexer:** os nomes das ferramentas aparecem no texto do prompt — renomear
uma ferramenta exige atualizar o prompt (default e TGs customizados, da aula
e do Playground). O override que desliga as falas gravadas vive em
`kevin_config.html` e vale nas duas telas (D54/D58).

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

15. **O Kevin é o professor de inglês da turma** (D55, reunião de 10/11/2026).
    Quem fica na sala é o **professor regente, que não fala inglês**: parceiro
    para organizar a turma e falar com o Kevin, principalmente por áudio. Com
    a turma, o Kevin fala **por iniciativa própria**: pergunta, pede para
    repetir, chama alguém. Na aula estruturada o **roteiro cadastrado continua
    mandando** (regra 4, D61); no Playground não há roteiro.
    *(Revoga a D11 e a versão anterior desta regra, em que o professor de
    inglês conduzia e o Kevin só assistia.)*
16. **Português com o professor, inglês só com a turma** (D56). Tudo o que o
    Kevin diz ao regente é em português. O inglês entra pela **sequência para
    ensinar um termo** (D57, metodologia TEFL, texto do Lucas em 12/11/2026):
    pergunta em português que leva a turma à palavra → termo em inglês com
    "Repitam comigo!" → a turma **repete duas vezes** → o Kevin diz em que
    língua quer a resposta → pergunta e espera → pede ao professor para
    passar ao próximo termo. O **Só inglês** (No Portuguese
    Allowed) vale só para a turma. Os blocos de idioma e execução ficam em
    trechos **isolados e substituíveis** do prompt, editáveis por TG
    (Demanda 8). *(Revoga a Instant Translation como padrão.)*
17. **Nenhuma fala gravada** (D58): toda fala do Kevin é sintetizada na hora
    pela voz dele no ElevenLabs, e ele **espera a turma responder** antes de
    avançar. Os MP3 do motor (Open class, Pay attention, "yeah, you got it",
    "bye") estão desligados nas duas telas. O ronco é efeito sonoro e fica.

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
| Falas gravadas (`audio/voz-kevin/*.mp3`) | ✅ Git **e** ☁️ bucket | **Não usadas desde o Épico A (D58, 11/11/2026):** o Kevin fala só pela voz sintetizada; `kevin_config.html` desliga hi/bye/celebrate e zera `voiceVolume`. Ficam no repositório por enquanto (o ronco continua em uso). Histórico: eram resolvidas relativas ao `.js` — ver `DIARIO_EXPORT.md`, Entrada 10 §6 |
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
  — 134 testes em `apps/{accounts,chat,curriculo,escolas}/tests.py`. Rode antes
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
| 20 | Kevin Playground | Sessão sem aula cadastrada em `/professor/playground/`: abertura fixa, contexto = 1ª resposta do professor, ferramentas (música, jogo, quadro, cenário, Pay Attention, Whisper, Só inglês), voz só da ElevenLabs, editor por TG na coordenação (D47–D54). **Falta validar em sala** e testar o sussurro com a voz do Kevin |
| 21–25 | **Épico A** — Kevin no lugar do professor de inglês | Português com o regente e sequência TEFL (repete duas vezes) nos prompts (D56/D57); aula estruturada com todas as ferramentas, eventos, estado da sala e os botões do Playground (D60/D61); falas gravadas desligadas nas duas telas (D58); botão **Repetir** com guard rail no servidor (D59). Código pronto e commitado em 11/11/2026. **Deploy travado** até o Plano apontar para o ElevenLabs com chave válida; **prompts aguardam validação do Lucas** |

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
