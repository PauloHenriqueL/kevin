FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# poppler-utils: o pdftotext usado por `manage.py importar_catalogo_tg` para
# ler o Games Bank do TG em PDF (ver D30 em docs/demandas.md).
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc poppler-utils && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Reúne os estáticos em STATIC_ROOT para o WhiteNoise servir em produção.
# SECRET_KEY dummy: o settings exige a variável para importar, mas collectstatic
# não usa criptografia — a chave real vem do ambiente em runtime.
RUN DEBUG=False SECRET_KEY=build-only-nao-usar \
    python manage.py collectstatic --noinput --clear

# Comando padrão de produção. No dev, o docker-compose sobrescreve com runserver.
# $PORT é injetado pela plataforma (Render/Railway); cai em 8000 fora dela.
# release: migrar antes de subir é responsabilidade do render.yaml (preDeploy).
EXPOSE 8000
CMD ["sh", "-c", "gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers 3 --timeout 120"]
