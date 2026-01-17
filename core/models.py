from django.conf import settings
from django.db import models
from django.utils.text import slugify


class Empresa(models.Model):
    PLANO_CHOICES = [
        ("free", "Free"),
        ("pro", "Pro"),
    ]

    POLITICA_LOTE_VENCIDO_CHOICES = [
        ("bloquear", "Bloquear sempre"),
        ("justificar", "Permitir com justificativa"),
        ("livre", "Permitir livre"),
    ]

    nome = models.CharField(max_length=120)

    # ✅ âncora para empresa padrão (não depende de first())
    codigo = models.SlugField(unique=True, blank=True)

    plano = models.CharField(
        max_length=10,
        choices=PLANO_CHOICES,
        default="free",
    )
    ativa = models.BooleanField(default=True)
    criado_em = models.DateTimeField(auto_now_add=True)

    politica_lote_vencido = models.CharField(
        max_length=20,
        choices=POLITICA_LOTE_VENCIDO_CHOICES,
        default="justificar",
    )

    def save(self, *args, **kwargs):
        if not self.codigo:
            self.codigo = slugify(self.nome) or "spaco-da-jhusena"
        super().save(*args, **kwargs)

    def __str__(self):
        return self.nome



class Perfil(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="perfil",
    )
    empresa = models.ForeignKey(
        Empresa,
        on_delete=models.PROTECT,
        related_name="usuarios",
    )

    def __str__(self):
        return getattr(self.user, "username", "user")
