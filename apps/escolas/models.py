from django.conf import settings
from django.db import models


class Plano(models.Model):
    class IAProvider(models.TextChoices):
        ANTHROPIC = 'anthropic', 'Anthropic (Claude)'
        OPENAI = 'openai', 'OpenAI (GPT)'

    class TTSProvider(models.TextChoices):
        ELEVENLABS = 'elevenlabs', 'ElevenLabs'
        OPENAI_TTS = 'openai_tts', 'OpenAI TTS'

    class STTProvider(models.TextChoices):
        OPENAI_WHISPER = 'openai_whisper', 'OpenAI Whisper'
        GOOGLE_STT = 'google_stt', 'Google Speech-to-Text'

    nome = models.CharField(max_length=100)
    valor_mensal = models.DecimalField(max_digits=10, decimal_places=2)

    # IA (Chat com Kevin)
    ia_provider = models.CharField(
        max_length=20,
        choices=IAProvider.choices,
        default=IAProvider.ANTHROPIC,
        help_text='Provedor de IA para o chat',
    )
    ia_modelo = models.CharField(
        max_length=100,
        default='claude-sonnet-4-20250514',
        help_text='Ex: claude-sonnet-4-20250514, gpt-4o',
    )
    ia_api_key = models.CharField(
        max_length=255,
        default='',
        help_text='API key do provedor de IA',
    )

    # TTS (Texto → Áudio)
    tts_provider = models.CharField(
        max_length=20,
        choices=TTSProvider.choices,
        default=TTSProvider.ELEVENLABS,
    )
    tts_api_key = models.CharField(
        max_length=255,
        default='',
        help_text='API key do provedor de TTS',
    )
    tts_voice_id = models.CharField(
        max_length=100,
        default='',
        blank=True,
        help_text='ElevenLabs voice_id. Ex: 21m00Tcm4TlvDq8ikWAM',
    )
    tts_modelo = models.CharField(
        max_length=100,
        default='eleven_multilingual_v2',
        blank=True,
        help_text='ElevenLabs model_id (ex: eleven_multilingual_v2) ou voz do OpenAI TTS (ex: alloy, nova).',
    )

    # STT (Áudio → Texto)
    stt_provider = models.CharField(
        max_length=20,
        choices=STTProvider.choices,
        default=STTProvider.OPENAI_WHISPER,
    )
    stt_api_key = models.CharField(
        max_length=255,
        default='',
        help_text='API key do provedor de STT',
    )

    class Meta:
        verbose_name = 'Plano'
        verbose_name_plural = 'Planos'

    def __str__(self):
        return f'{self.nome} — R$ {self.valor_mensal}'


class Escola(models.Model):
    nome = models.CharField(max_length=200)
    slug = models.SlugField(unique=True)
    plano = models.ForeignKey(
        Plano,
        on_delete=models.PROTECT,
        related_name='escolas',
    )
    ativa = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Escola'
        verbose_name_plural = 'Escolas'

    def __str__(self):
        return self.nome


class Diretor(models.Model):
    """Diretor/gestor de uma escola. Pode gerenciar professores, turmas e alunos."""
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='diretor',
    )
    escola = models.ForeignKey(
        Escola,
        on_delete=models.CASCADE,
        related_name='diretores',
    )

    class Meta:
        verbose_name = 'Diretor'
        verbose_name_plural = 'Diretores'

    def __str__(self):
        return f'{self.user.get_full_name() or self.user.username} — {self.escola.nome}'


class Professor(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='professor',
    )
    escola = models.ForeignKey(
        Escola,
        on_delete=models.CASCADE,
        related_name='professores',
    )
    ativo = models.BooleanField(default=True)

    class Meta:
        verbose_name = 'Professor'
        verbose_name_plural = 'Professores'

    def __str__(self):
        return self.user.get_full_name() or self.user.username


