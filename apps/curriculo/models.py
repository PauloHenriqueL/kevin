from django.db import models


def montar_codigo_aula(year, unit, week, class_num):
    """Gera o código estruturado Y{year}U{unit}W{week}C{class_num}."""
    return f'Y{year}U{unit}W{week}C{class_num}'


def gerar_codigo_aula():
    """Shim: referenciado por migração antiga (0002). Não é mais usado em runtime —
    o `codigo` é agora recomputado em Aula.save() a partir de year/unit/week/class_num.
    """
    return ''


class Aula(models.Model):
    codigo = models.CharField(
        max_length=20,
        unique=True,
        editable=False,
        help_text='Gerado automaticamente no formato Y1U1W1C1.',
    )
    year = models.IntegerField(help_text='Year (1, 2, 3, …)')
    unit = models.IntegerField(default=1, help_text='Unit dentro do Year')
    week = models.IntegerField(default=1, help_text='Week dentro da Unit')
    class_num = models.IntegerField(default=1, help_text='Class dentro da Week')
    titulo = models.CharField(max_length=200)
    descricao = models.TextField(
        default='',
        blank=True,
        help_text='Descrição para exibição no app. NÃO é enviada à IA.',
    )
    warm_up = models.TextField(
        default='',
        blank=True,
        help_text='Roteiro do WARM UP (10-15 min) — enviado à IA como contexto.',
    )
    development = models.TextField(
        default='',
        blank=True,
        help_text='Roteiro do DEVELOPMENT (30-40 min) — enviado à IA como contexto.',
    )
    closure = models.TextField(
        default='',
        blank=True,
        help_text='Roteiro do CLOSURE (5-10 min) — enviado à IA como contexto.',
    )

    class Meta:
        verbose_name = 'Aula'
        verbose_name_plural = 'Aulas'
        unique_together = [('year', 'unit', 'week', 'class_num')]
        ordering = ['year', 'unit', 'week', 'class_num']

    def __str__(self):
        return f'[{self.codigo}] {self.titulo}'

    def save(self, *args, **kwargs):
        self.codigo = montar_codigo_aula(self.year, self.unit, self.week, self.class_num)
        super().save(*args, **kwargs)

    def get_contexto_completo(self):
        """Retorna todo o contexto da aula para enviar à IA.

        A descrição (campo `descricao`) é apenas para exibição e NÃO vai pra IA.
        Os roteiros das três fases (warm_up, development, closure) são o contexto
        pedagógico efetivo.
        """
        conteudos = self.aula_conteudos.select_related('conteudo').order_by('ordem')
        homeworks = self.homeworks.all()

        contexto = f'AULA: {self.titulo}\n'
        contexto += f'Código: {self.codigo}\n'
        contexto += (
            f'Year: {self.year} | Unit: {self.unit} | '
            f'Week: {self.week} | Class: {self.class_num}\n\n'
        )

        if self.warm_up.strip():
            contexto += f'WARM UP:\n{self.warm_up.strip()}\n\n'
        if self.development.strip():
            contexto += f'DEVELOPMENT:\n{self.development.strip()}\n\n'
        if self.closure.strip():
            contexto += f'CLOSURE:\n{self.closure.strip()}\n\n'

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
