from django.urls import path
from .views import dashboard_estoque
from . import views

app_name = "estoque"

urlpatterns = [
    path("dashboard/", views.dashboard_estoque, name="dashboard_estoque"),
    path("dashboard/", dashboard_estoque, name="dashboard_estoque"),
    path("dashboard/dados/", views.dashboard_estoque_dados, name="dashboard_estoque_dados"),
    path("ia/lotes-validade/", views.ia_lotes_validade_view, name="ia_lotes_validade"),
    path(
        "api/lotes-prestes-vencer/",
        views.api_lotes_prestes_vencer,
        name="api_lotes_prestes_vencer",
    ),
]
