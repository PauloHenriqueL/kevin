"""Views da área da coordenação Bebelingue (Demanda 7, D23).

A tela central é a grade do TG: o mês (na verdade a Unit — ver D27) exibido
como semana × aula, no mesmo formato do arquivo que o coordenador já usa. O
editor de blocos monta o roteiro arrastando atividades do catálogo, com
autosave (D25).
"""
import json

from django.contrib import messages
from django.db import transaction
from django.db.models import Count, Max, Q
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect
from django.urls import reverse, reverse_lazy
from django.views.decorators.http import require_POST
from django.views.generic import (
    CreateView, ListView, TemplateView, UpdateView, View,
)

from apps.accounts.mixins import CoordenadorRequiredMixin
from apps.escolas.models import Escola, Professor
from apps.escolas.relatorios import montar_relatorio_professores, PERIODOS

from .models import Atividade, Aula, BlocoAula, ordem_da_unit


# Anos e unidades que a grade oferece por padrão. A Welcome e a June Unit não
# são numeradas no TG (D27+A).
YEARS = [1, 2, 3, 4, 5]
UNITS_PADRAO = ['WU', 'U1', 'U2', 'U3', 'U4', 'U5', 'U6', 'U7', 'U8', 'JU']

ROTULO_UNIT = {'WU': 'Welcome Unit', 'JU': 'June Unit'}


def rotulo_unit(unit):
    """Nome amigável da unit — "Welcome Unit", "Unit 3"…"""
    return ROTULO_UNIT.get(unit, f'Unit {unit[1:]}' if unit.startswith('U') else unit)


class CoordBase(CoordenadorRequiredMixin):
    """Base das telas de coordenação: injeta a navegação ativa no contexto."""
    active_nav = ''

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx['active_nav'] = self.active_nav
        return ctx


class DashboardView(CoordBase, TemplateView):
    template_name = 'coordenacao/dashboard.html'
    active_nav = 'dashboard'

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx['total_aulas'] = Aula.objects.count()
        ctx['total_atividades'] = Atividade.objects.filter(escola__isnull=True).count()
        ctx['total_escolas'] = Escola.objects.count()
        # Atividades oficiais sem regra preenchida: o Kevin improvisa sem elas.
        ctx['atividades_sem_regra'] = Atividade.objects.filter(
            escola__isnull=True, como_conduzir=''
        ).count()
        ctx['years'] = YEARS
        return ctx


# ──────────────────────────────────────────────
# Grade do TG
# ──────────────────────────────────────────────

class SelecionarUnitView(CoordBase, TemplateView):
    """Escolha de TG e Unit antes de abrir a grade.

    Lista os TGs existentes (cronogramas da Bebelingue) e, para o TG escolhido,
    as unidades. Assim a grade opera sobre um TG específico — 3x e 5x não se
    misturam (D31)."""
    template_name = 'coordenacao/tg_index.html'
    active_nav = 'tg'

    def get_context_data(self, **kwargs):
        from .models import TG
        ctx = super().get_context_data(**kwargs)

        # Contagem de aulas por (tg, unit), para marcar as unidades preenchidas.
        existentes = Aula.objects.values('tg_id', 'unit').annotate(n=Count('id'))
        mapa = {(e['tg_id'], e['unit']): e['n'] for e in existentes}

        ctx['painel_por_tg'] = [
            {
                'tg': tg,
                'units': [
                    {'sigla': u, 'rotulo': rotulo_unit(u), 'n': mapa.get((tg.id, u), 0)}
                    for u in UNITS_PADRAO
                ],
            }
            for tg in TG.objects.all()
        ]
        return ctx


