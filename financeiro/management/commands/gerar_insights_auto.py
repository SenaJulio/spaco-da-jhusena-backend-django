# financeiro/management/commands/gerar_insights_auto.py
from django.core.management.base import BaseCommand
from django.utils import timezone

from financeiro.models import Insight
from financeiro.notifications import send_telegram_message
from financeiro.services.insights import generate_simple_insight


class Command(BaseCommand):
    help = "Gera 1 Insight automático (evita duplicar se já houve um recente)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--min-interval-days",
            type=int,
            default=7,
            help="Intervalo mínimo em dias entre execuções (padrão: 7).",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Não grava nada, apenas valida execução.",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Ignora o intervalo mínimo e força a geração.",
        )

    def handle(self, *args, **opts):
        min_days = opts["min_interval_days"]
        dry = opts["dry_run"]
        force = opts["force"]

        # evita gerar se já teve auto recente
        last_auto = Insight.objects.filter(generated_by="auto").order_by("-created_at").first()
        if last_auto and not force:
            delta = timezone.now() - last_auto.created_at
            if delta.days < min_days:
                self.stdout.write(
                    self.style.WARNING(
                        f"Skip: último auto há {delta.days} dia(s). Mínimo: {min_days} dia(s)."
                    )
                )
                return

        if dry:
            self.stdout.write(self.style.SUCCESS("Dry-run OK: geraria um Insight agora."))
            return

        # gera o insight
        ins = generate_simple_insight()
        ins.generated_by = "auto"
        ins.save(update_fields=["generated_by"])

        # envia para o Telegram (se variáveis estiverem configuradas)
        msg = (
            f"<b>Nova dica (IA)</b>\n"
            f"Tipo: <b>{ins.kind}</b>\n"
            f"<b>{ins.title}</b>\n"
            f"{ins.text}\n"
        )
        ok, err = send_telegram_message(msg)
        if ok:
            self.stdout.write(self.style.SUCCESS(f"Enviado ao Telegram • Insight #{ins.id}"))
        else:
            self.stdout.write(
                self.style.WARNING(f"Telegram não enviado: {err or 'erro desconhecido'}")
            )

        self.stdout.write(
            self.style.SUCCESS(f"Insight #{ins.id} gerado ({ins.kind}) — {ins.title}")
        )
