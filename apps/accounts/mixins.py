from django.contrib.auth.mixins import LoginRequiredMixin, UserPassesTestMixin
from django.core.exceptions import PermissionDenied


class RoleRequiredMixin(LoginRequiredMixin, UserPassesTestMixin):
    """Mixin base que verifica role do usuário."""
    allowed_roles = []

    def test_func(self):
        return self.request.user.role in self.allowed_roles


# Papéis internos da Bebelingue: enxergam todas as escolas, não só uma.
ROLES_GLOBAIS = ('admin', 'coordenador')


class AdminRequiredMixin(RoleRequiredMixin):
    allowed_roles = ['admin']


class CoordenadorRequiredMixin(RoleRequiredMixin):
    """Área da coordenação Bebelingue — currículo e catálogo oficial."""
    allowed_roles = ['admin', 'coordenador']


class DiretorRequiredMixin(RoleRequiredMixin):
    allowed_roles = ['admin', 'diretor']


# Alias de compatibilidade: o papel 'escola' virou 'diretor'.
EscolaRequiredMixin = DiretorRequiredMixin


class ProfessorRequiredMixin(RoleRequiredMixin):
    allowed_roles = ['professor']


class EscolaFilterMixin:
    """
    Filtra querysets pela escola do usuário logado.
    Admin e coordenador Bebelingue veem tudo; diretor e professor veem só
    a própria escola.
    """

    def get_escola_queryset(self, queryset):
        if self.request.user.role in ROLES_GLOBAIS:
            return queryset
        if self.request.escola:
            return queryset.filter(escola=self.request.escola)
        return queryset.none()

    def get_turma_queryset(self, queryset):
        if self.request.user.role in ROLES_GLOBAIS:
            return queryset
        if self.request.escola:
            return queryset.filter(turma__escola=self.request.escola)
        return queryset.none()
