from django.contrib import admin

from .models import Atividade, Aula, AulaTurma, BlocoAula, Homework, TG


@admin.register(TG)
class TGAdmin(admin.ModelAdmin):
    """Cronogramas (TGs) da Bebelingue — 3x/4x/5x por Year (D31)."""
    list_display = ('nome', 'year', 'frequencia', 'qtd_aulas')
    list_filter = ('year', 'frequencia')
    search_fields = ('nome',)
    ordering = ('year', 'frequencia')

    @admin.display(description='Aulas')
    def qtd_aulas(self, obj):
        return obj.aulas.count()


class BlocoAulaInline(admin.StackedInline):
    """O roteiro da aula, na ordem.

    StackedInline (não Tabular) porque `instrucoes` é texto longo — numa tabela
    fica ilegível para quem cadastra o TG.
    """
    model = BlocoAula
    extra = 3
    fields = ('fase', 'ordem', 'atividade', 'titulo', 'referencia', 'instrucoes')
    autocomplete_fields = ('atividade',)
    ordering = ('fase', 'ordem')


class HomeworkInline(admin.StackedInline):
    model = Homework
    extra = 1


@admin.register(Aula)
class AulaAdmin(admin.ModelAdmin):
    list_display = (
        'codigo', 'titulo', 'tg', 'unit', 'semana', 'numero_aula', 'tipo',
    )
    list_filter = ('tg', 'unit', 'tipo', 'mes')
    search_fields = ('codigo', 'titulo', 'lesson')
    ordering = ('year', 'ordem_unit', 'semana', 'numero_aula')
    autocomplete_fields = ('tg',)
    inlines = [BlocoAulaInline, HomeworkInline]

    fieldsets = (
        ('Onde fica no TG', {
            'fields': ('tg', 'unit', 'semana', 'numero_aula'),
            'description': (
                'A aula pertence a um TG (o cronograma 3x/4x/5x). O código '
                '(ex: Y5-U1W1C1) é gerado a partir da Unit/Semana/Aula.'
            ),
        }),
        ('Que aula é esta', {
            'fields': ('titulo', 'tipo', 'mes', 'lesson'),
            'description': (
                'O mês é só contexto de calendário (a faixa lateral do TG). '
                'Quem endereça a aula é a Unit.'
            ),
        }),
        ('Extras', {
            'fields': ('observacao', 'background', 'kickoff'),
            'classes': ('collapse',),
            'description': 'Opcionais. Deixe em branco se não se aplicar.',
        }),
    )


@admin.register(Atividade)
class AtividadeAdmin(admin.ModelAdmin):
    list_display = ('nome', 'tipo', 'origem', 'tem_como_conduzir')
    list_filter = ('tipo', 'escola')
    search_fields = ('nome', 'descricao', 'objetivo_pedagogico', 'tags')
    ordering = ('tipo', 'nome')

    fieldsets = (
        ('Identificação', {
            'fields': ('nome', 'tipo', 'escola'),
            'description': (
                'Deixe "escola" VAZIO para o catálogo oficial da Bebelingue '
                '(visível para todas as escolas).'
            ),
        }),
        ('O que o Kevin precisa saber', {
            'fields': ('descricao', 'objetivo_pedagogico', 'como_conduzir'),
            'description': (
                '"Como conduzir" é o campo mais importante: é ele que vai para '
                'o Kevin. Sem ele, o Kevin improvisa a atividade.'
            ),
        }),
        ('Detalhes', {
            'fields': ('materiais', 'duracao_estimada', 'arquivo_url', 'tags'),
        }),
    )

    @admin.display(description='Origem')
    def origem(self, obj):
        return obj.escola.nome if obj.escola_id else '★ Bebelingue'

    @admin.display(description='Kevin sabe conduzir?', boolean=True)
    def tem_como_conduzir(self, obj):
        return bool(obj.como_conduzir.strip())


@admin.register(BlocoAula)
class BlocoAulaAdmin(admin.ModelAdmin):
    list_display = ('aula', 'fase', 'ordem', 'rotulo')
    list_filter = ('fase', 'aula__year', 'aula__unit')
    search_fields = ('aula__codigo', 'titulo', 'atividade__nome')
    autocomplete_fields = ('aula', 'atividade')


@admin.register(AulaTurma)
class AulaTurmaAdmin(admin.ModelAdmin):
    list_display = ('turma', 'aula', 'status', 'data_realizada', 'professor', 'presentes')
    list_filter = ('status', 'turma__escola', 'turma__year')
    search_fields = ('turma__nome', 'aula__codigo')
    autocomplete_fields = ('aula',)
    date_hierarchy = 'data_realizada'


@admin.register(Homework)
class HomeworkAdmin(admin.ModelAdmin):
    list_display = ('aula', 'descricao')
    search_fields = ('aula__codigo', 'descricao')
    autocomplete_fields = ('aula',)
