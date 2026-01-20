import json
from decimal import Decimal

from django.apps import apps
from django.contrib.auth.decorators import login_required
from django.db import transaction
from django.db.models import Sum, Case, When, F, DecimalField, Count
from django.http import JsonResponse
from django.shortcuts import render
from django.utils import timezone
from django.views.decorators.http import require_POST

from django.db.models.functions import Coalesce
from functools import wraps

from urllib3 import request
from core.models import Perfil
from .models import Venda, VendaItem
import traceback


def json_guard(view_func):
    """
    Garante que qualquer exceção vire JSON (e não HTML).
    Assim o front não recebe <!DOCTYPE html>.
    """

    @wraps(view_func)
    def _wrapped(request, *args, **kwargs):
        try:
            return view_func(request, *args, **kwargs)  # ✅ RETURN OBRIGATÓRIO
        except Exception as e:
            print("\n🚨 ERRO NO PDV (json_guard)")
            print(traceback.format_exc())
            return JsonResponse(
                {"ok": False, "erro": f"{e.__class__.__name__}: {str(e)}"},
                status=500,
            )

    return _wrapped


@login_required
@login_required
def pdv_home(request):
    # Empresa SEMPRE do perfil do usuário logado (safe)
    perfil = Perfil.objects.filter(user=request.user).select_related("empresa").first()

    if not perfil or not getattr(perfil, "empresa_id", None):
        return render(
            request,
            "pdv/pdv.html",
            {
                "itens": [],
                "erro": (
                    "Seu usuário ainda não está vinculado a uma empresa. "
                    "Peça ao administrador para vincular sua conta a uma empresa."
                ),
            },
        )

    empresa = perfil.empresa

    Produto = apps.get_model("estoque", "Produto")
    Venda = apps.get_model("pdv", "Venda")

    qs = Produto.objects.all()

    # filtra por empresa se existir
    if any(f.name == "empresa" for f in Produto._meta.fields):
        qs = qs.filter(empresa=empresa)

    produtos = qs.order_by("nome")

    itens = []
    for p in produtos:
        preco = getattr(p, "preco_venda", None)
        if preco is None:
            preco = getattr(p, "preco", None)
        if preco is None:
            preco = 0

        itens.append({
            "id": p.id,
            "nome": p.nome,
            "preco": float(preco),
        })

    # ✅ CONTADOR DE OVERRIDES (aqui estava faltando)
    overrides_count = (
        Venda.objects
        .filter(empresa=empresa)
        .exclude(justificativa_lote="")
        .count()
    )

    return render(
        request,
        "pdv/pdv.html",
        {
            "itens": itens,
            "overrides_count": overrides_count,
        },
    )



def _saldo_produto_atual(produto, empresa=None):
    """
    Saldo atual do produto somando movimentos (E - S).
    Se MovimentoEstoque tiver empresa, filtra.
    """
    MovimentoEstoque = apps.get_model("estoque", "MovimentoEstoque")

    qs = MovimentoEstoque.objects.filter(produto=produto)
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


