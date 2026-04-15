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
from .tasks import processar_mensagem_ia, processar_audio_ia


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
    Envia mensagem do professor e dispara task para IA responder.
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

        processar_mensagem_ia.delay(conversa.id, mensagem.conteudo)

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
