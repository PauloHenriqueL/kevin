from django.views.generic import ListView

from apps.accounts.mixins import AdminRequiredMixin, ProfessorRequiredMixin, EscolaFilterMixin

from .models import Escola, Professor, Turma


class EscolaListView(AdminRequiredMixin, ListView):
    template_name = 'escolas/escola_list.html'
    context_object_name = 'escolas'

    def get_queryset(self):
        return Escola.objects.select_related('plano').prefetch_related(
            'professores', 'turmas',
        )


class ProfessorListView(AdminRequiredMixin, ListView):
    template_name = 'escolas/professor_list.html'
    context_object_name = 'professores'

    def get_queryset(self):
        return Professor.objects.select_related('user', 'escola').prefetch_related('turmas')


class TurmaListView(ProfessorRequiredMixin, EscolaFilterMixin, ListView):
    template_name = 'escolas/turma_list.html'
    context_object_name = 'turmas'

    def get_queryset(self):
        qs = Turma.objects.select_related(
            'escola', 'professor__user',
        ).prefetch_related('alunos')
        return self.get_escola_queryset(qs)
