"""Prompts padrao do Kevin (Demanda 8, D42; Playground: Demanda 20, D50).

Os textos default dos 3 blocos vivem como arquivos .txt ao lado deste modulo e
sao lidos uma vez na importacao. Isto e o SEED/FALLBACK, nao a fonte viva: cada
bloco pode ser sobrescrito por TG (TG.prompt_papel / prompt_idioma /
prompt_execucao). Campo vazio no TG = usa o default daqui.

Fica dentro de apps/chat/ de proposito — o CLAUDE.md manda o prompt do Kevin
viver so em apps/chat/. Para mudar o COMPORTAMENTO padrao, edite os .txt aqui;
para calibrar um TG especifico sem deploy, use o editor da coordenacao.
"""
from pathlib import Path

_DIR = Path(__file__).resolve().parent


def _ler(nome: str) -> str:
    return (_DIR / nome).read_text(encoding='utf-8').strip()


PROMPT_PAPEL_PADRAO = _ler('papel.txt')
PROMPT_IDIOMA_PADRAO = _ler('idioma.txt')
PROMPT_EXECUCAO_PADRAO = _ler('execucao.txt')

# Playground (Demanda 20): sessao sem aula cadastrada. Mesmo esquema dos blocos
# da aula — default aqui, override nos campos TG.playground_*. A abertura e uma
# fala fixa (D53), nao um bloco do system prompt.
PLAYGROUND_ABERTURA_PADRAO = _ler('playground_abertura.txt')
PLAYGROUND_PAPEL_PADRAO = _ler('playground_papel.txt')
PLAYGROUND_IDIOMA_PADRAO = _ler('playground_idioma.txt')
PLAYGROUND_EXECUCAO_PADRAO = _ler('playground_execucao.txt')


def montar_prompt(papel: str = '', idioma: str = '', execucao: str = '') -> str:
    """Junta os 3 blocos na ordem. Bloco vazio cai no default do arquivo.

    Usado tanto pela montagem do prompt base (sem argumentos = tudo default)
    quanto por TG.get_system_prompt() (passando os campos do TG).
    """
    return '\n\n'.join([
        (papel or PROMPT_PAPEL_PADRAO).strip(),
        (idioma or PROMPT_IDIOMA_PADRAO).strip(),
        (execucao or PROMPT_EXECUCAO_PADRAO).strip(),
    ])


def montar_prompt_playground(papel: str = '', idioma: str = '', execucao: str = '') -> str:
    """Os 3 blocos do Kevin no Playground, na ordem. Vazio cai no default."""
    return '\n\n'.join([
        (papel or PLAYGROUND_PAPEL_PADRAO).strip(),
        (idioma or PLAYGROUND_IDIOMA_PADRAO).strip(),
        (execucao or PLAYGROUND_EXECUCAO_PADRAO).strip(),
    ])
