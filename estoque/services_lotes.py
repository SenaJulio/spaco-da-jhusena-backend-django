# estoque/services_lotes.py
from datetime import timedelta

from django.utils import timezone

from .models import LoteProduto  # seu model de lote


def buscar_lotes_prestes_vencer(dias_aviso=30):
    """
    Retorna uma lista de lotes que estão vencidos ou prestes a vencer,
    considerando apenas lotes com saldo_atual > 0 (se disponível).
    """
    hoje = timezone.localdate()
    limite = hoje + timedelta(days=dias_aviso)

    qs = LoteProduto.objects.filter(validade__isnull=False, validade__lte=limite).order_by(
        "validade", "id"
    )

    resultados = []

    for lote in qs:
        saldo = getattr(lote, "saldo_atual", None)
        if saldo is not None and saldo <= 0:
            continue

        validade = lote.validade
        dias_restantes = (validade - hoje).days

        if dias_restantes < 0:
            status = "vencido"
        else:
            status = "prestes_vencer"

        resultados.append(
            {
                "lote": lote,
                "produto": lote.produto,
                "dias_restantes": dias_restantes,
                "status": status,
            }
        )

    return resultados


def gerar_textos_alerta_lotes(dias_aviso=30):
    """
    Usa buscar_lotes_prestes_vencer e transforma em textos de alerta
    (para IA, notificações, etc.).
    """
    lotes = buscar_lotes_prestes_vencer(dias_aviso=dias_aviso)

    mensagens = []

    for item in lotes:
        lote = item["lote"]
        produto = item["produto"]
        dias = item["dias_restantes"]
        status = item["status"]

        codigo = getattr(lote, "codigo", "") or f"ID {lote.id}"

        if status == "vencido":
            msg = (
                f"Atenção: o lote {codigo} do produto '{produto.nome}' "
                f"está VENCIDO desde {lote.validade.strftime('%d/%m/%Y')}."
            )
        else:
            if dias == 0:
                quando = "vence HOJE"
            elif dias == 1:
                quando = "vence em 1 dia"
            else:
                quando = f"vence em {dias} dias"

            msg = (
                f"Alerta: o lote {codigo} do produto '{produto.nome}' "
                f"{quando} ({lote.validade.strftime('%d/%m/%Y')})."
            )

        mensagens.append(
            {
                "tipo": status,  # "vencido" ou "prestes_vencer"
                "texto": msg,
                "lote_id": lote.id,
                "produto_id": produto.id,
                "produto_nome": produto.nome,
                "lote_codigo": codigo,
                "validade": lote.validade.isoformat(),
                "dias_restantes": dias,
            }
        )

    return mensagens
