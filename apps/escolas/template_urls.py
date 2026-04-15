from django.urls import path

from . import template_views

app_name = 'escolas'

urlpatterns = [
    path('', template_views.EscolaListView.as_view(), name='escola_list'),
    path('professores/', template_views.ProfessorListView.as_view(), name='professor_list'),
    path('turmas/', template_views.TurmaListView.as_view(), name='turma_list'),
]
