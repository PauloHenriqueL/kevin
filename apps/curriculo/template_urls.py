from django.urls import path

from . import template_views

app_name = 'curriculo'

urlpatterns = [
    path('aulas/', template_views.AulaListView.as_view(), name='aula_list'),
    path('conteudos/', template_views.ConteudoListView.as_view(), name='conteudo_list'),
]
