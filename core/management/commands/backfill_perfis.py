from django.core.management.base import BaseCommand
from django.conf import settings
from django.contrib.auth import get_user_model

from core.models import Perfil, Empresa


class Command(BaseCommand):
    help = "Garante que todos os usuários tenham Perfil e que o Perfil tenha empresa."

    def handle(self, *args, **options):
        User = get_user_model()

        empresa_padrao = Empresa.objects.order_by("id").first()
        if empresa_padrao is None:
            empresa_padrao = Empresa.objects.create(nome="Spaço da Jhuséna")

        total = 0
        criados = 0
        ajustados = 0

        for u in User.objects.all():
            total += 1

            # tenta achar perfil por 'usuario' ou 'user'
            perfil = None
            if hasattr(Perfil, "usuario"):
                perfil, was_created = Perfil.objects.get_or_create(usuario=u)
            elif hasattr(Perfil, "user"):
                perfil, was_created = Perfil.objects.get_or_create(user=u)
            else:
                raise Exception("Perfil não tem campo 'usuario' nem 'user'.")

            if was_created:
                criados += 1

            if perfil.empresa_id is None:
                perfil.empresa = empresa_padrao
                perfil.save(update_fields=["empresa"])
                ajustados += 1

        self.stdout.write(self.style.SUCCESS(
            f"OK! usuários={total} perfis_criados={criados} perfis_ajustados={ajustados} empresa_padrao_id={empresa_padrao.id}"
        ))
