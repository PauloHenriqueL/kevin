from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

app_name = 'curriculo_api'

router = DefaultRouter()
router.register('aulas', views.AulaViewSet, basename='aula')
router.register('atividades', views.AtividadeViewSet, basename='atividade')
router.register('blocos', views.BlocoAulaViewSet, basename='bloco')
router.register('homeworks', views.HomeworkViewSet, basename='homework')
router.register('aulas-turma', views.AulaTurmaViewSet, basename='aula-turma')

urlpatterns = [
    path('', include(router.urls)),
]
