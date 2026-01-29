# financeiro/urls.py
from django.urls import path
from django.http import HttpResponse
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from .views_insights import metrics_despesas_por_categoria_view 
from . import views_financeiro
from .views_ia import ia_gerar_dica_30d
from .views_insights import gerar_insight_view
from . import views_financeiro as views
from . import views_financeiro as v
from .views_financeiro import gerar_insight, listar_insights
from .views_export import historico_ia_csv_v2
from .views import api_enviar_whatsapp

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
    ia_alertas_estoque_baixo,
    ia_alertas_lotes,
)

from .views_insights_api import api_criar_insight_simples


# Se/Quando você criar a view real de categorias:


app_name = "financeiro"


def ping(request):
    return HttpResponse("pong")


urlpatterns = [
    # Ping
    path("ping/", lambda r: v.JsonResponse({"pong": True}), name="ping"),
    # Painel
    path("dashboard/", login_required(v.dashboard_financeiro), name="dashboard_financeiro"),
    # Dados para gráficos do dashboard
    path(
        "dados_grafico_filtrados/",
        login_required(v.dados_grafico_filtrados),
        name="dados_grafico_filtrados",
    ),
    path(
        "dashboard/dados-filtrados/",
        login_required(v.dados_financeiros_filtrados),
        name="dados_filtrados_dashboard",
    ),
    # Diagnóstico e utilidades
    path("diag/transacao/", login_required(v.diag_transacao), name="diag_transacao"),
    path("dashboard/categorias/", v.categorias_transacao, name="categorias_transacao"),
    # IA – Preview e Gerar (alinhado com o front)
    path("ia/analise/preview/", v.ia_analise_30d_preview, name="ia_analise_30d_preview"),
    path("ia/analise/gerar/", v.ia_analise_30d_gerar, name="ia_analise_30d_gerar"),
    path("ia/gerar_dica_30d/", v.gerar_dica_30d, name="api_generate_tip_30d"),  # usado pelo JS
    # Histórico (v2 é o usado pelo historico_ia.js)
    path("ia/historico/feed/v2/", v.ia_historico_feed_v2, name="ia_historico_feed_v2"),
    path("ia/historico/feed/", v.ia_historico_feed, name="ia_historico_feed"),
    path("ia/historico/", v.ia_historico, name="ia_historico"),
    path("ia/historico/export/csv/", historico_ia_csv_v2, name="ia_historico_export_csv_v2"),
    # Insights utilitários/APIs extras
    path(
        "metrics/despesas-por-categoria/",
        login_required(metrics_despesas_por_categoria_view),
        name="metrics_despesas_por_categoria",
    ),
    path("insights/gerar/", gerar_insight_view, name="gerar_insight"),
    path("insights/", v.listar_insights, name="listar_insights"),
    # Endpoints antigos/alternativos (opcional)
    path("ia/dica30d/", ia_gerar_dica_30d, name="ia_dica30d"),
    path("ia/resumo_mensal/", v.ia_resumo_mensal, name="ia_resumo_mensal"),
    path("ia/resumo-mensal/", v.ia_resumo_mensal, name="ia_resumo_mensal_dash"),
    path("api/insights/servico-lider/", views.api_servico_lider, name="api_servico_lider"),
    path("api/insights/categoria-lider/", views.api_categoria_lider_receitas, name="api_categoria_lider_receitas"),
    path("api/insights/produto-lider-pdv/", views.api_produto_lider_pdv, name="api_produto_lider_pdv"),
    path(
        "ia/gerar_dica_sob_demanda/",
        v.gerar_dica_sob_demanda,
        name="ia_gerar_dica_sob_demanda",
    ),
    path(
        "ia/resumo-mensal/series/",
        views.ia_resumo_mensal_series,
        name="ia_resumo_mensal_series",
    ),
    path(
        "ia/analise-mensal/preview/",
        views.ia_analise_mensal_preview,
        name="ia_analise_mensal_preview",
    ),
    path(
        "metrics/ranking-categorias-mensal/",
        views.ranking_categorias_mensal,
        name="ranking_categorias_mensal",
    ),
    path(
        "metrics/ranking-servicos-mensal/",
        views.ranking_servicos_mensal,
        name="ranking_servicos_mensal",
    ),
    path(
        "metrics/crescimento-categoria/",
        views.categoria_que_mais_cresceu,
        name="categoria_que_mais_cresceu",
    ),
    path(
        "metrics/despesas-fixas-variaveis/",
        views.despesas_fixas_variaveis_mensal,
        name="despesas_fixas_variaveis_mensal",
    ),
    path(
        "ia/gerar_dica_30d/",
        views.gerar_dica_30d,
        name="gerar_dica_30d",
    ),
    path(
        "ia/enviar_dica_30d/",
        views.enviar_dica_30d,
        name="enviar_dica_30d",
    ),
    path(
        "ranking/servicos_mensal/",
        views.ranking_servicos_mensal,
        name="ranking_servicos_mensal",
    ),
    path(
        "ia/alertas_periodos_criticos/",
        views.ia_alertas_periodos_criticos,
        name="ia_alertas_periodos_criticos",
    ),
    path(
        "ia/resumo_mensal_series/",
        views.ia_resumo_mensal_series,
        name="ia_resumo_mensal_series",
    ),
    path("whatsapp/enviar/", api_enviar_whatsapp, name="api_enviar_whatsapp"),

    # 🔥 Estoque baixo (usa gerar_alertas_estoque_baixo)
    path(
        "ia/estoque-baixo/",
        views.ia_alertas_estoque_baixo,
        name="ia_alertas_estoque_baixo",
    ),
    # 📦 Alertas de lotes (usa ia_alertas_lotes)
    path(
        "ia/alertas-lotes/",
        views.ia_alertas_lotes,
        name="ia_alertas_lotes",
    ),

]
