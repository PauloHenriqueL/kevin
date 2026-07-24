#!/usr/bin/env python3
"""Validador de export do Kevin — roda ANTES de entregar o export.

Checa as regras do contrato entre a animação e o sistema Kevin (Bebelingue).
Python 3 puro, sem dependências — roda em qualquer máquina.

USO:
    python3 validar_export.py caminho/para/export/

    # se o export está na pasta atual:
    python3 validar_export.py .

SAÍDA:
    Lista de ✅ / ❌ por regra e um veredito final.
    Código de saída 0 = pode entregar; 1 = tem problema.

Para o animador: rode isto no fim do seu script de export. Se falhar, o
problema está no seu lado e é mais rápido corrigir aí do que descobrir depois
que o sistema já quebrou na frente de um professor.
"""
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

SVG_NS = 'http://www.w3.org/2000/svg'

# Limites do contrato (Regra 5)
#
# BG_MAX_KB: só UM cenário carrega por aula, então o custo real por aula é
# ~1 background. Com 600 KB o primeiro carregamento fica em ~800 KB (SVG + 1
# cenário) — rápido mesmo em internet ruim de escola. Folga suficiente para o
# animador não precisar espremer a qualidade da arte contra o teto.
SVG_MAX_MB = 2.5
BG_MAX_KB = 600

# Grupos que o motor varre para esconder o esqueleto (buildRigState)
GRUPOS_BONES = {
    'Bones_Body', 'Bones_Left_Arm', 'Bones_Right_Arm',
    'Bones_Right_leg', 'Bones_Right_leg1',
}

# IDs que o motor procura por getNodeById — se faltarem, o motor quebra
IDS_OBRIGATORIOS = [
    'Head', 'Left_Arm', 'Right_Arm', 'Pelvis', 'Tail',
    'Bones_Body', 'Bones_Left_Arm', 'Bones_Right_Arm',
    'Mão_Ukulele', 'Mão_tchau', 'Corpo_mosca',
]

# Padrão de nome que indica um elemento de esqueleto
RE_BONE = re.compile(r'bone|Bone|Joelho|Pulso|Cotovelo|Ombro|pelvis|Pelvis', re.I)


class Resultado:
    def __init__(self):
        self.erros = []
        self.avisos = []

    def ok(self, msg):
        print(f'  \033[32m✅\033[0m {msg}')

    def erro(self, msg, como_corrigir=''):
        print(f'  \033[31m❌\033[0m {msg}')
        if como_corrigir:
            print(f'     \033[33m→ {como_corrigir}\033[0m')
        self.erros.append(msg)

    def aviso(self, msg, detalhe=''):
        print(f'  \033[33m⚠️\033[0m  {msg}')
        if detalhe:
            print(f'     {detalhe}')
        self.avisos.append(msg)


def mapear_pais(root):
    return {c: p for p in root.iter() for c in p}


def ancestrais_ids(el, pais):
    ids, cur = [], el
    while cur in pais:
        cur = pais[cur]
        if cur.get('id'):
            ids.append(cur.get('id'))
    return ids


