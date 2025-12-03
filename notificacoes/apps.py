# notificacoes/apps.py
from django.apps import AppConfig
import os
import logging

logger = logging.getLogger(__name__)


class NotificacoesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "notificacoes"

    def ready(self):
        """
        Esse método roda quando o Django inicializa o app.
        Aqui a gente inicia o APScheduler, MAS com cuidado
        para não duplicar no autoreload do runserver.
        """
        # Evitar rodar duas vezes no runserver por causa do autoreload
        if os.environ.get("RUN_MAIN") != "true":
            logger.info("[NOTIF_SCHED] Ignorando start() no processo de autoreload.")
            return

        try:
            from . import scheduler

            scheduler.start()
            logger.info("[NOTIF_SCHED] start() chamado com sucesso no ready().")
        except Exception as e:
            logger.exception(f"[NOTIF_SCHED] Erro ao iniciar scheduler: {e}")
