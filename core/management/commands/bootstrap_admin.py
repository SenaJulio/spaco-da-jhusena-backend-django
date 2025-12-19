# core/management/commands/bootstrap_admin.py
import os
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model


class Command(BaseCommand):
    help = "Cria/atualiza um superuser automaticamente usando variáveis de ambiente."

    def handle(self, *args, **options):
        username = os.getenv("DJANGO_SUPERUSER_USERNAME")
        email = os.getenv("DJANGO_SUPERUSER_EMAIL", "")
        password = os.getenv("DJANGO_SUPERUSER_PASSWORD")

        if not username or not password:
            self.stdout.write(
                self.style.WARNING(
                    "bootstrap_admin: variáveis DJANGO_SUPERUSER_USERNAME/PASSWORD não definidas. Pulando."
                )
            )
            return

        User = get_user_model()
        user = User.objects.filter(username=username).first()

        if user is None:
            self.stdout.write("bootstrap_admin: criando superuser...")
            user = User.objects.create_superuser(username=username, email=email, password=password)
            self.stdout.write(
                self.style.SUCCESS(f"bootstrap_admin: superuser '{username}' criado.")
            )
        else:
            # garante que vira superuser + atualiza senha
            changed = False
            if not user.is_superuser:
                user.is_superuser = True
                changed = True
            if not user.is_staff:
                user.is_staff = True
                changed = True

            user.set_password(password)
            user.email = email or user.email
            user.save()

            msg = f"bootstrap_admin: senha atualizada e permissões garantidas para '{username}'."
            self.stdout.write(self.style.SUCCESS(msg))
