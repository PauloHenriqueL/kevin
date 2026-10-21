import re
import unicodedata

import httpx
import openai

from .base import BaseTTSProvider


ELEVENLABS_DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'
ELEVENLABS_DEFAULT_MODEL = 'eleven_multilingual_v2'

# Everybody Whisper (D52): o multilingual_v2 não interpreta direção de voz; o
# v3 aceita tags como [whispers] no próprio texto, no mesmo endpoint. A tag é
# posta SÓ aqui — nunca vai para Mensagem.conteudo nem aparece no chat.
ELEVENLABS_WHISPER_MODEL = 'eleven_v3'
ESTILOS = ('normal', 'sussurro')


def limpar_para_fala(texto: str) -> str:
    """Tira do texto o que o TTS leria em voz alta sem querer.

    O prompt proíbe, mas o modelo às vezes manda emoji, *ênfase* ou uma
    [direção] — e o TTS lê tudo o que chega.
    """
    texto = re.sub(r'\[[^\]]*\]', ' ', texto or '')
    texto = ''.join(
        c for c in texto
        if unicodedata.category(c) not in ('So', 'Cs')
        and c not in '*\u200d\ufe0f'
    )
    return ' '.join(texto.split())


class ElevenLabsTTSProvider(BaseTTSProvider):
    def sintetizar(self, texto: str, estilo: str = 'normal') -> bytes:
        voice_id = self.voice_id or ELEVENLABS_DEFAULT_VOICE_ID
        model_id = self.modelo or ELEVENLABS_DEFAULT_MODEL
        if estilo == 'sussurro':
            model_id = ELEVENLABS_WHISPER_MODEL
            texto = f'[whispers] {texto}'

        response = httpx.post(
            f'https://api.elevenlabs.io/v1/text-to-speech/{voice_id}',
            headers={
                'Accept': 'audio/mpeg',
                'xi-api-key': self.api_key,
                'Content-Type': 'application/json',
            },
            json={
                'text': texto,
                'model_id': model_id,
                'voice_settings': {'stability': 0.5, 'similarity_boost': 0.75},
            },
            timeout=30,
        )
        response.raise_for_status()
        return response.content


class OpenAITTSProvider(BaseTTSProvider):
    def sintetizar(self, texto: str, estilo: str = 'normal') -> bytes:
        # tts-1 não sussurra: o estilo é ignorado aqui, e o frontend baixa o
        # volume como reforço (D52).
        client = openai.OpenAI(api_key=self.api_key)

        response = client.audio.speech.create(
            model='tts-1',
            voice=self.modelo or 'alloy',
            input=texto,
        )

        return response.content


PROVIDERS = {
    'elevenlabs': ElevenLabsTTSProvider,
    'openai_tts': OpenAITTSProvider,
}


def get_tts_provider(
    provider_name: str,
    api_key: str,
    voice_id: str = '',
    modelo: str = '',
) -> BaseTTSProvider:
    provider_class = PROVIDERS.get(provider_name)
    if not provider_class:
        raise ValueError(f'Provedor de TTS desconhecido: {provider_name}')
    return provider_class(api_key=api_key, voice_id=voice_id, modelo=modelo)
