"""Guardas de papel para views em função.

As views em classe usam os mixins de `apps.accounts.mixins`. As views em
função não herdam nada, então precisam do equivalente explícito — foi a
ausência disso que deixou os endpoints do editor de blocos abertos a
qualquer usuário autenticado (D40).

Mantenha os papéis permitidos em sintonia com os mixins: `coordenador_required`
libera o mesmo par que `CoordenadorRequiredMixin`.
"""
from functools import wraps

from django.core.exceptions import PermissionDenied


def role_required(*roles):
    """Nega com 403 quem não tiver um dos papéis.

    403 e não redirecionamento: estes endpoints respondem a `fetch` do
    editor, e um 302 para a tela de login chegaria ao JavaScript como um
    sucesso com HTML no corpo — falha silenciosa, pior que o erro.
    """
    def decorator(view):
        @wraps(view)
        def _wrapped(request, *args, **kwargs):
            if not request.user.is_authenticated:
                raise PermissionDenied
            if request.user.role not in roles:
                raise PermissionDenied
            return view(request, *args, **kwargs)
        return _wrapped
    return decorator


# Área da coordenação Bebelingue — currículo e catálogo oficial.
# Espelha CoordenadorRequiredMixin.
coordenador_required = role_required('admin', 'coordenador')