def validar_svg(caminho: Path, r: Resultado):
    print('\n\033[1m▸ SVG do personagem\033[0m')

    if not caminho.exists():
        r.erro(f'{caminho.name} não encontrado', 'O export precisa incluir kevin-rigged.svg')
        return

    # Regra 5 — peso
    mb = caminho.stat().st_size / 1024 / 1024
    if mb <= SVG_MAX_MB:
        r.ok(f'Peso: {mb:.1f} MB (limite {SVG_MAX_MB} MB)')
    else:
        r.erro(
            f'Peso: {mb:.1f} MB — acima do limite de {SVG_MAX_MB} MB',
            'Exporte com 2 casas decimais e desmarque "Preserve Illustrator '
            'Editing Capabilities" (Regra 5)',
        )

    try:
        tree = ET.parse(caminho)
    except ET.ParseError as e:
        r.erro(f'SVG inválido: {e}')
        return
    root = tree.getroot()
    pais = mapear_pais(root)
    todos_ids = {el.get('id') for el in root.iter() if el.get('id')}

    # Regra 6 — IDs obrigatórios
    faltando = [i for i in IDS_OBRIGATORIOS if i not in todos_ids]
    if not faltando:
        r.ok(f'IDs obrigatórios presentes ({len(IDS_OBRIGATORIOS)} checados)')
    else:
        r.erro(
            f'IDs faltando: {", ".join(faltando)}',
            'O motor acha cada parte por id. Não renomeie camadas; se usar SVGO, '
            'ligue cleanupIds: false (Regra 6)',
        )

    # Regra 1 — bones fora dos grupos Bones_* nunca são escondidos pelo motor
    fora = []
    for el in root.iter():
        if el.tag == f'{{{SVG_NS}}}g':
            continue
        ident = el.get('id') or ''
        classe = el.get('class') or ''
        parece_bone = RE_BONE.search(ident) or classe in ('st36',)
        if not parece_bone:
            continue
        anc = ancestrais_ids(el, pais)
        if not (GRUPOS_BONES & set(anc)):
            fora.append((ident or f'<{el.tag.split("}")[-1]} class={classe}>',
                         ' > '.join(anc[:2]) or 'raiz'))

    if not fora:
        r.ok('Esqueleto: todos os bones dentro dos grupos Bones_*')
    else:
        r.erro(
            f'{len(fora)} elemento(s) de bone FORA dos grupos Bones_*',
            'O motor esconde bones varrendo os grupos Bones_*. O que está fora '
            'NUNCA é escondido e aparece na tela (Regra 1)',
        )
        for ident, pai in fora[:8]:
            print(f'       · {ident}  (dentro de: {pai})')

    # Regra 3 — a mosca precisa do grupo pai com id="Mosca"
    mosca_grupo = 'Mosca' in todos_ids
    corpo_mosca = 'Corpo_mosca' in todos_ids
    if corpo_mosca and mosca_grupo:
        r.ok('Mosca: grupo "Mosca" e "Corpo_mosca" presentes')
    elif corpo_mosca and not mosca_grupo:
        r.erro(
            'Existe "Corpo_mosca" mas NÃO existe o grupo pai id="Mosca"',
            'Sem o grupo "Mosca", o motor não consegue escondê-la no boot e ela '
            'aparece ao abrir (Regra 3)',
        )
    elif not corpo_mosca:
        r.aviso('Mosca não encontrada no SVG (ok se foi removida de propósito)')

    # Regra 2 — variantes de mão precisam do prefixo exato "Mão_"/"Mao_"
    variantes = [i for i in todos_ids if i.startswith(('Mão_', 'Mao_'))]
    suspeitas = [
        i for i in todos_ids
        if re.match(r'^(m[ãa]o|MAO|MÃO)', i or '', re.I)
        and not i.startswith(('Mão_', 'Mao_'))
        and i not in ('Mão', 'mão')
    ]
    if variantes:
        r.ok(f'Variantes de mão com prefixo correto: {", ".join(sorted(variantes))}')
    if suspeitas:
        r.erro(
            f'Variante(s) de mão com nome fora do padrão: {", ".join(suspeitas)}',
            'O motor esconde automaticamente só [id^="Mão_"] / [id^="Mao_"]. Fora '
            'desse prefixo, a mão fica sempre visível e dá "mão a mais" (Regra 2)',
        )


def validar_backgrounds(pasta: Path, r: Resultado):
    print('\n\033[1m▸ Cenários (backgrounds)\033[0m')
    bg_dir = pasta / 'assets' / 'backgrounds'
    if not bg_dir.exists():
        r.aviso('Pasta assets/backgrounds/ não encontrada')
        return

    imgs = sorted([p for p in bg_dir.iterdir()
                   if p.suffix.lower() in ('.png', '.jpg', '.jpeg', '.webp')])
    if not imgs:
        r.aviso('Nenhuma imagem de cenário encontrada')
        return

    pesados = [(p.name, p.stat().st_size / 1024) for p in imgs
               if p.stat().st_size / 1024 > BG_MAX_KB]
    if not pesados:
        r.ok(f'{len(imgs)} cenários, todos ≤ {BG_MAX_KB} KB')
    else:
        r.erro(
            f'{len(pesados)} cenário(s) acima de {BG_MAX_KB} KB',
            'Exporte em WebP ou PNG otimizado (Regra 5)',
        )
        for nome, kb in pesados[:8]:
            print(f'       · {nome}: {kb:.0f} KB')

    # Regra 4 — resolução uniforme (o Kevin é ancorado na base; tamanhos
    # diferentes deslocam onde ele "pisa")
    dims = {}
    for p in imgs:
        d = _dimensoes_png(p)
        if d:
            dims.setdefault(d, []).append(p.name)
    if len(dims) <= 1:
        if dims:
            (w, h), = dims.keys()
            r.ok(f'Resolução uniforme: {w}×{h}')
    else:
        r.erro(
            f'Cenários com resoluções diferentes ({len(dims)} tamanhos)',
            'Use a mesma resolução em todos — o Kevin é ancorado na base da '
            'imagem, então tamanhos diferentes mudam onde ele pisa (Regra 4)',
        )
        for (w, h), nomes in list(dims.items())[:5]:
            print(f'       · {w}×{h}: {", ".join(nomes[:3])}')

    print('     \033[33mℹ️  O "chão" onde o Kevin pisa precisa estar no terço '
          'inferior de CADA cenário,\n        livre de móveis. Isso só dá para '
          'conferir olhando — teste no demo.html.\033[0m')


def validar_videos(pasta: Path, r: Resultado):
    """O motor busca assets/videos/mudanca-cenario.webm por padrão.

    Sem ele, setBackground() troca o cenário sem a animação de transição.
    """
    print('\n\033[1m▸ Vídeos\033[0m')
    vid_dir = pasta / 'assets' / 'videos'
    transicao = vid_dir / 'mudanca-cenario.webm'

    if transicao.exists():
        mb = transicao.stat().st_size / 1024 / 1024
        r.ok(f'mudanca-cenario.webm presente ({mb:.1f} MB)')
    else:
        r.erro(
            'assets/videos/mudanca-cenario.webm ausente',
            'O motor procura este arquivo por padrão para animar a troca de '
            'cenário. Sem ele, o fundo troca sem transição.',
        )

    # .mov não deve viajar no export (é o master, pesado)
    if vid_dir.exists():
        movs = [p.name for p in vid_dir.iterdir() if p.suffix.lower() == '.mov']
        if movs:
            r.aviso(
                f'{len(movs)} arquivo(s) .mov no export',
                'Os .mov são os masters (dezenas de MB). Entregue só os .webm:\n'
                + '\n'.join(f'       · {m}' for m in movs[:5]),
            )


