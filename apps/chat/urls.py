from django.urls import path

from . import views

app_name = 'chat_api'

urlpatterns = [
    path('conversas/', views.ConversaListCreateView.as_view(), name='conversa_list'),
    path('conversas/<int:pk>/', views.ConversaDetailView.as_view(), name='conversa_detail'),
    path('conversas/<int:pk>/mensagem/', views.EnviarMensagemView.as_view(), name='enviar_mensagem'),
    path('conversas/<int:pk>/audio/', views.EnviarAudioView.as_view(), name='enviar_audio'),
    path('conversas/<int:pk>/estado/', views.AtualizarEstadoView.as_view(), name='atualizar_estado'),
    path('conversas/<int:pk>/repetir/', views.RepetirPalavraView.as_view(), name='repetir_palavra'),
    # Controle pelo celular (D62)
    path('conversas/<int:pk>/controle/', views.ControleCriarView.as_view(), name='controle_criar'),
    path('conversas/<int:pk>/controle/sync/', views.ControleSyncView.as_view(), name='controle_sync'),
    path('controle/<str:token>/estado/', views.ControleEstadoView.as_view(), name='controle_estado'),
    path('controle/<str:token>/comando/', views.ControleComandoView.as_view(), name='controle_comando'),
    # Modo ao vivo (GPT Live / Realtime) — teste
    path('conversas/<int:pk>/live/sessao/', views.LiveSessaoView.as_view(), name='live_sessao'),
    path('conversas/<int:pk>/live/token-voz/', views.LiveTokenVozView.as_view(), name='live_token_voz'),
    path('conversas/<int:pk>/live/ferramenta/', views.LiveFerramentaView.as_view(), name='live_ferramenta'),
    path('conversas/<int:pk>/live/registrar/', views.LiveRegistrarView.as_view(), name='live_registrar'),
    path('stt/', views.TranscreverAudioView.as_view(), name='stt'),
    path('tts/', views.SintetizarTextoView.as_view(), name='tts'),
]
