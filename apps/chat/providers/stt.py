import io

import openai

from .base import BaseSTTProvider


class OpenAIWhisperProvider(BaseSTTProvider):
    def transcrever(self, audio: bytes) -> str:
        client = openai.OpenAI(api_key=self.api_key)

        audio_file = io.BytesIO(audio)
        audio_file.name = 'audio.webm'

        response = client.audio.transcriptions.create(
            model='whisper-1',
            file=audio_file,
        )

        return response.text


class GoogleSTTProvider(BaseSTTProvider):
    def transcrever(self, audio: bytes) -> str:
        # TODO: Implementar Google Speech-to-Text
        raise NotImplementedError('Google STT ainda não implementado')


PROVIDERS = {
    'openai_whisper': OpenAIWhisperProvider,
    'google_stt': GoogleSTTProvider,
}


def get_stt_provider(provider_name: str, api_key: str) -> BaseSTTProvider:
    provider_class = PROVIDERS.get(provider_name)
    if not provider_class:
        raise ValueError(f'Provedor de STT desconhecido: {provider_name}')
    return provider_class(api_key=api_key)
