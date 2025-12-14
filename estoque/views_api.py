# estoque/views_api.py
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.http import require_GET

from .services_lotes import buscar_lotes_prestes_vencer


@login_required
@require_GET
def lotes_criticos(request):
    """
    Retorna lotes vencidos / a vencer (com saldo > 0) para exibir no dashboard.
    GET /estoque/lotes/criticos/?dias=30&limit=5
    """
    try:
        dias = int(request.GET.get("dias", 30))
    except Exception:
        dias = 30

    try:
        limit = int(request.GET.get("limit", 5))
    except Exception:
        limit = 5

    dias = max(1, min(dias, 365))
    limit = max(1, min(limit, 20))

    lotes = buscar_lotes_prestes_vencer(dias_aviso=dias)

    # Ordena: vencidos primeiro, depois os mais próximos de vencer
    def _key(it):
        status = it.get("status")
        dias_rest = it.get("dias_restantes", 999999)
        vencido_first = 0 if status == "vencido" else 1
        return (vencido_first, dias_rest)

    lotes = sorted(lotes, key=_key)[:limit]

    items = []
    for it in lotes:
        lote = it["lote"]
        produto = it["produto"]

        codigo = (getattr(lote, "codigo", "") or "").strip() or f"ID {lote.id}"
        saldo = getattr(lote, "saldo_atual", 0)  # seu @property

        items.append(
            {
                "lote_id": lote.id,
                "produto_id": produto.id,
                "produto_nome": produto.nome,
                "lote_codigo": codigo,
                "validade": lote.validade.isoformat() if lote.validade else None,
                "dias_restantes": it.get("dias_restantes"),
                "status": it.get("status"),  # "vencido" | "prestes_vencer"
                "saldo_lote": float(saldo or 0),
                # link pro admin (ajusta o app_label/model se o seu for diferente)
                "admin_url": f"/admin/estoque/loteproduto/{lote.id}/change/",
            }
        )

    return JsonResponse({"ok": True, "dias": dias, "count": len(items), "items": items})
