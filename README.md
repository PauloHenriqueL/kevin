# Bebelingue / Kevin

Plataforma SaaS de ensino de inglês para crianças, vendida para escolas
franqueadas. A **Bebelingue** é a fornecedora (metodologia, currículo e
material); a **escola** é a cliente. O **Kevin** é um personagem animado,
projetado no telão da sala, que conversa com o professor por texto e voz.

**Produção:** https://kevin-qv84.onrender.com

---

## Rodar na sua máquina (Docker)

```bash
git clone https://github.com/PauloHenriqueL/kevin.git
cd kevin
cp .env.example .env
docker compose up --build      # sobe db, redis, web, celery
```

Em outro terminal, na primeira vez:

```bash
docker compose exec web python manage.py migrate
docker compose exec web python manage.py seed_demo
```

App em http://localhost:8000

### Usuários criados pelo `seed_demo`

| Usuário | Senha | Papel | Onde cai |
|---|---|---|---|
| `admin` | `admin123` | superusuário | `/admin/` |
| `coord` | `coord123` | coordenador Bebelingue | `/coordenacao/` |
| `carlos` | `dir123` | diretor da escola | `/gestao/` |
| `maria` | `prof123` | professor | `/professor/` |

Entre como **`maria`** para ver o Kevin: Year 5 → turma → uma das 4 aulas de
vitrine → **Iniciar aula**.

> Mudou só CSS ou JS? Não precisa reiniciar nada — **Ctrl+Shift+R** no
> navegador. Mudou Python? `docker compose restart web`.

---

## ⚠️ O Kevin vai aparecer sem cenário — e isso é esperado

A mídia do Kevin (cenários, vídeos, áudios, imagens de vocabulário — 29 MB)
**não está no Git**, de propósito: o Git guarda cada versão de binário para
sempre, sem delta, e três entregas do animador virariam ~60 MB permanentes no
histórico mesmo depois de apagados.

Então, depois do `git clone`, estes diretórios vêm **vazios**:

```
static/js/kevin-puppet/assets/backgrounds/     7 cenários .webp
static/js/kevin-puppet/assets/videos/          entrada e transição .webm
static/js/kevin-puppet/assets/audio/           trilha, celebrate, ronco .mp3
static/js/kevin-puppet/assets/obj/             quadro-negro .png
static/js/kevin-puppet/assets/img/vocabulario/ 15 cartões .png
```

O sistema **sobe e funciona sem eles** — o Kevin anima, o chat responde, a aula
abre. O que falta é o visual: fundo branco, sem trilha, sem animação de entrada.

**Para ter a mídia:** peça o `export_N.zip` do animador ao Paulo, extraia, e
copie as pastas `assets/` para o caminho acima. O procedimento completo está no
[CLAUDE.md](CLAUDE.md), seção "Como INSTALAR um export novo".

> Em breve isso deixa de ser manual: os assets vão para um bucket público
> (Demanda 19 em [docs/demandas.md](docs/demandas.md)).

---

## Sem Docker

```bash
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# No .env: descomente DB_ENGINE=sqlite, ou aponte DB_HOST=localhost
python manage.py migrate
python manage.py seed_demo
python manage.py runserver
```

O chat assíncrono precisa de Redis e de um worker:

```bash
celery -A config worker -l info
```

Sem Celery o chat ainda funciona em modo síncrono (`?sync=1` na chamada).

---

## Stack

| | |
|---|---|
| Backend | Django 6 + Django REST Framework |
| Banco | PostgreSQL (16 em dev, 18 em produção no Neon) |
| Fila | Celery + Redis |
| Auth | Sessão + SimpleJWT, redirect por papel no login |
| IA / Voz | Providers plugáveis: Anthropic ou OpenAI (chat), ElevenLabs ou OpenAI (TTS), Whisper ou Google (STT) |
| Frontend | Templates Django + CSS próprio + JS vanilla (sem framework) |
| Animação | SVG riggado + motor próprio (`static/js/kevin-puppet/`) |
| Infra dev | Docker Compose: `db`, `redis`, `web`, `celery` |
| Produção | Render (web, plano Starter, região Ohio) + Neon (Postgres serverless) |

---

## Papéis e áreas

