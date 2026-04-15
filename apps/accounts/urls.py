from django.urls import path
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

from . import views

app_name = 'accounts'

urlpatterns = [
    path('token/', TokenObtainPairView.as_view(), name='token_obtain'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('me/', views.MeuPerfilView.as_view(), name='meu_perfil'),
    path('registrar/', views.CriarUsuarioView.as_view(), name='registrar'),
]
