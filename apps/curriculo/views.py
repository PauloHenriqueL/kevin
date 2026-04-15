from rest_framework import viewsets

from apps.accounts.permissions import IsAdminOrReadOnly

from .models import Aula, AulaConteudo, Conteudo, Homework, ProgressoTurma
from .serializers import (
    AulaConteudoSerializer,
    AulaListSerializer,
    AulaSerializer,
    ConteudoSerializer,
    HomeworkSerializer,
    ProgressoTurmaSerializer,
)


class AulaViewSet(viewsets.ModelViewSet):
    """CRUD de aulas — admin cria/edita, professores só leem."""
    queryset = Aula.objects.prefetch_related('aula_conteudos__conteudo', 'homeworks')
    permission_classes = [IsAdminOrReadOnly]
    filterset_fields = ['year']

    def get_serializer_class(self):
        if self.action == 'list':
            return AulaListSerializer
        return AulaSerializer


class ConteudoViewSet(viewsets.ModelViewSet):
    """CRUD de conteúdos — qualquer professor cria, todos veem."""
    queryset = Conteudo.objects.select_related('criado_por__user').all()
    serializer_class = ConteudoSerializer
    filterset_fields = ['tipo']
    search_fields = ['titulo', 'descricao']

    def perform_create(self, serializer):
        serializer.save(criado_por=self.request.user.professor)


class AulaConteudoViewSet(viewsets.ModelViewSet):
    """Vincular conteúdos a aulas — admin gerencia."""
    queryset = AulaConteudo.objects.select_related('aula', 'conteudo').all()
    serializer_class = AulaConteudoSerializer
    permission_classes = [IsAdminOrReadOnly]
    filterset_fields = ['aula']


class HomeworkViewSet(viewsets.ModelViewSet):
    """CRUD de homeworks — admin gerencia."""
    queryset = Homework.objects.select_related('aula').all()
    serializer_class = HomeworkSerializer
    permission_classes = [IsAdminOrReadOnly]
    filterset_fields = ['aula']


class ProgressoTurmaViewSet(viewsets.ModelViewSet):
    """Progresso das turmas — professor atualiza as suas."""
    serializer_class = ProgressoTurmaSerializer
    filterset_fields = ['turma', 'status']

    def get_queryset(self):
        user = self.request.user
        qs = ProgressoTurma.objects.select_related('turma__escola', 'aula')
        if user.role == 'admin':
            return qs.all()
        if user.role == 'professor' and hasattr(user, 'professor'):
            return qs.filter(turma__escola=user.professor.escola)
        return ProgressoTurma.objects.none()
