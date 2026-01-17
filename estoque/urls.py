from django.urls import path

from . import views
from .views_lotes import lotes_criticos
from .views import dashboard_estoque
from .views import api_ranking_estoque_critico

app_name = "estoque"

urlpatterns = [
    # Dashboard HTML
    path("dashboard/", views.dashboard_estoque, name="dashboard_estoque"),
    # Dados do dashboard (AJAX)
    path(
        "dashboard/dados/",
        views.dashboard_estoque_dados,
        name="dashboard_estoque_dados",
    ),
    # IA / alertas de validade de lotes
    path(
        "ia/lotes-validade/",
        views.ia_lotes_validade_view,
        name="ia_lotes_validade",
    ),
    # API – lotes prestes a vencer (usado no dashboard)
    path(
        "api/lotes-prestes-vencer/",
        views.api_lotes_prestes_vencer,
        name="api_lotes_prestes_vencer",
    ),
    # 🔥 Lotes críticos (endpoint que o front espera)
    path("lotes/criticos/", views.lotes_criticos_page, name="lotes_criticos"),

     path("api/ranking-critico/", views.api_lotes_criticos, name="api_ranking_critico"),


]
