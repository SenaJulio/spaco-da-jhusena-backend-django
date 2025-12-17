from django.urls import path

from .views import dashboard_estoque
from .views_api import lotes_criticos
from .views_lotes import (
    dashboard_estoque_dados,
    ia_lotes_validade_view,
    api_lotes_prestes_vencer,
)

urlpatterns = [
    path("dashboard/", dashboard_estoque, name="dashboard_estoque"),
    path("dashboard/dados/", dashboard_estoque_dados, name="dashboard_estoque_dados"),
    path("lotes/criticos/", lotes_criticos, name="lotes_criticos"),
    path("ia/lotes-validade/", ia_lotes_validade_view, name="ia_lotes_validade"),
    path(
        "api/lotes-prestes-vencer/",
        api_lotes_prestes_vencer,
        name="api_lotes_prestes_vencer",
    ),
]
