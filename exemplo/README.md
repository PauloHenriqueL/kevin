# Kevin - English Learning Platform

Plataforma educacional de ingles com IA, interface de voz (OpenAI + ElevenLabs) e mascote animado Kevin.

---

## Estrutura do Projeto

```
kevin/
├── server.py              # Backend Flask (API REST)
├── templates/
│   └── index.html         # Pagina principal (SPA)
├── static/
│   ├── css/style.css      # Estilos do app
│   └── js/
│       ├── app.js         # Logica do frontend
│       └── kevin-widget.js # Mascote Kevin animado (SVG)
├── animacoes/
│   └── kevin-widget.js    # Arquivo original das animacoes
├── custom_lessons.json    # Aulas customizadas (persistencia)
├── requirements.txt       # Dependencias Python
└── .env                   # Chaves de API (nao versionado)
```

---

## Como rodar o projeto

### 1. Instale o Python

Baixe em [python.org/downloads](https://www.python.org/downloads/) (3.9+).
Marque **"Add Python to PATH"** durante a instalacao.

### 2. Baixe o projeto

```bash
git clone https://github.com/arthurbpinho/kevin.git
cd kevin/kevin
```

### 3. Crie o ambiente virtual e instale dependencias

```bash
python -m venv .venv
```

Ative o ambiente:

- **Windows:** `.venv\Scripts\activate`
- **Mac/Linux:** `source .venv/bin/activate`

Instale as dependencias:

```bash
pip install -r requirements.txt
```

### 4. Configure as chaves de API

Crie um arquivo `.env` na raiz do projeto:

```
OPENAI_API_KEY=sua_chave_openai_aqui
ELEVENLABS_API_KEY=sua_chave_elevenlabs_aqui
ELEVENLABS_VOICE_ID=seu_voice_id_aqui
ELEVENLABS_MODEL=seu_modelo_aqui
```

- **OpenAI:** [platform.openai.com](https://platform.openai.com/)
- **ElevenLabs:** [elevenlabs.io](https://elevenlabs.io/)

### 5. Execute

```bash
python server.py
```

Acesse **http://localhost:5000** no navegador.

---

## Credenciais de teste

| Perfil | E-mail | Senha |
|---|---|---|
| Professor | `professor@escola.com` | `prof123` |
| Aluno | `aluno@escola.com` | `aluno123` |
| Admin | `admin@escola.com` | `admin123` |

---

## Funcionalidades

- **Chat com Kevin** - IA educacional com voz (OpenAI GPT + ElevenLabs TTS)
- **Kevin animado** - Mascote SVG com expressoes: feliz, surpreso, pensativo, falando
- **Aulas estruturadas** - Warm Up, Development, Closure
- **Painel admin** - Criar e gerenciar aulas customizadas
- **Microfone** - Speech-to-text via OpenAI Whisper
- **Design infantil** - Interface colorida e intuitiva para criancas

---

## Resumo rapido

```bash
git clone https://github.com/arthurbpinho/kevin.git
cd kevin/kevin
python -m venv .venv
source .venv/bin/activate   # Linux/Mac
pip install -r requirements.txt
# crie o arquivo .env com suas chaves
python server.py
```
