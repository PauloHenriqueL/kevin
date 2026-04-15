from rest_framework import viewsets

from apps.accounts.permissions import IsAdmin, IsAdminOrReadOnly

from .models import Aluno, Escola, Plano, Professor, Turma
from .serializers import (
    AlunoSerializer,
    EscolaSerializer,
    PlanoSerializer,
    ProfessorSerializer,
    TurmaSerializer,
)


class PlanoViewSet(viewsets.ModelViewSet):
    """CRUD de planos — apenas admin cria/edita, demais só leem."""
    queryset = Plano.objects.all()
    serializer_class = PlanoSerializer
    permission_classes = [IsAdminOrReadOnly]


class EscolaViewSet(viewsets.ModelViewSet):
    """CRUD de escolas — admin gerencia, professores veem só a sua."""
    serializer_class = EscolaSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin':
            return Escola.objects.all()
        if user.role == 'professor' and hasattr(user, 'professor'):
            return Escola.objects.filter(id=user.professor.escola_id)
        return Escola.objects.none()


class ProfessorViewSet(viewsets.ModelViewSet):
    """CRUD de professores — admin vê todos, professor vê colegas da escola."""
    serializer_class = ProfessorSerializer

    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin':
            return Professor.objects.select_related('user', 'escola').all()
        if user.role == 'professor' and hasattr(user, 'professor'):
            return Professor.objects.select_related('user', 'escola').filter(
                escola=user.professor.escola,
            )
        return Professor.objects.none()


class TurmaViewSet(viewsets.ModelViewSet):
    """CRUD de turmas — filtradas por escola do usuário."""
    serializer_class = TurmaSerializer

    def get_queryset(self):
        user = self.request.user
        qs = Turma.objects.select_related('escola', 'professor__user')
        if user.role == 'admin':
            return qs.all()
        if user.role == 'professor' and hasattr(user, 'professor'):
            return qs.filter(escola=user.professor.escola)
        return Turma.objects.none()


class AlunoViewSet(viewsets.ModelViewSet):
    """CRUD de alunos — filtrados pela escola do professor."""
    serializer_class = AlunoSerializer

    def get_queryset(self):
        user = self.request.user
        qs = Aluno.objects.select_related('turma__escola')
        if user.role == 'admin':
            return qs.all()
        if user.role == 'professor' and hasattr(user, 'professor'):
            return qs.filter(turma__escola=user.professor.escola)
        return Aluno.objects.none()
