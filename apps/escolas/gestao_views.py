from django.contrib import messages
from django.shortcuts import get_object_or_404, redirect
from django.urls import reverse_lazy
from django.views.generic import CreateView, ListView, TemplateView, UpdateView

from apps.accounts.mixins import EscolaRequiredMixin

from apps.curriculo.models import Aula, ProgressoTurma

from .forms import AlunoForm, ProfessorForm, TurmaForm
from .models import Aluno, Professor, Turma


class DiretorMixin(EscolaRequiredMixin):
    """Garante que o diretor só vê dados da sua escola."""

    def get_escola(self):
        return self.request.escola


class GestaoDashboardView(DiretorMixin, TemplateView):
    template_name = 'gestao/dashboard.html'

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        escola = self.get_escola()
        ctx['escola'] = escola
        ctx['total_professores'] = Professor.objects.filter(escola=escola, ativo=True).count()
        ctx['total_turmas'] = Turma.objects.filter(escola=escola).count()
        ctx['total_alunos'] = Aluno.objects.filter(turma__escola=escola).count()
        ctx['professores'] = Professor.objects.filter(escola=escola).select_related('user')[:5]
        ctx['turmas'] = Turma.objects.filter(escola=escola).select_related('professor__user')[:5]
        return ctx


# ── Professores ──

class ProfessorListView(DiretorMixin, ListView):
    template_name = 'gestao/professor_list.html'
    context_object_name = 'professores'

    def get_queryset(self):
        return Professor.objects.filter(
            escola=self.get_escola(),
        ).select_related('user').prefetch_related('turmas')


class ProfessorCreateView(DiretorMixin, CreateView):
    template_name = 'gestao/professor_form.html'
    form_class = ProfessorForm
    success_url = reverse_lazy('gestao:professor_list')

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        kwargs['escola'] = self.get_escola()
        return kwargs

    def form_valid(self, form):
        form.save()
        messages.success(self.request, 'Professor cadastrado com sucesso!')
        return redirect(self.success_url)


class ProfessorUpdateView(DiretorMixin, UpdateView):
    template_name = 'gestao/professor_form.html'
    form_class = ProfessorForm
    success_url = reverse_lazy('gestao:professor_list')

    def get_queryset(self):
        return Professor.objects.filter(escola=self.get_escola())

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        kwargs['escola'] = self.get_escola()
        return kwargs

    def form_valid(self, form):
        form.save()
        messages.success(self.request, 'Professor atualizado com sucesso!')
        return redirect(self.success_url)


# ── Turmas ──

class TurmaListView(DiretorMixin, ListView):
    template_name = 'gestao/turma_list.html'
    context_object_name = 'turmas'

    def get_queryset(self):
        return Turma.objects.filter(
            escola=self.get_escola(),
        ).select_related('professor__user').prefetch_related('alunos')


class TurmaCreateView(DiretorMixin, CreateView):
    template_name = 'gestao/turma_form.html'
    form_class = TurmaForm
    success_url = reverse_lazy('gestao:turma_list')

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        kwargs['escola'] = self.get_escola()
        return kwargs

    def form_valid(self, form):
        form.save()
        messages.success(self.request, 'Turma criada com sucesso!')
        return redirect(self.success_url)


class TurmaUpdateView(DiretorMixin, UpdateView):
    template_name = 'gestao/turma_form.html'
    form_class = TurmaForm
    success_url = reverse_lazy('gestao:turma_list')

    def get_queryset(self):
        return Turma.objects.filter(escola=self.get_escola())

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        kwargs['escola'] = self.get_escola()
        return kwargs

    def form_valid(self, form):
        form.save()
        messages.success(self.request, 'Turma atualizada com sucesso!')
        return redirect(self.success_url)


# ── Alunos ──

class AlunoListView(DiretorMixin, ListView):
    template_name = 'gestao/aluno_list.html'
    context_object_name = 'alunos'

    def get_queryset(self):
        return Aluno.objects.filter(
            turma__escola=self.get_escola(),
        ).select_related('turma')


