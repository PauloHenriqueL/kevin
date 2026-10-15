import logging

from celery import shared_task

logger = logging.getLogger(__name__)

# ── Prompt do Kevin ──────────────────────────────────────────────────────────
#
# ESTA E A FONTE UNICA DE VERDADE do prompt (ver CLAUDE.md). Nao duplique em
# exemplo/ nem em template.
#
# O prompt e montado por blocos (Papel / Idioma / Execucao). Os DEFAULTS vivem
# em apps/chat/prompts/*.txt (D42); o valor VIVO pode ser sobrescrito por TG
# (campos TG.prompt_*), editavel pela coordenacao sem deploy (Demanda 8, D43).
# Bloco vazio no TG = usa o default do arquivo.
#
# O roteiro concreto da aula (fases, atividades expandidas do catalogo) NAO vive
# aqui: vem de Aula.get_contexto_completo(), anexado em _montar_contexto().
from .prompts import (  # noqa: E402  (apos o logger, de proposito)
    PROMPT_PAPEL_PADRAO, PROMPT_IDIOMA_PADRAO, PROMPT_EXECUCAO_PADRAO,
    montar_prompt,
)

# Nomes antigos mantidos como alias para quem importava daqui (testes, etc.).
PROMPT_PAPEL = PROMPT_PAPEL_PADRAO
PROMPT_IDIOMA = PROMPT_IDIOMA_PADRAO
PROMPT_EXECUCAO = PROMPT_EXECUCAO_PADRAO


def montar_system_prompt_base():
    """Prompt base com os 3 blocos no default. Usado quando nao ha TG."""
    return montar_prompt()


SYSTEM_PROMPT_BASE = montar_system_prompt_base()


def _montar_contexto(conversa):
    """Monta system prompt com contexto completo da aula.

    O prompt base vem do TG da aula (campos editaveis por TG — D43), caindo no
    default dos arquivos quando o TG nao customizou um bloco. Sem aula ou sem TG,
    usa o SYSTEM_PROMPT_BASE (tudo default).
    """
    if conversa.aula and conversa.aula.tg_id:
        system_prompt = conversa.aula.tg.get_system_prompt()
    else:
        system_prompt = SYSTEM_PROMPT_BASE

    if conversa.aula:
        system_prompt += '\n\n--- CONTEXTO DA AULA ---\n'
        system_prompt += conversa.aula.get_contexto_completo()

    return system_prompt


def _montar_historico(conversa):
    """Monta lista de mensagens anteriores para a IA."""
    from apps.chat.models import Mensagem

    mensagens = Mensagem.objects.filter(
        conversa=conversa,
    ).order_by('created_at')

    return [
        {'role': msg.role, 'content': msg.conteudo}
        for msg in mensagens
    ]


def responder_ia_sync(conversa_id):
    """
    Chama a IA com o contexto atual da conversa e salva a resposta.
    Retorna o objeto Mensagem criado (role=assistant).

    Pensado para ser chamado tanto da task Celery quanto de uma view
    síncrona (modo conversação por áudio, hands-free).
    """
    from apps.chat.models import Conversa, Mensagem
    from apps.chat.providers import get_ia_provider

    conversa = Conversa.objects.select_related(
        'professor__escola__plano',
        'aula',
    ).get(id=conversa_id)

    plano = conversa.professor.escola.plano
    system_prompt = _montar_contexto(conversa)
    historico = _montar_historico(conversa)

    provider = get_ia_provider(
        provider_name=plano.ia_provider,
        api_key=plano.ia_api_key,
        modelo=plano.ia_modelo,
        effort=plano.ia_effort,
    )

    resposta, celebrar = provider.chat(
        system_prompt=system_prompt,
        mensagens=historico,
    )

    return Mensagem.objects.create(
        conversa=conversa,
        role='assistant',
        tipo='texto',
        conteudo=resposta,
        celebrar=celebrar,
    )


@shared_task(bind=True, max_retries=3, default_retry_delay=10)
def processar_mensagem_ia(self, conversa_id, mensagem_usuario):
    """Task: recebe texto do professor → chama IA → salva resposta."""
    try:
        responder_ia_sync(conversa_id)
        logger.info('Mensagem texto processada: conversa=%s', conversa_id)
        return {'conversa_id': conversa_id, 'status': 'respondido'}
    except Exception as exc:
        logger.error('Erro ao processar mensagem: %s', exc)
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=10)
def processar_audio_ia(self, conversa_id, mensagem_id, audio_bytes_list):
    """
    Task: recebe áudio → transcreve via STT → chama IA → salva resposta.

    Fluxo:
    1. Transcreve áudio (STT do plano)
    2. Atualiza mensagem do user com texto transcrito
    3. Chama IA com o texto
    4. Salva resposta da IA
    """
    from apps.chat.models import Conversa, Mensagem
    from apps.chat.providers import get_ia_provider, get_stt_provider

    try:
        conversa = Conversa.objects.select_related(
            'professor__escola__plano',
            'aula',
        ).get(id=conversa_id)

        plano = conversa.professor.escola.plano
        audio_bytes = bytes(audio_bytes_list)

        # 1. Transcrever áudio → texto
        stt = get_stt_provider(
            provider_name=plano.stt_provider,
            api_key=plano.stt_api_key,
        )
        texto_transcrito = stt.transcrever(audio_bytes)

        # 2. Atualiza mensagem do user com a transcrição
        mensagem_user = Mensagem.objects.get(id=mensagem_id)
        mensagem_user.conteudo = f'🎤 {texto_transcrito}'
        mensagem_user.save()

        # 3. Chamar IA
        system_prompt = _montar_contexto(conversa)
        historico = _montar_historico(conversa)

        ia = get_ia_provider(
            provider_name=plano.ia_provider,
            api_key=plano.ia_api_key,
            modelo=plano.ia_modelo,
            effort=plano.ia_effort,
        )

        resposta, celebrar = ia.chat(
            system_prompt=system_prompt,
            mensagens=historico,
        )

        # 4. Salvar resposta
        Mensagem.objects.create(
            conversa=conversa,
            role='assistant',
            tipo='texto',
            conteudo=resposta,
            celebrar=celebrar,
        )

        logger.info(
            'Áudio processado: conversa=%s stt=%s ia=%s',
            conversa_id, plano.stt_provider, plano.ia_provider,
        )

        return {'conversa_id': conversa_id, 'status': 'respondido_audio'}

    except Exception as exc:
        logger.error('Erro ao processar áudio: %s', exc)
        raise self.retry(exc=exc)
