# core/signals.py
from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Perfil, Empresa  # <- se o nome "Empresa" for outro, troque aqui


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def criar_perfil_automatico(sender, instance, created, **kwargs):
    """
    Garante que todo usuário tenha Perfil e que o Perfil tenha empresa.
    """
    # cria perfil se não existir
    perfil, _ = Perfil.objects.get_or_create(usuario=instance)

    # garante empresa (evita empresa_id = NULL)
    if perfil.empresa_id is None:
        empresa_padrao = Empresa.objects.order_by("id").first()
        if empresa_padrao is None:
            empresa_padrao = Empresa.objects.create(nome="Spaço da Jhuséna")

        perfil.empresa = empresa_padrao
        perfil.save(update_fields=["empresa"])
