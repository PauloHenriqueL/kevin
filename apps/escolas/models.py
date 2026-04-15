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
    year = models.IntegerField(help_text='Ano do currículo (1, 2, 3...)')
    nome = models.CharField(max_length=10, help_text='Ex: A, B, C')
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

    class Meta:
        verbose_name = 'Turma'
        verbose_name_plural = 'Turmas'
        unique_together = [('escola', 'year', 'nome')]

    def __str__(self):
        return f'{self.escola.nome} — Turma {self.year}{self.nome}'


class Aluno(models.Model):
    nome = models.CharField(max_length=200)
    turma = models.ForeignKey(
        Turma,
        on_delete=models.CASCADE,
        related_name='alunos',
    )

    class Meta:
        verbose_name = 'Aluno'
        verbose_name_plural = 'Alunos'

    def __str__(self):
        return self.nome
