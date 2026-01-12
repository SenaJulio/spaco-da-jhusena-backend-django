from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver

from core.models import Perfil, Empresa



@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def criar_perfil(sender, instance, created, **kwargs):
    if not created:
        return

    # pega a primeira empresa como padrão (pode trocar depois)
    empresa_padrao = Empresa.objects.order_by("id").first()

    Perfil.objects.create(
        user=instance,
        empresa=empresa_padrao,
    )
