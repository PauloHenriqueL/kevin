from django.urls import path

from . import gestao_views

app_name = 'gestao'

urlpatterns = [
    path('', gestao_views.GestaoDashboardView.as_view(), name='dashboard'),

    # Professores
    path('professores/', gestao_views.ProfessorListView.as_view(), name='professor_list'),
    path('professores/novo/', gestao_views.ProfessorCreateView.as_view(), name='professor_create'),
    path('professores/<int:pk>/editar/', gestao_views.ProfessorUpdateView.as_view(), name='professor_edit'),

    # Turmas
    path('turmas/', gestao_views.TurmaListView.as_view(), name='turma_list'),
    path('turmas/nova/', gestao_views.TurmaCreateView.as_view(), name='turma_create'),
    path('turmas/<int:pk>/editar/', gestao_views.TurmaUpdateView.as_view(), name='turma_edit'),

    # Alunos
    path('alunos/', gestao_views.AlunoListView.as_view(), name='aluno_list'),
    path('alunos/novo/', gestao_views.AlunoCreateView.as_view(), name='aluno_create'),
    path('alunos/<int:pk>/editar/', gestao_views.AlunoUpdateView.as_view(), name='aluno_edit'),

    # Relatórios
    path('relatorios/progresso/', gestao_views.RelatorioProgressoView.as_view(), name='relatorio_progresso'),
    path('relatorios/professores/', gestao_views.RelatorioProfessoresView.as_view(), name='relatorio_professores'),
]
