from django.urls import path

from . import views

app_name = 'chat_api'

urlpatterns = [
    path('conversas/', views.ConversaListCreateView.as_view(), name='conversa_list'),
    path('conversas/<int:pk>/', views.ConversaDetailView.as_view(), name='conversa_detail'),
    path('conversas/<int:pk>/mensagem/', views.EnviarMensagemView.as_view(), name='enviar_mensagem'),
    path('conversas/<int:pk>/audio/', views.EnviarAudioView.as_view(), name='enviar_audio'),
]
