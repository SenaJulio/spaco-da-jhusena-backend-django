# core/management/commands/create_demo.py
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db import transaction

from core.models import Empresa, Perfil


class Command(BaseCommand):
    help = "Cria (ou garante) Empresa DEMO + Usuário DEMO + Perfil DEMO (idempotente)."

    @transaction.atomic
    def handle(self, *args, **options):
        User = get_user_model()

        demo_empresa_nome = "DEMO - Spaço da Jhuséna"
        demo_username = "demo"
        demo_email = "demo@spacodajhusena.local"
        demo_password = "demo12345"

        # 1) Empresa DEMO
        empresa, empresa_created = Empresa.objects.get_or_create(
            nome=demo_empresa_nome,
            defaults={},
        )

        # tenta setar politica_lote_vencido se existir no model
        if hasattr(empresa, "politica_lote_vencido") and not getattr(empresa, "politica_lote_vencido"):
            empresa.politica_lote_vencido = "justificar"  # padrão seguro p/ demo
            empresa.save(update_fields=["politica_lote_vencido"])

        # 2) Usuário DEMO
        user, user_created = User.objects.get_or_create(
            username=demo_username,
            defaults={"email": demo_email},
        )
        if user_created:
            user.set_password(demo_password)
            user.save()

        # garante email
        if getattr(user, "email", "") != demo_email:
            user.email = demo_email
            user.save(update_fields=["email"])

        # 3) Perfil DEMO (empresa obrigatória)
        perfil, perfil_created = Perfil.objects.get_or_create(
            user=user,
            defaults={"empresa": empresa},
        )
        if not getattr(perfil, "empresa_id", None):
            perfil.empresa = empresa
            perfil.save(update_fields=["empresa"])

        self.stdout.write(self.style.SUCCESS("✅ DEMO pronto!"))
        self.stdout.write(f"Empresa: {empresa.nome} (id={empresa.id})")
        self.stdout.write(f"Usuário: {user.username}")
        self.stdout.write(f"Senha: {demo_password}")
        self.stdout.write("👉 Login e use o sistema com segurança (ambiente demo).")
