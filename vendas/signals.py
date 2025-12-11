# vendas/signals.py

from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone

from vendas.models import Venda
from financeiro.models import Transacao  # só Transacao, sem Categoria
from estoque.services_ia import gerar_alertas_estoque_baixo
from django.contrib.auth import get_user_model

@receiver(post_save, sender=Venda)
def sync_venda_transacao(sender, instance, **kwargs):
    """
    Sincroniza a venda com o financeiro:
    - Sempre que a Venda for salva com total > 0,
      garante UMA única Transacao de receita "Venda (PDV)".
    """

    total = instance.total or 0
    if total <= 0:
        # Se a venda não tiver total positivo, não faz nada
        return

    data_venda = instance.data or timezone.now()
    descricao = f"Venda #{instance.id}"

    # 🔑 Chave para identificar transações dessa venda
    filtros = {}

    # Se o modelo Transacao tiver FK para Venda, usamos ela como chave
    if hasattr(Transacao, "venda"):
        filtros["venda"] = instance
    else:
        # fallback: usa descrição
        filtros["descricao"] = descricao

    # 1) Apaga qualquer transação antiga dessa venda
    Transacao.objects.filter(**filtros).delete()

    # 2) Cria a transação oficial, no formato novo
    campos = {
        "descricao": descricao,
        "tipo": "receita",  # ✅ tipo novo, amigável
        "data": data_venda,
        "valor": total,
        "categoria": "Venda (PDV)",
    }

    # se existir FK venda no model, preenche
    if hasattr(Transacao, "venda"):
        campos["venda"] = instance

    transacao = Transacao.objects.create(**campos)

    print(">>> Transação sync (oficial):", transacao.id)


@receiver(post_save, sender=Venda)
def sync_venda_transacao(sender, instance, **kwargs):
    # ... tudo que já existe

    # NOVO — dispara alerta de estoque baixo
    try:
        gerar_alertas_estoque_baixo(usuario=instance.usuario)
    except Exception as exc:
        print("[IA ESTOQUE BAIXO] Erro ao gerar alerta:", exc)
