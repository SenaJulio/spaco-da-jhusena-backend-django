# Register your models here.
# agendamentos/admin.py

from django.contrib import admin
from django.contrib.admin import AdminSite

from .models import Agendamento


class SpaçoJhusenaAdminSite(AdminSite):

    site_header = "🐶 Spaço da Jhuséna Admin"
    site_title = "Painel Spaço da Jhuséna"
    index_title = "Bem-vindo ao Controle Geral 💚"

    def each_context(self, request):
        context = super().each_context(request)
        context["css_files"] = ["css/admin_custom.css"]
        return context


admin_site = SpaçoJhusenaAdminSite(name="custom_admin")


@admin.register(Agendamento)
class AgendamentoAdmin(admin.ModelAdmin):

    list_display = ["cliente", "servico", "data", "hora", "status"]
    search_fields = ["cliente"]
    list_filter = ["status", "data"]
    ordering = ["-data", "hora"]
    actions = ["marcar_como_concluido"]

    @admin.action(description="Marcar agendamentos selecionados como Concluídos")
    def marcar_como_concluido(self, request, queryset):
        atualizados = queryset.update(status="concluido")
        self.message_user(request, f"{atualizados} agendamento(s) marcado(s) como concluído(s).")

        admin.site.register(Agendamento, AgendamentoAdmin)