class Serie(models.Model):
    """Um segmento da escola cliente — o vínculo entre a escola e um TG (D32).

    A reunião de 30/07 mostrou que cada escola organiza os alunos em segmentos
    com NOME PRÓPRIO ("não é sempre Fundamental") e escolhe, para cada um, qual
    cronograma (TG) usar. Ex: Bernoulli cria a série "Fundamental" (Year 5) e o
    coordenador aponta ela para o "TG 3x — Year 5".

    A turma pertence a uma série e herda o TG dela.
    """

    escola = models.ForeignKey(
        Escola,
        on_delete=models.CASCADE,
        related_name='series',
    )
    nome = models.CharField(
        max_length=60,
        help_text='Nome que a escola dá ao segmento. Ex: "Fundamental", "K2".',
    )
    year = models.PositiveIntegerField(
        help_text='Year do currículo (1 a 9) que esta série cursa.',
    )
    tg = models.ForeignKey(
        'curriculo.TG',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='series',
        help_text=(
            'Cronograma que esta série segue. O coordenador Bebelingue escolhe. '
            'Vazio = ainda não vinculado (as turmas não têm currículo até então).'
        ),
    )

    class Meta:
        verbose_name = 'Série'
        verbose_name_plural = 'Séries'
        unique_together = [('escola', 'nome')]
        ordering = ['escola', 'year', 'nome']

    def __str__(self):
        return f'{self.escola.nome} — {self.nome} (Year {self.year})'


class Turma(models.Model):
    """Uma turma da escola cliente.

    Não guarda alunos nominalmente: a escola não mede aluno individual (ver
    demandas.md, D8). Só o headcount e, por aula, a presença em AulaTurma.
    """

    serie = models.ForeignKey(
        Serie,
        on_delete=models.CASCADE,
        related_name='turmas',
        null=True,  # temporário para a migração; vira obrigatório depois
        help_text='A série a que esta turma pertence — define o TG que ela segue.',
    )
    year = models.IntegerField(help_text='Year do currículo (1 a 9). Herda o da série.')
    nome = models.CharField(max_length=20, help_text='Ex: A, B, "Tarde"')
    escola = models.ForeignKey(
        Escola,
        on_delete=models.CASCADE,
        related_name='turmas',
    )
    professor = models.ForeignKey(
        Professor,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='turmas',
    )
    qtd_alunos = models.PositiveIntegerField(
        default=0,
        help_text='Quantos alunos a turma tem. Substitui o cadastro individual.',
    )
    # DEPRECIADO (D31/D32): a frequência agora vem do TG da série
    # (serie.tg.frequencia). Mantido temporariamente; será removido.
    aulas_por_semana = models.PositiveIntegerField(
        default=3,
        help_text='Depreciado — a frequência vem do TG da série.',
    )

    class Meta:
        verbose_name = 'Turma'
        verbose_name_plural = 'Turmas'
        unique_together = [('escola', 'year', 'nome')]

    def __str__(self):
        return f'{self.escola.nome} — Turma {self.year}{self.nome}'

    @property
    def tg(self):
        """O cronograma que esta turma segue, vindo da série (D32)."""
        return self.serie.tg if self.serie_id else None

    def aulas_do_curriculo(self):
        """Aulas do TG que esta turma deve dar, na ordem (D31/D32).

        Vêm do TG da série. Sem série ou sem TG vinculado, a turma ainda não
        tem currículo — retorna vazio."""
        from apps.curriculo.models import Aula

        if not self.tg:
            return Aula.objects.none()
        return self.tg.aulas.all()

    def posicao_no_plano(self, ate=None):
        """Onde a turma chegou no TG (D33), acumulado até a data `ate`.

        Retorna um dict com a última aula concluída (a "posição"), quantas
        aulas foram concluídas e o total do TG. Se `ate` é None, considera
        tudo. É a base do relatório do professor com filtro temporal.
        """
        from apps.curriculo.models import AulaTurma

        total = self.aulas_do_curriculo().count()
        execs = AulaTurma.objects.filter(turma=self, status='concluida')
        if ate is not None:
            execs = execs.filter(data_realizada__lte=ate)

        concluidas = execs.count()
        # A "posição" é a aula concluída mais avançada no TG (ordem_unit/semana).
        ultima = (
            execs.select_related('aula')
            .order_by('-aula__ordem_unit', '-aula__semana', '-aula__numero_aula')
            .first()
        )
        return {
            'aula': ultima.aula if ultima else None,
            'concluidas': concluidas,
            'total': total,
            'pct': round((concluidas / total) * 100) if total else 0,
        }
