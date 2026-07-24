# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 📁 Onde está cada coisa (docs/)

| Arquivo | O que é |
|---|---|
| `docs/demandas.md` | **Fonte de verdade do escopo.** Todas as demandas, decisões (D1–D22), modelo de dados alvo, migração. Leia antes de mexer no domínio |
| `docs/PERGUNTAS_REUNIAO_CLIENTE.md` | Pauta de validação com a Bebelingue; o que já foi respondido e o que falta |
| `docs/mensagens.md` | Rascunhos de comunicação (cliente, animador, dev) |
| `docs/animador.md` | Guia para o ANIMADOR: como exportar o Kevin certo (regras + bugs conhecidos) |
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
| **Vitor** | animador | Entrega `export_N.zip` (Kevin + motor). Contrato em `docs/mensagens.md` §4 |
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
| Modelo/lógica | `docker compose exec web python manage.py test` (30 testes) |
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

- Branch por frente de trabalho (`feat/remodelagem-curriculo`)
- PR no template do Paulo: Descrição / Como Testar / Observações
- **Nunca** commitar: `export_*.zip`, backgrounds, vídeos, `documento_escola/`
  (todos no `.gitignore`)
- O `CLAUDE.md` **é versionado** — o time todo lê. Mantenha-o atualizado quando
  uma decisão mudar; é a fonte de contexto de quem chega no projeto

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

**Key Models & Relations** (após a Demanda 1 — ver `docs/demandas.md`):
- `Plano 1─N Escola 1─N Professor 1─N Turma` (Turma tem `qtd_alunos`, sem modelo Aluno)
- `Aula` (TG global, código `Y5-MAR-W1C1`) `1─N BlocoAula N─1 Atividade` (catálogo)
- `Turma N─N Aula` via `AulaTurma` (execução: data, professor, presença)
- `Professor 1─N Conversa 0─1 Aula`; `Conversa 1─N Mensagem`

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
iniciativa de se dirigir às crianças.

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
2. **A aula é endereçada por `Year + Mês + Semana + Aula`** (`Y5-MAR-W1C1`).
   `unit` e `lesson` são atributos descritivos, **nunca chave** — a Unit
   atravessa o mês.
3. **Frequência 3x/4x/5x não gera TGs diferentes.** O de 4x é o de 3x mais uma
   Communication Class. Modelado como `Aula.frequencia_minima`; a turma filtra
   por `aulas_por_semana >= frequencia_minima`.
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
    de se dirigir às crianças.
16. **Instant Translation é o padrão de idioma**: valida em português, responde
    em inglês. Deve ficar num trecho **isolado e substituível** do prompt
    (vira configuração na Demanda 8).

## 🚧 Deploy em produção — PENDENTE, precisa de ajuda

> **Estado atual:** o projeto só roda local (Docker Compose) e é versionado no
> GitHub. **Nunca foi para produção.** Quando for a hora, este é um trabalho a
> ser feito com apoio — não assuma que está resolvido.

**Plataformas cogitadas:** Render ou Railway (ambas fazem deploy direto do
GitHub, sem servidor manual).

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
  — 30 testes em `apps/{accounts,curriculo,escolas}/tests.py`. Rode antes de
  commitar mudanças no domínio.

## ⚠️ Exports de animação do animador — como lidar

> O animador (Vitor) entrega o Kevin como um `export_N.zip` (SVG + motor JS +
> CSS + backgrounds). Ele **testa no ambiente dele e vê funcionar**, mas os
> exports chegam com defeitos que a exportação do Illustrator introduz. Guia
> completo para ele em `docs/animador.md`.

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
`docs/animador.md`) a tapar com CSS no nosso lado — senão cada entrega nova traz
o bug de volta. Correção CSS temporária é aceitável para não travar, mas registre
como dívida e cobre o animador.

**Nunca renomeie os IDs do SVG** — o motor encontra cada parte por `id`. Se rodar
SVGO, use `cleanupIds: false`.

## Kevin Animation System

**Architecture:** Three-layer modular system for SVG rigging and animation.

1. **KevinRig.js** — Core SVG control
   - Loads SVG from `static/css/animations/kevin-rigged.svg`
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
  svgUrl: "{% static 'css/animations/kevin-rigged.svg' %}",
  rigMountSelector: "#kevin-rig-mount",  // mounts to stage area in lesson page
};
window.KEVIN_CHAT_CONFIG = { ... };
```

**CSS:** `static/css/kevin-chat-animation.css` includes animations and stage styling

## Estado atual e próximos passos

> Atualizado em 24/07/2026. Status detalhado de cada demanda em
> `docs/demandas.md` (tabela "Panorama das demandas").

**Feito e validado:** remodelagem do currículo (D1), papéis (D2), prompt do
Kevin (D3), busca no catálogo (D6), motor de animação novo (D9A),
enquadramento (D10 parcial), ajustes do telão (D11), background por aula (D12),
seed oficial (D13), 30 testes automatizados (D14).

**Bloqueado esperando o cliente:**
- Métricas de professor (D4) — falta o **Yearly Plan Review** e o modelo de RMP
- Class Feedback (D5) — falta reunião de definição
- Popular o catálogo real — falta o **TG completo** (Games Bank + BeBooklet)

**Bloqueado esperando o animador:**
- SVG leve, `Pulso_bone1` no grupo certo, grupo `Mosca`, chão dos cenários
  (ver `docs/mensagens.md` seção 4 — bloco para o CLAUDE.md dele)

**Livre para fazer a qualquer momento:**
- Área da coordenação `/coordenacao/` (D7)
- Ajuste de piso por cenário (contorna o "Kevin na cama" sem depender do animador)
- Converter backgrounds para WebP (~2 MB → ~300 KB cada)
- Subir para produção (código pronto; falta bucket R2 e escolher plataforma)
