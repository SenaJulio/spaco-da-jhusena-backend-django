# core/urls.py
from django.urls import path
from . import views
from core.views import home

app_name = "core"

urlpatterns = [
    path("", views.home, name="home"),
]
