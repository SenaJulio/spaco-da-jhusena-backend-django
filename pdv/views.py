from django.contrib.auth.decorators import login_required
from django.shortcuts import render

@login_required
def pdv_home(request):
    return render(request, "pdv/pdv.html")

import json
from django.db.models import Sum, Case, When, F, DecimalField
from decimal import Decimal


from django.db import transaction
from django.http import JsonResponse
from django.views.decorators.http import require_POST

from .models import Venda, VendaItem
from financeiro.models import Transacao



def _saldo_produto_atual(produto):
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
    from estoque.models import LoteProduto, MovimentoEstoque

    qtd = Decimal(str(qtd))
    if qtd <= 0:
        return

    if not getattr(produto, "controla_estoque", False):
        return

    lotes = (
        LoteProduto.objects
        .select_for_update()
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
    """
    Recebe:
    {
      "itens": [{"produto_id": 1, "qtd": 2}, ...],
      "forma_pagamento": "pix" (opcional),
      "observacao": "" (opcional)
    }

    Retorna:
    { "ok": true, "venda_id": 123, "total": "106.00" }
    """
    try:
        payload = json.loads(request.body.decode("utf-8")) if request.body else {}
    except json.JSONDecodeError:
        return JsonResponse({"ok": False, "erro": "JSON inválido"}, status=400)

    itens = payload.get("itens") or []
    forma_pagamento = (payload.get("forma_pagamento") or "pix").strip().lower()
    observacao = (payload.get("observacao") or "").strip()

    if not isinstance(itens, list) or len(itens) == 0:
        return JsonResponse({"ok": False, "erro": "Carrinho vazio"}, status=400)

    # ✅ carrega o model Produto do app estoque
    from estoque.models import Produto  # ajuste se o nome do model for outro

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

    # Transação pra ser tudo ou nada
    with transaction.atomic():
        # trava as linhas de produto (evita corrida de estoque)
        produtos = (
            Produto.objects.select_for_update()
            .filter(id__in=produto_ids)
        )

        prod_map = {p.id: p for p in produtos}

        # valida se todos existem
        faltando = [pid for pid in produto_ids if pid not in prod_map]
        if faltando:
            return JsonResponse({"ok": False, "erro": f"Produtos não encontrados: {faltando}"}, status=404)

       
                 # ✅ valida estoque pelo saldo REAL (movimentos E - S)
        for pid, qtd in agrupado.items():
            p = prod_map[pid]

            # só valida se controla estoque
            if getattr(p, "controla_estoque", False):
                saldo_atual = _saldo_produto_atual(p)
                if Decimal(str(saldo_atual)) < Decimal(str(qtd)):
                    return JsonResponse(
                        {"ok": False, "erro": f"Estoque insuficiente para {getattr(p,'nome',p.id)}. Saldo: {saldo_atual}"},
                        status=400
                    )

        # cria venda
        venda = Venda.objects.create(
            operador=request.user,
            forma_pagamento=forma_pagamento,
            observacao=observacao,
            total=Decimal("0.00"),
        )

        total = Decimal("0.00")

        # cria itens + baixa estoque simples (FIFO a gente liga depois)
        for pid, qtd in agrupado.items():
            p = prod_map[pid]

            # preço: tenta pegar do produto; se não existir, tenta "preco"
            preco = getattr(p, "preco_venda", None)
            if preco is None:
                preco = getattr(p, "preco", None)

            if preco is None:
                return JsonResponse({"ok": False, "erro": f"Produto {p.id} sem preço (preco/preco_venda)"},
                                    status=500)

            preco = Decimal(str(preco))

            VendaItem.objects.create(
                venda=venda,
                produto=p,
                qtd=int(qtd),
                preco_unit=preco,
            )

            total += preco * int(qtd)

            # ✅ baixa estoque via FIFO (lotes) gerando MovimentoEstoque tipo "S"
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

            

        venda.total = total
        venda.save(update_fields=["total"])
        # 💰 registra receita no financeiro (PDV)
    Transacao.objects.create(
        tipo="receita",
        valor=total,
        descricao=f"Venda PDV #{venda.id}",
        categoria="PDV",
        data=venda.criado_em if hasattr(venda, "criado_em") else None,
    )


    return JsonResponse({"ok": True, "venda_id": venda.id, "total": f"{total:.2f}"})
