from django.contrib import admin

from .models import Aluno, Diretor, Escola, Plano, Professor, Turma


@admin.register(Plano)
class PlanoAdmin(admin.ModelAdmin):
    list_display = ('nome', 'valor_mensal', 'ia_provider', 'ia_modelo', 'tts_provider', 'stt_provider')
    fieldsets = (
        (None, {'fields': ('nome', 'valor_mensal')}),
        ('IA (Chat Kevin)', {'fields': ('ia_provider', 'ia_modelo', 'ia_api_key')}),
        ('TTS (Texto → Áudio)', {'fields': ('tts_provider', 'tts_api_key')}),
        ('STT (Áudio → Texto)', {'fields': ('stt_provider', 'stt_api_key')}),
    )


@admin.register(Escola)
class EscolaAdmin(admin.ModelAdmin):
    list_display = ('nome', 'slug', 'plano', 'ativa', 'created_at')
    list_filter = ('ativa', 'plano')
    prepopulated_fields = {'slug': ('nome',)}


class TurmaInline(admin.TabularInline):
    model = Turma
    extra = 0


@admin.register(Diretor)
class DiretorAdmin(admin.ModelAdmin):
    list_display = ('user', 'escola')
    list_filter = ('escola',)


@admin.register(Professor)
class ProfessorAdmin(admin.ModelAdmin):
    list_display = ('user', 'escola', 'ativo')
    list_filter = ('ativo', 'escola')
    inlines = [TurmaInline]


@admin.register(Turma)
class TurmaAdmin(admin.ModelAdmin):
    list_display = ('__str__', 'escola', 'year', 'nome', 'professor')
    list_filter = ('escola', 'year')


@admin.register(Aluno)
class AlunoAdmin(admin.ModelAdmin):
    list_display = ('nome', 'turma')
    list_filter = ('turma__escola',)
    search_fields = ('nome',)
