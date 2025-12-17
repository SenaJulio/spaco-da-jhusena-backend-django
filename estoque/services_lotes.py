# estoque/services_lotes.py
from datetime import timedelta
from django.utils import timezone
from .models import LoteProduto


def buscar_lotes_prestes_vencer(dias_aviso=30):
    hoje = timezone.localdate()
    limite = hoje + timedelta(days=dias_aviso)

    qs = LoteProduto.objects.filter(validade__isnull=False, validade__lte=limite).order_by(
        "validade", "id"
    )

    resultados = []

    for lote in qs:
        saldo = getattr(lote, "saldo_atual", None)
        if saldo is not None and saldo <= 0:
            # lote sem saldo não entra em alerta
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
                "saldo_atual": saldo,
            }
        )

    # 🔥 ordena: 1º vencidos, depois prestes a vencer, e dentro disso pela validade
    resultados.sort(
        key=lambda item: (
            0 if item["status"] == "vencido" else 1,
            item["dias_restantes"],
        )
    )

    return resultados


def gerar_textos_alerta_lotes(dias_aviso=30):
    lotes = buscar_lotes_prestes_vencer(dias_aviso=dias_aviso)

    mensagens = []

    for item in lotes:
        lote = item["lote"]
        produto = item["produto"]
        dias = item["dias_restantes"]
        status = item["status"]
        saldo = item.get("saldo_atual")

        codigo = getattr(lote, "codigo", "") or f"ID {lote.id}"

        if status == "vencido":
            msg_base = (
                f"Atenção: o lote {codigo} do produto '{produto.nome}' "
                f"está VENCIDO desde {lote.validade.strftime('%d/%m/%Y')}"
            )
        else:
            if dias == 0:
                quando = "vence HOJE"
            elif dias == 1:
                quando = "vence em 1 dia"
            else:
                quando = f"vence em {dias} dias"

            msg_base = (
                f"Alerta: o lote {codigo} do produto '{produto.nome}' "
                f"{quando} ({lote.validade.strftime('%d/%m/%Y')})"
            )

        # complemento opcional com saldo
        if saldo is not None:
            msg = f"{msg_base} com saldo de {saldo} unidade(s)."
        else:
            msg = msg_base + "."

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
                "saldo_atual": float(saldo) if saldo is not None else None,
            }
        )

    return mensagens

from django.contrib.auth.decorators import login_required
from django.http import JsonResponse


@login_required
def dashboard_estoque_dados(request):
    """
    Endpoint que fornece dados agregados do estoque para o dashboard.
    (stub inicial – depois a gente incrementa)
    """
    return JsonResponse({"ok": True, "message": "Dashboard de estoque - dados iniciais"})
