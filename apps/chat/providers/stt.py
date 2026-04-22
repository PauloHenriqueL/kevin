import io

import openai

from .base import BaseSTTProvider


class OpenAIWhisperProvider(BaseSTTProvider):
    def transcrever(self, audio: bytes, filename: str = 'audio.webm') -> str:
        client = openai.OpenAI(api_key=self.api_key)

        audio_file = io.BytesIO(audio)
        audio_file.name = filename

        # Prompt bilíngue e neutro — metade em PT, metade em EN — para que
        # o Whisper não enviese o reconhecimento a favor de nenhum idioma.
        # Incluir vocabulário tipicamente esperado numa sala bilíngue ajuda
        # a reduzir erros em palavras mistas.
        response = client.audio.transcriptions.create(
            model='whisper-1',
            file=audio_file,
            response_format='verbose_json',
            prompt=(
                'Sala de aula bilíngue de inglês para crianças. '
                'Bilingual English classroom for kids. '
                'Transcreva exatamente como foi falado, preservando o idioma '
                'original (inglês fica em inglês, português fica em português). '
                'Transcribe exactly as spoken — do not translate. '
                'Palavras comuns: hello, goodbye, teacher, student, music, '
                'professor, aluno, música, vamos, let\'s go, homework.'
            ),
            temperature=0,
        )

        return response.text


class GoogleSTTProvider(BaseSTTProvider):
    def transcrever(self, audio: bytes, filename: str = 'audio.webm') -> str:
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
