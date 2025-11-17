from django.contrib import admin
from django.urls import  path, include # 👈 precisa importar o include!

from agendamentos.views import agendar_servico
from core.views import home

urlpatterns = [
    path("admin/", admin.site.urls),
    path(
        "financeiro/",
        include(
            ("financeiro.urls", "financeiro"),
            path("", include("core.urls")),  # 👈 adiciona esta linha
            path("agendamentos/", include("agendamentos.urls")),
            path("agendar/", agendar_servico, name="agendar"),
            path("financeiro/", include("financeiro.urls")),
            path("", include("agendamentos.urls")),
            namespace="financeiro",
        ),
    ),
]
