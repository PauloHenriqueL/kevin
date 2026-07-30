"""Relatório orientado ao professor (Demanda 16, D33).

A métrica que importa para a Bebelingue é a do professor, não a da turma. Este
módulo monta a estrutura Professor → Turma → posição no TG, com filtro temporal
(mês atual / mês passado / ano). É usado pela coordenação (todas as escolas) e
pelo diretor (a sua escola).
"""
from datetime import date, timedelta

from apps.curriculo.models import AulaTurma


PERIODOS = [
    ('mes_atual', 'Mês atual'),
    ('mes_passado', 'Mês passado'),
    ('ano', 'Ano'),
]


def _fim_do_periodo(periodo, hoje):
    """A data-limite (inclusive) que o filtro considera.

    A posição no plano é acumulada até essa data (D33 — "onde a turma estava no
    fim de junho"). Para o ano, é hoje (acumulado do ano inteiro).
    """
    if periodo == 'mes_passado':
        # Último dia do mês anterior = um dia antes do dia 1 deste mês.
        return hoje.replace(day=1) - timedelta(days=1)
    # mes_atual e ano: acumulado até hoje.
    return hoje


def montar_relatorio_professores(professores, periodo='mes_atual', hoje=None):
    """Monta os dados do relatório para uma lista/queryset de professores.

    Cada professor traz suas turmas; cada turma, a posição no TG acumulada até
    o fim do período. Ordena os professores pelo menor progresso médio (quem
    precisa de atenção primeiro).
    """
    hoje = hoje or date.today()
    ate = _fim_do_periodo(periodo, hoje)

    dados = []
    for prof in professores:
        turmas_data = []
        for turma in prof.turmas.all():
            pos = turma.posicao_no_plano(ate=ate)
            turmas_data.append({
                'turma': turma,
                'tg': turma.tg,
                'posicao': pos['aula'],       # aula mais avançada concluída
                'concluidas': pos['concluidas'],
                'total': pos['total'],
                'pct': pos['pct'],
            })

        pct_medio = (
            round(sum(t['pct'] for t in turmas_data) / len(turmas_data))
            if turmas_data else 0
        )
        dados.append({
            'professor': prof,
            'turmas': turmas_data,
            'pct_medio': pct_medio,
        })

    dados.sort(key=lambda d: d['pct_medio'])
    return {
        'professores': dados,
        'periodo': periodo,
        'periodo_label': dict(PERIODOS).get(periodo, periodo),
        'ate': ate,
        'periodos': PERIODOS,
    }
