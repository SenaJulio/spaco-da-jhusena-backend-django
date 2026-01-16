# estoque/models.py
from django.db import models
from django.db.models import Sum, F, Case, When, DecimalField
from django.core.exceptions import ValidationError

from core.models import Empresa


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
    empresa = models.ForeignKey(
        Empresa,
        on_delete=models.CASCADE,
        related_name="estoque_produtos",
    )

    TIPO_CHOICES = [
        ("SERVICO", "Serviço"),
        ("PRODUTO", "Produto"),
    ]

    nome = models.CharField("Nome", max_length=120)
    tipo = models.CharField("Tipo", max_length=8, choices=TIPO_CHOICES, default="SERVICO")

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


class LoteProduto(models.Model):
    """
    Lote de um produto com validade opcional.
    Serve para rastrear de qual lote vieram as entradas/saídas.
    """
    empresa = models.ForeignKey(
        Empresa,
        on_delete=models.PROTECT,
        related_name="lotes_produto",
    )

    produto = models.ForeignKey(
        Produto,
        on_delete=models.PROTECT,
        related_name="lotes",
    )

    codigo = models.CharField(
        "Lote",
        max_length=50,
        blank=True,
        help_text="Código do lote impresso na embalagem (opcional).",
    )

    validade = models.DateField(
        "Validade",
        null=True,
        blank=True,
        help_text="Data de validade do lote (se houver).",
    )

    criado_em = models.DateTimeField("Criado em", auto_now_add=True)

    class Meta:
        verbose_name = "Lote de produto"
        verbose_name_plural = "Lotes de produto"
        ordering = ["produto", "validade", "codigo"]

    def __str__(self):
        base = self.produto.nome
        if self.codigo:
            base += f" — lote {self.codigo}"
        if self.validade:
            base += f" (val {self.validade:%d/%m/%Y})"
        return base
    
    def save(self, *args, **kwargs):
        if self.produto_id:
            self.empresa = self.produto.empresa
        return super().save(*args, **kwargs)

    @property
    def saldo_atual(self):
        """
        Calcula o saldo do lote somando os movimentos vinculados a ele.
        (entradas - saídas)
        """
        agg = self.movimentos.aggregate(
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


class MovimentoEstoque(models.Model):
    """
    Registro de entradas/saídas de estoque.
    PDV e ajustes de estoque geram movimentos automaticamente.
    """
    TIPO_CHOICES = [
        ("E", "Entrada"),
        ("S", "Saída"),
    ]

    empresa = models.ForeignKey(
        Empresa,
        on_delete=models.PROTECT,
        related_name="movimentos_estoque",
    )

    produto = models.ForeignKey(
        Produto,
        on_delete=models.PROTECT,
        related_name="movimentos",
    )

    tipo = models.CharField("Tipo", max_length=1, choices=TIPO_CHOICES)

    quantidade = models.DecimalField("Quantidade", max_digits=10, decimal_places=3)

    data = models.DateTimeField("Data", auto_now_add=True)

    observacao = models.CharField("Observação", max_length=255, blank=True)

    lote = models.ForeignKey(
        "estoque.LoteProduto",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="movimentos",
        verbose_name="Lote",
    )

    class Meta:
        verbose_name = "Movimento de estoque"
        verbose_name_plural = "Movimentos de estoque"
        ordering = ["-data"]

    def __str__(self):
        return f"{self.get_tipo_display()} de {self.quantidade} de {self.produto}"

    def clean(self):
        super().clean()

        # Regra anti-mistura: empresa do movimento deve ser a do produto
        if self.produto_id and self.empresa_id and getattr(self.produto, "empresa_id", None) != self.empresa_id:
            raise ValidationError({"empresa": "Empresa do movimento deve ser a mesma do produto."})

        # Só valida SAÍDA de produto que controla estoque (por produto)
        if (
            self.tipo == "S"
            and self.produto_id
            and getattr(self.produto, "controla_estoque", False)
        ):
            qs = type(self).objects.filter(produto=self.produto, empresa=self.produto.empresa)

            if self.pk:
                qs = qs.exclude(pk=self.pk)

            agg = qs.aggregate(
                saldo=Sum(
                    Case(
                        When(tipo="E", then=F("quantidade")),
                        When(tipo="S", then=-F("quantidade")),
                        default=0,
                        output_field=DecimalField(),
                    )
                )
            )
            saldo_atual = agg["saldo"] or 0
            if saldo_atual < 0:
                saldo_atual = 0

            if self.quantidade > saldo_atual:
                raise ValidationError(
                    {"quantidade": f"Estoque insuficiente para {self.produto}. Saldo atual: {saldo_atual}."}
                )

    def save(self, *args, **kwargs):
        if self.produto_id:
            self.empresa = self.produto.empresa
        self.full_clean()
        return super().save(*args, **kwargs)

