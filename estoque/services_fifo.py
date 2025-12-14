from decimal import Decimal
from django.db import transaction
from django.core.exceptions import ValidationError
from django.utils.timezone import now


from .models import LoteProduto  # 👈 seu model, conforme o traceback


class EstoqueInsuficienteError(Exception):
    """Erro lançado quando não há estoque suficiente para atender a saída."""

    pass


def validar_lote_para_venda(lote):
    """
    Bloqueia venda se o lote estiver vencido e ainda tiver saldo.
    """
    validade = getattr(lote, "validade", None)
    if not validade:
        return  # sem validade, não bloqueia

    saldo = getattr(lote, "saldo_atual", None)
    if saldo is None:
        return  # se não tem saldo_atual aqui, a função principal já trata

    hoje = now().date()
    if validade < hoje and saldo > 0:
        raise ValidationError(f"Lote vencido ({validade}). Venda bloqueada.")


@transaction.atomic
def consumir_estoque_fifo(produto, quantidade):
    """
    Consome estoque por FIFO (lote mais antigo primeiro).

    Parâmetros:
        produto: instância de Produto.
        quantidade: quantidade total a ser baixada (int, float, Decimal).

    Retorna:
        dict com:
            - produto
            - quantidade_solicitada
            - quantidade_atendida
            - lotes: lista de { "lote": LoteProduto, "quantidade": Decimal }

    Lança:
        EstoqueInsuficienteError se não houver saldo suficiente.
    """
    if quantidade is None:
        raise ValidationError("Quantidade não pode ser None.")

    quantidade = Decimal(str(quantidade))

    if quantidade <= 0:
        raise ValidationError("Quantidade deve ser maior que zero.")

    # 🔹 Agora só filtramos por produto e ordenamos para FIFO
    lotes = LoteProduto.objects.filter(produto=produto).order_by(
        "validade", "id"
    )  # validade existe no seu model

    if not lotes.exists():
        raise EstoqueInsuficienteError(f"Não há lotes cadastrados para o produto '{produto}'.")

    restante = quantidade
    movimentos = []

    for lote in lotes:
        if restante <= 0:
            break

        # 🔹 Aqui usamos a propriedade/atributo saldo_atual em Python
        saldo = getattr(lote, "saldo_atual", None)

        if saldo is None:
            # Se cair aqui, quer dizer que o model não tem nem campo nem @property saldo_atual
            raise ValueError(
                "O model LoteProduto não possui atributo/propriedade 'saldo_atual'. "
                "Ajuste o services_fifo.py para usar a sua forma de calcular o saldo."
            )

        if saldo <= 0:
            continue
        validar_lote_para_venda(lote)
        
        consumir = min(saldo, restante)

        # Se saldo_atual for field real, isso salva no banco;
        # se for @property calculada, depois a gente ajusta a lógica.
        if hasattr(type(lote), "_meta") and "saldo_atual" in [f.name for f in lote._meta.fields]:
            lote.saldo_atual = saldo - consumir
            lote.save(update_fields=["saldo_atual"])
        else:
            # Por enquanto só segue; mais pra frente podemos amarrar com Movimentos
            pass

        movimentos.append(
            {
                "lote": lote,
                "quantidade": consumir,
            }
        )

        restante -= consumir

    quantidade_atendida = quantidade - restante

    if restante > 0:
        raise EstoqueInsuficienteError(
            f"Estoque insuficiente para '{produto}'. "
            f"Solicitado: {quantidade}, disponível: {quantidade_atendida}."
        )

    return {
        "produto": produto,
        "quantidade_solicitada": quantidade,
        "quantidade_atendida": quantidade_atendida,
        "lotes": movimentos,
    }
