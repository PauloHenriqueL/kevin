from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.contrib.auth.views import LogoutView
from django.urls import include, path

from apps.accounts.template_views import DashboardView, LoginView

urlpatterns = [
    # Admin
    path('admin/', admin.site.urls),

    # Auth
    path('login/', LoginView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),

    # Dashboard
    path('', DashboardView.as_view(), name='dashboard'),

    # Fluxo do professor (Year → Turma → Aula + Chat)
    path('professor/', include('apps.escolas.professor_urls')),

    # Painel do diretor (gestão da escola)
    path('gestao/', include('apps.escolas.gestao_urls')),

    # Páginas de visualização (legado admin)
    path('escolas/', include('apps.escolas.template_urls')),
    path('curriculo/', include('apps.curriculo.template_urls')),
    path('chat/', include('apps.chat.template_urls')),

    # API REST
    path('api/escolas/', include('apps.escolas.urls')),
    path('api/curriculo/', include('apps.curriculo.urls')),
    path('api/chat/', include('apps.chat.urls')),
    path('api/accounts/', include('apps.accounts.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATICFILES_DIRS[0])
