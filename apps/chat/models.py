from django.db import models


class Conversa(models.Model):
    class Modo(models.TextChoices):
        AULA = 'aula', 'Aula do TG'
        PLAYGROUND = 'playground', 'Playground'

    professor = models.ForeignKey(
        'escolas.Professor',
        on_delete=models.CASCADE,
        related_name='conversas',
    )
    aula = models.ForeignKey(
        'curriculo.Aula',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='conversas',
        help_text='Chat livre se nulo, chat contextual se preenchido',
    )
    # ── Playground (Demanda 20, D47) ──
    # Sessão sem aula cadastrada: o Kevin pergunta o tema e conduz a partir da
    # resposta do Teacher. Não gera AulaTurma — progresso continua sendo do TG.
    modo = models.CharField(
        max_length=20, choices=Modo.choices, default=Modo.AULA,
    )
    turma = models.ForeignKey(
        'escolas.Turma',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='conversas',
        help_text='Playground: a turma da sessão (define Year e TG).',
    )
    contexto = models.TextField(
        blank=True,
        default='',
        help_text='Playground: a primeira resposta do Teacher, literal (D49).',
    )
    estado = models.JSONField(
        default=dict,
        blank=True,
        help_text='Playground: whisper, so_ingles, cenario, quadro, jogo_id.',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Conversa'
        verbose_name_plural = 'Conversas'
        ordering = ['-created_at']

    def __str__(self):
        if self.eh_playground:
            return f'{self.professor} — Playground {self.turma or ""}'.rstrip()
        ctx = f' — {self.aula}' if self.aula else ' (livre)'
        return f'{self.professor}{ctx}'

    @property
    def eh_playground(self):
        return self.modo == self.Modo.PLAYGROUND

    def registrar_contexto(self, mensagem, texto=None):
        """Fixa a 1ª resposta do Teacher como contexto da sessão (D49).

        Só no Playground, só uma vez, e só com fala de verdade: evento do
        sistema (botão, fim de música) não conta. `texto` substitui o conteúdo
        da mensagem (ex.: a transcrição sem o prefixo 🎤). Devolve True se gravou.
        """
        if (
            not self.eh_playground
            or self.contexto
            or mensagem.role != Mensagem.RoleChoices.USER
            or mensagem.tipo == Mensagem.TipoChoices.EVENTO
        ):
            return False
        texto = (mensagem.conteudo if texto is None else texto or '').strip()
        if not texto:
            return False
        self.contexto = texto
        self.save(update_fields=['contexto'])
        return True


class Mensagem(models.Model):
    class RoleChoices(models.TextChoices):
        USER = 'user', 'Usuário'
        ASSISTANT = 'assistant', 'Assistente'

    class TipoChoices(models.TextChoices):
        TEXTO = 'texto', 'Texto'
        AUDIO = 'audio', 'Áudio'
        # Fato da sala que o Kevin precisa saber ("a música terminou", "o
        # Teacher ligou o Whisper pelo botão"). Vai à IA como mensagem do
        # usuário prefixada por [EVENTO]; não aparece no chat (Demanda 20).
        EVENTO = 'evento', 'Evento do sistema'

    conversa = models.ForeignKey(
        Conversa,
        on_delete=models.CASCADE,
        related_name='mensagens',
    )
    role = models.CharField(max_length=10, choices=RoleChoices.choices)
    tipo = models.CharField(max_length=10, choices=TipoChoices.choices, default=TipoChoices.TEXTO)
    conteudo = models.TextField(help_text='Texto da mensagem ou URL do áudio')
    celebrar = models.BooleanField(
        default=False,
        help_text=(
            'A IA sinalizou (via tool-calling) que esta resposta celebra um '
            'acerto do Teacher/turma — dispara o modo "celebrate" do Kevin.'
        ),
    )
    acoes = models.JSONField(
        default=list,
        blank=True,
        help_text='Ações que a IA pediu nesta resposta (ver apps/chat/ferramentas.py).',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Mensagem'
        verbose_name_plural = 'Mensagens'
        ordering = ['created_at']

    def __str__(self):
        return f'[{self.get_role_display()}] {self.conteudo[:50]}'
