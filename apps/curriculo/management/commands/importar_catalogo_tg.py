"""Importa o catálogo oficial de Atividades a partir do TG em PDF.

Fonte: a seção "GAMES FOR THE WHOLE YEAR" do Teacher's Guide (o que a regra de
negócio nº 8 chama de "Games Bank") e a seção de técnicas de uso de L1/L2.

Por que isto existe (ver D30 em docs/demandas.md): a D7 diz "sem seed" para
impedir que a gente invente dados no lugar do cliente. Aqui a fonte é o
documento oficial dele — importar é transcrever, não inventar. Sem o campo
`como_conduzir` preenchido, o Kevin improvisa a regra do jogo em sala, que é
exatamente o que a metodologia proíbe.

Uso:
    python manage.py importar_catalogo_tg "documento_escola/Y5 3x Part 1 .pdf"
    python manage.py importar_catalogo_tg <pdf> --dry-run
"""

import re
import shutil
import subprocess
import tempfile
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from apps.curriculo.models import Atividade

# Marcadores das seções dentro do TG.
INICIO_JOGOS = 'GAMES FOR THE WHOLE YEAR'
# O banco termina quando começa o TG propriamente dito (as aulas têm "WARM UP").
FIM_JOGOS = 'WARM UP'

# Rodapé de copyright repetido em toda página — nunca é conteúdo.
RUIDO = re.compile(r'Proibida a reprodu|Bebil[íi]ngue Ltda', re.I)

# Título de jogo: linha toda em maiúscula, curta, opcionalmente com um
# parêntese de contexto — "TONGUE TWISTER (Phonics)".
#
# A pontuação precisa entrar na classe de caracteres: há títulos como
# "UP, UP; DOWN, DOWN", "WHAT AM I?" e "WHAT'S MISSING?". Sem eles no padrão,
# o jogo era engolido pelo corpo do anterior em vez de virar entrada própria.
TITULO_JOGO = re.compile(
    r"^(?P<nome>[A-Z][A-Z0-9 &'’?!,;:/.\-]{2,45}?)"
    r"(?:\s*\((?P<contexto>[^)]{2,60})\))?\s*$"
)

# Letras isoladas ("A", "B") são divisórias alfabéticas do banco, não jogos.
DIVISORIA = re.compile(r'^[A-Z]$')

# Falsos positivos: cabeçalhos que passariam no padrão de título.
NAO_SAO_JOGOS = {
    'GAMES FOR THE WHOLE YEAR', 'NUMBERS', 'INDEX',
    'IMPORTANT NOTE', 'ATTENTION',
}

# Técnicas de L1/L2 (seção 2.2 do booklet). São `tipo=tecnica`, não jogo.
# Ficam explícitas porque são poucas e vivem numa seção de prosa, onde um
# parser genérico erraria mais do que acertaria.
TECNICAS = [
    ('Instant Translation',
     'Quando o aluno fala algo em português, o professor repete em inglês e '
     'incentiva o aluno a repetir.',
     'Política de idioma padrão do Kevin — ver o prompt em apps/chat/.'),
    ('Correlation',
     'Usada quando o aluno não entende um conceito ou instrução. O professor '
     'correlaciona inglês e português com a pergunta "How do you say … in '
     'English?". O aluno então repete.',
     'Para destravar compreensão sem abandonar o inglês.'),
    ('Sandwich Technique',
     'O professor diz a palavra/frase em inglês, depois em português, e repete '
     'em inglês. Usada ao dar uma instrução nova ou introduzir palavra nova.',
     'Introdução de vocabulário e instruções novas.'),
]


# Siglas e palavras que devem manter a forma original na capitalização.
PRESERVAR_CAIXA = {'Q&A', 'TV', 'L1', 'L2'}


def capitalizar_nome(bruto: str) -> str:
    """Converte "DON'T SAY IT" em "Don't Say It".

    `str.title()` não serve: quebra em apóstrofo ("Don’T Say It") e destrói
    siglas ("Q&A" viraria "Q&A" por acaso, mas "TV" viraria "Tv").
    """
    def capitalizar_palavra(palavra: str) -> str:
        if palavra in PRESERVAR_CAIXA:
            return palavra
        # Barra e hífen separam nomes ("Yes/No", "Tic-Tac-Toe"); apóstrofo não
        # ("Don't", "Jim's"). Por isso a divisão é explícita, e não `.title()`.
        return re.sub(
            r"(^|[/\-])([a-zA-Z])",
            lambda m: m.group(1) + m.group(2).upper(),
            palavra.lower(),
        )

    return ' '.join(capitalizar_palavra(p) for p in bruto.split())


def extrair_texto(pdf: Path) -> str:
    """Roda pdftotext -layout. O layout preserva a indentação que o parser usa."""
    if not shutil.which('pdftotext'):
        raise CommandError(
            'pdftotext não encontrado. Instale o poppler-utils:\n'
            '  sudo apt install poppler-utils'
        )

    with tempfile.NamedTemporaryFile(suffix='.txt') as saida:
        resultado = subprocess.run(
            ['pdftotext', '-layout', str(pdf), saida.name],
            capture_output=True,
            text=True,
        )
        if resultado.returncode != 0:
            raise CommandError(f'pdftotext falhou: {resultado.stderr.strip()}')
        return Path(saida.name).read_text(encoding='utf-8', errors='replace')


