from django.urls import path

from . import template_views

app_name = 'chat'

urlpatterns = [
    path('', template_views.ChatPageView.as_view(), name='chat_page'),
    # Controle pelo celular (D62): link do QR do telão, sem login.
    path('controle/<str:token>/', template_views.ControleCelularView.as_view(), name='controle_celular'),
]
