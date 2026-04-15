"""
Kevin - English Learning Platform
Flask backend serving API + static frontend
"""

import os
import json
import tempfile
import uuid
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory, render_template
from dotenv import load_dotenv
from openai import OpenAI
import requests as http_requests

load_dotenv()

app = Flask(__name__, static_folder='static', template_folder='templates')
app.secret_key = os.getenv("FLASK_SECRET_KEY", "kevin-dev-secret-2024")

# ============================================================
# CONFIG
# ============================================================

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID")
ELEVENLABS_MODEL = os.getenv("ELEVENLABS_MODEL")

client = None
if OPENAI_API_KEY and OPENAI_API_KEY != "sua-chave-aqui":
    client = OpenAI(api_key=OPENAI_API_KEY)

MOCK_USERS = {
    "professor@escola.com": {"password": "prof123", "role": "professor", "name": "Professor Demo"},
    "aluno@escola.com": {"password": "aluno123", "role": "aluno", "name": "Aluno Demo"},
    "admin@escola.com": {"password": "admin123", "role": "administrador", "name": "Admin Demo"},
}

CUSTOM_LESSONS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "custom_lessons.json")
AUDIT_LOGS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "audit_logs.json")

# ============================================================
# PROMPTS
# ============================================================

KEVIN_BASE_INSTRUCTION = """
Voce e um agente de I.A. educacional chamado Kevin.
Seu papel e atuar como assistente pedagogico e co-piloto do professor regente em turmas de Ensino Fundamental (Elementary School). O professor dita o ritmo, mas voce sugere os proximos passos e interage com as criancas quando acionado.

=== METODOLOGIA DA AULA ===
Toda aula segue estritamente tres momentos. Voce deve ajudar o professor a navegar por eles:

1. WARM UP (10-15 min): Preparacao e engajamento.
Sua funcao: Cumprimentar a turma de forma animada, ajudar na rotina inicial (musicas, calendario, sentimentos) e conduzir o jogo de revisao ou pratica inicial de forma rapida e ludica.

2. DEVELOPMENT (30-40 min): Foco principal da aula (Conteudo, Cultura, etc.).
Sua funcao: Introduzir o vocabulario e a gramatica do dia com clareza. Voce fara exercicios de repeticao (drills) com os alunos, fara perguntas curtas e ajudara o professor a modelar o uso correto do idioma.

3. CLOSURE (5-10 min): Encerramento.
Sua funcao: Ajudar a revisar o que foi aprendido de forma rapida, lembrar os alunos do dever de casa (homework) se houver, e conduzir a despedida (musica de bye-bye).

=== DIRETRIZES DE COMUNICACAO ===
- Publico: Criancas. Seja sempre animado, divertido, encorajador e paciente.
- Idioma: Priorize frases curtas e claras em ingles. Se algo puder gerar confusao, explique em portugues e retome em ingles. (Ex: "This is a dog. Dog e cachorro. Repeat: dog!").
- Postura: Voce NAO substitui o professor. Voce interage COM o professor e COM os alunos. Chame o professor de "Teacher".
- Ritmo: Nao de todas as instrucoes da aula de uma vez. Va passo a passo, aguardando a interacao do professor ou dos alunos antes de avancar para a proxima atividade ou fase da aula.
- Linguagem: Tornar instrucao e linguagem mais compativel com a estrutura da aula (nao utilize por exemplo participio do passado e estruturas ou vocabulario dificil em uma aula de vocabulario e proposta simples)
- Correcao dos alunos: Caso o aluno responda algo em portugues, diga aquilo que ele falou em ingles e peca-o para repetir, ou se voce notar que o aluno esta tendo dificuldade, ajude-o a melhorar, sempre usando a didatica de pronunciar a frase correta em ingles e pedindo a repeticao.

=== REGRAS CRITICAS SOBRE O PASSO A PASSO ===
- O "PASSO A PASSO" e as "Acoes" sao o seu ROTEIRO INTERNO. Eles descrevem O QUE voce deve fazer, NAO o que voce deve dizer literalmente.
- NUNCA leia as acoes em voz alta. NUNCA diga "Acao 1", "Acao 2", "FASE 1", "WARM UP", "DEVELOPMENT", "CLOSURE" ou qualquer marcacao do roteiro. Isso e invisivel para o Teacher e para os alunos.
- Em vez de ler o roteiro, EXECUTE a acao de forma natural e conversacional. Exemplo: se o roteiro diz "Diga Hello e peca para o Teacher colocar a musica", voce deve simplesmente dizer algo como "Hello everyone! Teacher, can you play our Hello song?".
- Faca APENAS UMA acao por vez. Apos executa-la, PARE e ESPERE o Teacher ou a turma responder antes de avancar para a proxima acao.
- Suas respostas devem ser CURTAS (2-4 frases no maximo). Voce esta falando com criancas em uma sala de aula real. Nao faca monologos e evite explicacoes sobre o que esta ensinando.
- NUNCA antecipe multiplas acoes em uma unica resposta. Uma mensagem = uma acao do roteiro.
"""