def recortar_banco_de_jogos(texto: str) -> list[str]:
    """Devolve só as linhas da seção de jogos."""
    linhas = texto.splitlines()

    try:
        inicio = next(i for i, l in enumerate(linhas) if INICIO_JOGOS in l)
    except StopIteration:
        raise CommandError(
            f'Seção "{INICIO_JOGOS}" não encontrada neste PDF. '
            'Confira se é a Parte 1 do TG — o banco de jogos só está nela.'
        )

    fim = next(
        (i for i, l in enumerate(linhas) if i > inicio and FIM_JOGOS in l),
        len(linhas),
    )
    return linhas[inicio + 1:fim]


def parsear_jogos(linhas: list[str]) -> list[dict]:
    """Cada jogo é um título em maiúscula seguido do corpo da regra.

    O texto vem com o corpo indentado no mesmo nível do título, então o que
    separa um do outro é o título ser inteiramente maiúsculo.
    """
    jogos: list[dict] = []
    atual: dict | None = None

    for linha in linhas:
        conteudo = linha.strip()

        if not conteudo or RUIDO.search(conteudo):
            continue

        # Divisória alfabética do banco ("A", "B", "C"…).
        if DIVISORIA.match(conteudo):
            continue

        match = TITULO_JOGO.match(conteudo)
        # Só é título se não tiver minúscula fora do parêntese de contexto.
        eh_titulo = bool(match) and match.group('nome') not in NAO_SAO_JOGOS

        if eh_titulo:
            if atual:
                jogos.append(atual)
            nome = match.group('nome').strip().rstrip('.')
            atual = {
                'nome': capitalizar_nome(nome),
                'contexto': (match.group('contexto') or '').strip(),
                'linhas': [],
            }
        elif atual is not None:
            atual['linhas'].append(conteudo)

    if atual:
        jogos.append(atual)

    # Um título sem corpo é quase sempre um falso positivo (cabeçalho solto).
    return [j for j in jogos if j['linhas']]


def montar_atividade(jogo: dict) -> dict:
    """Traduz o jogo parseado para os campos do modelo Atividade."""
    como_conduzir = '\n'.join(jogo['linhas']).strip()

    # A primeira frase serve de descrição curta; o resto fica no passo a passo.
    primeira_frase = re.split(r'(?<=[.!?])\s+', como_conduzir, maxsplit=1)[0]

    return {
        'nome': jogo['nome'],
        'tipo': Atividade.Tipo.JOGO,
        'descricao': primeira_frase[:500],
        'como_conduzir': como_conduzir,
        'objetivo_pedagogico': jogo['contexto'],
        'tags': ', '.join(
            filter(None, ['game', jogo['contexto'].lower()])
        )[:300],
    }


class Command(BaseCommand):
    help = (
        'Importa o catálogo oficial de atividades (Games Bank + técnicas) '
        'a partir do PDF do Teacher\'s Guide.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            'pdf',
            help='Caminho do TG (Parte 1 — é onde fica o banco de jogos).',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Mostra o que seria importado, sem gravar nada.',
        )
        parser.add_argument(
            '--sobrescrever',
            action='store_true',
            help=(
                'Atualiza atividades que já existem. Sem esta flag, as '
                'existentes são preservadas (o coordenador pode tê-las editado).'
            ),
        )

    def handle(self, *args, **opts):
        pdf = Path(opts['pdf'])
        if not pdf.exists():
            raise CommandError(f'Arquivo não encontrado: {pdf}')

        dry_run = opts['dry_run']
        sobrescrever = opts['sobrescrever']

        self.stdout.write(f'Lendo {pdf.name}…')
        texto = extrair_texto(pdf)
        jogos = parsear_jogos(recortar_banco_de_jogos(texto))

        registros = [montar_atividade(j) for j in jogos]
        registros += [
            {
                'nome': nome,
                'tipo': Atividade.Tipo.TECNICA,
                'descricao': descricao,
                'como_conduzir': descricao,
                'objetivo_pedagogico': objetivo,
                'tags': 'technique, l1, l2',
            }
            for nome, descricao, objetivo in TECNICAS
        ]

        self.stdout.write(
            f'Encontrados {len(jogos)} jogos e {len(TECNICAS)} técnicas.'
        )

        criadas = atualizadas = preservadas = 0

        for reg in registros:
            # escola=None => catálogo oficial da Bebelingue (D6).
            #
            # A busca é case-insensitive de propósito: o seed criou "Go and
            # Touch" e o TG traz "GO AND TOUCH". Casar literal criaria duas
            # entradas para o mesmo jogo, e os BlocoAula existentes ficariam
            # apontando para a versão pobre.
            existente = Atividade.objects.filter(
                nome__iexact=reg['nome'], escola__isnull=True
            ).first()

            if existente and not sobrescrever:
                preservadas += 1
                continue

            if dry_run:
                criadas += 0 if existente else 1
                atualizadas += 1 if existente else 0
                continue

            if existente:
                for campo, valor in reg.items():
                    setattr(existente, campo, valor)
                existente.save()
                atualizadas += 1
            else:
                Atividade.objects.create(escola=None, **reg)
                criadas += 1

        prefixo = '[dry-run] ' if dry_run else ''
        self.stdout.write(
            self.style.SUCCESS(
                f'{prefixo}{criadas} criadas · {atualizadas} atualizadas · '
                f'{preservadas} preservadas (use --sobrescrever para atualizar)'
            )
        )

        if dry_run and registros:
            self.stdout.write('\nAmostra do que seria importado:')
            for reg in registros[:5]:
                resumo = reg['como_conduzir'][:100].replace('\n', ' ')
                self.stdout.write(f'  · {reg["nome"]} — {resumo}…')
