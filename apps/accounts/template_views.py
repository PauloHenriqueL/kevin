from django.contrib.auth import views as auth_views
from django.shortcuts import redirect
from django.urls import reverse
from django.views import View


class LoginView(auth_views.LoginView):
    template_name = 'accounts/login.html'
    redirect_authenticated_user = True


class DashboardView(View):
    """
    Redireciona por role:
    - Professor  → /professor/ (Years → Turmas → Aulas)
    - Escola     → /gestao/ (painel do diretor)
    - Admin      → /admin/ (Django admin)
    """

    def get(self, request):
        if not request.user.is_authenticated:
            return redirect('login')

        if request.user.role == 'professor':
            return redirect(reverse('professor:years'))

        if request.user.role == 'diretor':
            return redirect(reverse('gestao:dashboard'))

        # Coordenador Bebelingue: até a área /coordenacao/ existir (Demanda 7),
        # ele trabalha pelo Django admin.
        if request.user.role in ('admin', 'coordenador'):
            return redirect('/admin/')

        return redirect('login')
