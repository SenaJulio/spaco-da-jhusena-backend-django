from django.contrib.auth.decorators import login_required
from .views_financeiro import dados_grafico_filtrados, ia_resumo_mensal
from django.http import HttpResponse
from django.urls import path

from .views_financeiro import (
    dashboard_financeiro,
    gerar_dica_30d,
    ia_historico,
    ia_historico_feed,
    ia_resumo_mensal,
    gerar_dica_sob_demanda,
)
from .views_insights_api import api_criar_insight_simples

app_name = "financeiro"


def ping(request):
    return HttpResponse("pong")


urlpatterns = [
    path("ping/", ping, name="ping"),

    # Painel
    path("dashboard/", login_required(dashboard_financeiro), name="dashboard_financeiro"),

    # APIs de insights e IA
    path(
        "api/insights/criar-simples/",
        login_required(api_criar_insight_simples),
        name="api_criar_insight_simples",
    ),
    path("modo-turbo/dica30d/", login_required(gerar_dica_30d), name="gerar_dica_30d"),
    path("api/insights/gerar/", login_required(gerar_dica_sob_demanda), name="gerar_dica_sob_demanda"),

    # Histórico/Feeds/Resumo
    path("ia/historico/", login_required(ia_historico), name="insights_historico"),
    path("ia/historico-feed/", login_required(ia_historico_feed), name="ia_historico_feed"),
    path("ia/resumo-mensal/", login_required(ia_resumo_mensal), name="ia_resumo_mensal"),
    path("dados_grafico_filtrados/", login_required(dados_grafico_filtrados), name="dados_grafico_filtrados"),    
    path("dashboard/dados-filtrados/", login_required(dados_grafico_filtrados), name="dados_filtrados_dashboard"),

]

from .views_financeiro import diag_transacao
urlpatterns += [
    path("diag/transacao/", login_required(diag_transacao), name="diag_transacao"),
]
