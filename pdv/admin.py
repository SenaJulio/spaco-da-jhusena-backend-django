from django.contrib import admin
from .models import Venda, VendaItem


class VendaItemInline(admin.TabularInline):
    model = VendaItem
    extra = 0


@admin.register(Venda)
class VendaAdmin(admin.ModelAdmin):
    list_display = ("id", "criado_em", "operador", "forma_pagamento", "total", "status")
    list_filter = ("forma_pagamento", "status", "criado_em")
    search_fields = ("id", "operador__username", "operador__email")
    inlines = [VendaItemInline]
