# notificacoes/scheduler.py
import logging

from apscheduler.schedulers.background import BackgroundScheduler
from django.utils import timezone

from .jobs import executar_notificacoes_semanais

logger = logging.getLogger(__name__)

_scheduler = None


def start():
    """
    Inicia o scheduler em background e cadastra o job semanal.
    Esse cara será chamado no AppConfig.ready().
    """
    global _scheduler

    # Se já estiver rodando, não inicia de novo
    if _scheduler and _scheduler.running:
        logger.info("[NOTIF_SCHED] Scheduler já está rodando, ignorando start().")
        return

    # Usa o timezone do Django
    tz = timezone.get_current_timezone()

    scheduler = BackgroundScheduler(timezone=str(tz))

    # 💡 FASE 1: rodar A CADA 1 MINUTO só para teste
    # Depois que confirmar que está funcionando, a gente troca pra semanal (cron).
    scheduler.add_job(
        executar_notificacoes_semanais,
        "cron",
        day_of_week="mon",  # segunda-feira
        hour=9,
        minute=0,
        kwargs={
            "canal": "telegram",
            "dry_run": False,  # já enviando de verdade para o Telegram
        },
        id="notificacoes_semanais",
        replace_existing=True,
    )

    scheduler.start()
    _scheduler = scheduler
    logger.info("[NOTIF_SCHED] Scheduler de notificações semanais INICIADO.")
