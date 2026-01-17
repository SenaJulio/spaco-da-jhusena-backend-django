from django.contrib import admin
from django.db.models import Sum, Case, When, F, DecimalField

from .models import ItemEstoque, Produto, MovimentoEstoque, LoteProduto


# -------- Filtro lateral "com estoque baixo" --------
class EstoqueBaixoFilter(admin.SimpleListFilter):
    title = "Estoque"
    parameter_name = "estoque_baixo"

    def lookups(self, request, model_admin):
        return [
            ("baixo", "Baixo / Em falta"),
        ]

    def queryset(self, request, queryset):
        valor = self.value()
        if valor == "baixo":
            # só considera produtos que controlam estoque
            # e compara saldo_calc com o estoque_minimo do próprio produto
            return queryset.filter(controla_estoque=True, saldo_calc__lte=F("estoque_minimo"))
        return queryset


class EstoqueBaixoFilter(admin.SimpleListFilter):
    title = "Estoque"
    parameter_name = "estoque_baixo"

    def lookups(self, request, model_admin):
        return [("baixo", "Baixo / Em falta")]

    def queryset(self, request, queryset):
        if self.value() == "baixo":
            # saldo <= estoque_minimo
            return queryset.filter(saldo_calc__lte=F("estoque_minimo"))
        return queryset


@admin.register(Produto)
class ProdutoAdmin(admin.ModelAdmin):
    list_display = (
        "nome",
        "tipo",
        "preco_venda",
        "controla_estoque",
        "estoque_minimo",
        "ativo",
        "saldo_estoque",
        "status_estoque",
    )

    # permite editar direto na lista (mais rápido no dia a dia)
    list_editable = ("estoque_minimo",)

    list_filter = (
        "tipo",
        "controla_estoque",
        "ativo",
        EstoqueBaixoFilter,
    )
    search_fields = ("nome",)
    readonly_fields = ("saldo_estoque",)

    # -------- SALDO --------
    @admin.display(description="Saldo em estoque")
    def saldo_estoque(self, obj):
        if not obj.pk:
            return 0

        agg = obj.movimentos.aggregate(
            saldo=Sum(
                Case(
                    When(tipo="E", then=F("quantidade")),
                    When(tipo="S", then=-F("quantidade")),
                    default=0,
                    output_field=DecimalField(),
                )
            )
        )
        return agg["saldo"] or 0

    # -------- STATUS VISUAL --------
    @admin.display(description="Status")
    def status_estoque(self, obj):
        # se não controla estoque, não entra em alerta
        if not obj.controla_estoque:
            return "🟢 OK"

        saldo = self.saldo_estoque(obj)
        minimo = getattr(obj, "estoque_minimo", 0) or 0

        if saldo <= 0:
            return "❌ Em falta"
        elif saldo <= minimo:
            return "⚠️ Baixo"
        return "🟢 OK"

    # -------- Anotação para o filtro usar --------
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.annotate(
            saldo_calc=Sum(
                Case(
                    When(movimentos__tipo="E", then=F("movimentos__quantidade")),
                    When(movimentos__tipo="S", then=-F("movimentos__quantidade")),
                    default=0,
                    output_field=DecimalField(),
                )
            )
        )


@admin.register(LoteProduto)
class LoteProdutoAdmin(admin.ModelAdmin):
    list_display = ("produto", "codigo", "validade", "saldo_lote")
    list_filter = ("produto", "validade")
    search_fields = ("produto__nome", "codigo")

    @admin.display(description="Saldo do lote")
    def saldo_lote(self, obj):
        return obj.saldo_atual


@admin.register(MovimentoEstoque)
class MovimentoEstoqueAdmin(admin.ModelAdmin):
    list_display = ("data", "produto", "tipo", "quantidade", "lote", "observacao")
    list_filter = ("tipo", "produto", "lote")
    search_fields = ("produto__nome", "observacao", "lote__codigo")


admin.site.register(ItemEstoque)

