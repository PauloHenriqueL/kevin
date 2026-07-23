from django.http import Http404
from django.shortcuts import get_object_or_404, redirect
from django.views import View
from django.views.generic import ListView, TemplateView

from apps.accounts.mixins import ProfessorRequiredMixin
from apps.chat.models import Conversa, Mensagem
from apps.curriculo.models import Atividade, Aula, AulaTurma

from .models import Turma


def _criar_mensagem_boas_vindas(conversa, aula):
    return Mensagem.objects.create(
        conversa=conversa,
        role='assistant',
        tipo='texto',
        conteudo=(
            f'Olá! Sou o Kevin 🐝\n\n'
            f'Já estou por dentro do conteúdo da aula **{aula.titulo}**.\n\n'
            f'Posso te ajudar com:\n'
            f'- Dicas de como apresentar os conteúdos\n'
            f'- Sugestões de atividades\n'
            f'- Tradução e pronúncia\n'
            f'- Ideias para o homework\n\n'
            f'É só perguntar!'
        ),
    )


class YearsView(ProfessorRequiredMixin, TemplateView):
    """Professor escolhe o Year."""
    template_name = 'professor/years.html'

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        professor = self.request.user.professor

        turmas = Turma.objects.filter(
            professor=professor,
        )

        years_set = set(turmas.values_list('year', flat=True))
        colors = ['purple', 'coral', 'mint', 'mustard']
        emojis = ['🌱', '🌿', '🌳', '🌟', '🚀']

        years = []
        for i, year in enumerate(sorted(years_set)):
            years.append({
                'year': year,
                'total_aulas': Aula.objects.filter(year=year).count(),
                'total_turmas': turmas.filter(year=year).count(),
                'color': colors[i % len(colors)],
                'emoji': emojis[i % len(emojis)],
            })

        ctx['years'] = years
        return ctx


class TurmasYearView(ProfessorRequiredMixin, TemplateView):
    """Professor escolhe a turma dentro de um Year."""
    template_name = 'professor/turmas.html'

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        year = kwargs['year']
        professor = self.request.user.professor

        ctx['year'] = year
        ctx['turmas'] = Turma.objects.filter(
            professor=professor,
            year=year,
        ).select_related('escola')
        ctx['total_aulas'] = Aula.objects.filter(year=year).count()

        return ctx


class TurmaAulasView(ProfessorRequiredMixin, TemplateView):
    """Lista de aulas para a turma escolhida."""
    template_name = 'professor/turma_aulas.html'

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        professor = self.request.user.professor

        turma = Turma.objects.filter(
            id=kwargs['turma_id'],
            professor=professor,
        ).select_related('escola').first()

        if not turma:
            raise Http404

        aulas = turma.aulas_do_curriculo().prefetch_related('blocos', 'homeworks')

        # Anexa status de progresso a cada aula
        progressos = dict(
            AulaTurma.objects.filter(turma=turma).values_list('aula_id', 'status')
        )
        for aula in aulas:
            aula.progresso_status = progressos.get(aula.id, 'nao_iniciada')

        ctx['turma'] = turma
        ctx['aulas'] = aulas

        return ctx


class AulaDetailView(ProfessorRequiredMixin, TemplateView):
    """
    Página da aula com conteúdo + Chat Kevin lateral.
    Cria ou reutiliza a conversa automaticamente.
    """
    template_name = 'professor/aula_detail.html'

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        professor = self.request.user.professor

        turma = Turma.objects.filter(
            id=kwargs['turma_id'],
            professor=professor,
        ).select_related('escola').first()

        if not turma:
            raise Http404

        aula = Aula.objects.filter(codigo=kwargs['aula_codigo']).first()
        if not aula:
            raise Http404

        blocos = aula.blocos.select_related('atividade').order_by('fase', 'ordem')
        homeworks = aula.homeworks.all()

        # Cria ou busca a conversa do professor com esta aula
        conversa, created = Conversa.objects.get_or_create(
            professor=professor,
            aula=aula,
        )

        if created:
            _criar_mensagem_boas_vindas(conversa, aula)

        mensagens = Mensagem.objects.filter(conversa=conversa).order_by('created_at')

        # Marca como 'em andamento' se estava não iniciada
        progresso, _ = AulaTurma.objects.get_or_create(
            turma=turma,
            aula=aula,
            defaults={'status': 'em_andamento'},
        )
        if progresso.status == 'nao_iniciada':
            progresso.status = 'em_andamento'
            progresso.save()

        ctx['turma'] = turma
        ctx['aula'] = aula
        ctx['blocos'] = blocos
        ctx['homeworks'] = homeworks
        ctx['conversa'] = conversa
        ctx['mensagens'] = mensagens
        ctx['progresso_status'] = progresso.status

        return ctx


