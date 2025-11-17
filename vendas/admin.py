from django.contrib import admin
from .models import Venda, ItemVenda
from estoque.models import MovimentoEstoque


class ItemVendaInline(admin.TabularInline):
    model = ItemVenda
    extra = 1
    fields = ("produto", "quantidade", "preco_unitario", "subtotal")
    readonly_fields = ("subtotal",)


@admin.register(Venda)
class VendaAdmin(admin.ModelAdmin):
    list_display = ("id", "data", "total", "observacao")
    list_filter = ("data",)
    search_fields = ("observacao",)
    readonly_fields = ("total",)
    inlines = [ItemVendaInline]

    def save_related(self, request, form, formsets, change):
        """
        Depois de salvar os itens:
        - recalcula o total da venda
        - gera saída de estoque para produtos que controlam estoque
        """
        super().save_related(request, form, formsets, change)

        venda = form.instance

        # recalcula total
        venda.calcular_total()

        # gera movimentos de estoque (entrada já foi lançada na mão)
        for item in venda.itens.all():
            produto = item.produto
            if getattr(produto, "controla_estoque", False):
                MovimentoEstoque.objects.create(
                    produto=produto,
                    tipo="S",  # Saída
                    quantidade=item.quantidade,
                    observacao=f"Venda #{venda.id}",
                )


@admin.register(ItemVenda)
class ItemVendaAdmin(admin.ModelAdmin):
    list_display = ("venda", "produto", "quantidade", "preco_unitario", "subtotal")
    readonly_fields = ("subtotal",)
