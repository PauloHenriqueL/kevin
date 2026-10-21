from django.contrib import admin

from .models import Conversa, Mensagem


class MensagemInline(admin.TabularInline):
    model = Mensagem
    extra = 0
    readonly_fields = ('role', 'tipo', 'conteudo', 'acoes', 'created_at')


@admin.register(Conversa)
class ConversaAdmin(admin.ModelAdmin):
    list_display = ('professor', 'modo', 'aula', 'turma', 'created_at')
    list_filter = ('modo', 'professor__escola')
    inlines = [MensagemInline]


@admin.register(Mensagem)
class MensagemAdmin(admin.ModelAdmin):
    list_display = ('conversa', 'role', 'tipo', 'created_at')
    list_filter = ('role', 'tipo')
