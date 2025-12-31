# core/management/commands/bootstrap_data.py
import os
from django.core.management.base import BaseCommand
from django.core.management import call_command
from django.apps import apps


class Command(BaseCommand):
    help = "Importa dados iniciais (dump.json) no Postgres apenas se o banco estiver vazio."

    def handle(self, *args, **options):
        dump_path = os.getenv("DJANGO_BOOTSTRAP_DUMP", "dump.json")

        # modelo “termômetro” (troque aqui se quiser)
        try:
            Transacao = apps.get_model("financeiro", "Transacao")
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f"bootstrap_data: não achei financeiro.Transacao: {e}")
            )
            return

        # se já tem dado, não importa
        try:
            if Transacao.objects.exists():
                self.stdout.write(
                    self.style.SUCCESS("bootstrap_data: banco já possui dados. Pulando import.")
                )
                return
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"bootstrap_data: erro consultando banco: {e}"))
            return

        # dump existe no projeto?
        if not os.path.exists(dump_path):
            self.stdout.write(
                self.style.WARNING(f"bootstrap_data: '{dump_path}' não encontrado. Pulando.")
            )
            return

        self.stdout.write("bootstrap_data: banco vazio. Importando dump...")
        try:
            call_command("loaddata", dump_path)
            self.stdout.write(self.style.SUCCESS("bootstrap_data: import concluído com sucesso!"))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"bootstrap_data: falha ao importar: {e}"))