LESSON_SPECIFIC_CONTEXTS = {
    "year_2": {
        "week_1": {
            "class_1": """
=== CONTEXTO ESPECIFICO DESTA AULA (U1W1C2 - Content Class) ===

OBJETIVOS: Fazer perguntas com "What's" e usar "a/an".
VOCABULARIO: Clock, window, board, desk, picture, chair, notebook, backpack.
GRAMATICA: "What's this? It's a/an...".

PASSO A PASSO PARA O KEVIN CONDUZIR (Aguarde a resposta do Teacher ou da turma antes de pular de um passo para outro):

[ FASE 1: WARM UP ]
- Acao 1: Diga um "Hello" bem animado e peca para o Teacher colocar a musica "Hello!".
- Acao 2: Apos a musica, conduza uma revisao rapida (Tim's Game) usando o vocabulario da aula. Faca 3 perguntas rapidas para a turma tentar adivinhar qual e o objeto.

[ FASE 2: DEVELOPMENT ]
- Acao 1: Peca atencao da turma. Introduza a estrutura gramatical falando: "Look! What's this? It's a backpack!". Peca para a turma repetir.
- Acao 2: Sugira ao Teacher apontar para objetos reais na sala (window, board, desk, chair) para fazer a pratica de repeticao (Drills) com a turma, usando a estrutura "What's this? It's a...". Ajude a validar as respostas das criancas elogiando-as ("Great job!", "Exactly!").
- Acao 3: Lembre o Teacher de abrir o livro 'Share It!' na Unidade 1, Licao 2 para as atividades de Listening e Grammar Practice.

[ FASE 3: CLOSURE ]
- Acao 1: Se houver TV na sala, lembre o Teacher de passar o Grammar Video.
- Acao 2: Ajude o Teacher a passar o dever de casa: "Integrated Activities, Unit 1, exercises 1 and 2". Explique brevemente em portugues para garantir que os alunos entendam.
- Acao 3: Despeca-se da turma de forma calorosa e peca para o Teacher tocar a musica "See You Later, Alligator"."""
        }
    }
}

# ============================================================
# HELPERS
# ============================================================

def load_custom_lessons():
    if os.path.exists(CUSTOM_LESSONS_FILE):
        with open(CUSTOM_LESSONS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}

def save_custom_lessons(lessons):
    with open(CUSTOM_LESSONS_FILE, "w", encoding="utf-8") as f:
        json.dump(lessons, f, ensure_ascii=False, indent=2)

