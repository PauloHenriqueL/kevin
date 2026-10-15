"""Prompts padrao do Kevin (Demanda 8, D42).

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
