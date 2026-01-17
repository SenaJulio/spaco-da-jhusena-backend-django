# estoque/signals.py
from decimal import Decimal

from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone
from django.apps import apps

from estoque.models import MovimentoEstoque


def _get_custo_unit(produto):
    """
    Tenta descobrir um campo de custo/compra no Produto.
    Se não existir, retorna 0 (e a transação não será criada).
    """
    for fname in ("preco_custo", "preco_compra", "custo", "custo_unit"):
        if hasattr(produto, fname):
            v = getattr(produto, fname)
            try:
                return Decimal(str(v or 0))
            except Exception:
                return Decimal("0")
    return Decimal("0")


@receiver(post_save, sender=MovimentoEstoque)
def criar_despesa_entrada_estoque(sender, instance: MovimentoEstoque, created: bool, **kwargs):
    # Só na criação
    if not created:
        return

    # Só para ENTRADA
    if instance.tipo != "E":
        return

    # Só se controla estoque
    if not getattr(instance.produto, "controla_estoque", False):
        return

    empresa = instance.empresa
    produto = instance.produto

    # Calcula valor (se não tiver custo cadastrado, não cria despesa pra não “mentir” no financeiro)
    custo_unit = _get_custo_unit(produto)
    qtd = Decimal(str(instance.quantidade or 0))
    valor = (custo_unit * qtd).quantize(Decimal("0.01"))

    if valor <= 0:
        return

    Transacao = apps.get_model("financeiro", "Transacao")

    # Anti-duplicação simples por descrição única
    descricao = f"Entrada estoque (Mov #{instance.id}) - {produto.nome}"

    if Transacao.objects.filter(empresa=empresa, descricao=descricao).exists():
        return

    trans_kwargs = {
        "empresa": empresa,
        "tipo": "despesa",
        "valor": valor,
        "descricao": descricao,
        "categoria": "Estoque",
        "data": (getattr(instance, "data", None) or timezone.now()).date(),
    }

    Transacao.objects.create(**trans_kwargs)
