"""Resolve a URL de um asset do Kevin (Demanda 19, etapa 1).

Com `KEVIN_ASSETS_BASE_URL` configurado, aponta para o bucket público; sem
ela, cai em `static/`. Os dois caminhos coexistem de propósito: em produção a
mídia não está na imagem Docker (é gitignored), mas quem clonou o repo e
copiou um export do animador continua desenvolvendo offline, sem precisar de
credencial de bucket.
"""
from urllib.parse import quote

from django import template
from django.conf import settings
from django.templatetags.static import static

register = template.Library()

PREFIXO_STATIC = 'js/kevin-puppet/assets/'


@register.simple_tag
def kevin_asset(caminho):
    """`{% kevin_asset 'backgrounds/floresta.webp' %}`

    O `quote` é necessário: um dos arquivos do export tem espaço no nome
    (`take-a-shower .png`) e o motor o referencia exatamente assim. Sem
    escapar, a URL quebra.
    """
    base = getattr(settings, 'KEVIN_ASSETS_BASE_URL', '')
    if base:
        return f"{base.rstrip('/')}/{quote(caminho)}"
    return static(PREFIXO_STATIC + caminho)
