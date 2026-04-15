from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

app_name = 'curriculo_api'

router = DefaultRouter()
router.register('aulas', views.AulaViewSet, basename='aula')
router.register('conteudos', views.ConteudoViewSet, basename='conteudo')
router.register('aula-conteudos', views.AulaConteudoViewSet, basename='aula-conteudo')
router.register('homeworks', views.HomeworkViewSet, basename='homework')
router.register('progressos', views.ProgressoTurmaViewSet, basename='progresso')

urlpatterns = [
    path('', include(router.urls)),
]
