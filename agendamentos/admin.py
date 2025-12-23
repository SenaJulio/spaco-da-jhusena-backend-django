from django.contrib import admin
from .models import Agendamento


# Branding no admin padrão
admin.site.site_header = "🐶 Spaço da Jhuséna Admin"
admin.site.site_title = "Painel Spaço da Jhuséna"
admin.site.index_title = "Bem-vindo ao Controle Geral 💚"


@admin.register(Agendamento)
class AgendamentoAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "cliente",
        "servico",
        "data",
        "hora",
        "status",
        "nome",
        "telefone",
        "email",
    )
    search_fields = ("cliente", "nome", "telefone", "email")
    list_filter = ("status", "data")  # (servico pode ficar aqui também se quiser)
    ordering = ("-id",)
    actions = ("marcar_como_concluido",)

    @admin.action(description="Marcar agendamentos selecionados como Concluídos")
    def marcar_como_concluido(self, request, queryset):
        atualizados = queryset.update(status="concluido")
        self.message_user(request, f"{atualizados} agendamento(s) marcado(s) como concluído(s).")
