from django.contrib import admin

from .models import Diretor, Escola, Plano, Professor, Serie, Turma


@admin.register(Serie)
class SerieAdmin(admin.ModelAdmin):
    """Séries da escola — o vínculo com um TG (D32).

    É aqui que o coordenador escolhe qual cronograma cada segmento da escola
    segue: abre a série e seleciona o TG."""
    list_display = ('nome', 'escola', 'year', 'tg')
    list_filter = ('escola', 'year')
    search_fields = ('nome', 'escola__nome')
    autocomplete_fields = ('tg',)


@admin.register(Plano)
class PlanoAdmin(admin.ModelAdmin):
    list_display = ('nome', 'valor_mensal', 'ia_provider', 'ia_modelo', 'tts_provider', 'stt_provider')
    fieldsets = (
        (None, {'fields': ('nome', 'valor_mensal')}),
        ('IA (Chat Kevin)', {'fields': ('ia_provider', 'ia_modelo', 'ia_api_key')}),
        ('TTS (Texto → Áudio)', {'fields': ('tts_provider', 'tts_api_key', 'tts_voice_id', 'tts_modelo')}),
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
    search_fields = ('user__first_name', 'user__last_name', 'user__username')
    inlines = [TurmaInline]


@admin.register(Turma)
class TurmaAdmin(admin.ModelAdmin):
    list_display = (
        '__str__', 'escola', 'serie', 'nome', 'professor', 'qtd_alunos',
    )
    list_filter = ('escola', 'serie')
    search_fields = ('nome', 'escola__nome')
    autocomplete_fields = ('serie', 'professor')
