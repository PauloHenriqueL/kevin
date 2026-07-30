from django.core.exceptions import ValidationError
from django.db import models

# Siglas de mês usadas no código da aula (Y5-MAR-W1C1), como no TG da Bebelingue.
MESES_SIGLA = {
    1: 'JAN', 2: 'FEB', 3: 'MAR', 4: 'APR', 5: 'MAY', 6: 'JUN',
    7: 'JUL', 8: 'AUG', 9: 'SEP', 10: 'OCT', 11: 'NOV', 12: 'DEC',
}

MES_CHOICES = [
    (1, 'Janeiro'), (2, 'Fevereiro'), (3, 'Março'), (4, 'Abril'),
    (5, 'Maio'), (6, 'Junho'), (7, 'Julho'), (8, 'Agosto'),
    (9, 'Setembro'), (10, 'Outubro'), (11, 'Novembro'), (12, 'Dezembro'),
]

# Cenários de fundo entregues pelo animador (ver Demanda 9).
BACKGROUND_CHOICES = [
    ('floresta', 'Floresta'),
    ('quarto', 'Quarto'),
    ('banheiro', 'Banheiro'),
    ('escola-int', 'Escola (interior)'),
    ('escola-ext', 'Escola (exterior)'),
    ('hospital', 'Hospital (exterior)'),
    ('hospital-int', 'Hospital (interior)'),
]


# Unidades não numeradas do TG. O material usa a sigla, não um número:
# a Welcome Unit é "WU" e a de junho é "JU" — nunca "U0" ou "U9".
UNIT_WELCOME = 'WU'
UNIT_JUNE = 'JU'

# Ordem de cada unidade no ano letivo, para o `ordering` do queryset.
# A Welcome Unit abre o ano (fevereiro) e a June Unit fecha o semestre.
ORDEM_UNITS = {UNIT_WELCOME: 0, UNIT_JUNE: 9}


def ordem_da_unit(unit):
    """Posição da unit no ano letivo — "U3" → 3, "WU" → 0, "JU" → 9."""
    unit = (unit or '').strip().upper()
    if unit in ORDEM_UNITS:
        return ORDEM_UNITS[unit]
    digitos = ''.join(c for c in unit if c.isdigit())
    return int(digitos) if digitos else 99


def montar_codigo_aula(year, unit, semana, numero_aula):
    """Gera o código da aula no formato Y5-U1W1C1.

    Espelha o endereçamento impresso no TG (ver demandas.md, D27): o eixo é a
    UNIT, e o código que o coordenador lê na apostila é exatamente `U1W1C1`.
    O mês é contexto de calendário, não chave — ver `Aula.mes`.
    """
    unit = (unit or '').strip().upper()
    return f'Y{year}-{unit}W{semana}C{numero_aula}'


