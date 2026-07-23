from collections import OrderedDict

from django.views.generic import ListView, TemplateView

from apps.accounts.mixins import ProfessorRequiredMixin

from .models import Atividade, Aula


class AulaListView(ProfessorRequiredMixin, TemplateView):
    template_name = 'curriculo/aula_list.html'

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        aulas = Aula.objects.prefetch_related('blocos', 'homeworks').all()

        years = OrderedDict()
        for aula in aulas:
            years.setdefault(aula.year, []).append(aula)

        ctx['years'] = years
        return ctx


class ConteudoListView(ProfessorRequiredMixin, ListView):
    """Lista do catálogo de atividades (antiga 'biblioteca de conteúdos')."""
    template_name = 'curriculo/conteudo_list.html'
    context_object_name = 'conteudos'

    def get_queryset(self):
        return Atividade.objects.select_related('criado_por', 'escola').all()

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx['total_jogos'] = Atividade.objects.filter(tipo='jogo').count()
        ctx['total_tecnicas'] = Atividade.objects.filter(tipo='tecnica').count()
        ctx['total_rotinas'] = Atividade.objects.filter(tipo='rotina').count()
        ctx['total_recursos'] = Atividade.objects.filter(tipo='recurso').count()
        return ctx
