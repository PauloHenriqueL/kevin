FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Reúne os estáticos em STATIC_ROOT para o WhiteNoise servir em produção.
# SECRET_KEY dummy: o settings exige a variável para importar, mas collectstatic
# não usa criptografia — a chave real vem do ambiente em runtime.
RUN DEBUG=False SECRET_KEY=build-only-nao-usar \
    python manage.py collectstatic --noinput --clear
