from decimal import Decimal
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from core.models import Empresa


class Venda(models.Model):
    FORMA_PAGAMENTO_CHOICES = [
        ("dinheiro", "Dinheiro"),
        ("pix", "Pix"),
        ("cartao", "Cartão"),
        ("misto", "Misto"),
    ]

    empresa = models.ForeignKey(
        Empresa,
        on_delete=models.PROTECT,
        related_name="pdv_vendas",
    )

    criado_em = models.DateTimeField(auto_now_add=True)

    operador = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="pdv_vendas",
    )

    forma_pagamento = models.CharField(
        max_length=20,
        choices=FORMA_PAGAMENTO_CHOICES,
        default="pix",
    )

    total = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    observacao = models.CharField(max_length=255, blank=True, default="")
    status = models.CharField(max_length=20, default="concluida")  # futuro: cancelada, estornada
    justificativa_lote = models.CharField(max_length=255, blank=True, default="")

    def __str__(self):
        return f"Venda #{self.id} - {self.total} - {self.criado_em:%d/%m %H:%M}"

    # ✅ Blindagem: impedir alterar venda concluída por código/admin
    def clean(self):
        super().clean()
        if self.pk:
            old = Venda.objects.filter(pk=self.pk).only("status").first()
            if old and old.status == "concluida":
                raise ValidationError("Venda concluída não pode ser alterada.")

    def save(self, *args, **kwargs):
        if self.pk:
            self.full_clean()
        return super().save(*args, **kwargs)


class VendaItem(models.Model):
    vendas = models.ForeignKey(
        Venda,
        on_delete=models.CASCADE,
        related_name="itens",
    )

    produto = models.ForeignKey(
        "estoque.Produto",
        on_delete=models.PROTECT,
        related_name="pdv_itens",
    )

    qtd = models.PositiveIntegerField(default=1)
    preco_unit = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))

    def subtotal(self):
        return self.qtd * self.preco_unit

    def __str__(self):
        vid = getattr(self, "venda_id", None) or getattr(self, "vendas_id", None)
        return f"{self.qtd}x {self.produto} (Venda #{vid})"

    # ✅ Blindagem: item de venda concluída não pode mudar
    def clean(self):
        super().clean()
        if self.vendas_id and self.vendas.status == "concluida":
            raise ValidationError("Venda concluída não pode ser alterada.")

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)
class OverrideLoteVencido(models.Model):
    """
    Auditoria de overrides no PDV (ex: liberar lote vencido com saldo, com justificativa).
    Serve para tela de auditoria + resumo do topo.
    """

    TIPO_CHOICES = [
        ("ACAO_IMEDIATA", "Ação imediata"),
        ("ALERTA_7_DIAS", "Alerta 7 dias"),
        ("ALERTA_15_DIAS", "Alerta 15 dias"),
        ("ATENCAO", "Atenção"),
    ]

    empresa = models.ForeignKey(
        Empresa,
        on_delete=models.PROTECT,
        related_name="pdv_overrides",
    )

    criado_em = models.DateTimeField(auto_now_add=True)

    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="pdv_overrides",
    )

    # opcional: se o override aconteceu durante uma venda
    venda = models.ForeignKey(
        "pdv.Venda",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="overrides",
    )

    # produto/lote que foi “liberado”
    produto = models.ForeignKey(
        "estoque.Produto",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="pdv_overrides",
    )

    lote = models.ForeignKey(
        "estoque.LoteProduto",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="pdv_overrides",
    )

    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES, default="ACAO_IMEDIATA")
    motivo = models.CharField(max_length=255, default="")

    def __str__(self):
        return f"Override #{self.id} ({self.tipo}) - {self.criado_em:%d/%m %H:%M}"
