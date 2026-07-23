from django.contrib import admin

from .models import Atividade, Aula, AulaTurma, BlocoAula, Homework


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
        'codigo', 'titulo', 'year', 'mes', 'semana', 'numero_aula',
        'tipo', 'frequencia_minima',
    )
    list_filter = ('year', 'mes', 'tipo', 'frequencia_minima', 'unit')
    search_fields = ('codigo', 'titulo', 'lesson')
    ordering = ('year', 'mes', 'semana', 'numero_aula')
    inlines = [BlocoAulaInline, HomeworkInline]

    fieldsets = (
        ('Onde fica no TG', {
            'fields': ('year', 'mes', 'semana', 'numero_aula'),
            'description': (
                'O código da aula (ex: Y5-MAR-W1C1) é gerado a partir destes '
                'campos. Preencha exatamente como está na grade do TG.'
            ),
        }),
        ('Que aula é esta', {
            'fields': ('titulo', 'tipo', 'frequencia_minima', 'unit', 'lesson'),
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
    list_filter = ('fase', 'aula__year', 'aula__mes')
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
