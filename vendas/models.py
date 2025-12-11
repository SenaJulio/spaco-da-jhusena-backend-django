from decimal import Decimal
from django.db import models
from django.utils import timezone
from django.core.exceptions import ValidationError

from financeiro.models import Transacao
from estoque.models import Produto, MovimentoEstoque
from estoque.services_fifo import consumir_estoque_fifo, EstoqueInsuficienteError


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
        self.save(update_fields=["total"])
        self.sincronizar_transacao_receita()

    def sincronizar_transacao_receita(self):
        """
        Garante que exista UMA transação de receita para esta venda,
        com valor e data sempre atualizados.
        """
        # Se não tiver total ou for zero/negativo, apaga qualquer transação ligada
        if not self.total or self.total <= 0:
            Transacao.objects.filter(venda=self).delete()
            return

        trans, created = Transacao.objects.get_or_create(
            venda=self,
            defaults={
                "tipo": "receita",
                "descricao": f"Venda #{self.id}",
                "valor": self.total,
                "data": self.data.date(),
                "categoria": "Vendas",
            },
        )

        if not created:
            trans.valor = self.total
            trans.data = self.data.date()
            trans.descricao = f"Venda #{self.id}"
            if not trans.categoria:
                trans.categoria = "Vendas"
            trans.save()

    def save(self, *args, **kwargs):
        """
        Sempre que a venda for salva (ex: mudou data no admin),
        mantém a transação sincronizada.
        """
        super().save(*args, **kwargs)
        if self.id:
            self.sincronizar_transacao_receita()


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
    quantidade = models.DecimalField(
        "Quantidade",
        max_digits=10,
        decimal_places=3,
        default=0,
    )
    preco_unitario = models.DecimalField(
        "Preço unitário",
        max_digits=10,
        decimal_places=2,
        default=0,
    )

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

    # ---------- Estoque automático + FIFO ----------

    def _registrar_movimento_estoque(self, diff):
        """
        diff > 0  => saída de estoque (venda/aumento de quantidade)
        diff < 0  => entrada de estoque (estorno/remoção de item)
        """
        if not self.produto.controla_estoque:
            return

        diff = Decimal(diff or 0)
        if diff == 0:
            return

        MovimentoEstoque.objects.create(
            produto=self.produto,
            tipo="S" if diff > 0 else "E",
            quantidade=abs(diff),
            observacao=f"Venda #{self.venda_id} (ajuste item)",
        )

    def save(self, *args, **kwargs):
        criando = self.pk is None
        qtd_nova = Decimal(self.quantidade or 0)

        # 🔹 Na criação, antes de registrar MovimentoEstoque, usamos FIFO por lote
        if criando:
            if qtd_nova <= 0:
                raise ValidationError("Quantidade deve ser maior que zero.")

            if self.produto.controla_estoque:
                try:
                    # Baixa dos lotes em ordem FIFO
                    consumir_estoque_fifo(self.produto, qtd_nova)
                except EstoqueInsuficienteError as exc:
                    # Impede salvar o item se não tiver estoque suficiente
                    raise ValidationError(str(exc))

            # salva primeiro para garantir PK e relação certinha
            super().save(*args, **kwargs)
            # registra saída total da quantidade (estoque agregado)
            self._registrar_movimento_estoque(qtd_nova)

        else:
            # Atualização de item: mantém lógica antiga (ajuste por diferença)
            qtd_antiga = (
                ItemVenda.objects.filter(pk=self.pk).values_list("quantidade", flat=True).first()
            )
            qtd_antiga = Decimal(qtd_antiga or 0)

            super().save(*args, **kwargs)

            diff = qtd_nova - qtd_antiga
            self._registrar_movimento_estoque(diff)

        # recalcula total da venda sempre que um item é salvo
        if self.venda_id:
            self.venda.calcular_total()

    def delete(self, *args, **kwargs):
        # ao remover o item, devolve a quantidade inteira para o estoque
        qtd_atual = Decimal(self.quantidade or 0)
        self._registrar_movimento_estoque(-qtd_atual)

        venda = self.venda
        super().delete(*args, **kwargs)

        if venda:
            venda.calcular_total()
