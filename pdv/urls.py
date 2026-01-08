from django.urls import path
from . import views

app_name = "pdv"

urlpatterns = [
    path("", views.pdv_home, name="home"),
    path("api/finalizar/", views.api_finalizar_venda, name="api_finalizar"),
]
