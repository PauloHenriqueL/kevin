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

    # Fallback para static/. Com DEBUG=False o Django usa o storage de
    # manifesto, que LEVANTA ValueError quando o arquivo não foi coletado —
    # e a mídia do Kevin é gitignored, logo nunca é coletada em produção.
    #
    # Isso derrubou a página inteira da aula com 500 (28/09/2026): um cenário
    # ausente virava erro de servidor. Degradar é melhor: devolvemos o
    # caminho cru, o navegador dá 404 naquele asset, e a aula abre — o Kevin
    # aparece sem fundo em vez de a tela não abrir.
    try:
        return static(PREFIXO_STATIC + caminho)
    except ValueError:
        return f'{settings.STATIC_URL}{PREFIXO_STATIC}{quote(caminho)}'
