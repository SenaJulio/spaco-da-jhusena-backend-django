from django.contrib import admin

from .models import Insight, RecomendacaoIA, Transacao
from financeiro.services.ia_utils import _map_tipo


admin.site.register(Transacao)


@admin.register(Insight)
class InsightAdmin(admin.ModelAdmin):
    list_display = ("created_at", "title", "kind", "categoria_dominante", "score")
    list_filter = ("kind", "categoria_dominante")
    search_fields = ("title", "text")
    ordering = ("-created_at",)


from django.contrib import admin

from .models import RecomendacaoIA


@admin.register(RecomendacaoIA)
class RecomendacaoIAAdmin(admin.ModelAdmin):
    # Campos EXISTENTES no seu model
    list_display = ("criado_em", "tipo", "usuario", "preview_texto")
    list_filter = ("tipo", "criado_em", "usuario")
    search_fields = ("texto", "usuario__username", "usuario__first_name", "usuario__last_name")
    ordering = ("-criado_em",)

    def preview_texto(self, obj):
        return (obj.texto[:80] + "…") if len(obj.texto) > 80 else obj.texto

    preview_texto.short_description = "Texto (prévia)"

from financeiro.services.ia_utils import _map_tipo