| Papel | Quem é | Área | Pode |
|---|---|---|---|
| `admin` | Bebelingue (técnico) | `/admin/` | Tudo, inclusive chaves de API e planos |
| `coordenador` | Bebelingue (pedagógico) | `/coordenacao/` | Cadastrar TG, aulas e catálogo oficial; ver todas as escolas |
| `diretor` | Escola cliente | `/gestao/` | Professores e turmas **da própria escola** |
| `professor` | Escola cliente | `/professor/` | Suas turmas, usar o Kevin, criar atividade **local** |

**Quem cria aula e catálogo é a coordenação da Bebelingue.** O professor só vê
e executa — não edita o currículo. Isso é regra de negócio, não detalhe de
implementação: o TG é global e a mesma aula serve todas as escolas.

O aluno **não tem login** e não existe como entidade — a turma guarda só o
`qtd_alunos`.

---

## Modelo de dados

```
Plano 1─N Escola 1─N Serie N─1 TG 1─N Aula 1─N BlocoAula N─1 Atividade
                     │                    │
                     └─N Turma ───────────┴─N AulaTurma   (execução: data, professor)
                          │
Professor 1─N Turma       └─ qtd_alunos (headcount; não há modelo Aluno)

Professor 1─N Conversa 0─1 Aula
Conversa 1─N Mensagem
```

- **`TG`** é o cronograma global da Bebelingue (ex: "TG 3x — Year 5"). 3x, 4x e
  5x são TGs **diferentes**, não variações do mesmo.
- **`Serie`** é o segmento da escola (nome livre, ex: "Fundamental") e aponta
  para um TG. A turma segue o TG da série.
- **`Aula`** é endereçada por `Year + Unit + Semana + Aula` — o código
  `Y5-U1W1C1`, que é o impresso no TG.
- **`Aula` é o plano; `AulaTurma` é a execução.** Tabelas separadas porque
  feriado e reposição são normais.
- **`Atividade`** é o catálogo. `escola = NULL` significa catálogo oficial da
  Bebelingue; preenchido, é atividade local daquela escola.
- **Progresso é da turma, nunca do aluno.**

---

## Comandos do dia a dia

```bash
docker compose up -d                                        # sobe tudo
docker compose restart web                                  # após mudar Python
docker compose exec web python manage.py test               # 72 testes
docker compose exec web python manage.py seed_demo          # dados de vitrine
docker compose exec web python manage.py flush --no-input   # zera o banco
python3 scripts/validar_export.py <pasta-export>/           # valida entrega do animador
```

Antes de commitar: `manage.py check` limpo e a suíte passando.

---

## Variáveis de ambiente

Tudo em `.env` (não versionado — copie de `.env.example`).

As chaves de IA (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `ELEVENLABS_API_KEY`)
são **opcionais em dev**: sem elas o chat sobe e responde em modo demo, sem IA
real nem voz.

⚠️ Se você definir `DATABASE_URL`, ela tem **prioridade** sobre as `DB_*` — é
assim que se aponta para o banco de produção. Cuidado: com ela preenchida,
todo `manage.py` que você rodar mexe em produção.

---

## Onde está cada coisa

| Arquivo | O que é |
|---|---|
| [CLAUDE.md](CLAUDE.md) | **Leia antes de mexer.** Regras de negócio, workflow, armadilhas conhecidas |
| [docs/demandas.md](docs/demandas.md) | Fonte de verdade do escopo: demandas e decisões (D1–D41) |
| [docs/MOTOR_KEVIN.md](docs/MOTOR_KEVIN.md) | Como o motor de animação funciona |
| [docs/mensagem.md](docs/mensagem.md) | Contrato com o animador (o que o export precisa ter) |
| [docs/ROTEIRO_APRESENTACAO.md](docs/ROTEIRO_APRESENTACAO.md) | Roteiro para demonstrar o sistema |
| `scripts/validar_export.py` | Valida um export do animador antes de instalar |
| `exemplo/` | Protótipo descartável — **não é produção, não é referência** |

---

## Convenções

- **Português** em código, comentários, UI e mensagens de commit
- CSS próprio com variáveis em `:root`, sem framework
- **O prompt do Kevin vive só em `apps/chat/`** (`SYSTEM_PROMPT_BASE` em
  `tasks.py`). Nunca em `exemplo/`
- **Nunca renomeie os IDs do `kevin-rigged.svg`** — o motor encontra cada parte
  do personagem por `id`. Se rodar SVGO, use `cleanupIds: false`
- Não commitar: `export_*.zip`, backgrounds, vídeos, `documento_escola/`