class Atividade(models.Model):
    """Catálogo de atividades da metodologia Bebelingue.

    Unifica quatro naturezas numa tabela só (ver demandas.md, D5) para que a
    busca global (Demanda 6) varra um lugar só e o BlocoAula aponte para uma
    FK só:

      - jogo     → "Simon Says", "Hot Potato" (regra, não arquivo)
      - tecnica  → "Sandwich Technique", "Instant Translation" (o COMO ensinar)
      - rotina   → "BeCalendar", "I Can Routine" (ritual fixo da aula)
      - recurso  → "Student's Book U1L1", faixa de áudio (material de apoio)

    `escola` NULO = catálogo oficial da Bebelingue; preenchido = atividade
    local daquela escola, nunca visível para outra (D6).
    """

    class Tipo(models.TextChoices):
        JOGO = 'jogo', 'Jogo'
        TECNICA = 'tecnica', 'Técnica'
        ROTINA = 'rotina', 'Rotina'
        RECURSO = 'recurso', 'Recurso / Material'

    tipo = models.CharField(
        max_length=20,
        choices=Tipo.choices,
        help_text='Jogo (Simon Says) · Técnica (Sandwich) · Rotina (BeCalendar) · Recurso (livro, áudio)',
    )
    nome = models.CharField(
        max_length=200,
        help_text='Nome exato como aparece no TG. Ex: "Simon Says", "BeCalendar"',
    )
    descricao = models.TextField(
        blank=True,
        default='',
        help_text='O que é esta atividade, em uma ou duas frases.',
    )
    como_conduzir = models.TextField(
        blank=True,
        default='',
        help_text=(
            'Passo a passo de como conduzir. ESTE CAMPO VAI PARA O KEVIN — '
            'sem ele o Kevin improvisa a atividade. Fonte oficial: seção '
            '"Games Bank", no início do TG.'
        ),
    )
    objetivo_pedagogico = models.TextField(
        blank=True,
        default='',
        help_text='O que se pratica. Ex: "vocabulário de rotina diária".',
    )
    materiais = models.CharField(
        max_length=300,
        blank=True,
        default='',
        help_text='Ex: flashcards, bola, quadro. Vazio se não precisa de nada.',
    )
    duracao_estimada = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text='Duração em minutos (opcional).',
    )
    arquivo_url = models.URLField(
        blank=True,
        default='',
        help_text='Só para Recurso: link do livro, áudio ou vídeo.',
    )
    tags = models.CharField(
        max_length=300,
        blank=True,
        default='',
        help_text='Palavras-chave separadas por vírgula, para a busca. Ex: "fruits, vocabulary, movement"',
    )
    escola = models.ForeignKey(
        'escolas.Escola',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='atividades',
        help_text=(
            'VAZIO = catálogo oficial da Bebelingue (todas as escolas veem). '
            'Preenchido = atividade local, visível só nessa escola.'
        ),
    )
    criado_por = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='atividades_criadas',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Atividade'
        verbose_name_plural = 'Atividades (catálogo)'
        ordering = ['tipo', 'nome']
        unique_together = [('nome', 'escola')]

    def __str__(self):
        origem = self.escola.nome if self.escola_id else 'Bebelingue'
        return f'{self.nome} ({self.get_tipo_display()} — {origem})'

    @property
    def eh_oficial(self):
        return self.escola_id is None

    def clean(self):
        if self.tipo == self.Tipo.RECURSO and not self.arquivo_url:
            raise ValidationError(
                {'arquivo_url': 'Recurso precisa de um link para o material.'}
            )


