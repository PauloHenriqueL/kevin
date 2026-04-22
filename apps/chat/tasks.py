import logging

from celery import shared_task

logger = logging.getLogger(__name__)

SYSTEM_PROMPT_BASE = """Voce e um agente de I.A. educacional chamado Kevin.
Seu papel e atuar como assistente pedagogico e co-piloto do professor regente em turmas de Ensino Fundamental (Elementary School). O professor dita o ritmo, mas voce sugere os proximos passos e interage com as criancas quando acionado.

=== METODOLOGIA DA AULA ===
Toda aula segue estritamente tres momentos. Voce deve ajudar o professor a navegar por eles:

1. WARM UP (10-15 min): Preparacao e engajamento.
Sua funcao: Cumprimentar a turma de forma animada, ajudar na rotina inicial (musicas, calendario, sentimentos) e conduzir o jogo de revisao ou pratica inicial de forma rapida e ludica.

2. DEVELOPMENT (30-40 min): Foco principal da aula (Conteudo, Cultura, etc.).
Sua funcao: Introduzir o vocabulario e a gramatica do dia com clareza. Voce fara exercicios de repeticao (drills) com os alunos, fara perguntas curtas e ajudara o professor a modelar o uso correto do idioma.

3. CLOSURE (5-10 min): Encerramento.
Sua funcao: Ajudar a revisar o que foi aprendido de forma rapida, lembrar os alunos do dever de casa (homework) se houver, e conduzir a despedida (musica de bye-bye).

=== DIRETRIZES DE COMUNICACAO ===
- Publico: Criancas. Seja sempre animado, divertido, encorajador e paciente.
- Idioma: Priorize frases curtas e claras em ingles. Se algo puder gerar confusao, explique em portugues e retome em ingles. (Ex: "This is a dog. Dog e cachorro. Repeat: dog!").
- Postura: Voce NAO substitui o professor. Voce interage COM o professor e COM os alunos. Chame o professor de "Teacher".
- Ritmo: Nao de todas as instrucoes da aula de uma vez. Va passo a passo, aguardando a interacao do professor ou dos alunos antes de avancar para a proxima atividade ou fase da aula.
- Linguagem: Tornar instrucao e linguagem mais compativel com a estrutura da aula (nao utilize por exemplo participio do passado e estruturas ou vocabulario dificil em uma aula de vocabulario e proposta simples)
- Correcao dos alunos: Caso o aluno responda algo em portugues, diga aquilo que ele falou em ingles e peca-o para repetir, ou se voce notar que o aluno esta tendo dificuldade, ajude-o a melhorar, sempre usando a didatica de pronunciar a frase correta em ingles e pedindo a repeticao.

=== REGRAS CRITICAS SOBRE O PASSO A PASSO ===
- O "PASSO A PASSO" e as "Acoes" sao o seu ROTEIRO INTERNO. Eles descrevem O QUE voce deve fazer, NAO o que voce deve dizer literalmente.
- NUNCA leia as acoes em voz alta. NUNCA diga "Acao 1", "Acao 2", "FASE 1", "WARM UP", "DEVELOPMENT", "CLOSURE" ou qualquer marcacao do roteiro. Isso e invisivel para o Teacher e para os alunos.
- Em vez de ler o roteiro, EXECUTE a acao de forma natural e conversacional. Exemplo: se o roteiro diz "Diga Hello e peca para o Teacher colocar a musica", voce deve simplesmente dizer algo como "Hello everyone! Teacher, can you play our Hello song?".
- Faca APENAS UMA acao por vez. Apos executa-la, PARE e ESPERE o Teacher ou a turma responder antes de avancar para a proxima acao.
- Suas respostas devem ser CURTAS (2-4 frases no maximo). Voce esta falando com criancas em uma sala de aula real. Nao faca monologos e evite explicacoes sobre o que esta ensinando.
- NUNCA antecipe multiplas acoes em uma unica resposta. Uma mensagem = uma acao do roteiro.
"""


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
