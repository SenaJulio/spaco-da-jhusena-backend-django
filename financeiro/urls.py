# financeiro/urls.py
from django.urls import path
from django.http import HttpResponse
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse

from .views_financeiro import (
    dashboard_financeiro,
    gerar_dica_30d,
    ia_historico,
    ia_historico_feed,
    ia_resumo_mensal,
    gerar_dica_sob_demanda,
    dados_grafico_filtrados,  # usado pelo dashboard.js
    diag_transacao,  # diagnóstico opcional
)

from .views_insights_api import api_criar_insight_simples

# Se/Quando você criar a view real de categorias:
# from .views_insights import metrics_despesas_por_categoria_view

app_name = "financeiro"


def ping(request):
    return HttpResponse("pong")


def metrics_despesas_por_categoria_view(request):
    return JsonResponse({"labels": [], "valores": []})


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
        "api/insights/gerar/", login_required(gerar_dica_sob_demanda), name="gerar_dica_sob_demanda"
    ),
    # Histórico/Feeds/Resumo
    path("ia/historico/", login_required(ia_historico), name="insights_historico"),
    path("ia/historico-feed/", login_required(ia_historico_feed), name="ia_historico_feed"),
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
    # Quando tiver categorias reais:
    # path("metrics/despesas-por-categoria/", login_required(metrics_despesas_por_categoria_view), name="metrics_despesas_por_categoria"),
    path(
        "metrics/despesas-por-categoria/",
        login_required(metrics_despesas_por_categoria_view),
        name="metrics_despesas_por_categoria",
    ),
]
