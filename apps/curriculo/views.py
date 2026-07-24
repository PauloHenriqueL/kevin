from django.db.models import Q
from rest_framework import viewsets

from apps.accounts.permissions import IsAdminOrCoordenador, IsAdminOrReadOnly

from .models import Atividade, Aula, AulaTurma, BlocoAula, Homework
from .serializers import (
    AtividadeSerializer,
    AulaListSerializer,
    AulaSerializer,
    AulaTurmaSerializer,
    BlocoAulaSerializer,
    HomeworkSerializer,
)

ROLES_GLOBAIS = ('admin', 'coordenador')


class AulaViewSet(viewsets.ModelViewSet):
    """Aulas do TG — coordenador cria/edita, professor só lê."""
    queryset = Aula.objects.prefetch_related('blocos__atividade', 'homeworks')
    permission_classes = [IsAdminOrReadOnly]
    filterset_fields = ['year', 'unit', 'mes', 'tipo']
    search_fields = ['codigo', 'titulo']

    def get_serializer_class(self):
        if self.action == 'list':
            return AulaListSerializer
        return AulaSerializer


class AtividadeViewSet(viewsets.ModelViewSet):
    """Catálogo de atividades.

    Isolamento entre escolas (D6): cada usuário vê o catálogo oficial da
    Bebelingue (escola nula) mais as atividades locais da própria escola —
    nunca as de outra.
    """
    serializer_class = AtividadeSerializer
    filterset_fields = ['tipo']
    search_fields = ['nome', 'descricao', 'objetivo_pedagogico', 'tags']

    def get_queryset(self):
        user = self.request.user
        qs = Atividade.objects.select_related('escola', 'criado_por')

        if user.role in ROLES_GLOBAIS:
            return qs

        escola = getattr(self.request, 'escola', None)
        if escola:
            return qs.filter(Q(escola__isnull=True) | Q(escola=escola))
        return qs.filter(escola__isnull=True)

    def perform_create(self, serializer):
        """Professor só cria atividade LOCAL; coordenador cria a oficial."""
        user = self.request.user
        if user.role in ROLES_GLOBAIS:
            serializer.save(criado_por=user)
        else:
            serializer.save(criado_por=user, escola=getattr(self.request, 'escola', None))


class BlocoAulaViewSet(viewsets.ModelViewSet):
    """Blocos do roteiro — coordenador gerencia."""
    queryset = BlocoAula.objects.select_related('aula', 'atividade')
    serializer_class = BlocoAulaSerializer
    permission_classes = [IsAdminOrCoordenador]
    filterset_fields = ['aula', 'fase']


class HomeworkViewSet(viewsets.ModelViewSet):
    """Homeworks — coordenador gerencia."""
    queryset = Homework.objects.select_related('aula')
    serializer_class = HomeworkSerializer
    permission_classes = [IsAdminOrReadOnly]
    filterset_fields = ['aula']


class AulaTurmaViewSet(viewsets.ModelViewSet):
    """Execução das aulas por turma — professor atualiza as suas."""
    serializer_class = AulaTurmaSerializer
    filterset_fields = ['turma', 'status', 'aula']

    def get_queryset(self):
        user = self.request.user
        qs = AulaTurma.objects.select_related('turma__escola', 'aula', 'professor')
        if user.role in ROLES_GLOBAIS:
            return qs
        if user.role == 'professor' and hasattr(user, 'professor'):
            return qs.filter(turma__escola=user.professor.escola)
        escola = getattr(self.request, 'escola', None)
        if escola:
            return qs.filter(turma__escola=escola)
        return AulaTurma.objects.none()