class GradeView(CoordBase, TemplateView):
    """A grade semana × aula de uma Unit de um TG — a tela mais importante."""
    template_name = 'coordenacao/grade.html'
    active_nav = 'tg'

    def get_context_data(self, **kwargs):
        from .models import TG
        ctx = super().get_context_data(**kwargs)
        tg = get_object_or_404(TG, pk=self.kwargs['tg_id'])
        unit = self.kwargs['unit'].upper()

        aulas = list(
            Aula.objects.filter(tg=tg, unit=unit)
            .prefetch_related('blocos')
            .order_by('semana', 'numero_aula')
        )

        # Monta a matriz semana → {numero_aula: aula}. O TG tem exceções
        # (U7 pula para C5, U6 tem C4), então a grade se adapta ao que existe
        # em vez de assumir 3 colunas fixas.
        semanas = sorted({a.semana for a in aulas}) or [1, 2, 3, 4]
        max_aula = max((a.numero_aula for a in aulas), default=3)
        colunas = list(range(1, max(max_aula, 3) + 1))

        matriz = {s: {} for s in semanas}
        for aula in aulas:
            matriz.setdefault(aula.semana, {})[aula.numero_aula] = aula

        ctx.update({
            'tg': tg,
            'unit': unit,
            'rotulo_unit': rotulo_unit(unit),
            'semanas': semanas,
            'colunas': colunas,
            'matriz': [
                {'semana': s, 'celulas': [matriz[s].get(c) for c in colunas]}
                for s in semanas
            ],
            'total_aulas': len(aulas),
            'tipos': Aula.Tipo.choices,
        })
        return ctx


class DuplicarUnitView(CoordBase, View):
    """Copia a estrutura de uma Unit para outra, dentro do mesmo TG (D7.2).

    Copia a aula e seus blocos, para o coordenador editar por cima. A Unit de
    destino tem que estar vazia — nunca sobrescreve."""

    def post(self, request, tg_id, unit):
        from .models import TG
        tg = get_object_or_404(TG, pk=tg_id)
        unit = unit.upper()
        destino = request.POST.get('unit_destino', '').strip().upper()

        if not destino:
            messages.error(request, 'Escolha a Unit de destino.')
            return redirect('coordenacao:grade', tg_id=tg.id, unit=unit)

        if Aula.objects.filter(tg=tg, unit=destino).exists():
            messages.error(
                request,
                f'A {rotulo_unit(destino)} já tem aulas neste TG. '
                'Duplicar só funciona para uma Unit vazia.'
            )
            return redirect('coordenacao:grade', tg_id=tg.id, unit=unit)

        origem = Aula.objects.filter(tg=tg, unit=unit).prefetch_related('blocos')
        if not origem.exists():
            messages.error(request, 'A Unit de origem está vazia.')
            return redirect('coordenacao:grade', tg_id=tg.id, unit=unit)

        with transaction.atomic():
            for aula in origem:
                blocos = list(aula.blocos.all())
                aula.pk = None
                aula.unit = destino
                aula.save()  # regera código e ordem_unit
                for bloco in blocos:
                    bloco.pk = None
                    bloco.aula = aula
                    bloco.save()

        messages.success(
            request,
            f'{rotulo_unit(unit)} duplicada para {rotulo_unit(destino)}. '
            'Revise as aulas antes de publicar.'
        )
        return redirect('coordenacao:grade', tg_id=tg.id, unit=destino)


# ──────────────────────────────────────────────
# Aula: criar e editar o roteiro
# ──────────────────────────────────────────────

class AulaCreateView(CoordBase, CreateView):
    """Cria uma aula a partir de uma célula vazia da grade."""
    model = Aula
    template_name = 'coordenacao/aula_form.html'
    fields = ['tg', 'unit', 'semana', 'numero_aula', 'tipo', 'titulo',
              'mes', 'lesson', 'background', 'observacao']

    def get_initial(self):
        # A grade manda tg/unit/semana/numero por querystring ao criar.
        return {k: self.request.GET.get(k)
                for k in ('tg', 'unit', 'semana', 'numero_aula')
                if self.request.GET.get(k)}

    def form_valid(self, form):
        messages.success(self.request, 'Aula criada. Agora monte o roteiro.')
        self.object = form.save()
        return redirect('coordenacao:aula_editor', pk=self.object.pk)


class AulaUpdateView(CoordBase, UpdateView):
    """Edita os dados da aula (não o roteiro — isso é o editor de blocos)."""
    model = Aula
    template_name = 'coordenacao/aula_form.html'
    fields = ['tipo', 'titulo', 'mes', 'lesson',
              'background', 'observacao', 'kickoff']

    def get_success_url(self):
        return reverse('coordenacao:aula_editor', kwargs={'pk': self.object.pk})


