# estoque/views.py

from decimal import Decimal
from datetime import timedelta

from django.contrib.auth.decorators import login_required
from django.db.models import Sum, Case, When, F, DecimalField
from django.db.models.functions import TruncMonth
from django.http import JsonResponse
from django.shortcuts import render
from django.utils import timezone

from .models import MovimentoEstoque, Produto, LoteProduto
from .services_lotes import gerar_textos_alerta_lotes


from django.views.decorators.http import require_GET

from .services_lotes import gerar_textos_alerta_lotes


# ==============================
# 1) DASHBOARD DE ESTOQUE (HTML)
# ==============================


def dashboard_estoque(request):
    """
    Dashboard simples de estoque:
    - Ranking dos produtos por saldo
    - Série mensal de entradas x saídas
    """

    # 1) Produtos com saldo e vendidos
    produtos_qs = Produto.objects.filter(controla_estoque=True, ativo=True).annotate(
        saldo=Sum(
            Case(
                When(movimentos__tipo="E", then=F("movimentos__quantidade")),
                When(movimentos__tipo="S", then=-F("movimentos__quantidade")),
                default=0,
                output_field=DecimalField(),
            )
        ),
        vendidos=Sum(
            Case(
                When(movimentos__tipo="S", then=F("movimentos__quantidade")),
                default=0,
                output_field=DecimalField(),
            )
        ),
    )

    # ordena pelos mais vendidos
    produtos_rank = sorted(
        produtos_qs,
        key=lambda p: p.vendidos or Decimal("0"),
        reverse=True,
    )[:10]

    labels_produtos = [p.nome for p in produtos_rank]
    dados_saldo = [float(p.saldo or 0) for p in produtos_rank]
    dados_vendidos = [float(p.vendidos or 0) for p in produtos_rank]
    # saídas → positivo

    # 2) Série mensal entradas x saídas
    mov_qs = (
        MovimentoEstoque.objects.all()
        .annotate(mes=TruncMonth("data"))
        .values("mes", "tipo")
        .annotate(total=Sum("quantidade"))
        .order_by("mes", "tipo")
    )

    meses = {}
    for item in mov_qs:
        mes_label = item["mes"].strftime("%m/%Y") if item["mes"] else "N/D"
        if mes_label not in meses:
            meses[mes_label] = {"E": 0, "S": 0}
        if item["tipo"] == "E":
            meses[mes_label]["E"] += float(item["total"] or 0)
        else:
            meses[mes_label]["S"] += float(abs(item["total"] or 0))

    labels_meses = list(meses.keys())
    dados_entradas = [meses[m]["E"] for m in labels_meses]
    dados_saidas = [meses[m]["S"] for m in labels_meses]

    alertas_lotes = gerar_textos_alerta_lotes(dias_aviso=30)

    context = {
        "labels_produtos": labels_produtos,
        "dados_saldo": dados_saldo,
        "dados_vendidos": dados_vendidos,
        "labels_meses": labels_meses,
        "dados_entradas": dados_entradas,
        "dados_saidas": dados_saidas,
        "alertas_lotes": alertas_lotes,
        "periodo_dias": 30,
    }
    return render(request, "estoque/dashboard_estoque.html", context)


# =============================================
# 2) DADOS DO DASHBOARD (JSON para os gráficos)
# =============================================


@login_required
def dashboard_estoque_dados(request):
    """
    Retorna JSON com:
      - top_produtos: saldo atual e quantidade vendida por produto
      - movimento_mensal: entradas x saídas por mês
    """

    movimentos = MovimentoEstoque.objects.select_related("produto")

    # -------- Top produtos por vendas (saída) --------
    vendas = (
        movimentos.filter(tipo="S")
        .values("produto__nome")
        .annotate(qtd_vendida=Sum("quantidade"))
        .order_by("-qtd_vendida")[:10]
    )

    # saldo atual por produto (entradas - saídas)
    saldos = movimentos.values("produto__nome").annotate(
        saldo=Sum(
            Case(
                When(tipo="E", then=F("quantidade")),
                When(tipo="S", then=-F("quantidade")),
                default=0,
                output_field=DecimalField(),
            )
        )
    )
    map_saldo = {s["produto__nome"]: s["saldo"] for s in saldos}

    top_produtos = []
    for v in vendas:
        nome = v["produto__nome"]
        top_produtos.append(
            {
                "produto": nome,
                "vendido": float(v["qtd_vendida"] or 0),
                "saldo": float(map_saldo.get(nome, 0) or 0),
            }
        )

    # -------- Entradas x Saídas por mês --------
    mov_mes = (
        movimentos.annotate(mes=TruncMonth("data"))
        .values("mes", "tipo")
        .annotate(total=Sum("quantidade"))
        .order_by("mes")
    )

    series = {}
    for row in mov_mes:
        if not row["mes"]:
            continue
        mes_label = row["mes"].strftime("%m/%Y")
        if mes_label not in series:
            series[mes_label] = {"mes": mes_label, "entradas": 0, "saidas": 0}

        if row["tipo"] == "E":
            series[mes_label]["entradas"] = float(row["total"] or 0)
        else:
            series[mes_label]["saidas"] = float(row["total"] or 0)

    payload = {
        "ok": True,
        "top_produtos": top_produtos,
        "movimento_mensal": list(series.values()),
    }
    return JsonResponse(payload)


# ==========================================
# 3) IA – ALERTAS DE VALIDADE DOS LOTES
# ==========================================


@login_required
def ia_lotes_validade_view(request):
    """
    Gera alertas de validade de lotes e devolve um JSON simples.
    Esses alertas são salvos em RecomendacaoIA e aparecem no Histórico IA.
    """
    try:
        dias = int(request.GET.get("janela", 15))
    except ValueError:
        dias = 15

    msgs = gerar_textos_alerta_lotes(dias_aviso=dias)
    total = len(msgs)


    return JsonResponse(
        {
            "ok": True,
            "janela_dias": dias,
            "alertas_gerados": total,
        }
    )


@require_GET
def api_lotes_prestes_vencer(request):
    """
    Endpoint JSON com alertas de lotes vencidos / prestes a vencer.

    GET /estoque/api/lotes-prestes-vencer/?dias_aviso=30

    Retorno:
    {
      "ok": true,
      "dias_aviso": 30,
      "count": 2,
      "items": [
        {
          "tipo": "vencido",
          "texto": "...",
          "lote_id": 1,
          "produto_id": 2,
          "produto_nome": "Ração Premium 10kg",
          "lote_codigo": "ID 1",
          "validade": "2025-12-09",
          "dias_restantes": -1
        },
        ...
      ]
    }
    """
    dias_raw = request.GET.get("dias_aviso") or "30"
    try:
        dias_aviso = int(dias_raw)
    except ValueError:
        dias_aviso = 30

    msgs = gerar_textos_alerta_lotes(dias_aviso=dias_aviso)

    data = {
        "ok": True,
        "dias_aviso": dias_aviso,
        "count": len(msgs),
        "items": msgs,
    }
    return JsonResponse(data, json_dumps_params={"ensure_ascii": False})