class BibliotecaView(ProfessorRequiredMixin, ListView):
    """Biblioteca de conteúdos — somente leitura, com busca e filtro por tipo."""
    template_name = 'professor/biblioteca.html'
    context_object_name = 'conteudos'

    def get_queryset(self):
        from django.db.models import Q

        # Catálogo oficial (escola nula) + atividades locais da própria escola.
        escola = self.request.user.professor.escola
        qs = Atividade.objects.select_related('escola', 'criado_por').filter(
            Q(escola__isnull=True) | Q(escola=escola)
        )

        q = self.request.GET.get('q', '').strip()
        if q:
            qs = qs.filter(
                Q(nome__icontains=q) | Q(descricao__icontains=q)
                | Q(objetivo_pedagogico__icontains=q) | Q(tags__icontains=q)
            )

        tipo = self.request.GET.get('tipo', '').strip()
        if tipo:
            qs = qs.filter(tipo=tipo)

        return qs.order_by('tipo', 'nome')

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx['q'] = self.request.GET.get('q', '')
        ctx['tipo_filtro'] = self.request.GET.get('tipo', '')
        return ctx


class TodasAulasView(ProfessorRequiredMixin, ListView):
    """Lista todas as aulas do currículo com busca e filtro por year."""
    template_name = 'professor/todas_aulas.html'
    context_object_name = 'aulas'

    def get_queryset(self):
        qs = Aula.objects.prefetch_related('blocos', 'homeworks').all()

        q = self.request.GET.get('q', '').strip()
        if q:
            qs = qs.filter(titulo__icontains=q)

        year = self.request.GET.get('year', '').strip()
        if year:
            qs = qs.filter(year=year)

        return qs

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx['q'] = self.request.GET.get('q', '')
        year_raw = self.request.GET.get('year', '')
        ctx['year_filtro'] = int(year_raw) if year_raw.isdigit() else None
        ctx['years_disponiveis'] = sorted(
            Aula.objects.values_list('year', flat=True).distinct()
        )
        return ctx


class AtualizarProgressoView(ProfessorRequiredMixin, View):
    """POST: professor marca o status da aula.

    Ao concluir, grava data e professor automaticamente (D22). Presença e
    observação ficam opcionais — não travam a conclusão.
    """

    def post(self, request, turma_id, aula_codigo):
        from django.utils import timezone

        professor = request.user.professor
        turma = get_object_or_404(Turma, id=turma_id, professor=professor)
        aula = get_object_or_404(Aula, codigo=aula_codigo)

        novo_status = request.POST.get('status', 'em_andamento')
        if novo_status not in ('em_andamento', 'concluida', 'nao_iniciada', 'pulada'):
            novo_status = 'em_andamento'

        progresso, _ = AulaTurma.objects.get_or_create(turma=turma, aula=aula)
        progresso.status = novo_status
        if novo_status == 'concluida':
            progresso.data_realizada = progresso.data_realizada or timezone.localdate()
            progresso.professor = progresso.professor or professor
            presentes = request.POST.get('presentes', '').strip()
            if presentes.isdigit():
                progresso.presentes = int(presentes)
            obs = request.POST.get('observacoes', '').strip()
            if obs:
                progresso.observacoes = obs
        progresso.save()

        return redirect('professor:aula_detail', turma_id=turma.id, aula_codigo=aula.codigo)


class ResetAulaView(ProfessorRequiredMixin, View):
    """
    POST: reseta a aula para aquela turma do zero.
    - Apaga o AulaTurma (na próxima abertura volta a 'em_andamento').
    - Limpa o histórico de chat com o Kevin para essa aula e recria
      a mensagem inicial de boas-vindas.
    """

    def post(self, request, turma_id, aula_codigo):
        professor = request.user.professor
        turma = get_object_or_404(Turma, id=turma_id, professor=professor)
        aula = get_object_or_404(Aula, codigo=aula_codigo)

        AulaTurma.objects.filter(turma=turma, aula=aula).delete()

        conversa = Conversa.objects.filter(professor=professor, aula=aula).first()
        if conversa:
            Mensagem.objects.filter(conversa=conversa).delete()
            _criar_mensagem_boas_vindas(conversa, aula)

        return redirect('professor:aula_detail', turma_id=turma.id, aula_codigo=aula.codigo)


class MeuProgressoView(ProfessorRequiredMixin, TemplateView):
    """Visão geral do progresso de todas as turmas do professor."""
    template_name = 'professor/meu_progresso.html'

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        professor = self.request.user.professor

        turmas = Turma.objects.filter(
            professor=professor,
        ).select_related('escola')

        turmas_data = []
        for turma in turmas:
            total_aulas = turma.aulas_do_curriculo().count()
            concluidas = AulaTurma.objects.filter(
                turma=turma, status='concluida',
            ).count()
            parciais = AulaTurma.objects.filter(
                turma=turma, status='em_andamento',
            ).count()
            pct = round((concluidas / total_aulas) * 100) if total_aulas else 0

            turmas_data.append({
                'turma': turma,
                'total_aulas': total_aulas,
                'concluidas': concluidas,
                'parciais': parciais,
                'nao_iniciadas': total_aulas - concluidas - parciais,
                'pct': pct,
            })

        ctx['turmas_data'] = turmas_data
        return ctx
