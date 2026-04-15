from collections import OrderedDict

from django.views.generic import ListView, TemplateView

from apps.accounts.mixins import ProfessorRequiredMixin

from .models import Aula, Conteudo


class AulaListView(ProfessorRequiredMixin, TemplateView):
    template_name = 'curriculo/aula_list.html'

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        aulas = Aula.objects.prefetch_related('aula_conteudos', 'homeworks').all()

        years = OrderedDict()
        for aula in aulas:
            years.setdefault(aula.year, []).append(aula)

        ctx['years'] = years
        return ctx


class ConteudoListView(ProfessorRequiredMixin, ListView):
    template_name = 'curriculo/conteudo_list.html'
    context_object_name = 'conteudos'

    def get_queryset(self):
        return Conteudo.objects.select_related('criado_por__user').all()

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx['total_musicas'] = Conteudo.objects.filter(tipo='musica').count()
        ctx['total_videos'] = Conteudo.objects.filter(tipo='video').count()
        ctx['total_textos'] = Conteudo.objects.filter(tipo='texto').count()
        ctx['total_imagens'] = Conteudo.objects.filter(tipo='imagem').count()
        return ctx
