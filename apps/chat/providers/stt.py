import io
import re

import openai

from .base import BaseSTTProvider


# Prompt do Whisper: SÓ dica de vocabulário/estilo, NUNCA instrução.
#
# O Whisper não é um modelo instrucional — o `prompt` apenas enviesa o
# vocabulário do reconhecimento. Frases imperativas ("transcreva exatamente…")
# não fazem nada útil E são exatamente o que vaza como "transcrição" quando o
# áudio é silencioso/curto (alucinação conhecida do Whisper). Por isso aqui só
# entram palavras esperadas numa sala bilíngue.
_WHISPER_PROMPT = (
    'Aula de ingles para criancas, bilingue (portugues e ingles). '
    'Vocabulario comum: hello, goodbye, teacher, student, music, homework, '
    'professor, aluno, musica, vamos, let\'s go.'
)


def _normalizar(texto: str) -> str:
    """Minúsculas, só alfanumérico — para comparar transcrição com o prompt."""
    return re.sub(r'[^a-z0-9]+', ' ', (texto or '').lower()).strip()


_PROMPT_NORMALIZADO = _normalizar(_WHISPER_PROMPT)


def _attr(obj, nome, default=None):
    """Lê atributo de objeto OU chave de dict — o SDK varia por versão."""
    if isinstance(obj, dict):
        return obj.get(nome, default)
    return getattr(obj, nome, default)


def _texto_sem_alucinacao(response) -> str:
    """Extrai a transcrição descartando silêncio e vazamento do prompt.

    Usa os segmentos do `verbose_json`: segmento com `no_speech_prob` alto e
    `avg_logprob` baixo é silêncio/ruído (de onde vêm as alucinações). O que
    sobra é texto de fala real. Como guarda final, se o resultado for um trecho
    longo do prompt, foi vazamento — devolve vazio (o frontend reabre o mic no
    modo ao vivo sem mandar nada).
    """
    segmentos = _attr(response, 'segments', None) or []
    partes = []
    for seg in segmentos:
        nsp = _attr(seg, 'no_speech_prob', 0.0) or 0.0
        alp = _attr(seg, 'avg_logprob', 0.0) or 0.0
        if nsp > 0.6 and alp < -0.5:
            continue  # provável silêncio/ruído
        partes.append((_attr(seg, 'text', '') or '').strip())

    if segmentos:
        texto = ' '.join(p for p in partes if p).strip()
    else:
        # Formato inesperado (sem segments): usa o texto cru.
        texto = (_attr(response, 'text', '') or '').strip()

    # Guarda contra vazamento: só descarta se for um trecho LONGO contido no
    # prompt (4+ palavras), para não derrubar fala real curta como "hello
    # teacher" que casa com o vocabulário do prompt.
    norm = _normalizar(texto)
    if len(norm.split()) >= 4 and norm in _PROMPT_NORMALIZADO:
        return ''

    return texto


class OpenAIWhisperProvider(BaseSTTProvider):
    def transcrever(self, audio: bytes, filename: str = 'audio.webm') -> str:
        client = openai.OpenAI(api_key=self.api_key)

        audio_file = io.BytesIO(audio)
        audio_file.name = filename

        response = client.audio.transcriptions.create(
            model='whisper-1',
            file=audio_file,
            response_format='verbose_json',
            prompt=_WHISPER_PROMPT,
            temperature=0,
        )

        return _texto_sem_alucinacao(response)


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
