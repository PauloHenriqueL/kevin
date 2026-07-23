from rest_framework.permissions import BasePermission


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'admin'


class IsCoordenador(BasePermission):
    """Coordenador pedagógico da Bebelingue — dono do currículo e do catálogo."""

    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'coordenador'


class IsDiretor(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'diretor'


# Alias de compatibilidade: o papel 'escola' virou 'diretor'.
IsEscola = IsDiretor


class IsProfessor(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'professor'


class IsAdminOrDiretor(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ('admin', 'diretor')


IsAdminOrEscola = IsAdminOrDiretor


class IsAdminOrCoordenador(BasePermission):
    """Quem pode manter o currículo global (aulas, catálogo de atividades)."""

    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ('admin', 'coordenador')


class IsAdminOrReadOnly(BasePermission):
    def has_permission(self, request, view):
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return request.user.is_authenticated
        return request.user.is_authenticated and request.user.role == 'admin'