class Aula(models.Model):
    """Uma aula do TG (Teacher's Guide) — currículo GLOBAL da Bebelingue.

    Confirmado com o cliente (23/07/2026): toda escola que usa o Year 1 recebe
    o mesmo TG. A aula NÃO pertence a escola nem a turma — a execução por turma
    fica em AulaTurma. O professor não edita: só executa e marca progresso.
    """

    class Tipo(models.TextChoices):
        CONTENT = 'content', 'Content Class'
        COMMUNICATION = 'communication', 'Communication Class'
        CULTURE = 'culture', 'Culture Class'
        # CLIL (Content and Language Integrated Learning) é a natureza de aula
        # em que a língua entra a serviço de outra disciplina. Aparece em ~30
        # das 128 aulas do Y5 3x — não é variação de Content (ver D28).
        CLIL = 'clil', 'CLIL Class'
        EXTRA = 'extra', 'Extra Class / Festival'

    class Fase(models.TextChoices):
        """Fases do roteiro. Usada por BlocoAula."""
        WARM_UP = 'warm_up', 'Warm Up'
        DEVELOPMENT = 'development', 'Development'
        CLOSURE = 'closure', 'Closure'

    codigo = models.CharField(
        max_length=30,
        unique=True,
        editable=False,
        help_text='Gerado automaticamente. Ex: Y5-U1W1C1',
    )

    # ── Endereçamento (a chave) ──
    # É o código impresso no TG: Unit + Week + Class. Ver D27.
    year = models.PositiveIntegerField(help_text='Year do currículo: 1 a 5.')
    unit = models.CharField(
        max_length=5,
        default='U1',
        help_text=(
            'Unit como aparece no TG: U1, U2… WU para a Welcome Unit e JU '
            'para a de junho. Digite exatamente a sigla da apostila.'
        ),
    )
    semana = models.PositiveIntegerField(
        default=1,
        help_text='Semana dentro da unit: 1 a 5 (WEEK 1, WEEK 2… no TG).',
    )
    numero_aula = models.PositiveIntegerField(
        default=1,
        help_text='Qual aula da semana: 1, 2, 3… (CLASS 1, CLASS 2 no TG)',
    )
    ordem_unit = models.PositiveIntegerField(
        default=1,
        editable=False,
        help_text='Posição da unit no ano. Calculado a partir da sigla.',
    )

    # ── Classificação ──
    tipo = models.CharField(
        max_length=20,
        choices=Tipo.choices,
        default=Tipo.CONTENT,
        help_text='Define o formato do roteiro e o que o Kevin espera da aula.',
    )
    frequencia_minima = models.PositiveIntegerField(
        default=3,
        help_text=(
            'Aparece para turmas com esta frequência semanal OU MAIOR. '
            'Use 3 para as aulas do TG base; 4 ou 5 para as Communication '
            'Classes extras dos TGs de 4x e 5x.'
        ),
    )

    # ── Descritivo (não é chave) ──
    # O mês continua no modelo porque o TG o exibe na faixa lateral da grade
    # ("FEBRUARY", "Festivals: Carnival") e o professor precisa da noção de
    # calendário. Mas não endereça a aula — a unit atravessa o mês (D27).
    mes = models.PositiveIntegerField(
        choices=MES_CHOICES,
        null=True,
        blank=True,
        help_text='Mês em que esta unit costuma cair. Só contexto — não é a chave.',
    )
    lesson = models.CharField(
        max_length=50,
        blank=True,
        default='',
        help_text='Referência da lição no livro. Ex: "U1L1", "U1 L6 & L7"',
    )
    titulo = models.CharField(max_length=200)
    observacao = models.TextField(
        blank=True,
        default='',
        help_text='Aviso para o professor. Ex: "Convidar os alunos a vestir verde".',
    )
    kickoff = models.CharField(
        max_length=300,
        blank=True,
        default='',
        help_text=(
            'Mensagem que abre a aula quando o professor clica em "Iniciar aula". '
            'Vazio = usa o texto padrão do tipo de aula.'
        ),
    )
    background = models.CharField(
        max_length=30,
        choices=BACKGROUND_CHOICES,
        default='floresta',
        help_text='Cenário de fundo do Kevin. Escolha o que combina com o vocabulário da aula.',
    )

    class Meta:
        verbose_name = 'Aula (TG)'
        verbose_name_plural = 'Aulas (TG)'
        unique_together = [('year', 'unit', 'semana', 'numero_aula')]
        ordering = ['year', 'ordem_unit', 'semana', 'numero_aula']

    def __str__(self):
        return f'[{self.codigo}] {self.titulo}'

    def save(self, *args, **kwargs):
        self.unit = (self.unit or '').strip().upper()
        self.ordem_unit = ordem_da_unit(self.unit)
        self.codigo = montar_codigo_aula(
            self.year, self.unit, self.semana, self.numero_aula
        )
        super().save(*args, **kwargs)

    def get_kickoff(self):
        """Mensagem de abertura, do mais específico para o mais genérico.

        1. Aula.kickoff, se preenchido
        2. Texto padrão do tipo de aula
        3. Fallback genérico
        """
        if self.kickoff.strip():
            return self.kickoff.strip()

        padroes = {
            self.Tipo.CONTENT: 'Olá Kevin, vamos começar a aula de hoje. Por onde começamos?',
            self.Tipo.COMMUNICATION: 'Olá Kevin, hoje é dia de praticar falando. Qual é a primeira atividade?',
            self.Tipo.CULTURE: 'Olá Kevin, hoje vamos falar sobre um tema novo. Como começamos?',
            self.Tipo.CLIL: 'Olá Kevin, hoje vamos aprender sobre outro assunto em inglês. Por onde começamos?',
        }
        return padroes.get(
            self.tipo, 'Olá Kevin, o que vamos fazer hoje? Por onde começamos?'
        )

    def get_contexto_completo(self):
        """Monta o contexto pedagógico enviado ao Kevin.

        Percorre os blocos NA ORDEM e expande a Atividade de cada um a partir
        do catálogo — é isso que faz o Kevin *saber* conduzir o "Simon Says"
        em vez de improvisar (ver demandas.md, Demanda 3).

        Expande só as atividades DESTA aula, nunca o catálogo inteiro: a API é
        paga por token e o excesso dilui o foco.
        """
        linhas = [
            f'=== AULA {self.codigo} ===',
            f'Year {self.year} | Unit {self.unit} | '
            f'Semana {self.semana} | Aula {self.numero_aula}',
            f'Tipo: {self.get_tipo_display()}',
        ]
        if self.mes:
            linhas.insert(2, f'Época do ano: {self.get_mes_display()}')
        if self.lesson:
            linhas.append(f'Lesson: {self.lesson}')
        linhas.append(f'Título: {self.titulo}')
        if self.observacao.strip():
            linhas.append(f'Observação: {self.observacao.strip()}')

        blocos = list(self.blocos.select_related('atividade').order_by('fase', 'ordem'))

        for fase_valor, fase_label in self.Fase.choices:
            da_fase = [b for b in blocos if b.fase == fase_valor]
            if not da_fase:
                continue
            linhas.append(f'\n--- {fase_label.upper()} ---')
            for bloco in da_fase:
                linhas.append(bloco.para_contexto_ia())

        homeworks = self.homeworks.all()
        if homeworks:
            linhas.append('\n--- HOMEWORK ---')
            for hw in homeworks:
                linhas.append(f'- {hw.descricao}')

        return '\n'.join(linhas)

    def _atividade_por_marcadores(self, tags, nomes):
        """A primeira atividade da aula que casa com uma das tags ou nomes.

        Base dos botões do telão (música, listening): cada um só aparece se a
        aula tiver a atividade correspondente (Demanda 11)."""
        for bloco in self.blocos.select_related('atividade').all():
            a = bloco.atividade
            if not a:
                continue
            tags_lower = a.tags.lower()
            nome_lower = a.nome.lower()
            if any(t in tags_lower for t in tags) or any(n in nome_lower for n in nomes):
                return a
        return None

    def _atividade_musica(self):
        """Atividade de música da aula (o Kevin canta com o ukulele), ou None."""
        return self._atividade_por_marcadores(
            tags=('musica', 'música'), nomes=('song', 'música'))

    def _atividade_listening(self):
        """Atividade de listening da aula (áudio de escuta), ou None.

        Listening é distinto de música: é a turma escutando um áudio para
        praticar compreensão, não o Kevin cantando. Não é rotina de toda aula."""
        return self._atividade_por_marcadores(
            tags=('listening',), nomes=('listening',))

    @property
    def tem_musica(self):
        """True se a aula tem música — controla se o botão de música aparece."""
        return self._atividade_musica() is not None

    @property
    def musica_url(self):
        """URL do áudio de música (do `arquivo_url` da atividade). Vazio = o
        botão só anima o Kevin pegando o ukulele, sem tocar som."""
        atividade = self._atividade_musica()
        return atividade.arquivo_url if atividade else ''

    @property
    def tem_listening(self):
        """True se a aula tem listening — controla se o botão de listening
        aparece no telão. Mesma regra da música, para outro conteúdo."""
        return self._atividade_listening() is not None

    @property
    def listening_url(self):
        """URL do áudio de listening (do `arquivo_url` da atividade). Ao clicar,
        o botão só toca este áudio — o Kevin não faz animação especial."""
        atividade = self._atividade_listening()
        return atividade.arquivo_url if atividade else ''