def load_audit_logs():
    if os.path.exists(AUDIT_LOGS_FILE):
        with open(AUDIT_LOGS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return []

def save_audit_logs(logs):
    with open(AUDIT_LOGS_FILE, "w", encoding="utf-8") as f:
        json.dump(logs, f, ensure_ascii=False, indent=2)

def get_lesson_context(year, week, class_num):
    specific_context = None
    try:
        specific_context = LESSON_SPECIFIC_CONTEXTS[f"year_{year}"][f"week_{week}"][f"class_{class_num}"]
    except KeyError:
        pass
    if specific_context is None:
        custom_lessons = load_custom_lessons()
        key = f"U{year}W{week}C{class_num}"
        if key in custom_lessons:
            specific_context = custom_lessons[key]["prompt"]
    if specific_context is None:
        return None
    return f"{KEVIN_BASE_INSTRUCTION}\n\n=== CONTEXTO ESPECIFICO DESTA AULA ===\n{specific_context}"

def build_lesson_prompt(code, objetivos, vocabulario, gramatica, warmup_actions, development_actions, closure_actions):
    prompt = f"""=== CONTEXTO ESPECIFICO DESTA AULA ({code} - Content Class) ===

OBJETIVOS: {objetivos}
VOCABULARIO: {vocabulario}
GRAMATICA: {gramatica}

PASSO A PASSO PARA O KEVIN CONDUZIR (Aguarde a resposta do Teacher ou da turma antes de pular de um passo para outro):

[ FASE 1: WARM UP ]
"""
    for i, action in enumerate(warmup_actions, 1):
        prompt += f"- Acao {i}: {action}\n"
    prompt += "\n[ FASE 2: DEVELOPMENT ]\n"
    for i, action in enumerate(development_actions, 1):
        prompt += f"- Acao {i}: {action}\n"
    prompt += "\n[ FASE 3: CLOSURE ]\n"
    for i, action in enumerate(closure_actions, 1):
        prompt += f"- Acao {i}: {action}\n"
    return prompt

# ============================================================
# ROUTES - PAGES
# ============================================================

@app.route('/')
def index():
    return render_template('index.html')

# ============================================================
# ROUTES - API
# ============================================================

@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.json
    email = data.get('email', '')
    password = data.get('password', '')
    role = data.get('role', '')
    if email in MOCK_USERS and MOCK_USERS[email]["password"] == password and MOCK_USERS[email]["role"] == role:
        user = MOCK_USERS[email]
        return jsonify({"success": True, "user": {"email": email, "name": user["name"], "role": role}})
    return jsonify({"success": False, "error": "Credenciais incorretas."}), 401

@app.route('/api/lessons/available', methods=['GET'])
def api_available_units():
    units = set()
    for key in LESSON_SPECIFIC_CONTEXTS:
        units.add(int(key.replace("year_", "")))
    custom_lessons = load_custom_lessons()
    for code in custom_lessons:
        unit_num = int(code.split("W")[0].replace("U", ""))
        units.add(unit_num)
    return jsonify({"units": sorted(units)})

@app.route('/api/lessons/unit/<int:unit>', methods=['GET'])
def api_unit_lessons(unit):
    available = {}
    year_key = f"year_{unit}"
    if year_key in LESSON_SPECIFIC_CONTEXTS:
        for week_key, classes in LESSON_SPECIFIC_CONTEXTS[year_key].items():
            week_num = week_key.replace("week_", "")
            if week_num not in available:
                available[week_num] = []
            for class_key in classes:
                class_num = class_key.replace("class_", "")
                if class_num not in available[week_num]:
                    available[week_num].append(class_num)
    custom_lessons = load_custom_lessons()
    for key in custom_lessons:
        if key.startswith(f"U{unit}W"):
            parts_w = key.split("W")[1]
            week_num = parts_w.split("C")[0]
            class_num = parts_w.split("C")[1]
            if week_num not in available:
                available[week_num] = []
            if class_num not in available[week_num]:
                available[week_num].append(class_num)
    for w in available:
        available[w] = sorted(available[w], key=int)
    sorted_available = dict(sorted(available.items(), key=lambda x: int(x[0])))
    return jsonify({"unit": unit, "weeks": sorted_available})

@app.route('/api/chat', methods=['POST'])
def api_chat():
    if not client:
        return jsonify({"error": "API nao conectada."}), 503
    data = request.json
    user_message = data.get('message', '')
    year = data.get('year')
    week = data.get('week')
    class_num = data.get('class_num')
    history = data.get('history', [])

    context = get_lesson_context(str(year), str(week), str(class_num))
    if not context:
        return jsonify({"error": "Aula nao encontrada."}), 404

    messages = [{"role": "system", "content": context}]
    for m in history[-10:]:
        messages.append({"role": m["role"], "content": m["content"]})
    messages.append({"role": "user", "content": user_message})

    try:
        response = client.chat.completions.create(model="gpt-5.4-nano", messages=messages, temperature=0.7)
        reply = response.choices[0].message.content
        return jsonify({"reply": reply})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/tts', methods=['POST'])
def api_tts():
    if not ELEVENLABS_API_KEY:
        return jsonify({"error": "TTS nao configurado."}), 503
    data = request.json
    text = data.get('text', '')
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{ELEVENLABS_VOICE_ID}"
    headers = {"Accept": "audio/mpeg", "xi-api-key": ELEVENLABS_API_KEY, "Content-Type": "application/json"}
    payload = {"text": text, "model_id": ELEVENLABS_MODEL, "voice_settings": {"stability": 0.5, "similarity_boost": 0.75}}
    try:
        resp = http_requests.post(url, json=payload, headers=headers)
        if resp.status_code == 200:
            return resp.content, 200, {'Content-Type': 'audio/mpeg'}
        print(f"[TTS ERROR] ElevenLabs status={resp.status_code} body={resp.text}")
        return jsonify({"error": f"TTS falhou ({resp.status_code}): {resp.text}"}), 502
    except Exception:
        return jsonify({"error": "Erro no TTS."}), 500

@app.route('/api/stt', methods=['POST'])
def api_stt():
    if not client:
        return jsonify({"error": "API nao conectada."}), 503
    if 'audio' not in request.files:
        return jsonify({"error": "Nenhum audio enviado."}), 400
    audio_file = request.files['audio']
    try:
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            audio_file.save(tmp.name)
            tmp_path = tmp.name
        with open(tmp_path, "rb") as f:
            transcript = client.audio.transcriptions.create(
                model="whisper-1",
                file=f,
                prompt="This is a bilingual English and Portuguese classroom. Transcribe exactly what is said, keeping English in English and Portuguese in Portuguese. Do not translate.",
            )
        os.unlink(tmp_path)
        return jsonify({"text": transcript.text})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/status', methods=['GET'])
def api_status():
    return jsonify({
        "openai": client is not None,
        "elevenlabs": ELEVENLABS_API_KEY is not None and ELEVENLABS_API_KEY != "",
    })

# Admin endpoints
@app.route('/api/admin/lessons', methods=['GET'])
def api_admin_list_lessons():
    return jsonify(load_custom_lessons())

@app.route('/api/admin/lessons', methods=['POST'])
def api_admin_add_lesson():
    data = request.json
    unit = data.get('unit')
    week = data.get('week')
    class_num = data.get('class_num')
    code = f"U{unit}W{week}C{class_num}"

    prompt = build_lesson_prompt(
        code, data.get('objetivos', ''), data.get('vocabulario', ''), data.get('gramatica', ''),
        data.get('warmup', []), data.get('development', []), data.get('closure', [])
    )
    custom_lessons = load_custom_lessons()
    custom_lessons[code] = {
        "unit": unit, "week": week, "class": class_num,
        "objetivos": data.get('objetivos', ''),
        "vocabulario": data.get('vocabulario', ''),
        "gramatica": data.get('gramatica', ''),
        "warmup": data.get('warmup', []),
        "development": data.get('development', []),
        "closure": data.get('closure', []),
        "prompt": prompt
    }
    save_custom_lessons(custom_lessons)
    return jsonify({"success": True, "code": code, "prompt": prompt})

@app.route('/api/admin/lessons/<code>', methods=['DELETE'])
def api_admin_delete_lesson(code):
    custom_lessons = load_custom_lessons()
    if code in custom_lessons:
        del custom_lessons[code]
        save_custom_lessons(custom_lessons)
        return jsonify({"success": True})
    return jsonify({"error": "Aula nao encontrada."}), 404

# Audit log endpoints
@app.route('/api/audit/save', methods=['POST'])
def api_audit_save():
    data = request.json
    log_entry = {
        "id": str(uuid.uuid4()),
        "timestamp": datetime.now().isoformat(),
        "user": data.get('user', {}),
        "lesson": data.get('lesson', {}),
        "messages": data.get('messages', []),
    }
    logs = load_audit_logs()
    logs.append(log_entry)
    save_audit_logs(logs)
    return jsonify({"success": True, "id": log_entry["id"]})

@app.route('/api/audit/logs', methods=['GET'])
def api_audit_list():
    logs = load_audit_logs()
    # Return summary list (without full messages) for the list view
    summaries = []
    for log in logs:
        summaries.append({
            "id": log["id"],
            "timestamp": log["timestamp"],
            "user": log.get("user", {}),
            "lesson": log.get("lesson", {}),
            "message_count": len(log.get("messages", [])),
        })
    summaries.reverse()  # newest first
    return jsonify(summaries)

@app.route('/api/audit/logs/<log_id>', methods=['GET'])
def api_audit_detail(log_id):
    logs = load_audit_logs()
    for log in logs:
        if log["id"] == log_id:
            return jsonify(log)
    return jsonify({"error": "Log nao encontrado."}), 404

@app.route('/api/audit/logs/<log_id>', methods=['DELETE'])
def api_audit_delete(log_id):
    logs = load_audit_logs()
    logs = [l for l in logs if l["id"] != log_id]
    save_audit_logs(logs)
    return jsonify({"success": True})

if __name__ == '__main__':
    app.run(debug=True, port=5000)
