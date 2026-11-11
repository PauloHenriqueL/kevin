"""Ferramentas (tool calling) do Kevin — Demanda 20, D51.

Generaliza a D38: cada ferramenta é descrita UMA vez aqui e cada provider só
traduz para o formato da sua API (ver providers/ia.py). A descrição diz O QUE a
ferramenta faz; QUANDO usar é pedagogia e fica no prompt, que a coordenação
edita — assim, editar o prompt nunca quebra o contrato técnico.

Cada ferramenta declara em que modo da Conversa vale. No modo aula só existe
`celebrar_acerto`: é isso que garante que a aula estruturada não muda.

Nomes: o que é nome da metodologia fica em inglês, como o professor fala em
sala (`everybody_whisper`, `no_portuguese_allowed`); o resto segue a convenção
do projeto, em português.

Nenhuma ferramenta dispara fala gravada do motor (MP3 com outra voz, D54): o
`pay_attention` faz só o GESTO; a frase de atenção é o texto da resposta,
falado pela ElevenLabs como todo o resto.
"""
import difflib
import logging
import re
import unicodedata
from dataclasses import dataclass, field
from typing import Callable

from apps.curriculo.models import BACKGROUND_CHOICES

logger = logging.getLogger(__name__)

QUADRO_MAX_CARACTERES = 40


@dataclass
class Resultado:
    texto_para_ia: str = 'ok'          # vira o tool_result
    acao: dict | None = None           # vai para Mensagem.acoes e para o frontend
    precisa_continuar: bool = False    # a IA precisa ler o resultado antes de falar


@dataclass
class Ferramenta:
    nome: str
    descricao: str
    parametros: dict                   # JSON Schema do input
    executar: Callable                 # (conversa, entrada: dict) -> Resultado
    # Épico A (D60): a aula estruturada ganhou os recursos do Playground —
    # todas as ferramentas valem nos dois modos.
    modos: tuple = field(default=('aula', 'playground'))


# ── Catálogo visível na sessão ───────────────────────────────────────────────

def _escola_da_conversa(conversa):
    if conversa.turma_id:
        return conversa.turma.escola
    return conversa.professor.escola


def catalogo_musicas(conversa):
    """Músicas que o Kevin pode tocar: só as que têm faixa (`arquivo_url`)."""
    from apps.curriculo.models import Atividade
    return list(
        Atividade.objects.visiveis_para(_escola_da_conversa(conversa))
        .musicas().exclude(arquivo_url='').order_by('nome')
    )


def catalogo_jogos(conversa):
    from apps.curriculo.models import Atividade
    return list(
        Atividade.objects.visiveis_para(_escola_da_conversa(conversa))
        .jogos().order_by('nome')
    )


def _normalizar(texto):
    """Minúsculas, sem acento, sem pontuação — para casar nome falado com cadastro."""
    texto = unicodedata.normalize('NFKD', texto or '')
    texto = ''.join(c for c in texto if not unicodedata.combining(c))
    texto = re.sub(r'[^\w\s]', ' ', texto.lower())
    return ' '.join(texto.split())


def buscar_por_nome(atividades, nome):
    """Igualdade → "contém" → aproximado. Devolve (atividade | None, sugestões)."""
    alvo = _normalizar(nome)
    if not alvo or not atividades:
        return None, [a.nome for a in atividades[:5]]
    por_nome = {}
    for a in atividades:
        por_nome.setdefault(_normalizar(a.nome), a)
    if alvo in por_nome:
        return por_nome[alvo], []
    contem = [a for chave, a in por_nome.items() if alvo in chave or chave in alvo]
    if len(contem) == 1:
        return contem[0], []
    proximos = difflib.get_close_matches(alvo, list(por_nome), n=5, cutoff=0.6)
    if proximos and not contem:
        return por_nome[proximos[0]], []
    sugestoes = [a.nome for a in contem[:5]] or [por_nome[c].nome for c in proximos]
    if not sugestoes:
        sugestoes = [
            por_nome[c].nome
            for c in difflib.get_close_matches(alvo, list(por_nome), n=5, cutoff=0.3)
        ]
    # Nada parecido: mostra o que existe, para a IA oferecer outra opção.
    return None, sugestoes or [a.nome for a in atividades[:5]]


