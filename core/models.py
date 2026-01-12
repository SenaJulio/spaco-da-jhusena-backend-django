from django.db import models

class Empresa(models.Model):
    PLANO_CHOICES = [
        ("free", "Free"),
        ("pro", "Pro"),
    ]

    nome = models.CharField(max_length=120)
    plano = models.CharField(
        max_length=10,
        choices=PLANO_CHOICES,
        default="free",
    )
    ativa = models.BooleanField(default=True)
    criado_em = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.nome

from django.contrib.auth.models import User

class Perfil(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    empresa = models.ForeignKey(
        Empresa,
        on_delete=models.CASCADE,
        related_name="usuarios"
    )

    def __str__(self):
        return self.user.username