def _baixar_estoque_fifo(produto, qtd, empresa=None, observacao="", venda_id=None):
    """
    Dá baixa no estoque por FIFO usando lotes.
    Cria movimentos tipo "S" em cada lote até completar a qtd.
    - Filtra por empresa quando existir.
    - Ordena por validade (NULL por último), criado_em, codigo.
    """
    LoteProduto = apps.get_model("estoque", "LoteProduto")
    MovimentoEstoque = apps.get_model("estoque", "MovimentoEstoque")

    qtd = Decimal(str(qtd))
    if qtd <= 0:
        return

    # Se o produto não controla estoque, não baixa nada
    if not getattr(produto, "controla_estoque", False):
        return

    lotes = LoteProduto.objects.select_for_update().filter(produto=produto)

    # Filtra lotes por empresa se o modelo tiver campo empresa
    if empresa and any(f.name == "empresa" for f in LoteProduto._meta.fields):
        lotes = lotes.filter(empresa=empresa)

    # FIFO robusto: validade NULL vai pro final
    lotes = lotes.annotate(
        validade_null=Case(
            When(validade__isnull=True, then=1),
            default=0,
        )
    ).order_by("validade_null", "validade", "criado_em", "codigo")

    restante = qtd

    for lote in lotes:
        saldo_lote = Decimal(str(getattr(lote, "saldo_atual", 0) or 0))
        if saldo_lote <= 0:
            continue

        tirar = saldo_lote if saldo_lote < restante else restante
        if tirar <= 0:
            continue

        obs = observacao or "Saída PDV"
        if venda_id:
            obs = f"{obs} (Venda #{venda_id})"

        mov_kwargs = {
            "produto": produto,
            "tipo": "S",
            "quantidade": tirar,
            "lote": lote,
            "observacao": obs,
        }

        # Empresa no movimento se existir
        if empresa and any(f.name == "empresa" for f in MovimentoEstoque._meta.fields):
            mov_kwargs["empresa"] = empresa

        MovimentoEstoque.objects.create(**mov_kwargs)

        restante -= tirar
        if restante <= 0:
            break

    if restante > 0:
        raise ValueError(
            f"Estoque insuficiente em lotes para {getattr(produto,'nome',produto)} (faltou {restante})."
        )