class BlocoAula(models.Model):
    """Um item numerado dentro de uma fase da aula.

    O roteiro do TG não é texto corrido: é uma lista ordenada de itens, e
    vários deles referenciam coisas nomeadas e reutilizáveis (ver D4).

    Cada bloco OU aponta para uma Atividade do catálogo, OU tem título livre.
    Nunca os dois vazios.
    """

    aula = models.ForeignKey(
        Aula,
        on_delete=models.CASCADE,
        related_name='blocos',
    )
    fase = models.CharField(
        max_length=20,
        choices=Aula.Fase.choices,
        help_text='Em qual momento da aula este bloco acontece.',
    )
    ordem = models.PositiveIntegerField(
        default=1,
        help_text='Posição dentro da fase: 1, 2, 3…',
    )
    atividade = models.ForeignKey(
        Atividade,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='blocos',
        help_text=(
            'Atividade do catálogo (ex: "Simon Says"). Preencha sempre que '
            'existir — é o que permite o Kevin conduzir a atividade.'
        ),
    )
    titulo = models.CharField(
        max_length=200,
        blank=True,
        default='',
        help_text='Use quando não houver atividade no catálogo.',
    )
    instrucoes = models.TextField(
        blank=True,
        default='',
        help_text='Passos específicos DESTA aula, um por linha.',
    )
    referencia = models.CharField(
        max_length=200,
        blank=True,
        default='',
        help_text='Material e páginas. Ex: "Student\'s Book U1L1 (P. 10-11)"',
    )

    class Meta:
        verbose_name = 'Bloco da aula'
        verbose_name_plural = 'Blocos da aula (roteiro)'
        ordering = ['fase', 'ordem']

    def __str__(self):
        return f'{self.aula.codigo} · {self.get_fase_display()} {self.ordem}. {self.rotulo}'

    @property
    def rotulo(self):
        if self.atividade_id:
            return self.atividade.nome
        return self.titulo or '(sem título)'

    def clean(self):
        if not self.atividade_id and not self.titulo.strip():
            raise ValidationError(
                'Preencha a atividade do catálogo OU um título livre.'
            )

    def para_contexto_ia(self):
        """Texto deste bloco para o prompt do Kevin, com a atividade expandida."""
        partes = [f'{self.ordem}. {self.rotulo}']

        if self.atividade_id:
            a = self.atividade
            partes[0] += f'  [{a.get_tipo_display().lower()}]'

        if self.referencia:
            partes.append(f'   Material: {self.referencia}')

        if self.atividade_id:
            a = self.atividade
            if a.objetivo_pedagogico:
                partes.append(f'   Objetivo: {a.objetivo_pedagogico}')
            if a.como_conduzir:
                partes.append(f'   Como conduzir: {a.como_conduzir}')
            if a.materiais:
                partes.append(f'   Materiais: {a.materiais}')

        if self.instrucoes.strip():
            partes.append('   Instruções desta aula:')
            for linha in self.instrucoes.strip().splitlines():
                if linha.strip():
                    partes.append(f'   - {linha.strip().lstrip("- ")}')

        return '\n'.join(partes)


