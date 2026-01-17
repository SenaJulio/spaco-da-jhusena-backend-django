from decimal import Decimal

from django.apps import apps
from django.db import models
from django.utils import timezone

from core.models import Empresa
from estoque.models import Produto, MovimentoEstoque


class Venda(models.Model):
    empresa = models.ForeignKey(
        Empresa,
        on_delete=models.CASCADE,
        related_name="vendas",
    )
    data = models.DateTimeField("Data", default=timezone.now)
    total = models.DecimalField("Total", max_digits=10, decimal_places=2, default=0)
    observacao = models.CharField("Observação", max_length=255, blank=True)
    justificativa_lote = models.TextField("Justificativa do lote", blank=True, default="")
    motivo_lote = models.CharField("Motivo (lote)", max_length=30, blank=True, default="")


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
        Transacao = apps.get_model("financeiro", "Transacao")

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
                "empresa": self.empresa,  # importante no multiempresa
            },
        )

        if not created:
            trans.valor = self.total
            trans.data = self.data.date()
            trans.descricao = f"Venda #{self.id}"
            trans.empresa = self.empresa
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
            return Decimal("0")
        return Decimal(self.quantidade) * Decimal(self.preco_unitario)

    class Meta:
        verbose_name = "Item da venda"
        verbose_name_plural = "Itens da venda"

    def __str__(self):
        return f"{self.quantidade} x {self.produto.nome}"

    # ---------- Estoque automático ----------

    def _registrar_movimento_estoque(self, diff):
        """
        diff > 0  => saída de estoque (venda/aumento de quantidade)
        diff < 0  => entrada de estoque (estorno/remoção de item)
        """
        if not getattr(self.produto, "controla_estoque", True):
            return

        diff = Decimal(diff or 0)
        if diff == 0:
            return

        MovimentoEstoque.objects.create(
            produto=self.produto,
            tipo="S" if diff > 0 else "E",
            quantidade=abs(diff),
            observacao=f"Venda #{self.venda_id} (ajuste item)",
            # se seu MovimentoEstoque também tiver empresa, depois a gente adiciona:
            # empresa=self.venda.empresa,
        )

    def save(self, *args, **kwargs):
        criando = self.pk is None
        qtd_nova = Decimal(self.quantidade or 0)

        if criando:
            super().save(*args, **kwargs)
            self._registrar_movimento_estoque(qtd_nova)
        else:
            qtd_antiga = (
                ItemVenda.objects.filter(pk=self.pk)
                .values_list("quantidade", flat=True)
                .first()
            )
            qtd_antiga = Decimal(qtd_antiga or 0)

            super().save(*args, **kwargs)

            diff = qtd_nova - qtd_antiga
            self._registrar_movimento_estoque(diff)

        if self.venda_id:
            self.venda.calcular_total()

    def delete(self, *args, **kwargs):
        qtd_atual = Decimal(self.quantidade or 0)
        self._registrar_movimento_estoque(-qtd_atual)

        venda = self.venda
        super().delete(*args, **kwargs)

        if venda:
            venda.calcular_total()