@require_POST
@login_required
@json_guard
def api_finalizar_venda(request):
    # empresa SEMPRE do perfil (safe)
    perfil = Perfil.objects.filter(user=request.user).select_related("empresa").first()
    if not perfil or not getattr(perfil, "empresa_id", None):
        return JsonResponse({"ok": False, "erro": "Usuário sem empresa vinculada."}, status=400)

    empresa = perfil.empresa

    try:
        payload = json.loads(request.body.decode("utf-8")) if request.body else {}
    except json.JSONDecodeError:
        return JsonResponse({"ok": False, "erro": "JSON inválido"}, status=400)

    itens = payload.get("itens") or []
    forma_pagamento = (payload.get("forma_pagamento") or "pix").strip().lower()
    observacao = (payload.get("observacao") or "").strip()
    justificativa_lote = (payload.get("justificativa_lote") or "").strip()

    if not isinstance(itens, list) or len(itens) == 0:
        return JsonResponse({"ok": False, "erro": "Carrinho vazio"}, status=400)

    politica = getattr(empresa, "politica_lote_vencido", None) or "justificar"

    Produto = apps.get_model("estoque", "Produto")
    Transacao = apps.get_model("financeiro", "Transacao")

    # Normaliza itens (PID/QTD) e agrupa por produto
    agrupado = {}
    for it in itens:
        try:
            pid = int(it.get("produto_id"))
            qtd = int(it.get("qtd"))
        except Exception:
            return JsonResponse({"ok": False, "erro": "Itens inválidos"}, status=400)

        if pid <= 0 or qtd <= 0:
            return JsonResponse({"ok": False, "erro": "Itens inválidos"}, status=400)

        agrupado[pid] = agrupado.get(pid, 0) + Decimal(str(qtd))

    produto_ids = list(agrupado.keys())

    with transaction.atomic():
        # trava produtos
        qs = Produto.objects.select_for_update().filter(id__in=produto_ids)
        if any(f.name == "empresa" for f in Produto._meta.fields):
            qs = qs.filter(empresa=empresa)

        prod_map = {p.id: p for p in qs}

        faltando = [pid for pid in produto_ids if pid not in prod_map]
        if faltando:
            return JsonResponse({"ok": False, "erro": f"Produtos não encontrados: {faltando}"}, status=404)

        # valida saldo total (antes de FIFO)
        for pid, qtd in agrupado.items():
            p = prod_map[pid]
            if getattr(p, "controla_estoque", False):
                saldo_atual = _saldo_produto_atual(p)  # se sua função já filtra por empresa ótimo
                if Decimal(str(saldo_atual)) < Decimal(str(qtd)):
                    return JsonResponse(
                        {
                            "ok": False,
                            "erro": f"Estoque insuficiente para {getattr(p,'nome',p.id)}. Saldo: {saldo_atual}",
                            "produto_id": pid,
                            "max_qtd": int(Decimal(str(saldo_atual))),
                        },
                        status=400,
                    )

        # 🔒 autoridade final: checagem de lote vencido (FIFO) NO BACKEND
        vencidos_detectados = []
        for pid, qtd in agrupado.items():
            p = prod_map[pid]
            if getattr(p, "controla_estoque", False):
                v = _checar_lote_vencido_fifo(empresa, p, qtd)
                if v:
                    vencidos_detectados.extend(v)

        if vencidos_detectados:
            if politica == "bloquear":
                return JsonResponse(
                    {
                        "ok": False,
                        "erro": "Venda BLOQUEADA: lote vencido. Política da empresa: bloquear sempre.",
                        "motivo": "LOTE_VENCIDO",
                        "politica": politica,
                        "detalhes": vencidos_detectados,
                    },
                    status=403,
                )

            if politica == "justificar" and not justificativa_lote:
                return JsonResponse(
                    {
                        "ok": False,
                        "erro": "Justificativa obrigatória para vender com lote vencido.",
                        "motivo": "LOTE_VENCIDO",
                        "politica": politica,
                        "detalhes": vencidos_detectados,
                        "exige_justificativa": True,
                    },
                    status=400,
                )
            # politica == "livre" -> segue

        # cria venda (status aberta e depois conclui)
        venda = Venda.objects.create(
            empresa=empresa,
            operador=request.user,
            total=Decimal("0.00"),
            forma_pagamento=forma_pagamento,
            observacao=observacao,
            status="aberta",
            justificativa_lote=justificativa_lote or "",
        )

        total = Decimal("0.00")

        # cria itens + baixa FIFO
        item_fields = {f.name for f in VendaItem._meta.fields}

        for pid, qtd in agrupado.items():
            p = prod_map[pid]

            preco = getattr(p, "preco_venda", None)
            if preco is None:
                preco = getattr(p, "preco", None)

            if preco is None:
                return JsonResponse(
                    {"ok": False, "erro": f"Produto {p.id} sem preço (preco/preco_venda)"},
                    status=500,
                )

            preco = Decimal(str(preco))

            kwargs_item = {}

            # FK da venda pode ser 'venda' ou 'vendas'
            if "venda" in item_fields:
                kwargs_item["venda"] = venda
            elif "vendas" in item_fields:
                kwargs_item["vendas"] = venda
            else:
                return JsonResponse({"ok": False, "erro": "VendaItem sem FK para Venda (venda/vendas)."}, status=500)

            # produto
            if "produto" in item_fields:
                kwargs_item["produto"] = p
            else:
                return JsonResponse({"ok": False, "erro": "VendaItem sem campo produto."}, status=500)

            # quantidade
            if "qtd" in item_fields:
                kwargs_item["qtd"] = int(qtd)
            elif "quantidade" in item_fields:
                kwargs_item["quantidade"] = int(qtd)
            else:
                return JsonResponse({"ok": False, "erro": "VendaItem sem campo qtd/quantidade."}, status=500)

            # preço
            if "preco_unit" in item_fields:
                kwargs_item["preco_unit"] = preco
            elif "preco_unitario" in item_fields:
                kwargs_item["preco_unitario"] = preco
            elif "preco" in item_fields:
                kwargs_item["preco"] = preco
            else:
                return JsonResponse({"ok": False, "erro": "VendaItem sem campo de preço."}, status=500)

            VendaItem.objects.create(**kwargs_item)

            total += preco * Decimal(str(qtd))

            if getattr(p, "controla_estoque", False):
                _baixar_estoque_fifo(
                    produto=p,
                    qtd=int(qtd),
                    observacao="Saída PDV",
                    venda_id=venda.id,
                )

        # fecha venda
        venda.total = total
        venda.status = "concluida"
        venda.save(update_fields=["total", "status"])

        # cria transação
        trans_kwargs = {
            "empresa": empresa,
            "tipo": "receita",
            "valor": total,
            "descricao": f"Venda PDV #{venda.id}",
            "categoria": "PDV",
            "data": (getattr(venda, "criado_em", None) or timezone.now()).date(),
        }

        # tenta vincular venda se existir campo
        for fname in ("venda", "vendas"):
            try:
                f = Transacao._meta.get_field(fname)
            except Exception:
                continue
            if getattr(f, "remote_field", None) and f.remote_field.model == venda.__class__:
                trans_kwargs[fname] = venda
                break

        Transacao.objects.create(**trans_kwargs)

    return JsonResponse({"ok": True, "venda_id": venda.id, "total": f"{total:.2f}"})