class AulaEditorView(CoordBase, TemplateView):
    """O editor de blocos: roteiro da aula em fases, arrastável (D25)."""
    template_name = 'coordenacao/aula_editor.html'
    active_nav = 'tg'

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        aula = get_object_or_404(
            Aula.objects.prefetch_related('blocos__atividade'),
            pk=self.kwargs['pk'],
        )
        blocos = list(aula.blocos.select_related('atividade'))
        ctx['aula'] = aula
        ctx['fases'] = [
            {
                'valor': valor,
                'label': label,
                'blocos': sorted(
                    [b for b in blocos if b.fase == valor],
                    key=lambda b: b.ordem,
                ),
            }
            for valor, label in Aula.Fase.choices
        ]
        return ctx


# ──────────────────────────────────────────────
# Endpoints do editor de blocos (autosave, D25)
# ──────────────────────────────────────────────

def _bloco_json(bloco):
    return {
        'id': bloco.id,
        'fase': bloco.fase,
        'ordem': bloco.ordem,
        'rotulo': bloco.rotulo,
        'titulo': bloco.titulo,
        'instrucoes': bloco.instrucoes,
        'referencia': bloco.referencia,
        'atividade_id': bloco.atividade_id,
        'atividade_nome': bloco.atividade.nome if bloco.atividade_id else '',
        'atividade_tipo': (
            bloco.atividade.get_tipo_display() if bloco.atividade_id else ''
        ),
    }


@require_POST
def reordenar_blocos(request, pk):
    """Persiste a nova ordem e fase dos blocos após arrastar.

    O front manda [{id, fase, ordem}, …]; gravamos numa transação para a grade
    nunca ficar num estado meio-salvo.
    """
    aula = get_object_or_404(Aula, pk=pk)
    try:
        itens = json.loads(request.body)['blocos']
    except (KeyError, json.JSONDecodeError):
        return JsonResponse({'ok': False, 'erro': 'payload inválido'}, status=400)

    ids_da_aula = set(aula.blocos.values_list('id', flat=True))
    with transaction.atomic():
        for item in itens:
            if item['id'] not in ids_da_aula:
                continue  # não deixa mexer em bloco de outra aula
            BlocoAula.objects.filter(id=item['id']).update(
                fase=item['fase'], ordem=item['ordem']
            )
    return JsonResponse({'ok': True})


@require_POST
def adicionar_bloco(request, pk):
    """Cria um bloco novo numa fase — de atividade do catálogo ou título livre."""
    aula = get_object_or_404(Aula, pk=pk)
    dados = json.loads(request.body)
    fase = dados.get('fase')

    if fase not in dict(Aula.Fase.choices):
        return JsonResponse({'ok': False, 'erro': 'fase inválida'}, status=400)

    atividade = None
    if dados.get('atividade_id'):
        # Só catálogo oficial ou da própria escola — nunca de outra (D6).
        # A coordenação vê só o oficial.
        atividade = Atividade.objects.filter(
            id=dados['atividade_id'], escola__isnull=True
        ).first()

    titulo = dados.get('titulo', '').strip()
    if not atividade and not titulo:
        return JsonResponse(
            {'ok': False, 'erro': 'informe uma atividade ou um título'},
            status=400,
        )

    ultima_ordem = (
        aula.blocos.filter(fase=fase).aggregate(m=Max('ordem'))['m'] or 0
    )
    bloco = BlocoAula.objects.create(
        aula=aula,
        fase=fase,
        ordem=ultima_ordem + 1,
        atividade=atividade,
        titulo='' if atividade else titulo,
    )
    return JsonResponse({'ok': True, 'bloco': _bloco_json(bloco)})


@require_POST
def atualizar_bloco(request, pk):
    """Edita título livre, instruções ou referência de um bloco."""
    bloco = get_object_or_404(BlocoAula, pk=pk)
    dados = json.loads(request.body)

    for campo in ('titulo', 'instrucoes', 'referencia'):
        if campo in dados:
            setattr(bloco, campo, dados[campo])
    bloco.save()
    return JsonResponse({'ok': True, 'bloco': _bloco_json(bloco)})


@require_POST
def remover_bloco(request, pk):
    bloco = get_object_or_404(BlocoAula, pk=pk)
    bloco.delete()
    return JsonResponse({'ok': True})


