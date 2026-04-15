from django.db import models


class Conversa(models.Model):
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
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Conversa'
        verbose_name_plural = 'Conversas'
        ordering = ['-created_at']

    def __str__(self):
        ctx = f' — {self.aula}' if self.aula else ' (livre)'
        return f'{self.professor}{ctx}'


class Mensagem(models.Model):
    class RoleChoices(models.TextChoices):
        USER = 'user', 'Usuário'
        ASSISTANT = 'assistant', 'Assistente'

    class TipoChoices(models.TextChoices):
        TEXTO = 'texto', 'Texto'
        AUDIO = 'audio', 'Áudio'

    conversa = models.ForeignKey(
        Conversa,
        on_delete=models.CASCADE,
        related_name='mensagens',
    )
    role = models.CharField(max_length=10, choices=RoleChoices.choices)
    tipo = models.CharField(max_length=10, choices=TipoChoices.choices, default=TipoChoices.TEXTO)
    conteudo = models.TextField(help_text='Texto da mensagem ou URL do áudio')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Mensagem'
        verbose_name_plural = 'Mensagens'
        ordering = ['created_at']

    def __str__(self):
        return f'[{self.get_role_display()}] {self.conteudo[:50]}'
