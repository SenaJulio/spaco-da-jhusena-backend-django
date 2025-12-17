from django.contrib import admin
from django.urls import path, include
from django.views.generic import TemplateView


urlpatterns = [
    path("admin/", admin.site.urls),
    # HOME (sua página principal)
    path("", include("core.urls")),
    # Módulos
    path("agendamentos/", include("agendamentos.urls")),
    path("financeiro/", include("financeiro.urls")),
    path("estoque/", include("estoque.urls")),  # só se existir esse app/urls
    path("vendas/", include("vendas.urls")),  # só se existir esse app/urls
    path("", TemplateView.as_view(template_name="home.html"), name="home"),
]
