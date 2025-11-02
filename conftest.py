import os

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
os.environ.setdefault("SECRET_KEY", "dummy-test-secret")
os.environ.setdefault("DEBUG", "1")
os.environ.setdefault("EMAIL_BACKEND", "django.core.mail.backends.console.EmailBackend")