def _checar_lote_vencido_fifo(empresa, produto, qtd):
    from decimal import Decimal
    from django.db.models import Sum, Case, When, F, DecimalField
    from django.utils import timezone
    from django.apps import apps

    LoteProduto = apps.get_model("estoque", "LoteProduto")
    MovimentoEstoque = apps.get_model("estoque", "MovimentoEstoque")

    hoje = timezone.localdate()
    qtd = Decimal(str(qtd))
    restante = qtd
    vencidos = []

    lotes = LoteProduto.objects.filter(produto=produto)
    if any(f.name == "empresa" for f in LoteProduto._meta.fields):
        lotes = lotes.filter(empresa=empresa)

    lotes = lotes.order_by("validade", "criado_em", "codigo")

    for lote in lotes:
        movs = MovimentoEstoque.objects.filter(lote=lote)
        if any(f.name == "empresa" for f in MovimentoEstoque._meta.fields):
            movs = movs.filter(empresa=empresa)

        saldo = movs.aggregate(
            saldo=Sum(
                Case(
                    When(tipo="E", then=F("quantidade")),
                    When(tipo="S", then=-F("quantidade")),
                    default=0,
                    output_field=DecimalField(),
                )
            )
        )["saldo"] or Decimal("0")

        if saldo <= 0:
            continue

        usar = saldo if saldo < restante else restante
        restante -= usar

        if lote.validade and lote.validade < hoje:
            vencidos.append(
                {
                    "lote_id": lote.id,
                    "lote": getattr(lote, "codigo", None) or str(lote),
                    "validade": lote.validade.isoformat(),
                    "qtd": float(usar),
                }
            )

        if restante <= 0:
            break

    return vencidos