class Homework(models.Model):
    aula = models.ForeignKey(
        Aula,
        on_delete=models.CASCADE,
        related_name='homeworks',
    )
    descricao = models.TextField(
        help_text='Como aparece no TG. Ex: "Integrated Activities - Unit 1 (exercises 1 and 2)"',
    )

    class Meta:
        verbose_name = 'Homework'
        verbose_name_plural = 'Homeworks'

    def __str__(self):
        return f'Homework — {self.aula.codigo}'


class AulaTurma(models.Model):
    """A execução de uma aula do TG por uma turma específica.

    Separada de Aula porque data real, professor e presença são da TURMA, não
    do currículo (ver D3). Feriado e reposição são normais: cada turma percorre
    o TG no seu ritmo.

    Criada sob demanda — a ausência de registro significa "não iniciada".
    """

    class Status(models.TextChoices):
        NAO_INICIADA = 'nao_iniciada', 'Não iniciada'
        EM_ANDAMENTO = 'em_andamento', 'Em andamento'
        CONCLUIDA = 'concluida', 'Concluída'
        PULADA = 'pulada', 'Pulada'

    turma = models.ForeignKey(
        'escolas.Turma',
        on_delete=models.CASCADE,
        related_name='aulas_turma',
    )
    aula = models.ForeignKey(
        Aula,
        on_delete=models.CASCADE,
        related_name='execucoes',
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.NAO_INICIADA,
    )
    data_realizada = models.DateField(
        null=True,
        blank=True,
        help_text='Data real em que a aula foi dada. Preenchida automaticamente ao concluir.',
    )
    professor = models.ForeignKey(
        'escolas.Professor',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='aulas_dadas',
        help_text='Quem deu a aula (pode ser um substituto).',
    )
    presentes = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text='Quantos alunos estavam presentes (opcional).',
    )
    observacoes = models.TextField(
        blank=True,
        default='',
        help_text='Anotação livre do professor sobre como foi a aula (opcional).',
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Aula da turma (execução)'
        verbose_name_plural = 'Aulas das turmas (execução)'
        unique_together = [('turma', 'aula')]
        ordering = ['-data_realizada', '-updated_at']

    def __str__(self):
        return f'{self.turma} — {self.aula.codigo}: {self.get_status_display()}'
