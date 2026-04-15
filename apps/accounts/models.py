from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = 'admin', 'Administrador'
        ESCOLA = 'escola', 'Gestor de Escola'
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
