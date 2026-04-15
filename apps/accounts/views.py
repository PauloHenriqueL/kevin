from rest_framework import generics, permissions

from .models import User
from .serializers import UserCreateSerializer, UserSerializer


class MeuPerfilView(generics.RetrieveUpdateAPIView):
    """GET/PUT /api/accounts/me/ — perfil do usuário logado."""
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


class CriarUsuarioView(generics.CreateAPIView):
    """POST /api/accounts/registrar/ — criar novo usuário (apenas admin)."""
    serializer_class = UserCreateSerializer
    permission_classes = [permissions.IsAdminUser]
