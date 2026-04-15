# Bebelingue / Kevin

Plataforma SaaS de ensino de idiomas para crianças, vendida para franqueados ("Escolas"). Inclui gestão de turmas, currículo fixo de aulas, biblioteca comunitária de conteúdos e um assistente de IA chamado **Kevin** que conversa com os professores por texto e voz.

## Stack

- **Backend:** Django 6 + Django REST Framework
- **Banco:** PostgreSQL 16
- **Fila:** Celery + Redis
- **Auth:** SimpleJWT + Session (login redireciona por role)
- **IA / Voz:** providers plugáveis — Anthropic / OpenAI (chat), ElevenLabs / OpenAI (TTS), Whisper / Google (STT)
- **Infra dev:** Docker Compose (4 containers: `db`, `redis`, `web`, `celery`)

## Estrutura

```
apps/
  accounts/    # User custom (AbstractUser + role), auth, middleware
  escolas/     # Escola, Plano, Diretor, Professor, Turma, Aluno + áreas /gestao/ e /professor/
  curriculo/   # Aula, Conteudo, AulaConteudo, ProgressoTurma, Homework
  chat/        # Conversa, Mensagem, providers de IA/TTS/STT, tasks Celery
config/        # settings, urls, celery, wsgi/asgi
templates/     # templates Django
static/        # css, js, imagens
exemplo/       # referência visual (paleta/estilo) usada como base do design
```

### Roles e áreas

| Role        | URL          | O que faz                                                                 |
|-------------|--------------|---------------------------------------------------------------------------|
| Admin       | `/admin/`    | Django admin completo (apenas superusuário)                              |
| Diretor     | `/gestao/`   | CRUD de professor/turma/aluno (sem delete), relatórios de progresso       |
| Professor   | `/professor/`| Year → Turma → Aula + chat lateral com Kevin, marcar aula concluída, áudio |

## Como rodar (Docker — recomendado)

```bash
git clone <repo>
cd Kevin
cp .env.example .env          # ajuste se necessário
docker compose up --build     # sobe db, redis, web, celery
```

Em outro terminal, na primeira vez:

```bash
docker compose exec web python manage.py migrate
docker compose exec web python manage.py seed_demo   # dados de teste
```

App em http://localhost:8000

### Usuários de teste (após `seed_demo`)

| Usuário  | Senha     | Role      |
|----------|-----------|-----------|
| admin    | admin123  | superuser |
| carlos   | dir123    | diretor   |
| maria    | prof123   | professor |

## Como rodar sem Docker

```bash
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Em .env: descomente as linhas DB_ENGINE=sqlite e comente as do PostgreSQL,
# ou aponte DB_HOST=localhost para um Postgres local.
python manage.py migrate
python manage.py seed_demo
python manage.py runserver
```

Para o chat assíncrono funcionar localmente é preciso Redis + um worker Celery:

```bash
celery -A config worker -l info
```

## Variáveis de ambiente

Veja `.env.example`. As chaves de IA (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `ELEVENLABS_API_KEY`) são opcionais em dev — sem elas o chat do Kevin sobe mas não responde de verdade.

## Modelo de dados (resumo)

```
Plano 1─N Escola 1─N Professor 1─N Turma 1─N Aluno
                    └─N Turma 1─N ProgressoTurma N─1 Aula
Aula N─N Conteudo (via AulaConteudo, com ordem)
Aula 1─N Homework
Professor 1─N Conversa 0─1 Aula
Conversa 1─N Mensagem (role user/assistant, tipo texto/audio)
```

Decisões já fechadas:
- Currículo é **fixo**, definido pela Bebelingue (não pelo professor).
- Aluno pertence a **uma** turma (sem M:N).
- Conteúdo é **comunitário** — qualquer professor cria, qualquer aula pode incluir.
- Progresso é **por turma**, não por aluno.
- Chat é **só de professor**; alunos não interagem com o Kevin.
- Modelo de IA e provedor de TTS ficam no `Plano` da escola, não em entidades separadas.

## O que está pronto

- Models, migrations e admin de todas as entidades acima
- Auth com 3 roles e redirect por role no login
- Áreas `/gestao/` (diretor) e `/professor/` completas
- Página da aula com conteúdos + chat Kevin lateral + gravação de áudio
- Providers plugáveis de IA / TTS / STT
- Celery tasks `processar_mensagem_ia`, `processar_audio_ia`
- Seed de dados de teste

## O que falta

- [ ] Plugar chaves reais e testar o chat do Kevin ponta-a-ponta
- [ ] Resposta do Kevin com TTS (botão "ouvir")
- [ ] Deploy de produção (HTTPS, domínio, S3/R2 para mídia)
- [ ] Polimentos de UI conforme feedback

## Convenções

- Mensagens de commit e código em **português** (UI inclusive).
- Visual: paleta azul Kevin `#2B7DE9`, fonte Nunito, estilo infantil — referência em [exemplo/](exemplo/).
- Não mexer em integração de IA sem chaves reais em mãos.
