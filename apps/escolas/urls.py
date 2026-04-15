from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

app_name = 'escolas_api'

router = DefaultRouter()
router.register('planos', views.PlanoViewSet, basename='plano')
router.register('escolas', views.EscolaViewSet, basename='escola')
router.register('professores', views.ProfessorViewSet, basename='professor')
router.register('turmas', views.TurmaViewSet, basename='turma')
router.register('alunos', views.AlunoViewSet, basename='aluno')

urlpatterns = [
    path('', include(router.urls)),
]
