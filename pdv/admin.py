from django.contrib import admin
from .models import Venda, VendaItem
from .models import OverrideLoteVencido


class VendaItemInline(admin.TabularInline):
    model = VendaItem
    extra = 0
    can_delete = True

    def get_readonly_fields(self, request, obj=None):
        if obj and getattr(obj, "status", "") == "concluida":
            return [f.name for f in self.model._meta.fields]
        return super().get_readonly_fields(request, obj)

    def has_add_permission(self, request, obj=None):
        if obj and getattr(obj, "status", "") == "concluida":
            return False
        return True

    def has_delete_permission(self, request, obj=None):
        if obj and getattr(obj, "status", "") == "concluida":
            return False
        return True


@admin.register(Venda)
class VendaAdmin(admin.ModelAdmin):
    list_display = ("id", "criado_em", "operador", "forma_pagamento", "total", "status")
    list_filter = ("status", "forma_pagamento", "criado_em")
    search_fields = ("id", "operador__username")
    date_hierarchy = "criado_em"
    inlines = [VendaItemInline]

    def get_readonly_fields(self, request, obj=None):
        ro = list(super().get_readonly_fields(request, obj))
        if obj and getattr(obj, "status", "") == "concluida":
            ro += ["operador", "forma_pagamento", "observacao", "total", "status", "criado_em"]
        return ro

    def has_delete_permission(self, request, obj=None):
        if obj and getattr(obj, "status", "") == "concluida":
            return False
        return super().has_delete_permission(request, obj)

    def changeform_view(self, request, object_id=None, form_url="", extra_context=None):
        extra_context = extra_context or {}
        obj = None
        if object_id:
            obj = self.get_object(request, object_id)

        if obj and getattr(obj, "status", "") == "concluida":
            extra_context.update({
                "show_save": False,
                "show_save_and_continue": False,
                "show_save_and_add_another": False,
                "show_delete": False,
            })

        return super().changeform_view(request, object_id, form_url, extra_context=extra_context)


@admin.register(VendaItem)
class VendaItemAdmin(admin.ModelAdmin):
    list_display = ("id", "vendas", "produto", "qtd", "preco_unit")
    search_fields = ("vendas__id", "produto__nome")

    def has_module_permission(self, request):
        # remove o app "VendaItem" do menu lateral
        return False

@admin.register(OverrideLoteVencido)
class OverrideLoteVencidoAdmin(admin.ModelAdmin):
    list_display = ("id", "empresa", "tipo", "usuario", "motivo", "criado_em")
    list_filter = ("empresa", "tipo", "criado_em")
    search_fields = ("motivo", "usuario__username", "usuario__email", "produto__nome", "lote__codigo")
    ordering = ("-criado_em",)