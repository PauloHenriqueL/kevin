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


class Turma(models.Model):
    """Uma turma da escola cliente.

    Não guarda alunos nominalmente: a escola não mede aluno individual (ver
    demandas.md, D8). Só o headcount e, por aula, a presença em AulaTurma.
    """

    year = models.IntegerField(help_text='Year do currículo (1 a 5). Define qual TG a turma segue.')
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
    aulas_por_semana = models.PositiveIntegerField(
        default=3,
        choices=[(3, '3x por semana'), (4, '4x por semana'), (5, '5x por semana')],
        help_text=(
            'Frequência contratada pela escola. O TG de 4x é o de 3x mais uma '
            'Communication Class; o de 5x, mais outra.'
        ),
    )

    class Meta:
        verbose_name = 'Turma'
        verbose_name_plural = 'Turmas'
        unique_together = [('escola', 'year', 'nome')]

    def __str__(self):
        return f'{self.escola.nome} — Turma {self.year}{self.nome}'

    def aulas_do_curriculo(self):
        """Aulas do TG que esta turma deve dar, na ordem.

        Filtra pela frequência: uma turma 3x não vê as Communication Classes
        extras cadastradas para 4x e 5x (ver D19).
        """
        from apps.curriculo.models import Aula

        return Aula.objects.filter(
            year=self.year,
            frequencia_minima__lte=self.aulas_por_semana,
        )
