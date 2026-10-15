import logging

from django.http import HttpResponse
from rest_framework import generics, permissions, status
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsProfessor

from .models import Conversa, Mensagem
from .serializers import (
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

        mensagem = Mensagem.objects.create(
            conversa=conversa,
            role='user',
            tipo=serializer.validated_data['tipo'],
            conteudo=serializer.validated_data['conteudo'],
        )

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
    POST /api/chat/tts/     body: {"text": "..."}
    Retorna bytes de áudio (MP3) direto no body.
    """
    permission_classes = [IsProfessor]

    def post(self, request):
        from apps.chat.providers import get_tts_provider

        texto = (request.data.get('text') or '').strip()
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
            audio_bytes = tts.sintetizar(texto)
        except Exception as exc:
            return Response(
                {'detail': f'Falha na síntese: {exc}'},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return HttpResponse(audio_bytes, content_type='audio/mpeg')
