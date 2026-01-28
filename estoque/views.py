# estoque/views.py

from decimal import Decimal
from datetime import timedelta

from django.contrib.auth.decorators import login_required
from django.db.models import Sum, Case, When, F, DecimalField
from django.db.models.functions import TruncMonth
from django.http import JsonResponse
from django.shortcuts import render
from django.utils import timezone
from core.models import Perfil
from django.apps import apps



from .models import MovimentoEstoque, Produto, LoteProduto
from .services_lotes import gerar_textos_alerta_lotes


from django.views.decorators.http import require_GET

from .services_lotes import gerar_textos_alerta_lotes




def _status_critico(dias_para_vencer: int, saldo: float) -> str | None:
    """
    Retorna o status do lote para o ranking crítico.
    - <= 0: ACAO_IMEDIATA (vencido)
    - 1..7: ALERTA_7_DIAS
    - 8..15: ALERTA_15_DIAS
    - >15: None (não entra no ranking)
    """
    if saldo is None or float(saldo) <= 0:
        return None  # sem saldo não é "crítico acionável" no ranking

    d = int(dias_para_vencer or 0)

    if d <= 0:
        return "ACAO_IMEDIATA"
    if d <= 7:
        return "ALERTA_7_DIAS"
    if d <= 15:
        return "ALERTA_15_DIAS"
    return None


# ==============================
# 1) DASHBOARD DE ESTOQUE (HTML)
# ==============================


