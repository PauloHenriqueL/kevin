from django.contrib.auth.mixins import LoginRequiredMixin, UserPassesTestMixin
from django.core.exceptions import PermissionDenied


class RoleRequiredMixin(LoginRequiredMixin, UserPassesTestMixin):
    """Mixin base que verifica role do usuário."""
    allowed_roles = []

    def test_func(self):
        return self.request.user.role in self.allowed_roles


class AdminRequiredMixin(RoleRequiredMixin):
    allowed_roles = ['admin']


class EscolaRequiredMixin(RoleRequiredMixin):
    allowed_roles = ['admin', 'escola']


class ProfessorRequiredMixin(RoleRequiredMixin):
    allowed_roles = ['professor']


class EscolaFilterMixin:
    """
    Filtra querysets pela escola do usuário logado.
    Admin vê tudo, professor vê só da sua escola.
    """

    def get_escola_queryset(self, queryset):
        if self.request.user.role == 'admin':
            return queryset
        if self.request.escola:
            return queryset.filter(escola=self.request.escola)
        return queryset.none()

    def get_turma_queryset(self, queryset):
        if self.request.user.role == 'admin':
            return queryset
        if self.request.escola:
            return queryset.filter(turma__escola=self.request.escola)
        return queryset.none()
