from django.contrib import messages
from django.db.models import Sum
from django.shortcuts import get_object_or_404, redirect
from django.urls import reverse_lazy
from django.views.generic import CreateView, ListView, TemplateView, UpdateView

from apps.accounts.mixins import EscolaRequiredMixin

from apps.curriculo.models import AulaTurma

from .forms import ProfessorForm, TurmaForm
from .models import Professor, Turma


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
        ctx['total_alunos'] = (
            Turma.objects.filter(escola=escola).aggregate(
                total=Sum('qtd_alunos'),
            )['total'] or 0
        )
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
        ).select_related('professor__user')


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


# ── Relatórios ──

class RelatorioProgressoView(DiretorMixin, TemplateView):
    """Progresso de todas as turmas da escola, por aula."""
    template_name = 'gestao/relatorio_progresso.html'

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        escola = self.get_escola()

        turmas = Turma.objects.filter(
            escola=escola,
        ).select_related('professor__user')

        turmas_data = []
        for turma in turmas:
            total_aulas = turma.aulas_do_curriculo().count()
            concluidas = AulaTurma.objects.filter(
                turma=turma, status='concluida',
            ).count()
            parciais = AulaTurma.objects.filter(
                turma=turma, status='em_andamento',
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
    """Relatório orientado ao professor (Demanda 16, D33) — versão do diretor,
    restrita à escola dele. Reusa o mesmo helper da coordenação."""
    template_name = 'gestao/relatorio_professores.html'

    def get_context_data(self, **kwargs):
        from .relatorios import montar_relatorio_professores, PERIODOS
        ctx = super().get_context_data(**kwargs)

        periodo = self.request.GET.get('periodo', 'mes_atual')
        if periodo not in dict(PERIODOS):
            periodo = 'mes_atual'

        professores = (
            Professor.objects.filter(escola=self.get_escola(), ativo=True)
            .select_related('user', 'escola')
            .prefetch_related('turmas__serie__tg')
        )
        ctx.update(montar_relatorio_professores(professores, periodo=periodo))
        return ctx