def dashboard_estoque(request):
    """
    Dashboard simples de estoque:
    - Ranking dos produtos por saldo
    - Série mensal de entradas x saídas
    """
    perfil = Perfil.objects.select_related("empresa").filter(user=request.user).first()
    if not perfil or not perfil.empresa_id:
        return render(request, "estoque/dashboard_estoque.html", {"erro": "Usuário sem empresa."})
    empresa = perfil.empresa

    # 1) Produtos com saldo e vendidos
    produtos_qs = Produto.objects.filter(empresa=empresa,controla_estoque=True, ativo=True).annotate(
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
        MovimentoEstoque.objects.filter(empresa=empresa)
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
    perfil = Perfil.objects.select_related("empresa").filter(user=request.user).first()
    if not perfil or not perfil.empresa_id:
        return JsonResponse({"ok": False, "erro": "Usuário sem empresa."}, status=400)

    empresa = request.user.perfil.empresa

    movimentos = MovimentoEstoque.objects.filter(empresa=empresa).select_related("produto")
        

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

from django.db.models.functions import Coalesce

@login_required
def api_ranking_estoque_critico(request):
    perfil = Perfil.objects.select_related("empresa").filter(user=request.user).first()
    if not perfil or not perfil.empresa_id:
        return JsonResponse({"ok": False, "erro": "Usuário sem empresa."}, status=400)

    empresa = perfil.empresa

    try:
        top = int(request.GET.get("top", 10))
    except ValueError:
        top = 10

    dec_out = DecimalField(max_digits=10, decimal_places=3)

    saldo_expr = Coalesce(
        Sum(
            Case(
                When(movimentos__tipo="E", then=F("movimentos__quantidade")),
                When(movimentos__tipo="S", then=-F("movimentos__quantidade")),
                default=Decimal("0.000"),
                output_field=dec_out,
            ),
            output_field=dec_out,
        ),
        Decimal("0.000"),
        output_field=dec_out,
    )

    qs = (
        Produto.objects.filter(empresa=empresa, ativo=True, controla_estoque=True)
        .annotate(saldo=saldo_expr)
        .filter(saldo__lte=F("estoque_minimo"))
        .order_by("saldo", "nome")[:top]
    )

    itens = []
    for p in qs:
        saldo = p.saldo or Decimal("0.000")
        minimo = getattr(p, "estoque_minimo", None) or Decimal("0.000")
        itens.append(
            {
                "id": p.id,
                "nome": p.nome,
                "saldo": float(saldo),
                "minimo": float(minimo),
                "status": "CRITICO" if saldo <= 0 else "ATENCAO",
            }
        )

    return JsonResponse({"ok": True, "itens": itens})

from django.views.decorators.http import require_GET
from django.db.models import Sum, Case, When, F, DecimalField

@require_GET
@login_required
def api_ranking_critico(request):
    """
    Ranking de itens críticos: saldo <= minimo.
    Retorna:
    { ok: true, itens: [{id,nome,saldo,minimo,status}, ...] }
    """
    try:
        top = int(request.GET.get("top", 10))
    except ValueError:
        top = 10

    # pega empresa do perfil
    empresa = request.user.perfil.empresa

    # saldo por produto (entradas - saídas)
    qs = (
        Produto.objects.filter(empresa=empresa, controla_estoque=True, ativo=True)
        .annotate(
            saldo=Sum(
                Case(
                    When(movimentos__tipo="E", then=F("movimentos__quantidade")),
                    When(movimentos__tipo="S", then=-F("movimentos__quantidade")),
                    default=0,
                    output_field=DecimalField(),
                )
            )
        )
    )

    itens = []
    for p in qs:
        saldo = float(p.saldo or 0)

        # 👉 aqui é o “estoque mínimo”:
        # se você AINDA não tem campo no model, a gente usa 3 como padrão
        minimo = float(getattr(p, "estoque_minimo", None) or 3)

        if saldo <= minimo:
            status = "CRITICO" if saldo <= 0 else "ATENCAO"
            itens.append(
                {
                    "id": p.id,
                    "nome": p.nome,
                    "saldo": saldo,
                    "minimo": minimo,
                    "status": status,
                }
            )

    # ordena: mais crítico primeiro
    itens.sort(key=lambda x: (x["saldo"] - x["minimo"]))

    return JsonResponse({"ok": True, "itens": itens[:top]})




def _saldo_lote_atual(lote, empresa=None):
    """
    Saldo do lote = soma(movimentos E) - soma(movimentos S)
    """
    MovimentoEstoque = apps.get_model("estoque", "MovimentoEstoque")

    qs = MovimentoEstoque.objects.filter(lote=lote)

    # filtra por empresa se o movimento tiver empresa
    if empresa and any(f.name == "empresa" for f in MovimentoEstoque._meta.fields):
        qs = qs.filter(empresa=empresa)

    agg = qs.aggregate(
        saldo=Sum(
            Case(
                When(tipo="E", then=F("quantidade")),
                When(tipo="S", then=-F("quantidade")),
                default=0,
                output_field=DecimalField(),
            )
        )
    )
    return agg["saldo"] or Decimal("0")


@require_GET
@login_required
def api_lotes_criticos(request):
    perfil = (
        Perfil.objects.filter(user=request.user)
        .select_related("empresa")
        .first()
    )
    if not perfil or not getattr(perfil, "empresa_id", None):
        return JsonResponse({"ok": False, "erro": "Usuário sem empresa vinculada."}, status=400)

    empresa = perfil.empresa
    hoje = timezone.localdate()

    qs = LoteProduto.objects.select_related("produto").all()

    # filtra por empresa se existir no LoteProduto
    if hasattr(LoteProduto, "empresa_id"):
        qs = qs.filter(empresa=empresa)

    # ordena por validade e FIFO
    qs = qs.order_by("validade", "criado_em", "codigo")[:80]  # pega um pouco mais e filtramos por saldo

    items = []

    for lote in qs:
        saldo_dec = _saldo_lote_atual(lote, empresa=empresa)

        # só entra se tiver saldo > 0
        if saldo_dec <= 0:
            continue

        validade = lote.validade
        if validade is None:
            continue  # sem validade não entra no ranking crítico

        dias = (validade - hoje).days
        saldo = float(saldo_dec)

        status = _status_critico(dias, saldo)
        if not status:
            continue  # >15 dias fica fora

        # prioridade: mais urgente primeiro
        if status == "ACAO_IMEDIATA":
            prioridade = 0
        elif status == "ALERTA_7_DIAS":
            prioridade = 1
        else:  # ALERTA_15_DIAS
            prioridade = 2

        items.append({
            "produto_id": lote.produto_id,
            "produto": getattr(lote.produto, "nome", str(lote.produto_id)),
            "lote_id": lote.id,
            "lote": getattr(lote, "codigo", None) or str(lote),
            "validade": validade.isoformat(),
            "dias_para_vencer": dias,
            "saldo": saldo,
            "prioridade": prioridade,
            "status": status,
        })

    # ordena por criticidade (mais urgente primeiro)
    items.sort(
        key=lambda x: (
            x["prioridade"],
            x["dias_para_vencer"] if x["dias_para_vencer"] is not None else 9999
        )
    )

    # limita top 50 já ordenado
    items = items[:50]
    return JsonResponse({"ok": True, "items": items})


@login_required
def lotes_criticos_page(request):
    return render(request, "estoque/lotes_criticos.html")


@require_GET
@login_required
def top_produtos_vendidos_api(request):
    perfil = Perfil.objects.select_related("empresa").filter(user=request.user).first()
    if not perfil or not perfil.empresa_id:
        return JsonResponse({"ok": False, "erro": "Usuário sem empresa."}, status=400)

    empresa = perfil.empresa

    try:
        dias = int(request.GET.get("dias", "30"))
    except Exception:
        dias = 30

    try:
        top = int(request.GET.get("top", "10"))
    except Exception:
        top = 10

    hoje = timezone.localdate()
    inicio = hoje - timezone.timedelta(days=dias)

    VendaItem = apps.get_model("pdv", "VendaItem")

    # ⚠️ Seu FK é "vendas" (vendas_id), então a venda é acessada como vendas__
    qs = (
        VendaItem.objects
        .filter(vendas__empresa=empresa, vendas__criado_em__date__gte=inicio)
        .values("produto__nome")
        .annotate(qtd=Sum("qtd"))
        .order_by("-qtd")[:top]
    )

    labels = [r["produto__nome"] or "-" for r in qs]
    data = [float(r["qtd"] or 0) for r in qs]

    return JsonResponse(
        {"ok": True, "dias": dias, "labels": labels, "data": data},
        json_dumps_params={"ensure_ascii": False},
    )