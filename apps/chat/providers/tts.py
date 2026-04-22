import httpx
import openai

from .base import BaseTTSProvider


ELEVENLABS_DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'
ELEVENLABS_DEFAULT_MODEL = 'eleven_multilingual_v2'


class ElevenLabsTTSProvider(BaseTTSProvider):
    def sintetizar(self, texto: str) -> bytes:
        voice_id = self.voice_id or ELEVENLABS_DEFAULT_VOICE_ID
        model_id = self.modelo or ELEVENLABS_DEFAULT_MODEL

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
    def sintetizar(self, texto: str) -> bytes:
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
