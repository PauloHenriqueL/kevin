from django.shortcuts import redirect
from django.urls import reverse


class EscolaMiddleware:
    """
    Injeta a escola do usuário logado no request.
    - Admin: request.escola = None (vê tudo)
    - Escola (diretor): request.escola = escola vinculada
    - Professor: request.escola = escola do professor
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.escola = None
        request.professor = None
        request.diretor = None

        if request.user.is_authenticated:
            if request.user.role == 'professor' and hasattr(request.user, 'professor'):
                request.professor = request.user.professor
                request.escola = request.user.professor.escola

            elif request.user.role == 'escola' and hasattr(request.user, 'diretor'):
                request.diretor = request.user.diretor
                request.escola = request.user.diretor.escola

        return self.get_response(request)


class LoginRequiredMiddleware:
    """Redireciona para login se não autenticado."""

    PUBLIC_PATHS = ['/login/', '/admin/', '/api/']

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if not request.user.is_authenticated:
            if not any(request.path.startswith(p) for p in self.PUBLIC_PATHS):
                return redirect(reverse('login'))

        # Bloqueia Django admin para não-superusuários
        if request.path.startswith('/admin/') and not request.path.startswith('/admin/login'):
            if request.user.is_authenticated and not request.user.is_superuser:
                return redirect(reverse('dashboard'))

        return self.get_response(request)
