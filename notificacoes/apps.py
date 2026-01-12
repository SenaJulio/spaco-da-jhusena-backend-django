import os
from django.apps import AppConfig

class NotificacoesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "notificacoes"

    def ready(self):
        # ✅ evita rodar 2x no autoreload do runserver
        if os.environ.get("RUN_MAIN") != "true":
            return

        from .scheduler import start  # ou o arquivo onde está seu start()
        start()