def regras_do_jogo(atividade):
    """O texto das regras, do catálogo (regra 8: o Kevin nunca inventa)."""
    linhas = [f'Jogo: {atividade.nome}']
    if atividade.objetivo_pedagogico:
        linhas.append(f'Objetivo: {atividade.objetivo_pedagogico}')
    if atividade.como_conduzir:
        linhas.append(f'Como conduzir: {atividade.como_conduzir}')
    else:
        linhas.append(
            'Como conduzir: o catálogo não tem o passo a passo deste jogo. '
            'Peça ao Teacher para explicar as regras; não invente.'
        )
    if atividade.materiais:
        linhas.append(f'Materiais: {atividade.materiais}')
    return '\n'.join(linhas)


# ── Executores ───────────────────────────────────────────────────────────────

def _salvar_estado(conversa, **mudancas):
    conversa.estado = {**(conversa.estado or {}), **mudancas}
    conversa.save(update_fields=['estado'])


def _celebrar(conversa, entrada):
    return Resultado(acao={'tipo': 'celebrar'})


def _mostrar_no_quadro(conversa, entrada):
    texto = ' '.join(str(entrada.get('texto') or '').split())[:QUADRO_MAX_CARACTERES]
    if texto == (conversa.estado or {}).get('quadro', ''):
        return Resultado(texto_para_ia='Isso já está no quadro.')
    _salvar_estado(conversa, quadro=texto)
    return Resultado(acao={'tipo': 'quadro', 'texto': texto})


def _cenarios():
    return [chave for chave, _ in BACKGROUND_CHOICES]


def _trocar_cenario(conversa, entrada):
    cenario = str(entrada.get('cenario') or '').strip()
    if cenario not in _cenarios():
        return Resultado(
            texto_para_ia=f'Cenário inexistente. Disponíveis: {", ".join(_cenarios())}.'
        )
    if cenario == (conversa.estado or {}).get('cenario'):
        return Resultado(texto_para_ia='O cenário já é esse.')
    _salvar_estado(conversa, cenario=cenario)
    return Resultado(acao={'tipo': 'cenario', 'cenario': cenario})


def _tocar_musica(conversa, entrada):
    nome = str(entrada.get('nome') or '').strip()
    if not nome:
        # Só o ukulele: o Kevin acompanha o Teacher cantando.
        return Resultado(acao={'tipo': 'musica', 'nome': '', 'url': ''})
    musicas = catalogo_musicas(conversa)
    atividade, sugestoes = buscar_por_nome(musicas, nome)
    if atividade:
        return Resultado(acao={
            'tipo': 'musica', 'nome': atividade.nome, 'url': atividade.arquivo_url,
        })
    disponiveis = ', '.join(sugestoes) if sugestoes else 'nenhuma cadastrada'
    return Resultado(
        texto_para_ia=f'Música "{nome}" não encontrada. Disponíveis: {disponiveis}.',
        precisa_continuar=True,
    )


def _iniciar_jogo(conversa, entrada):
    nome = str(entrada.get('nome') or '').strip()
    atividade, sugestoes = buscar_por_nome(catalogo_jogos(conversa), nome)
    if not atividade:
        disponiveis = ', '.join(sugestoes) if sugestoes else 'nenhum parecido'
        return Resultado(
            texto_para_ia=f'Jogo "{nome}" não encontrado. Parecidos: {disponiveis}.',
            precisa_continuar=True,
        )
    _salvar_estado(conversa, jogo_id=atividade.id)
    return Resultado(texto_para_ia=regras_do_jogo(atividade), precisa_continuar=True)


def _encerrar_jogo(conversa, entrada):
    _salvar_estado(conversa, jogo_id=None)
    return Resultado()


def _pay_attention(conversa, entrada):
    return Resultado(acao={'tipo': 'pay_attention'})


def _modo_booleano(chave_estado, tipo_acao):
    def executar(conversa, entrada):
        ativo = bool(entrada.get('ativo'))
        if bool((conversa.estado or {}).get(chave_estado)) == ativo:
            return Resultado(texto_para_ia='Já estava assim.')
        _salvar_estado(conversa, **{chave_estado: ativo})
        return Resultado(acao={'tipo': tipo_acao, 'ativo': ativo})
    return executar


# ── Registro ─────────────────────────────────────────────────────────────────

_SEM_PARAMETROS = {'type': 'object', 'properties': {}}
_ATIVO = {
    'type': 'object',
    'properties': {'ativo': {'type': 'boolean', 'description': 'true liga, false desliga.'}},
    'required': ['ativo'],
}

