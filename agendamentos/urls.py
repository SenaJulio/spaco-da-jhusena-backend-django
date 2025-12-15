from django.urls import path

from . import views

app_name = "agendamentos"

urlpatterns = [
    path("agendar/", views.agendar_servico, name="agendar"),
    path("agendamento_sucesso/", views.agendamento_sucesso, name="agendamento_sucesso"),
    path("listar/", views.listar_agendamentos, name="listar_agendamentos"),
    path("concluir/<int:id>/", views.concluir_agendamento, name="concluir_agendamento"),
    path("cancelar/<int:id>/", views.cancelar_agendamento, name="cancelar_agendamento"),
    path("dashboard/", views.dashboard_agendamentos, name="dashboard_agendamentos"),
    path("dashboard/dados/", views.dashboard_dados_ajax, name="dashboard_dados_ajax"),
    path("api/agendar/", views.criar_agendamento, name="criar_agendamento"),
    path("api/agendamentos/", views.AgendamentoCreateView.as_view(), name="agendamento_create"),
    path("dashboard/hoje/", views.agendamentos_hoje_ajax, name="agendamentos_hoje_ajax"),
    path("acao/<int:id>/", views.acao_agendamento, name="acao_agendamento"),
]
