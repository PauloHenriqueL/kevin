import logging

from django.http import HttpResponse
from rest_framework import generics, permissions, status
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsProfessor

from .models import Conversa, Mensagem
from .serializers import (
    AtualizarEstadoSerializer,
    ConversaDetailSerializer,
    ConversaSerializer,
    EnviarMensagemSerializer,
    MensagemSerializer,
)
from .tasks import processar_mensagem_ia, processar_audio_ia, responder_ia_sync

logger = logging.getLogger(__name__)


class ConversaListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/chat/conversas/       — lista conversas do professor
    POST /api/chat/conversas/       — cria nova conversa
    """
    serializer_class = ConversaSerializer
    permission_classes = [IsProfessor]

    def get_queryset(self):
        return Conversa.objects.filter(
            professor=self.request.user.professor,
        ).prefetch_related('mensagens')

    def perform_create(self, serializer):
        serializer.save(professor=self.request.user.professor)


class ConversaDetailView(generics.RetrieveAPIView):
    """GET /api/chat/conversas/<id>/ — detalhes com todas as mensagens."""
    serializer_class = ConversaDetailSerializer
    permission_classes = [IsProfessor]

    def get_queryset(self):
        return Conversa.objects.filter(
            professor=self.request.user.professor,
        ).prefetch_related('mensagens')


class EnviarMensagemView(APIView):
    """
    POST /api/chat/conversas/<id>/mensagem/
    Envia mensagem do professor e dispara IA.

    Por padrão dispara Celery e retorna a mensagem do user (201).
    Com `?sync=1` ou `{"sync": true}`, executa sincronamente e retorna
    também a resposta do assistente (para o modo conversa por áudio).
    """
    permission_classes = [IsProfessor]

    def post(self, request, pk):
        conversa = Conversa.objects.filter(
            pk=pk,
            professor=request.user.professor,
        ).first()

        if not conversa:
            return Response(
                {'detail': 'Conversa não encontrada.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = EnviarMensagemSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        tipo = serializer.validated_data['tipo']

        # Evento do sistema ("a música terminou", botão apertado) vale nos dois
        # modos desde o Épico A (D60); só a aula não grava contexto.
        mensagem = Mensagem.objects.create(
            conversa=conversa,
            role='user',
            tipo=tipo,
            conteudo=serializer.validated_data['conteudo'],
        )
        # Playground: a 1ª fala do Teacher vira o contexto da sessão (D49).
        conversa.registrar_contexto(mensagem)

        sync = (
            request.query_params.get('sync') in ('1', 'true')
            or request.data.get('sync') is True
        )

        if sync:
            # Modo voz: a resposta é aguardada aqui. Se a IA falhar (chave,
            # modelo, rede, rate limit), devolve um erro tratado em vez de 500
            # — o frontend trata o 502 sem quebrar o loop de conversa ao vivo.
            try:
                resposta = responder_ia_sync(conversa.id)
            except Exception as exc:
                logger.error('Falha na resposta síncrona da IA (conversa=%s): %s',
                             conversa.id, exc)
                return Response(
                    {'detail': 'Kevin não conseguiu responder agora.'},
                    status=status.HTTP_502_BAD_GATEWAY,
                )
            return Response(
                {
                    'mensagem_user': MensagemSerializer(mensagem).data,
                    'resposta': MensagemSerializer(resposta).data,
                },
                status=status.HTTP_201_CREATED,
            )

        # Modo texto (async). Em produção roda eager (sem worker), então uma
        # falha da IA propaga até aqui — trata pra não virar 500.
        try:
            processar_mensagem_ia.delay(conversa.id, mensagem.conteudo)
        except Exception as exc:
            logger.error('Falha ao processar mensagem (conversa=%s): %s',
                         conversa.id, exc)
            return Response(
                {'detail': 'Kevin não conseguiu responder agora.'},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        return Response(
            MensagemSerializer(mensagem).data,
            status=status.HTTP_201_CREATED,
        )


class AtualizarEstadoView(APIView):
    """
    PATCH /api/chat/conversas/<id>/estado/   body: {"whisper": true} etc.

    Botões do professor (Whisper, Só inglês, limpar o quadro), na aula e no
    Playground (D60). Grava e devolve o estado; o frontend avisa o Kevin em
    seguida com um evento, para ele reagir em voz (Demanda 20).
    """
    permission_classes = [IsProfessor]

    def patch(self, request, pk):
        conversa = Conversa.objects.filter(
            pk=pk,
            professor=request.user.professor,
        ).first()
        if not conversa:
            return Response(
                {'detail': 'Conversa não encontrada.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = AtualizarEstadoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if serializer.validated_data:
            conversa.estado = {**(conversa.estado or {}), **serializer.validated_data}
            conversa.save(update_fields=['estado'])
        return Response(conversa.estado)


class RepetirPalavraView(APIView):
    """
    POST /api/chat/conversas/<id>/repetir/

    Botão Repetir (Demanda 24, D59): o Kevin reapresenta a última palavra
    ensinada. O guard rail fica aqui: a palavra vem do registro feito no
    momento do ensino (`estado.ultima_palavra`), nunca do histórico, e só
    dentro da janela de 2 minutos. A IA conduz a reintrodução a partir de um
    evento que já traz a palavra escrita.
    """
    permission_classes = [IsProfessor]

    def post(self, request, pk):
        from .ferramentas import segundos_restantes_para_repetir

        conversa = Conversa.objects.filter(
            pk=pk,
            professor=request.user.professor,
        ).first()
        if not conversa:
            return Response(
                {'detail': 'Conversa não encontrada.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        registro = (conversa.estado or {}).get('ultima_palavra') or {}
        if not registro.get('texto'):
            return Response(
                {'detail': 'Nenhuma palavra ensinada agora.'},
                status=status.HTTP_409_CONFLICT,
            )
        if segundos_restantes_para_repetir(conversa) <= 0:
            return Response(
                {'detail': 'O tempo para repetir passou.'},
                status=status.HTTP_409_CONFLICT,
            )

        palavra = registro['texto']
        evento = (
            f'O professor apertou Repetir. Reapresente agora a palavra "{palavra}" '
            f'perguntando à turma "How do you say {palavra} in English?" e peça para '
            'repetirem duas vezes.'
        )
        if request.data.get('apenas_palavra') is True:
            # Modo ao vivo: quem fala é o modelo realtime, que recebe o evento
            # pelo próprio canal. Aqui só a validação da janela (o guard rail).
            return Response({'palavra': palavra, 'evento': evento})
        mensagem = Mensagem.objects.create(
            conversa=conversa,
            role='user',
            tipo=Mensagem.TipoChoices.EVENTO,
            conteudo=evento,
        )
        try:
            resposta = responder_ia_sync(conversa.id)
        except Exception as exc:
            logger.error('Falha no Repetir (conversa=%s): %s', conversa.id, exc)
            return Response(
                {'detail': 'Kevin não conseguiu responder agora.'},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        return Response(
            {
                'mensagem_user': MensagemSerializer(mensagem).data,
                'resposta': MensagemSerializer(resposta).data,
            },
            status=status.HTTP_201_CREATED,
        )


class EnviarAudioView(APIView):
    """
    POST /api/chat/conversas/<id>/audio/
    Recebe áudio do professor, transcreve via STT, e dispara IA.
    """
    permission_classes = [IsProfessor]
    parser_classes = [MultiPartParser]

    def post(self, request, pk):
        conversa = Conversa.objects.filter(
            pk=pk,
            professor=request.user.professor,
        ).first()

        if not conversa:
            return Response(
                {'detail': 'Conversa não encontrada.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        audio_file = request.FILES.get('audio')
        if not audio_file:
            return Response(
                {'detail': 'Arquivo de áudio não enviado.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        audio_bytes = audio_file.read()

        mensagem = Mensagem.objects.create(
            conversa=conversa,
            role='user',
            tipo='audio',
            conteudo='[Áudio sendo transcrito...]',
        )

        processar_audio_ia.delay(conversa.id, mensagem.id, list(audio_bytes))

        return Response(
            MensagemSerializer(mensagem).data,
            status=status.HTTP_201_CREATED,
        )


class TranscreverAudioView(APIView):
    """
    POST /api/chat/stt/
    Recebe áudio (multipart `audio`) e retorna texto transcrito.

    Não persiste nem chama IA. Usado pelo cliente para obter a transcrição
    e decidir o que enviar ao chat (modo click-to-record e primeiro passo
    do modo hands-free).
    """
    permission_classes = [IsProfessor]
    parser_classes = [MultiPartParser]

    def post(self, request):
        from apps.chat.providers import get_stt_provider

        audio_file = request.FILES.get('audio')
        if not audio_file:
            return Response(
                {'detail': 'Arquivo de áudio não enviado.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        plano = request.user.professor.escola.plano
        stt = get_stt_provider(
            provider_name=plano.stt_provider,
            api_key=plano.stt_api_key,
        )

        try:
            texto = stt.transcrever(
                audio_file.read(),
                filename=audio_file.name or 'audio.webm',
            )
        except Exception as exc:
            return Response(
                {'detail': f'Falha na transcrição: {exc}'},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response({'text': texto})


class SintetizarTextoView(APIView):
    """
    POST /api/chat/tts/     body: {"text": "...", "estilo": "normal" | "sussurro"}
    Retorna bytes de áudio (MP3) direto no body. `estilo` é opcional
    (Everybody Whisper, D52).
    """
    permission_classes = [IsProfessor]

    def post(self, request):
        from apps.chat.providers import get_tts_provider
        from apps.chat.providers.tts import ESTILOS, limpar_para_fala

        texto = limpar_para_fala(request.data.get('text') or '')
        estilo = request.data.get('estilo') or 'normal'
        if estilo not in ESTILOS:
            estilo = 'normal'
        if not texto:
            return Response(
                {'detail': 'Campo "text" obrigatório.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        plano = request.user.professor.escola.plano
        tts = get_tts_provider(
            provider_name=plano.tts_provider,
            api_key=plano.tts_api_key,
            voice_id=plano.tts_voice_id,
            modelo=plano.tts_modelo,
        )

        try:
            audio_bytes = tts.sintetizar(texto, estilo=estilo)
        except Exception as exc:
            return Response(
                {'detail': f'Falha na síntese: {exc}'},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return HttpResponse(audio_bytes, content_type='audio/mpeg')


def _conversa_do_professor(request, pk):
    return Conversa.objects.filter(pk=pk, professor=request.user.professor).first()


def _nao_encontrada():
    return Response({'detail': 'Conversa não encontrada.'}, status=status.HTTP_404_NOT_FOUND)


# ── Controle pelo celular (D62) ─────────────────────────────────────────────

class ControleCriarView(APIView):
    """
    POST /api/chat/conversas/<id>/controle/

    O telão pede o QR. Cria o controle ou troca a chave (QR novo desconecta os
    celulares que usavam o anterior). Devolve o link e o QR em SVG.
    """
    permission_classes = [IsProfessor]

    def post(self, request, pk):
        from django.urls import reverse

        from .controle import VALIDADE_SEGUNDOS, gerar_token, novo_controle, qr_svg

        conversa = _conversa_do_professor(request, pk)
        if not conversa:
            return _nao_encontrada()
        controle = novo_controle(conversa)
        url = request.build_absolute_uri(
            reverse('chat:controle_celular', args=[gerar_token(controle)]),
        )
        return Response({'url': url, 'qr_svg': qr_svg(url), 'validade_segundos': VALIDADE_SEGUNDOS})


class ControleSyncView(APIView):
    """
    POST /api/chat/conversas/<id>/controle/sync/   body: {"apos": 12, "estado": {...}}

    Busca do telão: publica o estado dele (fase, botões) e recebe os comandos do
    celular com id maior que `apos`. Sem QR gerado ainda, `ativo: false` — o
    telão para de perguntar até o professor abrir o QR.
    """
    permission_classes = [IsProfessor]

    def post(self, request, pk):
        from django.utils import timezone

        from .controle import comandos_apos, online
        from .models import ControleRemoto

        conversa = _conversa_do_professor(request, pk)
        if not conversa:
            return _nao_encontrada()
        controle = ControleRemoto.objects.filter(conversa=conversa).first()
        if not controle:
            return Response({'ativo': False, 'comandos': [], 'celular_conectado': False})
        estado = request.data.get('estado')
        campos = {'telao_visto_em': timezone.now()}
        if isinstance(estado, dict):
            campos['estado_telao'] = estado
        # update() direto: não regrava a fila, que o celular pode estar mexendo agora.
        ControleRemoto.objects.filter(id=controle.id).update(**campos)
        try:
            apos = int(request.data.get('apos') or 0)
        except (TypeError, ValueError):
            apos = 0
        return Response({
            'ativo': True,
            'comandos': comandos_apos(controle, apos),
            'celular_conectado': online(controle.celular_visto_em),
        })


class _ControleCelularMixin:
    """Celular: sem login. O token do link é a credencial (e não há cookie, então não há CSRF)."""
    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def _controle(self, token):
        from .controle import ler_token
        return ler_token(token)

    @staticmethod
    def _proibido():
        return Response(
            {'detail': 'Link vencido ou substituído. Leia o QR do telão de novo.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    @staticmethod
    def _situacao(controle):
        from .controle import online
        return {
            'telao_online': online(controle.telao_visto_em),
            'estado': controle.estado_telao or {},
        }


class ControleEstadoView(_ControleCelularMixin, APIView):
    """GET /api/chat/controle/<token>/estado/ — o celular pergunta como está o telão."""

    def get(self, request, token):
        from django.utils import timezone

        from .models import ControleRemoto

        controle = self._controle(token)
        if not controle:
            return self._proibido()
        ControleRemoto.objects.filter(id=controle.id).update(celular_visto_em=timezone.now())
        return Response(self._situacao(controle))


class ControleComandoView(_ControleCelularMixin, APIView):
    """POST /api/chat/controle/<token>/comando/   body: {"tipo": "falar_inicio"}"""

    def post(self, request, token):
        from .controle import COMANDOS, enfileirar

        controle = self._controle(token)
        if not controle:
            return self._proibido()
        tipo = request.data.get('tipo')
        if tipo not in COMANDOS:
            return Response({'detail': 'Comando desconhecido.'}, status=status.HTTP_400_BAD_REQUEST)
        comando = enfileirar(controle.id, tipo)
        return Response({'comando': comando, **self._situacao(controle)}, status=status.HTTP_201_CREATED)


# ── Modo ao vivo: GPT Live / Realtime (teste) ───────────────────────────────

class LiveSessaoView(APIView):
    """
    POST /api/chat/conversas/<id>/live/sessao/
    body: {"voz": "openai"|"kevin", "modelo": "gpt-realtime-2.1", "voz_openai": "marin"}

    Devolve o token efêmero da OpenAI (o navegador abre o WebRTC direto com
    ela) e, na voz do Kevin, também um token de uso único da ElevenLabs.
    """
    permission_classes = [IsProfessor]

    def post(self, request, pk):
        from . import live

        conversa = _conversa_do_professor(request, pk)
        if not conversa:
            return _nao_encontrada()
        voz = request.data.get('voz') if request.data.get('voz') in live.VOZES else 'openai'
        modelo = request.data.get('modelo')
        modelo = modelo if modelo in live.MODELOS else live.modelo_padrao()
        voz_openai = request.data.get('voz_openai')
        voz_openai = voz_openai if voz_openai in live.VOZES_OPENAI else 'marin'

        plano = request.user.professor.escola.plano
        try:
            corpo = {
                'voz': voz,
                'openai': live.criar_token_openai(
                    plano, live.config_sessao(conversa, voz, modelo, voz_openai),
                ),
            }
            if voz == 'kevin':
                corpo['elevenlabs'] = live.criar_token_elevenlabs(plano)
            corpo['historico'] = live.historico_recente(conversa)
        except live.LiveIndisponivel as exc:
            logger.error('Live indisponível (conversa=%s): %s', conversa.id, exc)
            return Response({'detail': str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
        return Response(corpo)


class LiveTokenVozView(APIView):
    """POST /api/chat/conversas/<id>/live/token-voz/ — próximo token de uso único da ElevenLabs."""
    permission_classes = [IsProfessor]

    def post(self, request, pk):
        from . import live

        if not _conversa_do_professor(request, pk):
            return _nao_encontrada()
        try:
            return Response(live.criar_token_elevenlabs(request.user.professor.escola.plano))
        except live.LiveIndisponivel as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_502_BAD_GATEWAY)


class LiveFerramentaView(APIView):
    """
    POST /api/chat/conversas/<id>/live/ferramenta/   body: {"nome": "...", "argumentos": "{...}"}

    O modelo realtime pediu uma ferramenta: executa aqui (mesmo código do modo
    tradicional, D51) e devolve o que vai para a IA e a ação para o telão.
    """
    permission_classes = [IsProfessor]

    def post(self, request, pk):
        from . import live
        from .ferramentas import executar

        conversa = _conversa_do_professor(request, pk)
        if not conversa:
            return _nao_encontrada()
        resultado = executar(
            conversa, str(request.data.get('nome') or ''),
            live.ler_argumentos(request.data.get('argumentos')),
        )
        return Response({
            'saida': resultado.texto_para_ia,
            'acao': resultado.acao,
            'precisa_continuar': resultado.precisa_continuar,
        })


class LiveRegistrarView(APIView):
    """
    POST /api/chat/conversas/<id>/live/registrar/
    body: {"role": "user"|"assistant"|"evento", "conteudo": "..."}

    Grava no histórico a transcrição de um turno ao vivo, sem chamar a IA. O
    histórico continua inteiro se o professor voltar ao modo tradicional, e a
    1ª fala no Playground segue virando o contexto (D49).
    """
    permission_classes = [IsProfessor]
    TIPOS = {
        'user': (Mensagem.RoleChoices.USER, Mensagem.TipoChoices.AUDIO),
        'assistant': (Mensagem.RoleChoices.ASSISTANT, Mensagem.TipoChoices.TEXTO),
        'evento': (Mensagem.RoleChoices.USER, Mensagem.TipoChoices.EVENTO),
    }

    def post(self, request, pk):
        conversa = _conversa_do_professor(request, pk)
        if not conversa:
            return _nao_encontrada()
        conteudo = str(request.data.get('conteudo') or '').strip()
        papel = self.TIPOS.get(request.data.get('role'))
        if not papel or not conteudo:
            return Response({'detail': 'role e conteudo obrigatórios.'}, status=status.HTTP_400_BAD_REQUEST)
        role, tipo = papel
        mensagem = Mensagem.objects.create(conversa=conversa, role=role, tipo=tipo, conteudo=conteudo)
        conversa.registrar_contexto(mensagem)
        return Response(MensagemSerializer(mensagem).data, status=status.HTTP_201_CREATED)