def buscar_atividades(request):
    """Autocomplete de atividade no editor de blocos (D25).

    Retorna só o catálogo oficial (escola=None) — é o que a coordenação
    administra. Atividade local é assunto do professor.
    """
    termo = request.GET.get('q', '').strip()
    qs = Atividade.objects.filter(escola__isnull=True)
    if termo:
        qs = qs.filter(Q(nome__icontains=termo) | Q(tags__icontains=termo))

    resultados = [
        {
            'id': a.id,
            'nome': a.nome,
            'tipo': a.get_tipo_display(),
            'descricao': a.descricao[:80],
        }
        for a in qs.order_by('nome')[:15]
    ]
    return JsonResponse({'resultados': resultados})


# ──────────────────────────────────────────────
# Catálogo de atividades
# ──────────────────────────────────────────────

class CatalogoListView(CoordBase, ListView):
    template_name = 'coordenacao/catalogo.html'
    context_object_name = 'atividades'
    active_nav = 'catalogo'

    def get_queryset(self):
        # Só o catálogo oficial. Conta em quantas aulas cada atividade é usada,
        # para o coordenador ver o impacto antes de editar/remover (D7.3).
        qs = (
            Atividade.objects.filter(escola__isnull=True)
            .annotate(usos=Count('blocos'))
            .order_by('tipo', 'nome')
        )
        tipo = self.request.GET.get('tipo')
        if tipo:
            qs = qs.filter(tipo=tipo)
        termo = self.request.GET.get('q', '').strip()
        if termo:
            qs = qs.filter(Q(nome__icontains=termo) | Q(tags__icontains=termo))
        return qs

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx['tipos'] = Atividade.Tipo.choices
        ctx['tipo_ativo'] = self.request.GET.get('tipo', '')
        ctx['termo'] = self.request.GET.get('q', '')
        return ctx


class AtividadeCreateView(CoordBase, CreateView):
    model = Atividade
    template_name = 'coordenacao/atividade_form.html'
    fields = ['tipo', 'nome', 'descricao', 'como_conduzir',
              'objetivo_pedagogico', 'materiais', 'duracao_estimada',
              'arquivo_url', 'tags']
    success_url = reverse_lazy('coordenacao:catalogo')

    def form_valid(self, form):
        # Catálogo oficial: escola fica nula (D6). Registra quem criou.
        form.instance.escola = None
        form.instance.criado_por = self.request.user
        messages.success(self.request, 'Atividade adicionada ao catálogo oficial.')
        return super().form_valid(form)


class AtividadeUpdateView(CoordBase, UpdateView):
    model = Atividade
    template_name = 'coordenacao/atividade_form.html'
    fields = ['tipo', 'nome', 'descricao', 'como_conduzir',
              'objetivo_pedagogico', 'materiais', 'duracao_estimada',
              'arquivo_url', 'tags']
    success_url = reverse_lazy('coordenacao:catalogo')

    def get_queryset(self):
        # Coordenação edita só o catálogo oficial.
        return Atividade.objects.filter(escola__isnull=True)

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        # Onde a atividade é usada — para avisar antes de mudar (D7.3).
        ctx['usos'] = (
            self.object.blocos.select_related('aula')
            .order_by('aula__year', 'aula__ordem_unit')
        )
        return ctx

    def form_valid(self, form):
        messages.success(self.request, 'Atividade atualizada.')
        return super().form_valid(form)


# ──────────────────────────────────────────────
# Relatório orientado ao professor (Demanda 16, D33)
# ──────────────────────────────────────────────

class RelatorioProfessorView(CoordBase, TemplateView):
    """Onde cada professor (de todas as escolas) está no plano — a métrica que
    importa para a Bebelingue (D33). Com filtro temporal mês/ano."""
    template_name = 'coordenacao/relatorio_professor.html'
    active_nav = 'relatorio'

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        periodo = self.request.GET.get('periodo', 'mes_atual')
        if periodo not in dict(PERIODOS):
            periodo = 'mes_atual'
        professores = (
            Professor.objects.filter(ativo=True)
            .select_related('user', 'escola')
            .prefetch_related('turmas__serie__tg')
        )
        ctx.update(montar_relatorio_professores(professores, periodo=periodo))
        return ctx
