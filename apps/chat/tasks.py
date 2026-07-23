import logging

from celery import shared_task

logger = logging.getLogger(__name__)

# ── Prompt do Kevin ──────────────────────────────────────────────────────────
#
# ESTA E A FONTE UNICA DE VERDADE do prompt (ver CLAUDE.md). Nao duplique em
# exemplo/ nem em template.
#
# O prompt e montado por blocos. Regras pedagogicas calibraveis (idioma, tom)
# ficam em blocos ISOLADOS e substituiveis — a Demanda 8 vai transforma-los em
# configuracao editavel pelo gerente da Bebelingue, entao NAO os dilua no texto.
#
# O roteiro concreto da aula (fases, atividades expandidas do catalogo) NAO vive
# aqui: vem de Aula.get_contexto_completo(), anexado em _montar_contexto().


# Papel e postura. O professor e o interlocutor; a turma participa quando ELE
# abre o momento (Decisao D11).
PROMPT_PAPEL = """Voce e o Kevin, um assistente de I.A. animado que ajuda o professor a dar aulas de ingles para criancas (Elementary School). Voce aparece numa tela/TV na sala.

Quem fala com voce e o PROFESSOR (chame-o de "Teacher"), principalmente por voz. Ele conduz a aula e dita o ritmo. As criancas so falam com voce quando o Teacher abre esse momento ("agora falem com o Kevin") — fora disso, fale com o Teacher, nao com a turma. Voce NAO substitui o professor e NAO toma a iniciativa de se dirigir as criancas sozinho."""


# >>> BLOCO CALIBRAVEL: POLITICA DE IDIOMA (Instant Translation) <<<
# Padrao da metodologia Bebelingue. A Demanda 8 troca este bloco por
# configuracao. Mantenha-o autocontido — nao espalhe regras de idioma em outros
# blocos.
PROMPT_IDIOMA = """=== IDIOMA ===
Priorize frases curtas e claras em INGLES. Quando o Teacher ou um aluno responder em portugues, use a tecnica Instant Translation: valide calorosamente em portugues e responda em seguida em ingles, mantendo o foco no idioma-alvo. Ex: aluno diz "cachorro" -> "Isso! Dog. Repeat with me: dog!". Evite gramatica e vocabulario dificeis numa aula de proposta simples."""
# >>> FIM DO BLOCO CALIBRAVEL <<<


# Como executar o roteiro que chega no contexto. Sem descrever fases fixas — elas
# vem da aula.
PROMPT_EXECUCAO = """=== COMO CONDUZIR A AULA ===
O contexto abaixo traz o roteiro da aula de hoje, em blocos, com as atividades ja explicadas (como conduzir cada jogo e tecnica). Ele e o seu ROTEIRO INTERNO: descreve O QUE fazer, nao o que dizer literalmente.

- NUNCA leia o roteiro em voz alta. Nunca diga "Warm Up", "Development", "Closure", "bloco 1" ou nomes de fase. Isso e invisivel para o Teacher.
- EXECUTE cada passo de forma natural. Ex: o roteiro diz "cumprimente e peca a musica" -> voce diz "Hello everyone! Teacher, can you play our Hello song?".
- UMA acao por vez. Depois, PARE e espere a resposta do Teacher (ou da turma, se o momento estiver aberto) antes de avancar.
- Respostas CURTAS: 2-4 frases. Voce esta numa sala real com criancas. Nada de monologo."""


def montar_system_prompt_base():
    """Junta os blocos do prompt. Separado para facilitar teste e a Demanda 8."""
    return '\n\n'.join([PROMPT_PAPEL, PROMPT_IDIOMA, PROMPT_EXECUCAO])


SYSTEM_PROMPT_BASE = montar_system_prompt_base()


def _montar_contexto(conversa):
    """Monta system prompt com contexto completo da aula."""
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
    )

    resposta = provider.chat(
        system_prompt=system_prompt,
        mensagens=historico,
    )

    return Mensagem.objects.create(
        conversa=conversa,
        role='assistant',
        tipo='texto',
        conteudo=resposta,
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
        )

        resposta = ia.chat(
            system_prompt=system_prompt,
            mensagens=historico,
        )

        # 4. Salvar resposta
        Mensagem.objects.create(
            conversa=conversa,
            role='assistant',
            tipo='texto',
            conteudo=resposta,
        )

        logger.info(
            'Áudio processado: conversa=%s stt=%s ia=%s',
            conversa_id, plano.stt_provider, plano.ia_provider,
        )

        return {'conversa_id': conversa_id, 'status': 'respondido_audio'}

    except Exception as exc:
        logger.error('Erro ao processar áudio: %s', exc)
        raise self.retry(exc=exc)
