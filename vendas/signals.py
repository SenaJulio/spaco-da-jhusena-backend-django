# vendas/signals.py

from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone

from vendas.models import Venda
from financeiro.models import Transacao  # só Transacao, sem Categoria


@receiver(post_save, sender=Venda)
def sync_venda_transacao(sender, instance, **kwargs):
    """
    Sincroniza a venda com o financeiro:
    - Sempre que a Venda for salva com total > 0,
      cria ou atualiza uma Transacao de receita "Venda (PDV)".
    """

    print(
        ">>> SIGNAL sync_venda_transacao rodando para venda", instance.id, "total=", instance.total
    )

    total = instance.total or 0
    if total <= 0:
        print(">>> total <= 0, não vou criar transação.")
        return

    data_venda = instance.data or timezone.now()
    descricao = f"Venda #{instance.id}"

    # cria ou atualiza a transação correspondente a essa venda
    transacao, created = Transacao.objects.update_or_create(
        descricao=descricao,
        tipo="R",  # receita
        defaults={
            "data": data_venda,
            "valor": total,
            "categoria": "Venda (PDV)",  # se for CharField funciona direto
        },
    )

    print(">>> Transação sync:", transacao.id, "created=", created)