def _dimensoes_png(p: Path):
    """Lê largura/altura de PNG sem dependência externa."""
    try:
        with open(p, 'rb') as f:
            head = f.read(26)
        if head[:8] == b'\x89PNG\r\n\x1a\n':
            return (int.from_bytes(head[16:20], 'big'),
                    int.from_bytes(head[20:24], 'big'))
    except Exception:
        pass
    return None


def validar_estrutura(pasta: Path, r: Resultado):
    print('\n\033[1m▸ Estrutura do export\033[0m')
    esperados = ['kevin-rigged.svg', 'kevin-puppet.js', 'kevin-puppet.css']
    faltando = [f for f in esperados if not (pasta / f).exists()]
    if not faltando:
        r.ok('Arquivos principais presentes')
    else:
        r.erro(f'Faltando: {", ".join(faltando)}')

    if (pasta / 'demo.html').exists():
        r.ok('demo.html presente (use para testar antes de entregar)')
    else:
        r.aviso('demo.html ausente — sem ele não dá para testar o export isolado')

    # Arquivos soltos na raiz: só os esperados devem estar lá. Sobras (ex.:
    # background-forest.png duplicando assets/backgrounds/floresta.png) confundem
    # qual é o arquivo válido e viajam no zip à toa.
    permitidos = set(esperados) | {'demo.html', 'README.md'}
    soltos = sorted(
        p.name for p in pasta.iterdir()
        if p.is_file() and p.name not in permitidos and not p.name.startswith('.')
    )
    if not soltos:
        r.ok('Raiz limpa (só os arquivos previstos)')
    else:
        r.aviso(
            f'{len(soltos)} arquivo(s) solto(s) na raiz do export',
            'Mova para assets/ ou remova — a raiz deve ter só '
            'kevin-rigged.svg, kevin-puppet.js/.css, demo.html e README.md:\n'
            + '\n'.join(f'       · {n}' for n in soltos[:8]),
        )


def validar_readme(pasta: Path, r: Resultado):
    """O README do export deve dizer O QUE MUDOU nesta versão.

    Sem isso, quem recebe não sabe se precisa ajustar algo do lado do sistema
    (ex.: cenário renomeado exige mudança no banco).
    """
    print('\n\033[1m▸ Changelog (README.md)\033[0m')
    readme = pasta / 'README.md'
    if not readme.exists():
        r.erro(
            'README.md ausente',
            'Inclua um README.md com a seção "## Mudanças nesta versão"',
        )
        return

    try:
        txt = readme.read_text(encoding='utf-8', errors='ignore')
    except Exception as e:
        r.aviso(f'Não consegui ler o README.md: {e}')
        return

    # Procura um cabeçalho de changelog em pt/en
    padrao = re.compile(
        r'^#{1,4}\s*.*(mudan[çc]a|altera[çc]|changelog|novidade|what.?s new|'
        r'nesta vers[ãa]o|vers[ãa]o \d)',
        re.I | re.M,
    )
    if padrao.search(txt):
        r.ok('README tem seção de mudanças')
    else:
        r.erro(
            'README.md não tem seção de mudanças desta versão',
            'Adicione no topo:  "## Mudanças nesta versão"  com 2-3 linhas do que '
            'foi alterado (correções, modos novos, cenários novos). É como sabemos '
            'se precisamos ajustar algo do nosso lado.',
        )


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)

    pasta = Path(sys.argv[1]).resolve()
    if not pasta.is_dir():
        print(f'Erro: {pasta} não é uma pasta')
        sys.exit(2)

    print(f'\n\033[1m═══ Validando export: {pasta} ═══\033[0m')
    r = Resultado()

    validar_estrutura(pasta, r)
    validar_readme(pasta, r)
    validar_svg(pasta / 'kevin-rigged.svg', r)
    validar_backgrounds(pasta, r)
    validar_videos(pasta, r)

    print('\n' + '═' * 60)
    if r.erros:
        print(f'\033[31m\033[1m✗ {len(r.erros)} problema(s) — NÃO entregue este '
              f'export ainda.\033[0m')
        print('  Corrija os itens ❌ acima — cada um traz a orientação em amarelo.')
        sys.exit(1)

    if r.avisos:
        print(f'\033[33m\033[1m✓ Passou, com {len(r.avisos)} aviso(s).\033[0m')
    else:
        print('\033[32m\033[1m✓ Tudo certo — pode entregar.\033[0m')
    print('  Lembre de testar no demo.html: todos os modos, todos os cenários.')
    sys.exit(0)


if __name__ == '__main__':
    main()
