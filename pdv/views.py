from django.contrib.auth.decorators import login_required
from django.shortcuts import render


import json
from django.db.models import Sum, Case, When, F, DecimalField
from decimal import Decimal


from django.db import transaction
from django.http import JsonResponse
from django.views.decorators.http import require_POST

from .models import Venda, VendaItem
from django.utils import timezone
from financeiro.models import Transacao
from django.shortcuts import redirect
from core.models import Perfil, Empresa  # ajuste se o caminho for outro

from django.apps import apps


@login_required
def pdv_home(request):
    # 1) precisamos de uma empresa válida, porque Perfil.empresa é NOT NULL
    empresa = Empresa.objects.order_by("id").first()
    if not empresa:
        return render(
            request,
            "pdv/pdv.html",
            {
                "itens": [],
                "erro": "Nenhuma empresa cadastrada ainda. Crie uma empresa no admin para liberar o PDV.",
            },
        )

    # 2) garante perfil SEM tentar criar com empresa_id null
    perfil = Perfil.objects.filter(user=request.user).select_related("empresa").first()

    if not perfil:
        perfil = Perfil.objects.create(user=request.user, empresa=empresa)
    elif not getattr(perfil, "empresa_id", None):
        # caso raro: perfil existe mas sem empresa (ou dados antigos)
        perfil.empresa = empresa
        perfil.save(update_fields=["empresa"])

    # se você quer sempre operar pela empresa do perfil:
    empresa = perfil.empresa

    # 3) produtos (filtra por empresa se existir o campo)
    Produto = apps.get_model("estoque", "Produto")
    qs = Produto.objects.all()

    if any(f.name == "empresa" for f in Produto._meta.fields):
        qs = qs.filter(empresa=empresa)

    produtos = qs.order_by("nome")

    # 4) lista segura com preço resolvido
    itens = []
    for p in produtos:
        preco = getattr(p, "preco_venda", None)
        if preco is None:
            preco = getattr(p, "preco", None)
        if preco is None:
            preco = 0

        itens.append({"id": p.id, "nome": p.nome, "preco": float(preco)})

    return render(request, "pdv/pdv.html", {"itens": itens})