CELEBRAR = Ferramenta(
    nome='celebrar_acerto',
    descricao=(
        'Chame esta ferramenta quando o Teacher (ou a turma, no momento que ele '
        'abriu) acabou de acertar algo que você estava ensinando ou testando — '
        'uma resposta certa, um vocabulário lembrado corretamente, um jogo '
        'ganho. Chame JUNTO com sua resposta de texto normal, nunca no lugar '
        'dela — o Teacher precisa continuar ouvindo você falar. Não chame por '
        'elogios genéricos, cumprimentos, ou toda vez que alguém responde algo.'
    ),
    parametros=_SEM_PARAMETROS,
    executar=_celebrar,
    modos=('aula', 'playground'),
)

REGISTRO = [
    CELEBRAR,
    Ferramenta(
        nome='mostrar_no_quadro',
        descricao=(
            'Escreve uma palavra ou expressão curta no quadro-negro ao lado do '
            'Kevin (até 40 caracteres). Texto vazio limpa o quadro.'
        ),
        parametros={
            'type': 'object',
            'properties': {'texto': {'type': 'string', 'maxLength': QUADRO_MAX_CARACTERES}},
            'required': ['texto'],
        },
        executar=_mostrar_no_quadro,
    ),
    Ferramenta(
        nome='trocar_cenario',
        descricao=(
            'Troca o cenário de fundo do Kevin, com animação de transição. '
            'Cenários: ' + ', '.join(f'{chave} ({rotulo})' for chave, rotulo in BACKGROUND_CHOICES)
            + '.'
        ),
        parametros={
            'type': 'object',
            'properties': {'cenario': {'type': 'string', 'enum': _cenarios()}},
            'required': ['cenario'],
        },
        executar=_trocar_cenario,
    ),
    Ferramenta(
        nome='tocar_musica',
        descricao=(
            'O Kevin pega o ukulele e toca uma música do catálogo, depois da sua '
            'fala. Use o nome da lista MÚSICAS DISPONÍVEIS. Nome vazio = só o '
            'ukulele, para acompanhar o Teacher cantando.'
        ),
        parametros={
            'type': 'object',
            'properties': {'nome': {'type': 'string'}},
            'required': ['nome'],
        },
        executar=_tocar_musica,
    ),
    Ferramenta(
        nome='iniciar_jogo',
        descricao=(
            'Começa um jogo do catálogo e devolve as regras oficiais dele. Use o '
            'nome da lista JOGOS DISPONÍVEIS.'
        ),
        parametros={
            'type': 'object',
            'properties': {'nome': {'type': 'string'}},
            'required': ['nome'],
        },
        executar=_iniciar_jogo,
    ),
    Ferramenta(
        nome='encerrar_jogo',
        descricao='Marca que o jogo em andamento terminou.',
        parametros=_SEM_PARAMETROS,
        executar=_encerrar_jogo,
    ),
    Ferramenta(
        nome='pay_attention',
        descricao=(
            'Pay attention: o Kevin acena chamando a atenção da turma, antes da '
            'sua fala. É só o gesto — a frase de atenção é a sua resposta de '
            'texto (ex: "Eyes on me, kids!").'
        ),
        parametros=_SEM_PARAMETROS,
        executar=_pay_attention,
    ),
    Ferramenta(
        nome='everybody_whisper',
        descricao=(
            'Liga ou desliga o modo Everybody Whisper: aviso na tela e a voz do '
            'Kevin sussurrada.'
        ),
        parametros=_ATIVO,
        executar=_modo_booleano('whisper', 'whisper'),
    ),
    Ferramenta(
        nome='no_portuguese_allowed',
        descricao=(
            'Liga ou desliga o modo No Portuguese Allowed: aviso na tela de que '
            'agora é só inglês.'
        ),
        parametros=_ATIVO,
        executar=_modo_booleano('so_ingles', 'so_ingles'),
    ),
]

_POR_NOME = {f.nome: f for f in REGISTRO}


def ferramentas_do_modo(modo: str) -> list[Ferramenta]:
    return [f for f in REGISTRO if modo in f.modos]


def executar(conversa, nome: str, entrada: dict | None) -> Resultado:
    """Executa a ferramenta pedida pela IA. Nunca levanta: erro vira resultado.

    Um nome desconhecido ou um executor que falha não pode derrubar a resposta
    que o professor está esperando na frente da turma.
    """
    ferramenta = _POR_NOME.get(nome)
    if not ferramenta:
        return Resultado(texto_para_ia=f'Ferramenta desconhecida: {nome}.')
    if conversa is None and ferramenta is not CELEBRAR:
        return Resultado(texto_para_ia='Indisponível.')
    try:
        return ferramenta.executar(conversa, entrada or {})
    except Exception:
        logger.exception('Falha ao executar a ferramenta %s', nome)
        return Resultado(texto_para_ia='Não funcionou agora.')
