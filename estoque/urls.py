from django.urls import path
<<<<<<< HEAD

=======
from .views import dashboard_estoque
from .views_api import lotes_criticos
>>>>>>> 519c13b (docs: atualiza README do ERP Spaço da Jhuséna (v1.0))
from . import views

urlpatterns = [
<<<<<<< HEAD
    path("", views.index, name="index"),
=======
    path("dashboard/", views.dashboard_estoque, name="dashboard_estoque"),
    path("dashboard/", dashboard_estoque, name="dashboard_estoque"),
    path("lotes/criticos/", lotes_criticos, name="lotes_criticos"),
    path("dashboard/dados/", views.dashboard_estoque_dados, name="dashboard_estoque_dados"),
    path("ia/lotes-validade/", views.ia_lotes_validade_view, name="ia_lotes_validade"),
    path(
        "api/lotes-prestes-vencer/",
        views.api_lotes_prestes_vencer,
        name="api_lotes_prestes_vencer",
    ),
>>>>>>> 519c13b (docs: atualiza README do ERP Spaço da Jhuséna (v1.0))
]
