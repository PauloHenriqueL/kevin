import httpx
import openai

from .base import BaseTTSProvider


class ElevenLabsTTSProvider(BaseTTSProvider):
    def sintetizar(self, texto: str) -> bytes:
        response = httpx.post(
            'https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM',
            headers={
                'xi-api-key': self.api_key,
                'Content-Type': 'application/json',
            },
            json={
                'text': texto,
                'model_id': 'eleven_multilingual_v2',
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
            voice='alloy',
            input=texto,
        )

        return response.content


PROVIDERS = {
    'elevenlabs': ElevenLabsTTSProvider,
    'openai_tts': OpenAITTSProvider,
}


def get_tts_provider(provider_name: str, api_key: str) -> BaseTTSProvider:
    provider_class = PROVIDERS.get(provider_name)
    if not provider_class:
        raise ValueError(f'Provedor de TTS desconhecido: {provider_name}')
    return provider_class(api_key=api_key)
