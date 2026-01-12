# notificacoes/scheduler.py
import logging
import os

from apscheduler.schedulers.background import BackgroundScheduler
from django.utils import timezone

from .jobs import executar_notificacoes_semanais

logger = logging.getLogger(__name__)

_scheduler = None


def start():
    """
    Inicia o scheduler em background e cadastra o job semanal.
    Esse cara será chamado no AppConfig.ready().

    Observação importante:
    - No runserver com autoreload, existem 2 processos.
      RUN_MAIN == "true" só no processo filho (o que realmente serve requests).
      Então iniciamos o scheduler apenas nele.
    """
    global _scheduler

    # ✅ evita iniciar duas vezes no runserver (processo pai do autoreload)
    if os.environ.get("RUN_MAIN") != "true":
        logger.info("[NOTIF_SCHED] Ignorando start() no processo pai do autoreload.")
        return

    # Se já estiver rodando, não inicia de novo
    if _scheduler and _scheduler.running:
        logger.info("[NOTIF_SCHED] Scheduler já está rodando, ignorando start().")
        return

    tz = timezone.get_current_timezone()
    scheduler = BackgroundScheduler(timezone=str(tz))

    scheduler.add_job(
        executar_notificacoes_semanais,
        "cron",
        day_of_week="mon",
        hour=9,
        minute=0,
        kwargs={
            "canal": "telegram",
            "dry_run": False,
        },
        id="notificacoes_semanais",
        replace_existing=True,
    )

    scheduler.start()
    _scheduler = scheduler
    logger.info("[NOTIF_SCHED] Scheduler de notificações semanais INICIADO.")