class AlunoCreateView(DiretorMixin, CreateView):
    template_name = 'gestao/aluno_form.html'
    form_class = AlunoForm
    success_url = reverse_lazy('gestao:aluno_list')

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        kwargs['escola'] = self.get_escola()
        return kwargs

    def form_valid(self, form):
        form.save()
        messages.success(self.request, 'Aluno cadastrado com sucesso!')
        return redirect(self.success_url)


class AlunoUpdateView(DiretorMixin, UpdateView):
    template_name = 'gestao/aluno_form.html'
    form_class = AlunoForm
    success_url = reverse_lazy('gestao:aluno_list')

    def get_queryset(self):
        return Aluno.objects.filter(turma__escola=self.get_escola())

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        kwargs['escola'] = self.get_escola()
        return kwargs

    def form_valid(self, form):
        form.save()
        messages.success(self.request, 'Aluno atualizado com sucesso!')
        return redirect(self.success_url)


# ── Relatórios ──

class RelatorioProgressoView(DiretorMixin, TemplateView):
    """Progresso de todas as turmas da escola, por aula."""
    template_name = 'gestao/relatorio_progresso.html'

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        escola = self.get_escola()

        turmas = Turma.objects.filter(
            escola=escola,
        ).select_related('professor__user').prefetch_related('alunos')

        turmas_data = []
        for turma in turmas:
            total_aulas = Aula.objects.filter(year=turma.year).count()
            concluidas = ProgressoTurma.objects.filter(
                turma=turma, status='concluida',
            ).count()
            parciais = ProgressoTurma.objects.filter(
                turma=turma, status='parcial',
            ).count()
            nao_iniciadas = total_aulas - concluidas - parciais
            pct = round((concluidas / total_aulas) * 100) if total_aulas else 0

            turmas_data.append({
                'turma': turma,
                'total_aulas': total_aulas,
                'concluidas': concluidas,
                'parciais': parciais,
                'nao_iniciadas': nao_iniciadas,
                'pct': pct,
            })

        # Ordena do menor progresso para o maior (quem precisa de atenção primeiro)
        turmas_data.sort(key=lambda x: x['pct'])

        # Totais gerais
        total_turmas = len(turmas_data)
        total_concluidas = sum(t['concluidas'] for t in turmas_data)
        total_parciais = sum(t['parciais'] for t in turmas_data)
        total_aulas_geral = sum(t['total_aulas'] for t in turmas_data)
        pct_geral = round((total_concluidas / total_aulas_geral) * 100) if total_aulas_geral else 0

        ctx['turmas_data'] = turmas_data
        ctx['total_turmas'] = total_turmas
        ctx['total_concluidas'] = total_concluidas
        ctx['total_parciais'] = total_parciais
        ctx['total_aulas_geral'] = total_aulas_geral
        ctx['pct_geral'] = pct_geral
        return ctx


class RelatorioProfessoresView(DiretorMixin, TemplateView):
    """Relatório de professores: turmas, alunos e progresso."""
    template_name = 'gestao/relatorio_professores.html'

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        escola = self.get_escola()

        professores = Professor.objects.filter(
            escola=escola,
        ).select_related('user').prefetch_related('turmas__alunos')

        prof_data = []
        for prof in professores:
            turmas = prof.turmas.all()
            total_alunos = sum(t.alunos.count() for t in turmas)

            total_aulas = 0
            total_concluidas = 0
            for turma in turmas:
                aulas_turma = Aula.objects.filter(year=turma.year).count()
                concl = ProgressoTurma.objects.filter(
                    turma=turma, status='concluida',
                ).count()
                total_aulas += aulas_turma
                total_concluidas += concl

            pct = round((total_concluidas / total_aulas) * 100) if total_aulas else 0

            prof_data.append({
                'professor': prof,
                'total_turmas': turmas.count(),
                'total_alunos': total_alunos,
                'total_aulas': total_aulas,
                'total_concluidas': total_concluidas,
                'pct': pct,
            })

        ctx['prof_data'] = prof_data
        return ctx
