from django.contrib import admin
from django.core.exceptions import ValidationError
from decimal import Decimal

from .models import Venda, ItemVenda
from estoque.models import MovimentoEstoque, LoteProduto
from django.db.models import Sum, Case, When, F, DecimalField


def _baixar_estoque_fifo(produto, quantidade, venda):
    """
    Baixa a quantidade informada usando o lote mais antigo primeiro
    (ordenado por validade, depois por criação).
    Cria 1 ou mais movimentos de saída, cada um ligado a um lote.
    """
    restante = Decimal(quantidade)

    # lotes do produto, ordenados do que vence mais cedo para o mais tarde
    lotes = LoteProduto.objects.filter(produto=produto).order_by("validade", "criado_em")

    for lote in lotes:
        saldo_lote = Decimal(lote.saldo_atual or 0)
        if saldo_lote <= 0:
            continue

        usar = min(saldo_lote, restante)

        MovimentoEstoque.objects.create(
            produto=produto,
            tipo="S",
            quantidade=usar,
            lote=lote,
            observacao=f"Venda #{venda.id} (FIFO)",
        )

        restante -= usar
        if restante <= 0:
            break

    if restante > 0:
        # se quiser, pode permitir saída sem lote;
        # eu preferi travar com erro claro
        raise ValidationError(
            {
                "__all__": (
                    f"Estoque insuficiente para {produto.nome}. "
                    f"Faltam {restante} unidade(s) para concluir a venda #{venda.id}."
                )
            }
        )


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
        - gera SAÍDA de estoque usando FIFO por lote
        """
        super().save_related(request, form, formsets, change)

        venda = form.instance
        venda.calcular_total()

        for item in venda.itens.all():
            produto = item.produto
            if getattr(produto, "controla_estoque", False):
                _baixar_estoque_fifo(
                    produto=produto,
                    quantidade=item.quantidade,
                    venda=venda,
                )


@admin.register(ItemVenda)
class ItemVendaAdmin(admin.ModelAdmin):
    list_display = ("venda", "produto", "quantidade", "preco_unitario", "subtotal")
    readonly_fields = ("subtotal",)
