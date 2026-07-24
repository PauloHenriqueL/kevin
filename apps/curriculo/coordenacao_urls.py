"""Rotas da área da coordenação Bebelingue (Demanda 7).

Caminho exclusivo do coordenador (D23): as telas próprias substituem o Django
admin cru para o dia a dia — cadastrar o TG, montar o roteiro das aulas e
manter o catálogo oficial.
"""
from django.urls import path

from . import coordenacao_views as v

app_name = 'coordenacao'

urlpatterns = [
    path('', v.DashboardView.as_view(), name='dashboard'),

    # ── Grade do TG (a tela central) ──
    path('tg/', v.SelecionarUnitView.as_view(), name='tg_index'),
    path('tg/y<int:year>/<str:unit>/', v.GradeView.as_view(), name='grade'),
    path('tg/y<int:year>/<str:unit>/duplicar/', v.DuplicarUnitView.as_view(),
         name='duplicar_unit'),

    # ── Aula: criar na grade, editar o roteiro ──
    path('aula/nova/', v.AulaCreateView.as_view(), name='aula_create'),
    path('aula/<int:pk>/', v.AulaEditorView.as_view(), name='aula_editor'),
    path('aula/<int:pk>/dados/', v.AulaUpdateView.as_view(), name='aula_edit'),

    # ── Endpoints do editor de blocos (autosave via fetch, D25) ──
    path('aula/<int:pk>/blocos/reordenar/', v.reordenar_blocos,
         name='blocos_reordenar'),
    path('aula/<int:pk>/blocos/adicionar/', v.adicionar_bloco,
         name='bloco_adicionar'),
    path('bloco/<int:pk>/remover/', v.remover_bloco, name='bloco_remover'),
    path('bloco/<int:pk>/atualizar/', v.atualizar_bloco, name='bloco_atualizar'),
    path('atividades/buscar/', v.buscar_atividades, name='atividades_buscar'),

    # ── Catálogo de atividades ──
    path('catalogo/', v.CatalogoListView.as_view(), name='catalogo'),
    path('catalogo/nova/', v.AtividadeCreateView.as_view(), name='atividade_create'),
    path('catalogo/<int:pk>/', v.AtividadeUpdateView.as_view(), name='atividade_edit'),
]
