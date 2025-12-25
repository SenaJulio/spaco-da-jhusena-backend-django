from django.shortcuts import redirect
from django.urls import path

from . import views

app_name = "agendamentos"


def agendamentos_home(request):
    # ✅ aponta para a página de agendar correta (com namespace)
    return redirect("agendamentos:agendar")


urlpatterns = [
    path("", agendamentos_home, name="agendamentos_home"),
    path("agendar/", views.agendar_servico, name="agendar"),
    path("agendamento_sucesso/", views.agendamento_sucesso, name="agendamento_sucesso"),
    path("listar/", views.listar_agendamentos, name="listar_agendamentos"),
    path("concluir/<int:id>/", views.concluir_agendamento, name="concluir_agendamento"),
    path("cancelar/<int:id>/", views.cancelar_agendamento, name="cancelar_agendamento"),
    path("dashboard/", views.dashboard_agendamentos, name="dashboard_agendamentos"),
    path("dashboard/dados/", views.dashboard_dados_ajax, name="dashboard_dados_ajax"),
    path("api/agendar/", views.criar_agendamento, name="criar_agendamento"),
    path("api/agendamentos/", views.AgendamentoCreateView.as_view(), name="agendamento_create"),
    path("dashboard/hoje/", views.dashboard_hoje, name="dashboard_hoje"),
    path("acao/<int:id>/", views.acao_agendamento, name="acao_agendamento"),
]
