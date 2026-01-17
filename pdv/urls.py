from django.urls import path
from . import views

app_name = "pdv"

urlpatterns = [
    path("", views.pdv_home, name="home"),
    path("api/finalizar/", views.api_finalizar_venda, name="api_finalizar"),
    path("api/check-lote-vencido/", views.api_pdv_check_lote_vencido, name="api_pdv_check_lote_vencido"),
    path(
    "vendas/lote-vencido/",
    views.vendas_com_lote_vencido,
    name="vendas_lote_vencido",
),

]
