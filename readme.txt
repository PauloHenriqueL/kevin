═══════════════════════════════════════════════════════════════════
                 KEVIN — como rodar no seu PC
═══════════════════════════════════════════════════════════════════

URL da aplicação:   http://localhost:8000
Credenciais demo:   maria / prof123       (professora)
                    carlos / dir123       (diretor)
                    admin / admin123      (superusuário → /admin/)


───────────────────────────────────────────────────────────────────
 ROTINA DO DIA-A-DIA — após reiniciar o PC
───────────────────────────────────────────────────────────────────

Abra um terminal e rode:

    cd ~/Projetos/kevin2
    docker compose up -d

Aguarde ~5 segundos e abra http://localhost:8000 no navegador.

Pronto. Tudo que é preciso.

Se o Docker não estiver rodando no host, inicie com:

    sudo systemctl start docker

(Para subir sozinho no boot, uma vez só:
    sudo systemctl enable docker )


───────────────────────────────────────────────────────────────────
 COMANDOS ÚTEIS
───────────────────────────────────────────────────────────────────

Ver status dos containers:
    docker compose ps

Ver logs ao vivo (Ctrl+C pra sair):
    docker compose logs -f web          # Django
    docker compose logs -f celery       # worker Celery (IA, TTS, STT)

Parar tudo (mantém o banco de dados intacto):
    docker compose down

Parar E apagar o banco (reset completo):
    docker compose down -v

Depois de mexer em models.py ou .env — sempre reinicie ambos:
    docker compose restart web celery

Aplicar migrações manualmente:
    docker compose exec web python manage.py migrate

Recriar dados de demo (usuários, turmas, aulas):
    docker compose exec web python manage.py seed

Abrir shell Django:
    docker compose exec web python manage.py shell


───────────────────────────────────────────────────────────────────
 PRIMEIRA VEZ QUE FOR USAR ESTE REPO (setup inicial)
───────────────────────────────────────────────────────────────────

Requisitos do sistema:
  - Docker Engine + Docker Compose v2
  - Usuário no grupo docker ("sudo usermod -aG docker $USER", depois logout/login)

Subir pela primeira vez (faz build das imagens):

    cd ~/Projetos/kevin2
    cp .env.example .env                # se ainda não existe
    docker compose up -d --build
    docker compose exec web python manage.py migrate
    docker compose exec web python manage.py seed


───────────────────────────────────────────────────────────────────
 CONFIGURAR AS CHAVES DE IA (ElevenLabs / OpenAI / Anthropic)
───────────────────────────────────────────────────────────────────

As chaves ficam no Plano da escola, não no .env. Edite em:

    http://localhost:8000/admin/escolas/plano/

(login como admin / admin123)

Campos do plano "Básico":
  - ia_api_key       → chave da Anthropic ou OpenAI (chat do Kevin)
  - stt_api_key      → chave da OpenAI (transcrição Whisper)
  - tts_api_key      → chave da ElevenLabs
  - tts_voice_id     → voice_id específico no ElevenLabs (ex: 21m00Tcm4TlvDq8ikWAM)
  - tts_modelo       → eleven_multilingual_v2 (padrão) ou o que você usar


───────────────────────────────────────────────────────────────────
 PROBLEMAS COMUNS
───────────────────────────────────────────────────────────────────

• "permission denied while trying to connect to the docker API"
  → Seu usuário não está no grupo docker. Rode:
       sudo usermod -aG docker $USER
     e faça LOGOUT/LOGIN (ou reinicie).

• "port is already allocated"
  → Outra coisa está usando a porta 8000, 5432 ou 6379.
     Descubra o que é: sudo lsof -iTCP:8000 -sTCP:LISTEN
     E pare o processo (ou edite docker-compose.yml pra usar outra porta).

• Kevin fica "pensando infinitamente" no chat de texto
  → Celery worker está travado. Reinicie:
       docker compose restart celery

• Mudei o código e não reflete
  → Templates/CSS/JS: hard-refresh no browser (Ctrl+Shift+R).
     Python (views, models): runserver recarrega sozinho, mas se mexeu em
     models ou celery tasks, rode: docker compose restart web celery

• Mexi em models.py e aparece erro "column does not exist"
  → Gere e aplique migração:
       docker compose exec web python manage.py makemigrations
       docker compose exec web python manage.py migrate
       docker compose restart web celery