def _saldo_produto_atual(produto):
    """
    Saldo atual do produto somando movimentos (E - S).
    """
    from estoque.models import MovimentoEstoque

    agg = MovimentoEstoque.objects.filter(produto=produto).aggregate(
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


def _baixar_estoque_fifo(produto, qtd, observacao="", venda_id=None):
    """
    Dá baixa no estoque por FIFO usando lotes.
    Cria movimentos tipo "S" em cada lote até completar a qtd.
    """
    from estoque.models import LoteProduto, MovimentoEstoque

    qtd = Decimal(str(qtd))
    if qtd <= 0:
        return

    # Se o produto não controla estoque, não baixa nada
    if not getattr(produto, "controla_estoque", False):
        return

    lotes = (
        LoteProduto.objects.select_for_update()
        .filter(produto=produto)
        .order_by("validade", "criado_em", "codigo")
    )

    restante = qtd

    for lote in lotes:
        saldo_lote = Decimal(str(lote.saldo_atual or 0))
        if saldo_lote <= 0:
            continue

        tirar = saldo_lote if saldo_lote < restante else restante
        if tirar <= 0:
            continue

        obs = observacao or "Saída PDV"
        if venda_id:
            obs = f"{obs} (Venda #{venda_id})"

        MovimentoEstoque.objects.create(
            produto=produto,
            tipo="S",
            quantidade=tirar,
            lote=lote,
            observacao=obs,
        )

        restante -= tirar
        if restante <= 0:
            break

    if restante > 0:
        raise ValueError(f"Estoque insuficiente em lotes para {produto} (faltou {restante}).")


@require_POST
@login_required
def api_finalizar_venda(request):
    empresa = request.user.perfil.empresa

    try:
        payload = json.loads(request.body.decode("utf-8")) if request.body else {}
    except json.JSONDecodeError:
        return JsonResponse({"ok": False, "erro": "JSON inválido"}, status=400)

    itens = payload.get("itens") or []
    forma_pagamento = (payload.get("forma_pagamento") or "pix").strip().lower()
    observacao = (payload.get("observacao") or "").strip()

    if not isinstance(itens, list) or len(itens) == 0:
        return JsonResponse({"ok": False, "erro": "Carrinho vazio"}, status=400)

    # ✅ pega models sem import circular
    Produto = apps.get_model("estoque", "Produto")
    Transacao = apps.get_model("financeiro", "Transacao")

    # Normaliza itens e valida básicos
    norm = []
    for it in itens:
        try:
            pid = int(it.get("produto_id"))
            qtd = int(it.get("qtd"))
        except Exception:
            return JsonResponse({"ok": False, "erro": "Itens inválidos"}, status=400)

        if pid <= 0 or qtd <= 0:
            return JsonResponse({"ok": False, "erro": "Itens inválidos"}, status=400)

        norm.append((pid, qtd))

    # Agrupa por produto (se vier repetido)
    agrupado = {}
    for pid, qtd in norm:
        agrupado[pid] = agrupado.get(pid, 0) + qtd

    produto_ids = list(agrupado.keys())

    with transaction.atomic():
        # trava as linhas de produto (evita corrida de estoque)
        qs = Produto.objects.select_for_update().filter(id__in=produto_ids)
        if "empresa" in [f.name for f in Produto._meta.fields]:
            qs = qs.filter(empresa=empresa)
        produtos = qs
        prod_map = {p.id: p for p in produtos}

        # valida se todos existem
        faltando = [pid for pid in produto_ids if pid not in prod_map]
        if faltando:
            return JsonResponse(
                {"ok": False, "erro": f"Produtos não encontrados: {faltando}"},
                status=404,
            )

        # ✅ valida estoque pelo saldo REAL (movimentos E - S)
        for pid, qtd in agrupado.items():
            p = prod_map[pid]
            if getattr(p, "controla_estoque", False):
                saldo_atual = _saldo_produto_atual(p)
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

        # cria venda
        venda = Venda.objects.create(
            operador=request.user,
            forma_pagamento=forma_pagamento,
            observacao=observacao,
            total=Decimal("0.00"),
            status="aberta",
        )

        total = Decimal("0.00")

        # cria itens + baixa estoque por FIFO
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

            # ✅ kwargs do item (com FK venda/vendas)
            VendaItem.objects.create(
                vendas=venda,
                produto=p,
                qtd=int(qtd),
                preco_unit=preco,
            )

            total += preco * int(qtd)

            if getattr(p, "controla_estoque", False):
                try:
                    _baixar_estoque_fifo(
                        produto=p,
                        qtd=int(qtd),
                        observacao="Saída PDV",
                        venda_id=venda.id,
                    )
                except ValueError as e:
                    return JsonResponse({"ok": False, "erro": str(e)}, status=400)

        # fecha venda
        venda.total = total
        venda.status = "concluida"
        venda.save(update_fields=["total", "status"])

        # 💰 transação no financeiro
    trans_kwargs = {
        "empresa": request.user.perfil.empresa,
        "tipo": "receita",
        "valor": total,
        "descricao": f"Venda PDV #{venda.id}",
        "categoria": "PDV",
        "data": (getattr(venda, "criado_em", None) or timezone.now()).date(),
    }

    # ✅ Só adiciona 'vendas' se existir no model
    # Só tenta linkar se existir um FK e ele apontar pro MESMO model da venda atual (pdv.Venda)
    for fname in ("venda", "vendas"):
        try:
            f = Transacao._meta.get_field(fname)
        except Exception:
            continue

        if getattr(f, "remote_field", None) and f.remote_field.model == venda.__class__:
            trans_kwargs[fname] = venda
            break

    Transacao.objects.create(**trans_kwargs)

    # ✅ SEMPRE retorna fora do atomic (mais seguro)
    return JsonResponse({"ok": True, "venda_id": venda.id, "total": f"{total:.2f}"})
