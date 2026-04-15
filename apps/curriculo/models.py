import string
import random
from django.db import models


def gerar_codigo_aula():
    """Gera código único tipo UIS13DS (7 caracteres alfanuméricos maiúsculos)."""
    chars = string.ascii_uppercase + string.digits
    return ''.join(random.choices(chars, k=7))


class Aula(models.Model):
    codigo = models.CharField(
        max_length=10,
        unique=True,
        default=gerar_codigo_aula,
        help_text='Código único da aula (ex: UIS13DS)',
    )
    year = models.IntegerField(help_text='Ano do currículo')
    ordem = models.IntegerField(help_text='Sequência dentro do ano')
    titulo = models.CharField(max_length=200)
    descricao = models.TextField(
        default='',
        help_text='Descrição detalhada do que será discutido na aula',
    )

    class Meta:
        verbose_name = 'Aula'
        verbose_name_plural = 'Aulas'
        unique_together = [('year', 'ordem')]
        ordering = ['year', 'ordem']

    def __str__(self):
        return f'[{self.codigo}] Year {self.year} — Aula {self.ordem}: {self.titulo}'

    def get_contexto_completo(self):
        """Retorna todo o contexto da aula para enviar à IA."""
        conteudos = self.aula_conteudos.select_related('conteudo').order_by('ordem')
        homeworks = self.homeworks.all()

        contexto = f'AULA: {self.titulo}\n'
        contexto += f'Código: {self.codigo}\n'
        contexto += f'Year: {self.year} | Aula {self.ordem}\n'
        contexto += f'Descrição: {self.descricao}\n\n'

        if conteudos:
            contexto += 'CONTEÚDOS DA AULA:\n'
            for ac in conteudos:
                c = ac.conteudo
                contexto += f'  {ac.ordem}. {c.titulo} ({c.get_tipo_display()})\n'
                if c.descricao:
                    contexto += f'     {c.descricao}\n'

        if homeworks:
            contexto += '\nHOMEWORKS:\n'
            for hw in homeworks:
                contexto += f'  - Objetivo: {hw.objetivo}\n'
                if hw.vocabulario:
                    contexto += f'    Vocabulário: {hw.vocabulario}\n'
                if hw.gramatica:
                    contexto += f'    Gramática: {hw.gramatica}\n'

        return contexto


class Conteudo(models.Model):
    class Tipo(models.TextChoices):
        MUSICA = 'musica', 'Música'
        VIDEO = 'video', 'Vídeo'
        TEXTO = 'texto', 'Texto'
        AUDIO = 'audio', 'Áudio'
        IMAGEM = 'imagem', 'Imagem'

    titulo = models.CharField(max_length=200)
    descricao = models.TextField(blank=True)
    tipo = models.CharField(max_length=20, choices=Tipo.choices)
    arquivo_url = models.URLField(help_text='Link para o arquivo (S3, etc.)')
    criado_por = models.ForeignKey(
        'escolas.Professor',
        on_delete=models.CASCADE,
        related_name='conteudos',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Conteúdo'
        verbose_name_plural = 'Conteúdos'

    def __str__(self):
        return f'{self.titulo} ({self.get_tipo_display()})'


class AulaConteudo(models.Model):
    aula = models.ForeignKey(
        Aula,
        on_delete=models.CASCADE,
        related_name='aula_conteudos',
    )
    conteudo = models.ForeignKey(
        Conteudo,
        on_delete=models.CASCADE,
        related_name='aula_conteudos',
    )
    ordem = models.IntegerField(help_text='Posição do conteúdo dentro da aula')

    class Meta:
        verbose_name = 'Conteúdo da Aula'
        verbose_name_plural = 'Conteúdos da Aula'
        unique_together = [('aula', 'conteudo')]
        ordering = ['ordem']

    def __str__(self):
        return f'{self.aula} → {self.conteudo}'


class ProgressoTurma(models.Model):
    class Status(models.TextChoices):
        NAO_INICIADA = 'nao_iniciada', 'Não Iniciada'
        PARCIAL = 'parcial', 'Parcial'
        CONCLUIDA = 'concluida', 'Concluída'

    turma = models.ForeignKey(
        'escolas.Turma',
        on_delete=models.CASCADE,
        related_name='progressos',
    )
    aula = models.ForeignKey(
        Aula,
        on_delete=models.CASCADE,
        related_name='progressos',
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.NAO_INICIADA,
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Progresso da Turma'
        verbose_name_plural = 'Progressos das Turmas'
        unique_together = [('turma', 'aula')]

    def __str__(self):
        return f'{self.turma} — {self.aula}: {self.get_status_display()}'


class Homework(models.Model):
    aula = models.ForeignKey(
        Aula,
        on_delete=models.CASCADE,
        related_name='homeworks',
    )
    objetivo = models.TextField()
    vocabulario = models.TextField(blank=True)
    gramatica = models.TextField(blank=True)

    class Meta:
        verbose_name = 'Homework'
        verbose_name_plural = 'Homeworks'

    def __str__(self):
        return f'Homework — {self.aula}'
