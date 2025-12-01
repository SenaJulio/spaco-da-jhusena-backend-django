from django.contrib import admin
from .models import ExecucaoIAAuto

from .models import Notificacao, CanalNotificacaoUsuario


@admin.register(Notificacao)
class NotificacaoAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "usuario",
        "canal",
        "destino",
        "titulo",
        "status",
        "criado_em",
        "enviado_em",
    )
    list_filter = ("canal", "status", "criado_em")
    search_fields = ("destino", "titulo", "mensagem")


@admin.register(CanalNotificacaoUsuario)
class CanalNotificacaoUsuarioAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "usuario",
        "canal",
        "destino",
        "ativo",
        "criado_em",
    )
    list_filter = ("canal", "ativo")
    search_fields = ("usuario__username", "destino")


@admin.register(ExecucaoIAAuto)
class ExecucaoIAAutoAdmin(admin.ModelAdmin):
    list_display = ("criado_em", "usuario", "tipo", "origem", "canal", "sucesso_envio")
    list_filter = ("canal", "sucesso_envio", "tipo", "origem")
    search_fields = ("texto", "erro_envio")
    readonly_fields = ("criado_em",)
