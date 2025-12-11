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
from .services_ia import gerar_alertas_validade_lotes

from django.views.decorators.http import require_GET

from .services_lotes import gerar_textos_alerta_lotes


# ==============================
# 1) DASHBOARD DE ESTOQUE (HTML)
# ==============================


@login_required
def dashboard_estoque(request):
    """
    Renderiza a página do dashboard de estoque.
    Os gráficos buscam dados via AJAX em /estoque/dashboard/dados/
    """
    return render(request, "estoque/dashboard_estoque.html")


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

    total = gerar_alertas_validade_lotes(request.user, dias_aviso=dias)

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