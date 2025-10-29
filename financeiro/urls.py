# financeiro/urls.py
from django.urls import path
from django.http import HttpResponse
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from .views_insights import metrics_despesas_por_categoria_view 
from . import views_financeiro
from .views_ia import ia_gerar_dica_30d
from .views_insights import gerar_insight_view

from .views_financeiro import (
    dashboard_financeiro,
    gerar_dica_30d,
    ia_historico,
    ia_historico_feed,
    ia_resumo_mensal,
    gerar_dica_sob_demanda,
    dados_grafico_filtrados,  # usado pelo dashboard.js
    diag_transacao,  # diagnóstico opcional
    ia_historico_feed_v2,   
)

from .views_insights_api import api_criar_insight_simples

# Se/Quando você criar a view real de categorias:


app_name = "financeiro"


def ping(request):
    return HttpResponse("pong")


urlpatterns = [
    path("ping/", ping, name="ping"),
    # Painel
    path("dashboard/", login_required(dashboard_financeiro), name="dashboard_financeiro"),
    # IA / Insights
    path("modo-turbo/dica30d/", login_required(gerar_dica_30d), name="gerar_dica_30d"),
    path(
        "api/insights/criar-simples/",
        login_required(api_criar_insight_simples),
        name="api_criar_insight_simples",
    ),
    path(
        "api/insights/gerar/",
        login_required(gerar_dica_sob_demanda),
        name="gerar_dica_sob_demanda",
    ),
    # Histórico / Feeds / Resumo
    path("ia/historico/", login_required(ia_historico), name="insights_historico"),
    # 🔹 Endpoints de histórico da IA (com compatibilidade)
    path("ia/historico/feed/", login_required(ia_historico_feed), name="ia_historico_feed"),
    path("ia/historico-feed/", login_required(ia_historico_feed)),  # compatibilidade
    path(
        "ia/historico/feed/v2/", login_required(ia_historico_feed_v2), name="ia_historico_feed_v2"
    ),
    path(
        "ia/historico/feed/v2/", login_required(ia_historico_feed_v2), name="ia_historico_feed_v2"
    ),
    path("ia/resumo-mensal/", login_required(ia_resumo_mensal), name="ia_resumo_mensal"),
    # Dados para gráficos do dashboard
    path(
        "dados_grafico_filtrados/",
        login_required(dados_grafico_filtrados),
        name="dados_grafico_filtrados",
    ),
    path(
        "dashboard/dados-filtrados/",
        login_required(dados_grafico_filtrados),
        name="dados_filtrados_dashboard",
    ),
    # Diagnóstico de modelo
    path("diag/transacao/", login_required(diag_transacao), name="diag_transacao"),
    # (opcional futuro)
    path(
        "metrics/despesas-por-categoria/",
        login_required(metrics_despesas_por_categoria_view),
        name="metrics_despesas_por_categoria",
    ),
    path("ia/gerar_dica_30d/", views_financeiro.gerar_dica_30d, name="api_generate_tip_30d"),
    path("ia/dica30d/", ia_gerar_dica_30d, name="ia_dica30d"),
    path("insights/gerar/", gerar_insight_view, name="gerar_insight"),
]
