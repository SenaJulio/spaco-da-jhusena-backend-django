from django.contrib import admin
from .models import ItemEstoque, Produto, MovimentoEstoque


@admin.register(Produto)
class ProdutoAdmin(admin.ModelAdmin):
    list_display = ("nome", "tipo", "preco_venda", "controla_estoque", "ativo")
    list_filter = ("tipo", "controla_estoque", "ativo")
    search_fields = ("nome",)


@admin.register(MovimentoEstoque)
class MovimentoEstoqueAdmin(admin.ModelAdmin):
    list_display = ("data", "produto", "tipo", "quantidade", "observacao")
    list_filter = ("tipo", "produto")
    search_fields = ("produto__nome", "observacao")


admin.site.register(ItemEstoque)
