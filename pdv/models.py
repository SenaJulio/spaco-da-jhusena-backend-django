from django.conf import settings
from django.db import models
from django.core.exceptions import ValidationError


class Venda(models.Model):
    FORMA_PAGAMENTO_CHOICES = [
        ("dinheiro", "Dinheiro"),
        ("pix", "Pix"),
        ("cartao", "Cartão"),
        ("misto", "Misto"),
    ]

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

    total = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    observacao = models.CharField(max_length=255, blank=True, default="")
    status = models.CharField(max_length=20, default="concluida")  # futuro: cancelada, estornada

    def __str__(self):
        return f"Venda #{self.id} - {self.total} - {self.criado_em:%d/%m %H:%M}"

    # ✅ Blindagem: impedir alterar venda concluída por código/admin POST
    def clean(self):
        super().clean()

        # Só bloqueia edição se a venda JÁ estava concluída no banco
        if self.pk:
            old = Venda.objects.filter(pk=self.pk).only("status").first()
            if old and old.status == "concluida":
                raise ValidationError("Venda concluída não pode ser alterada.")

    def save(self, *args, **kwargs):
        # Só valida quando já existe (evita bloquear criação)
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
    produto = models.ForeignKey("estoque.Produto", on_delete=models.PROTECT)
    qtd = models.PositiveIntegerField(default=1)
    preco_unit = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    def subtotal(self):
        return self.qtd * self.preco_unit

    def __str__(self):
    # suporta FK chamada venda ou vendas (dependendo da migração)
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
