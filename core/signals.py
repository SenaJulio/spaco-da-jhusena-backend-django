from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Perfil, Empresa


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def criar_perfil_automatico(sender, instance, created, **kwargs):
    # garante perfil (campo no seu Perfil é 'user')
    perfil, _ = Perfil.objects.get_or_create(user=instance)

    # garante empresa padrão pelo código fixo
    if perfil.empresa_id is None:
        empresa_padrao, _ = Empresa.objects.get_or_create(
            codigo="spaco-da-jhusena",
            defaults={"nome": "Spaço da Jhuséna"},
        )
        perfil.empresa = empresa_padrao
        perfil.save(update_fields=["empresa"])
