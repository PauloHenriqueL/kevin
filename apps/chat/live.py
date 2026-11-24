"""Modo ao vivo (GPT Live / Realtime) — teste da D69 e da latência.

O áudio NÃO passa pelo nosso servidor: o navegador do telão fala direto com a
OpenAI por WebRTC, autenticado por um token efêmero que este módulo pede. O
Render só entra para (1) emitir o token, (2) executar as ferramentas do Kevin
e (3) gravar a transcrição no histórico. Por isso a região e a CPU do Render
não pesam no tempo de resposta do Kevin neste modo.

Duas vozes, para comparar:
- `openai`: fala a fala (speech-to-speech), voz da própria OpenAI. É o caminho
  mais rápido, mas não é a voz do Kevin.
- `kevin`: o modelo responde em TEXTO, e o telão manda o texto, conforme vai
  chegando, para o WebSocket de streaming da ElevenLabs com a voz do Kevin.

Prompt e ferramentas são os mesmos do modo tradicional (fonte única: tasks.py
e ferramentas.py); aqui só se acrescenta o trecho sobre falar em tempo real.
"""
import json

import httpx
from django.conf import settings

from .ferramentas import ferramentas_do_modo
from .tasks import _montar_contexto

MODELOS = ('gpt-realtime-2.1', 'gpt-realtime-2.1-mini', 'gpt-realtime-2', 'gpt-realtime')
VOZES = ('openai', 'kevin')
VOZES_OPENAI = ('marin', 'cedar', 'alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse')
# Modelo de baixa latência da ElevenLabs para o streaming (TTFB medido: ~0,3 s
# contra ~0,5 s do multilingual_v2 em /stream e ~1,3 s do MP3 inteiro).
ELEVENLABS_MODELO_STREAM = 'eleven_flash_v2_5'

TRECHO_AO_VIVO = """=== MODO AO VIVO (voz em tempo real) ===
Você está falando em tempo real com a sala: o que você diz é ouvido na hora.
- Fale de forma natural e curta: 1 a 3 frases por vez. Depois, pare e espere.
- Palavras e frases em inglês saem com pronúncia de inglês nativo; o resto, em português do Brasil.
- Use as ferramentas junto com a fala, nunca no lugar dela."""

TRECHO_VOZ_KEVIN = """- Sua resposta em texto vira a voz do Kevin: escreva só o que deve ser falado, sem emojis, listas, asteriscos ou colchetes."""


class LiveIndisponivel(Exception):
    """Plano sem chave OpenAI ou falha ao pedir o token."""


def chave_openai(plano) -> str:
    """O Live é da OpenAI: usa a chave de IA se o provedor for OpenAI, senão a do Whisper."""
    if plano.ia_provider == 'openai' and plano.ia_api_key:
        return plano.ia_api_key
    if plano.stt_provider == 'openai_whisper' and plano.stt_api_key:
        return plano.stt_api_key
    raise LiveIndisponivel('O plano não tem chave da OpenAI.')


def ferramentas_realtime(conversa) -> list[dict]:
    return [
        {'type': 'function', 'name': f.nome, 'description': f.descricao, 'parameters': f.parametros}
        for f in ferramentas_do_modo(conversa.modo)
    ]


def instrucoes(conversa, voz: str) -> str:
    partes = [_montar_contexto(conversa), TRECHO_AO_VIVO]
    if voz == 'kevin':
        partes.append(TRECHO_VOZ_KEVIN)
    return '\n\n'.join(partes)


def config_sessao(conversa, voz: str, modelo: str, voz_openai: str) -> dict:
    """Sessão realtime. Microfone fechado (D62): sem detecção de turno no servidor;
    o telão fecha o turno quando o professor solta o botão de falar."""
    return {
        'type': 'realtime',
        'model': modelo,
        'instructions': instrucoes(conversa, voz),
        'output_modalities': ['text'] if voz == 'kevin' else ['audio'],
        'audio': {
            'input': {
                'transcription': {'model': 'gpt-4o-mini-transcribe', 'language': 'pt'},
                'noise_reduction': {'type': 'far_field'},
                'turn_detection': None,
            },
            'output': {'voice': voz_openai},
        },
        'tools': ferramentas_realtime(conversa),
        'tool_choice': 'auto',
    }


def criar_token_openai(plano, sessao: dict) -> dict:
    resposta = httpx.post(
        'https://api.openai.com/v1/realtime/client_secrets',
        headers={'Authorization': f'Bearer {chave_openai(plano)}'},
        json={'session': sessao},
        timeout=15,
    )
    if resposta.status_code != 200:
        raise LiveIndisponivel(f'OpenAI recusou o token ({resposta.status_code}): {resposta.text[:300]}')
    dados = resposta.json()
    return {'value': dados['value'], 'expires_at': dados.get('expires_at'), 'model': sessao['model']}


def criar_token_elevenlabs(plano) -> dict:
    """Token de uso único para o WebSocket de streaming (vale ~15 min, uma conexão)."""
    if plano.tts_provider != 'elevenlabs' or not plano.tts_api_key:
        raise LiveIndisponivel('O plano não usa ElevenLabs.')
    resposta = httpx.post(
        'https://api.elevenlabs.io/v1/single-use-token/tts_websocket',
        headers={'xi-api-key': plano.tts_api_key},
        timeout=15,
    )
    if resposta.status_code != 200:
        raise LiveIndisponivel(f'ElevenLabs recusou o token ({resposta.status_code}).')
    return {
        'token': resposta.json()['token'],
        'voice_id': plano.tts_voice_id,
        'model_id': ELEVENLABS_MODELO_STREAM,
    }


HISTORICO_MAX = 20


def historico_recente(conversa) -> list[dict]:
    """As últimas falas da conversa, para a sessão ao vivo continuar de onde parou.
    Evento vai como fala do usuário com [EVENTO], igual ao modo tradicional."""
    from .models import Mensagem

    mensagens = list(
        Mensagem.objects.filter(conversa=conversa).order_by('-created_at')[:HISTORICO_MAX]
    )[::-1]
    historico = []
    for m in mensagens:
        conteudo = (m.conteudo or '').replace('🎤', '').strip()
        if not conteudo:
            continue
        if m.tipo == Mensagem.TipoChoices.EVENTO:
            conteudo = f'[EVENTO] {conteudo}'
        historico.append({'role': m.role, 'conteudo': conteudo})
    return historico


def ler_argumentos(argumentos) -> dict:
    if isinstance(argumentos, dict):
        return argumentos
    try:
        valor = json.loads(argumentos or '{}')
    except (TypeError, ValueError):
        return {}
    return valor if isinstance(valor, dict) else {}


def modelo_padrao() -> str:
    return getattr(settings, 'LIVE_MODELO', MODELOS[0])
