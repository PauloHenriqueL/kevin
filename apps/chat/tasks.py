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
    montar_prompt, montar_prompt_playground,
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
    if conversa.eh_playground:
        return _montar_contexto_playground(conversa)
    if conversa.aula and conversa.aula.tg_id:
        system_prompt = conversa.aula.tg.get_system_prompt()
    else:
        system_prompt = SYSTEM_PROMPT_BASE

    if conversa.aula:
        system_prompt += '\n\n--- CONTEXTO DA AULA ---\n'
        system_prompt += conversa.aula.get_contexto_completo()

    # Épico A (D60/D61): a aula também tem os recursos do Playground. Catálogo
    # e estado da sala entram depois do roteiro, do estável ao volátil.
    partes = [system_prompt] + _secoes_catalogo(conversa) + [_secao_estado(conversa)]
    return '\n\n'.join(partes)


SEM_CONTEXTO_AINDA = (
    'O professor ainda não disse o tema de hoje. Pergunte, em uma frase, o que a '
    'turma está aprendendo.'
)


def _montar_contexto_playground(conversa):
    """System prompt do Playground (Demanda 20).

    Vai do ESTÁVEL ao VOLÁTIL de propósito: o prefixo que não muda entre turnos
    (blocos, turma, catálogo) é aproveitado pelo cache de prompt do provedor.
    As listas do catálogo levam só os NOMES (D10: token é pago); as regras de
    um jogo só entram quando ele começa (ferramenta iniciar_jogo) e enquanto
    ele estiver em andamento.
    """
    turma = conversa.turma
    tg = turma.tg if turma else None
    partes = [tg.get_system_prompt_playground() if tg else montar_prompt_playground()]

    if turma:
        partes.append(
            f'=== TURMA ===\nYear {turma.year} · Turma {turma.year}{turma.nome} · '
            f'{turma.qtd_alunos} alunos'
        )

    partes.extend(_secoes_catalogo(conversa))

    partes.append(
        '=== CONTEXTO DA AULA DE HOJE ===\n'
        + (conversa.contexto.strip() or SEM_CONTEXTO_AINDA)
    )

    partes.append(_secao_estado(conversa))

    return '\n\n'.join(partes)


def _secoes_catalogo(conversa):
    """MÚSICAS e JOGOS disponíveis — só os nomes (D10: token é pago)."""
    from apps.chat.ferramentas import catalogo_jogos, catalogo_musicas

    musicas = ' | '.join(a.nome for a in catalogo_musicas(conversa))
    jogos = ' | '.join(a.nome for a in catalogo_jogos(conversa))
    return [
        f'=== MÚSICAS DISPONÍVEIS ===\n{musicas or "(nenhuma cadastrada)"}',
        f'=== JOGOS DISPONÍVEIS ===\n{jogos or "(nenhum cadastrado)"}',
    ]


def _secao_estado(conversa):
    """ESTADO DA SALA AGORA: cenário, quadro, modos e jogo em andamento."""
    from apps.chat.ferramentas import regras_do_jogo
    from apps.curriculo.models import Atividade, BACKGROUND_CHOICES

    estado = conversa.estado or {}
    rotulos = dict(BACKGROUND_CHOICES)
    cenario = estado.get('cenario') or 'floresta'
    linhas = [
        '=== ESTADO DA SALA AGORA ===',
        f'Cenário: {cenario} ({rotulos.get(cenario, cenario)})',
        f'Quadro: {estado.get("quadro") or "vazio"}',
        f'Everybody Whisper: {"ATIVO" if estado.get("whisper") else "desligado"}',
        f'No Portuguese Allowed: {"ATIVO" if estado.get("so_ingles") else "desligado"}',
    ]
    jogo = None
    if estado.get('jogo_id'):
        jogo = Atividade.objects.filter(id=estado['jogo_id']).first()
    if jogo:
        # Relido do catálogo a cada mensagem: correção da coordenação vale na hora.
        linhas.append('Jogo em andamento:\n' + regras_do_jogo(jogo))
    else:
        linhas.append('Jogo em andamento: nenhum')
    return '\n'.join(linhas)


def _montar_historico(conversa):
    """Monta lista de mensagens anteriores para a IA.

    Evento do sistema (Playground) vai como fala do usuário prefixada por
    [EVENTO] — o prompt explica o que é. Mensagens seguidas do mesmo papel são
    mescladas: acontece quando uma chamada à IA falha e a fala do usuário fica
    sem resposta, e alguns provedores recusam dois turnos iguais em sequência.
    """
    from apps.chat.models import Mensagem

    mensagens = Mensagem.objects.filter(
        conversa=conversa,
    ).order_by('created_at')

    historico = []
    for msg in mensagens:
        role, conteudo = msg.role, msg.conteudo
        if msg.tipo == Mensagem.TipoChoices.EVENTO:
            role, conteudo = 'user', f'[EVENTO] {conteudo}'
        if historico and historico[-1]['role'] == role:
            historico[-1]['content'] += f'\n\n{conteudo}'
        else:
            historico.append({'role': role, 'content': conteudo})
    return historico


def _chamar_ia(conversa, plano):
    """Uma resposta da IA para a conversa, com as ferramentas do modo dela."""
    from apps.chat.ferramentas import ferramentas_do_modo
    from apps.chat.providers import get_ia_provider

    provider = get_ia_provider(
        provider_name=plano.ia_provider,
        api_key=plano.ia_api_key,
        modelo=plano.ia_modelo,
        effort=plano.ia_effort,
    )
    return provider.chat(
        system_prompt=_montar_contexto(conversa),
        mensagens=_montar_historico(conversa),
        ferramentas=ferramentas_do_modo(conversa.modo),
        conversa=conversa,
    )


def _salvar_resposta(conversa, texto, acoes):
    from apps.chat.models import Mensagem

    return Mensagem.objects.create(
        conversa=conversa,
        role='assistant',
        tipo='texto',
        conteudo=texto,
        acoes=acoes,
        # Mantido por compatibilidade (D38): o frontend da aula lê este campo.
        celebrar=any(a.get('tipo') == 'celebrar' for a in acoes),
    )


def responder_ia_sync(conversa_id):
    """
    Chama a IA com o contexto atual da conversa e salva a resposta.
    Retorna o objeto Mensagem criado (role=assistant).

    Pensado para ser chamado tanto da task Celery quanto de uma view
    síncrona (modo conversação por áudio, hands-free).
    """
    from apps.chat.models import Conversa

    conversa = Conversa.objects.select_related(
        'professor__escola__plano',
        'aula',
        'turma__escola',
    ).get(id=conversa_id)

    plano = conversa.professor.escola.plano
    resposta, acoes = _chamar_ia(conversa, plano)
    return _salvar_resposta(conversa, resposta, acoes)


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
    from apps.chat.providers import get_stt_provider

    try:
        conversa = Conversa.objects.select_related(
            'professor__escola__plano',
            'aula',
            'turma__escola',
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
        # Playground: a 1ª fala do Teacher vira o contexto da sessão (D49).
        conversa.registrar_contexto(mensagem_user, texto=texto_transcrito)

        # 3. Chamar IA e 4. salvar a resposta
        resposta, acoes = _chamar_ia(conversa, plano)
        _salvar_resposta(conversa, resposta, acoes)

        logger.info(
            'Áudio processado: conversa=%s stt=%s ia=%s',
            conversa_id, plano.stt_provider, plano.ia_provider,
        )

        return {'conversa_id': conversa_id, 'status': 'respondido_audio'}

    except Exception as exc:
        logger.error('Erro ao processar áudio: %s', exc)
        raise self.retry(exc=exc)
