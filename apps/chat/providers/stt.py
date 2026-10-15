import io
import re

import openai

from .base import BaseSTTProvider


# Sem `prompt` no Whisper DE PROPÓSITO.
#
# O Whisper não é instrucional — o `prompt` só enviesa o vocabulário. Pior: em
# áudio silencioso/curto ele DEVOLVE o prompt (verbatim ou repetido em loop,
# "bilingue, bilingue, bilingue…") como se fosse a transcrição. Medido na prática.
# Sem prompt, o silêncio ainda alucina ("you", "Legendas pela comunidade…"), mas
# aí NÃO é o nosso texto, e o filtro abaixo derruba por `no_speech_prob` + o
# detector de repetição. Correção > o ganho marginal de vocabulário em falas
# curtas de sala. Se algum dia reintroduzir prompt, os filtros abaixo seguem valendo.

# Acima disso, o segmento é quase certamente silêncio/ruído — de onde vêm as
# alucinações. Fala real fica bem abaixo (tipicamente < 0.2). Medido: silêncio
# dá 0.85–0.95.
_NO_SPEECH_MAX = 0.6


def _attr(obj, nome, default=None):
    """Lê atributo de objeto OU chave de dict — o SDK varia por versão."""
    if isinstance(obj, dict):
        return obj.get(nome, default)
    return getattr(obj, nome, default)


def _parece_repeticao(texto: str) -> bool:
    """Detecta alucinação repetitiva: uma palavra domina (ex: 'bilingue'×50)."""
    palavras = re.findall(r'\w+', texto.lower())
    if len(palavras) < 6:
        return False
    mais_comum = max(set(palavras), key=palavras.count)
    return palavras.count(mais_comum) / len(palavras) > 0.5


def _texto_sem_alucinacao(response) -> str:
    """Extrai a transcrição descartando silêncio e alucinação.

    Usa os segmentos do `verbose_json`: segmento com `no_speech_prob` alto é
    silêncio/ruído e sai fora. O que sobra é fala real. Guarda final: texto
    repetitivo é alucinação → devolve vazio (o frontend reabre o mic no modo ao
    vivo sem mandar nada).
    """
    segmentos = _attr(response, 'segments', None) or []
    partes = []
    for seg in segmentos:
        nsp = _attr(seg, 'no_speech_prob', 0.0) or 0.0
        if nsp > _NO_SPEECH_MAX:
            continue  # provável silêncio/ruído
        partes.append((_attr(seg, 'text', '') or '').strip())

    if segmentos:
        texto = ' '.join(p for p in partes if p).strip()
    else:
        # Formato inesperado (sem segments): usa o texto cru.
        texto = (_attr(response, 'text', '') or '').strip()

    if _parece_repeticao(texto):
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
