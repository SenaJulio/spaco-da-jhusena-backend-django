# notificacoes/management/commands/ia_auto_30d.py
from django.core.management.base import BaseCommand

from financeiro.services_ia import gerar_dica_30d_auto
from notificacoes.telegram_utils import enviar_telegram
from notificacoes.models import ExecucaoIAAuto  # 👈 NOVO


class Command(BaseCommand):
    help = "Gera uma dica automática da IA (últimos 30 dias) e envia para Telegram."

    def handle(self, *args, **options):
        self.stdout.write("Gerando dica 30d automática...")

        res = gerar_dica_30d_auto()  # dict com ok, tipo, texto, analise, user_id, etc.
        texto = res.get("texto") or "Sem texto gerado."
        tipo = res.get("tipo") or "neutra"
        origem = res.get("origem", "auto")
        analise = res.get("analise")  # dict com inicio, fim, saldo, etc.
        user_id = res.get("user_id")

        ok = enviar_telegram(texto)

        # ========= LOG NO BANCO =========
        try:
            ExecucaoIAAuto.objects.create(
                usuario_id=user_id,
                origem=origem,
                tipo=tipo,
                texto=texto,
                canal="telegram",
                sucesso_envio=ok,
                erro_envio="" if ok else "Falha no envio ao Telegram (ver logs).",
                meta=analise,
            )
        except Exception as e:
            # Não deixamos o comando explodir por causa de log
            self.stdout.write(self.style.ERROR(f"[LOG] Falha ao salvar ExecucaoIAAuto: {e}"))

        # ========= SAÍDA NO CONSOLE =========
        if ok:
            self.stdout.write(self.style.SUCCESS("Dica gerada e enviada com sucesso!"))
        else:
            self.stdout.write(self.style.WARNING("Dica gerada, mas FALHOU envio ao Telegram."))

        self.stdout.write(f"Tipo: {tipo}")
        self.stdout.write(f"Texto: {texto}")