@require_POST
@login_required
@json_guard
def api_pdv_check_lote_vencido(request):
    try:
        perfil = (
            Perfil.objects.filter(user=request.user)
            .select_related("empresa")
            .first()
        )
        if not perfil or not getattr(perfil, "empresa_id", None):
            return JsonResponse({"ok": False, "erro": "Usuário sem empresa."}, status=400)

        empresa = perfil.empresa
        politica = getattr(empresa, "politica_lote_vencido", None) or "justificar"

        produto_id = request.POST.get("produto_id")
        qtd = request.POST.get("qtd")

        try:
            produto_id = int(produto_id)
            qtd = Decimal(str(qtd))
        except Exception:
            return JsonResponse({"ok": False, "erro": "Dados inválidos."}, status=400)

        if produto_id <= 0 or qtd <= 0:
            return JsonResponse({"ok": False, "erro": "Dados inválidos."}, status=400)

        Produto = apps.get_model("estoque", "Produto")
        LoteProduto = apps.get_model("estoque", "LoteProduto")
        MovimentoEstoque = apps.get_model("estoque", "MovimentoEstoque")

        qs_prod = Produto.objects.filter(id=produto_id)
        if any(f.name == "empresa" for f in Produto._meta.fields):
            qs_prod = qs_prod.filter(empresa=empresa)

        produto = qs_prod.first()
        if not produto:
            return JsonResponse({"ok": False, "erro": "Produto não encontrado."}, status=404)

        if not getattr(produto, "controla_estoque", False):
            return JsonResponse({
                "ok": True,
                "bloquear": False,
                "avisar": False,
                "politica": politica,
            })

        hoje = timezone.localdate()

        lotes = LoteProduto.objects.filter(produto=produto)
        if any(f.name == "empresa" for f in LoteProduto._meta.fields):
            lotes = lotes.filter(empresa=empresa)

        lotes = lotes.order_by("validade", "criado_em", "codigo")

        restante = qtd
        vencidos = []

        for lote in lotes:
            movs = MovimentoEstoque.objects.filter(lote=lote)
            if any(f.name == "empresa" for f in MovimentoEstoque._meta.fields):
                movs = movs.filter(empresa=empresa)

            saldo = movs.aggregate(
                saldo=Sum(
                    Case(
                        When(tipo="E", then=F("quantidade")),
                        When(tipo="S", then=-F("quantidade")),
                        default=0,
                        output_field=DecimalField(),
                    )
                )
            )["saldo"] or Decimal("0")

            if saldo <= 0:
                continue

            usar = saldo if saldo < restante else restante
            restante -= usar

            if lote.validade and lote.validade < hoje:
                vencidos.append({
                    "lote_id": lote.id,
                    "lote": getattr(lote, "codigo", None) or str(lote),
                    "validade": lote.validade.isoformat(),
                    "qtd": float(usar),
                })

            if restante <= 0:
                break

        if vencidos:
            if politica == "livre":
                return JsonResponse({
                    "ok": True,
                    "bloquear": False,
                    "avisar": True,
                    "motivo": "LOTE_VENCIDO",
                    "detalhes": vencidos,
                    "politica": politica,
                })

            if politica == "bloquear":
                return JsonResponse({
                    "ok": True,
                    "bloquear": True,
                    "exige_justificativa": False,
                    "motivo": "LOTE_VENCIDO",
                    "detalhes": vencidos,
                    "politica": politica,
                })

            return JsonResponse({
                "ok": True,
                "bloquear": True,
                "exige_justificativa": True,
                "motivo": "LOTE_VENCIDO",
                "detalhes": vencidos,
                "politica": politica,
            })

        return JsonResponse({
            "ok": True,
            "bloquear": False,
            "avisar": False,
            "politica": politica,
        })

    except Exception as e:
        print("\n🚨 ERRO api_pdv_check_lote_vencido")
        print(traceback.format_exc())
        return JsonResponse({"ok": False, "erro": f"{e.__class__.__name__}: {e}"}, status=500)


@login_required
def vendas_com_lote_vencido(request):
    perfil = request.user.perfil
    empresa = perfil.empresa

    base_qs = (
            Venda.objects
            .filter(empresa=empresa)
            .filter(justificativa_lote__isnull=False)
            .exclude(justificativa_lote__exact="")
            .select_related("operador")
        )

        # lista (só para a tabela)
    vendas = base_qs.order_by("-criado_em")[:50]


    override_qtd = base_qs.count()

    override_valor = base_qs.aggregate(
        s=Coalesce(Sum("total"), Decimal("0.00"))
    )["s"]

    top_operador = (
        base_qs.values("operador__username")
        .annotate(qtd=Count("id"))
        .order_by("-qtd")
        .first()
    )
    top_operador_nome = (top_operador or {}).get("operador__username") or "-"
    top_operador_qtd = (top_operador or {}).get("qtd") or 0

    # Produto mais afetado (pode ajustar o related_name depois)
    top_produto_nome = "-"
    top_produto_qtd = 0

    VendaItem = apps.get_model("pdv", "VendaItem")

    vendas_ids = base_qs.values_list("id", flat=True)

    top_produto = (
        VendaItem.objects
        .filter(vendas_id__in=vendas_ids)
        .values("produto__nome")
        .annotate(qtd=Count("id"))
        .order_by("-qtd")
        .first()
    )

    top_produto_nome = (top_produto or {}).get("produto__nome") or "-"
    top_produto_qtd = (top_produto or {}).get("qtd") or 0


    return render(
        request,
        "pdv/vendas_lote_vencido.html",
        {
            "vendas": vendas,
            "override_qtd": override_qtd,
            "override_valor": override_valor,
            "top_operador_nome": top_operador_nome,
            "top_operador_qtd": top_operador_qtd,
            "top_produto_nome": top_produto_nome,
            "top_produto_qtd": top_produto_qtd,
        },
    )



