# core/signals.py
from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver

from core.models import Perfil, Empresa


def _get_empresa_padrao():
    """
    Retorna uma empresa padrão segura para casos onde o usuário é criado
    e ainda não tem empresa definida. Mantém o banco consistente (empresa_id NOT NULL).
    """
    empresa, _ = Empresa.objects.get_or_create(nome="Empresa Padrão")
    return empresa


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def criar_perfil_automatico(sender, instance, created, **kwargs):
    if not created:
        return

    # Se já existir (raríssimo aqui, mas por segurança), não faz nada
    if Perfil.objects.filter(user=instance).exists():
        return

    empresa = _get_empresa_padrao()

    # Cria perfil SEMPRE com empresa preenchida (empresa_id NOT NULL)
    Perfil.objects.create(user=instance, empresa=empresa)
