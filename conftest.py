# conftest.py — inicialização do Django para pytest
import os

# Configurações mínimas para o Django iniciar
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
os.environ.setdefault("SECRET_KEY", "dummy-test-secret")
os.environ.setdefault("DEBUG", "1")
os.environ.setdefault("EMAIL_BACKEND", "django.core.mail.backends.console.EmailBackend")

# (Opcional) — desabilita migrações para rodar os testes mais rápido
# Se der erro de migração, pode comentar esta parte
# from django.conf import settings
# class DisableMigrations(dict):
#     def __contains__(self, item): return True
#     def __getitem__(self, item): return None
# settings.MIGRATION_MODULES = DisableMigrations()
