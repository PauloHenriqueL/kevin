"""Controle da aula pelo celular (D62, reunião de 22/11/2026).

O telão mostra um QR; o celular do professor abre o link e vira o botão de
falar e o painel da aula. Sem login no celular: o link carrega um token
assinado (conversa + chave do controle) que vale por algumas horas. Gerar um
QR novo troca a chave e invalida os links anteriores.

O transporte é polling simples: sem Redis nem Channels em produção, e o
gunicorn é síncrono — conexão longa (SSE, long polling) prenderia um dos 3
workers. Cada busca é uma query pequena no Neon, na mesma região do Render.
"""
import secrets
from datetime import timedelta

from django.core import signing
from django.db import transaction
from django.utils import timezone

from .models import ControleRemoto

SALT = 'kevin.controle-remoto'
VALIDADE_SEGUNDOS = 8 * 60 * 60          # um turno de aulas
MAX_COMANDOS_GUARDADOS = 50
# Sem notícia há mais que isso, o outro lado conta como desconectado.
ONLINE_SEGUNDOS = 6

COMANDOS = {
    'iniciar',        # Começar / Iniciar aula
    'falar_inicio',   # botão de falar apertado: o telão abre o microfone
    'falar_fim',      # botão solto: o telão fecha e manda a fala ao Kevin
    'atencao',
    'repetir',
    'whisper',
    'so_ingles',
    'parar',          # o Kevin para de falar / a música para
}


def gerar_token(controle: ControleRemoto) -> str:
    return signing.dumps({'c': controle.conversa_id, 'k': controle.chave}, salt=SALT, compress=True)


def ler_token(token: str) -> ControleRemoto | None:
    """O controle do token, ou None se o token for inválido, vencido ou revogado."""
    try:
        dados = signing.loads(token, salt=SALT, max_age=VALIDADE_SEGUNDOS)
    except signing.BadSignature:
        return None
    controle = ControleRemoto.objects.filter(conversa_id=dados.get('c')).first()
    if not controle or not secrets.compare_digest(controle.chave, str(dados.get('k', ''))):
        return None
    return controle


def novo_controle(conversa) -> ControleRemoto:
    """Cria o controle da conversa ou troca a chave (QR novo derruba os celulares antigos)."""
    controle, _ = ControleRemoto.objects.get_or_create(
        conversa=conversa, defaults={'chave': secrets.token_hex(16)},
    )
    controle.chave = secrets.token_hex(16)
    controle.comandos = []
    controle.celular_visto_em = None
    controle.save(update_fields=['chave', 'comandos', 'celular_visto_em'])
    return controle


def enfileirar(controle_id: int, tipo: str) -> dict:
    """Põe um comando na fila. Trava a linha: dois toques seguidos não se perdem."""
    with transaction.atomic():
        controle = ControleRemoto.objects.select_for_update().get(id=controle_id)
        comando = {'id': controle.proximo_id, 'tipo': tipo, 'em': timezone.now().isoformat()}
        controle.comandos = (controle.comandos + [comando])[-MAX_COMANDOS_GUARDADOS:]
        controle.proximo_id += 1
        controle.celular_visto_em = timezone.now()
        controle.save(update_fields=['comandos', 'proximo_id', 'celular_visto_em'])
    return comando


def comandos_apos(controle: ControleRemoto, apos: int) -> list[dict]:
    return [c for c in controle.comandos if c['id'] > apos]


def online(visto_em) -> bool:
    return bool(visto_em) and timezone.now() - visto_em < timedelta(seconds=ONLINE_SEGUNDOS)


def qr_svg(url: str) -> str:
    """O QR do link como SVG inline (segno: Python puro, sem dependência de sistema)."""
    import segno
    # omitsize: só viewBox, sem width/height fixos — o SVG se ajusta à caixa do
    # modal. Com tamanho fixo ele saía cortado (sem a margem branca) e a câmera
    # não lia. border=4 é a margem mínima da norma; error='l' deixa menos denso.
    return segno.make(url, error='l').svg_inline(border=4, dark='#000000', omitsize=True)
