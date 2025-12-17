# estoque/models.py
from django.db import models


class ItemEstoque(models.Model):
    """
    Modelo simples legado. Mantido por compatibilidade.
    Use Produto para novos cadastros.
    """

    nome = models.CharField(max_length=100)

    def __str__(self):
        return self.nome


class Produto(models.Model):
    """
    Tudo que pode ser vendido no PDV:
    - Serviços (banho, tosa, hidratação etc.)
    - Produtos físicos (ração, petiscos, acessório etc.)
    """

    TIPO_CHOICES = [
        ("SERVICO", "Serviço"),
        ("PRODUTO", "Produto"),
    ]

    nome = models.CharField("Nome", max_length=120)
    tipo = models.CharField(
        "Tipo",
        max_length=8,
        choices=TIPO_CHOICES,
        default="SERVICO",
    )
    preco_venda = models.DecimalField(
        "Preço de venda",
        max_digits=10,
        decimal_places=2,
        default=0,
    )
    controla_estoque = models.BooleanField(
        "Controla estoque?",
        default=False,
        help_text="Marque apenas para itens físicos que baixam estoque.",
    )
    ativo = models.BooleanField("Ativo?", default=True)

    class Meta:
        verbose_name = "Produto"
        verbose_name_plural = "Produtos"
        ordering = ["nome"]

    def __str__(self):
        return self.nome


class MovimentoEstoque(models.Model):
    """
    Registro de entradas/saídas de estoque.
    Futuro PDV vai gerar saídas automaticamente.
    """

    TIPO_CHOICES = [
        ("E", "Entrada"),
        ("S", "Saída"),
    ]

    produto = models.ForeignKey(
        Produto,
        on_delete=models.PROTECT,
        related_name="movimentos",
    )
    tipo = models.CharField("Tipo", max_length=1, choices=TIPO_CHOICES)
    quantidade = models.DecimalField(
        "Quantidade",
        max_digits=10,
        decimal_places=3,
    )
    data = models.DateTimeField("Data", auto_now_add=True)
    observacao = models.CharField(
        "Observação",
        max_length=255,
        blank=True,
    )

    class Meta:
        verbose_name = "Movimento de estoque"
        verbose_name_plural = "Movimentos de estoque"
        ordering = ["-data"]

    def __str__(self):
        return f"{self.get_tipo_display()} de {self.quantidade} de {self.produto}"
from django.db import models


class LoteProduto(models.Model):
    produto = models.ForeignKey(
        "produtos.Produto",
        on_delete=models.CASCADE,
        related_name="lotes",
    )
    validade = models.DateField(null=True, blank=True)
    saldo_atual = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    criado_em = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.produto} | Val: {self.validade} | Saldo: {self.saldo_atual}"
