from decimal import Decimal
from django.db import transaction

from estoque.services_fifo import consumir_estoque_fifo, EstoqueInsuficienteError
from .models import Venda, ItemVenda  # ajuste se o caminho/modelo for outro


@transaction.atomic
def registrar_item_venda_com_fifo(venda: Venda, produto, quantidade):
    """
    Cria um ItemVenda para a venda e consome o estoque usando FIFO.
    Lança EstoqueInsuficienteError se não houver estoque suficiente.
    """
    quantidade = Decimal(str(quantidade))

    # 1) Baixa do estoque por FIFO
    resultado_fifo = consumir_estoque_fifo(produto, quantidade)

    # 2) Cria o item de venda normalmente
    item = ItemVenda.objects.create(
        venda=venda,
        produto=produto,
        quantidade=quantidade,
        # se tiver campo valor_unitario, total, etc, você preenche aqui
    )

    # 3) (Opcional) Se quiser, aqui você já poderia registrar em uma tabela
    #    de relacionamento LoteProduto x ItemVenda, se existir.
    #    Exemplo:
    # for mov in resultado_fifo["lotes"]:
    #     LoteItemVenda.objects.create(
    #         item_venda=item,
    #         lote=mov["lote"],
    #         quantidade=mov["quantidade"],
    #     )

    return item, resultado_fifo
