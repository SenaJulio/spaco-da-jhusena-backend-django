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
            # usa a anotação saldo_calc feita no get_queryset
            return queryset.filter(saldo_calc__lte=3)
        return queryset


@admin.register(Produto)
class ProdutoAdmin(admin.ModelAdmin):
    list_display = (
        "nome",
        "tipo",
        "preco_venda",
        "controla_estoque",
        "ativo",
        "saldo_estoque",
        "status_estoque",
    )
    list_filter = (
        "tipo",
        "controla_estoque",
        "ativo",
        EstoqueBaixoFilter,  # 👈 filtro de estoque baixo
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
        saldo = self.saldo_estoque(obj)

        if saldo <= 0:
            return "❌ Em falta"
        elif saldo <= 3:
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


# legado, mas ainda registrado
admin.site.register(ItemEstoque)
