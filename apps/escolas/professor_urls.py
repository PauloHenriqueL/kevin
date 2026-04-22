from django.urls import path

from . import professor_views

app_name = 'professor'

urlpatterns = [
    path('', professor_views.YearsView.as_view(), name='years'),
    path('year/<int:year>/', professor_views.TurmasYearView.as_view(), name='turmas_year'),
    path('turma/<int:turma_id>/', professor_views.TurmaAulasView.as_view(), name='turma_aulas'),
    path('turma/<int:turma_id>/aula/<str:aula_codigo>/', professor_views.AulaDetailView.as_view(), name='aula_detail'),
    path('turma/<int:turma_id>/aula/<str:aula_codigo>/progresso/', professor_views.AtualizarProgressoView.as_view(), name='atualizar_progresso'),
    path('turma/<int:turma_id>/aula/<str:aula_codigo>/reset/', professor_views.ResetAulaView.as_view(), name='resetar_aula'),
    path('aulas/', professor_views.TodasAulasView.as_view(), name='todas_aulas'),
    path('biblioteca/', professor_views.BibliotecaView.as_view(), name='biblioteca'),
    path('meu-progresso/', professor_views.MeuProgressoView.as_view(), name='meu_progresso'),
]
