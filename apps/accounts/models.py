from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = 'admin', 'Administrador'
        # Coordenador pedagógico da Bebelingue (fornecedora). Cadastra o
        # currículo (TG) e o catálogo oficial de atividades. NÃO tem acesso a
        # configuração técnica (chaves de API, planos).
        COORDENADOR = 'coordenador', 'Coordenador Bebelingue'
        # Diretor da escola cliente. O valor era 'escola' — renomeado para
        # alinhar com o modelo Diretor e com o resto do projeto.
        DIRETOR = 'diretor', 'Diretor de Escola'
        PROFESSOR = 'professor', 'Professor'

    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.PROFESSOR,
    )

    class Meta:
        verbose_name = 'Usuário'
        verbose_name_plural = 'Usuários'

    def __str__(self):
        return f'{self.get_full_name() or self.username} ({self.get_role_display()})'
