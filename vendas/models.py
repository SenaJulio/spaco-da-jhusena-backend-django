from django.db import models
from django.utils import timezone
from estoque.models import Produto, MovimentoEstoque


class Venda(models.Model):
    data = models.DateTimeField("Data", default=timezone.now)
    total = models.DecimalField("Total", max_digits=10, decimal_places=2, default=0)
    observacao = models.CharField("Observação", max_length=255, blank=True)

    class Meta:
        verbose_name = "Venda"
        verbose_name_plural = "Vendas"
        ordering = ["-data"]

    def __str__(self):
        return f"Venda #{self.id} - R$ {self.total}"

    def calcular_total(self):
        total = sum(item.subtotal for item in self.itens.all())
        self.total = total
        self.save()
        return total


class ItemVenda(models.Model):
    venda = models.ForeignKey(
        Venda,
        on_delete=models.CASCADE,
        related_name="itens",
    )
    produto = models.ForeignKey(
        Produto,
        on_delete=models.PROTECT,
    )
    quantidade = models.DecimalField(max_digits=10, decimal_places=3)
    preco_unitario = models.DecimalField(max_digits=10, decimal_places=2)

    @property
    def subtotal(self):
        if self.quantidade is None or self.preco_unitario is None:
            return 0
        return self.quantidade * self.preco_unitario


    class Meta:
        verbose_name = "Item da venda"
        verbose_name_plural = "Itens da venda"

    def __str__(self):
        return f"{self.quantidade} x {self.produto.nome}"
