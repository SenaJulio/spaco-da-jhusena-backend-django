from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver

from core.models import Perfil, Empresa


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def criar_perfil_para_usuario(sender, instance, created, **kwargs):
    if not created:
        return

    empresa_padrao = Empresa.objects.order_by("id").first()
    if empresa_padrao is None:
        empresa_padrao = Empresa.objects.create(nome="Empresa padrão")

    perfil_fields = {f.name for f in Perfil._meta.fields}
    data = {"empresa": empresa_padrao}

    if "user" in perfil_fields:
        data["user"] = instance
    elif "usuario" in perfil_fields:
        data["usuario"] = instance
    else:
        raise Exception("Perfil não tem campo user/usuario apontando para o usuário.")

    Perfil.objects.create(**data)
