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
    list_display = ('titulo', 'year', 'ordem')
    list_filter = ('year',)
    inlines = [AulaConteudoInline, HomeworkInline]


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
