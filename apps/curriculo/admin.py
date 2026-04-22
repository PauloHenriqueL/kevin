from django.contrib import admin

from .models import Aula, AulaConteudo, Conteudo, Homework, ProgressoTurma


class AulaConteudoInline(admin.TabularInline):
    model = AulaConteudo
    extra = 1


class HomeworkInline(admin.StackedInline):
    model = Homework
    extra = 0


@admin.register(Aula)
class AulaAdmin(admin.ModelAdmin):
    list_display = ('codigo', 'titulo', 'year', 'unit', 'week', 'class_num')
    list_filter = ('year', 'unit', 'week')
    search_fields = ('codigo', 'titulo')
    inlines = [AulaConteudoInline, HomeworkInline]
    fieldsets = (
        (None, {
            'fields': ('codigo', 'year', 'unit', 'week', 'class_num', 'titulo', 'descricao'),
            'description': 'O código é gerado automaticamente no formato Y{year}U{unit}W{week}C{class}.',
        }),
        ('Roteiro pedagógico (enviado à IA)', {
            'fields': ('warm_up', 'development', 'closure'),
            'description': 'Estes três campos compõem o contexto pedagógico que '
                           'o Kevin recebe. A "descrição" acima NÃO é enviada à IA.',
        }),
    )
    readonly_fields = ('codigo',)


@admin.register(Conteudo)
class ConteudoAdmin(admin.ModelAdmin):
    list_display = ('titulo', 'tipo', 'criado_por', 'created_at')
    list_filter = ('tipo',)
    search_fields = ('titulo', 'descricao')


@admin.register(ProgressoTurma)
class ProgressoTurmaAdmin(admin.ModelAdmin):
    list_display = ('turma', 'aula', 'status', 'updated_at')
    list_filter = ('status', 'turma__escola')


@admin.register(Homework)
class HomeworkAdmin(admin.ModelAdmin):
    list_display = ('aula', 'objetivo')
