from decimal import Decimal
from datetime import timedelta

from django.contrib import admin, messages
from django.core.exceptions import ValidationError
from django.db import transaction

from .models import Venda, ItemVenda
from estoque.models import MovimentoEstoque, LoteProduto


def _baixar_estoque_fifo(produto, quantidade, venda):
    """
    Baixa a quantidade informada usando FIFO (lote mais antigo primeiro).
    Bloqueia venda se houver lote vencido com saldo.
    """
    restante = Decimal(str(quantidade))

    lotes = LoteProduto.objects.filter(produto=produto).order_by("validade", "criado_em")

    for lote in lotes:
        saldo_lote = Decimal(str(lote.saldo_atual or 0))
        if saldo_lote <= 0:
            continue

        if lote.validade and lote.validade < venda.data.date():
            raise ValidationError([f"Lote vencido ({lote.validade}). Venda bloqueada."])

        dias_alerta = 30
        limite = venda.data.date() + timedelta(days=dias_alerta)

        if lote.validade and venda.data.date() <= lote.validade <= limite:
            avisos = getattr(venda, "_avisos_lote", [])
            avisos.append(f"⚠️ Lote próximo do vencimento ({lote.validade}).")
            venda._avisos_lote = avisos

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
        raise ValidationError(
            [
                f"Estoque insuficiente para {produto.nome}. "
                f"Faltam {restante} unidade(s) para concluir a venda #{venda.id}."
            ]
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

    def save_model(self, request, obj, form, change):
        try:
            super().save_model(request, obj, form, change)
        except ValidationError as e:
            msg = e.messages[0] if hasattr(e, "messages") else str(e)
            self.message_user(request, msg, level=messages.ERROR)
            form.add_error(None, msg)

    def save_related(self, request, form, formsets, change):
        """
        Após salvar os itens:
        - recalcula total
        - baixa estoque via FIFO
        - rollback completo em erro
        """
        try:
            with transaction.atomic():
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

                avisos = list(dict.fromkeys(getattr(venda, "_avisos_lote", [])))
                if avisos:
                    self.message_user(request, avisos[0], level=messages.WARNING)

        except ValidationError as e:
            transaction.set_rollback(True)
            msg = e.messages[0] if hasattr(e, "messages") else str(e)
            self.message_user(request, msg, level=messages.ERROR)
            form.add_error(None, msg)


@admin.register(ItemVenda)
class ItemVendaAdmin(admin.ModelAdmin):
    list_display = ("venda", "produto", "quantidade", "preco_unitario", "subtotal")
    readonly_fields = ("subtotal",)
