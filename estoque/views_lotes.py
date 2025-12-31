# estoque/views_lotes.py
from datetime import timedelta
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_GET
from django.contrib.auth.decorators import login_required
from django.db.models import Sum, Case, When, F, DecimalField
from .models import LoteProduto


@login_required
@require_GET
def lotes_criticos(request):
    dias = int(request.GET.get("dias", 30))
    limit = int(request.GET.get("limit", 10))

    hoje = timezone.localdate()
    limite = hoje + timedelta(days=dias)

    saldo_expr = Sum(
        Case(
            When(movimentos__tipo="E", then=F("movimentos__quantidade")),
            When(movimentos__tipo="S", then=-F("movimentos__quantidade")),
            default=0,
            output_field=DecimalField(),
        )
    )

    qs = (
        LoteProduto.objects.filter(validade__isnull=False, validade__lte=limite)
        .annotate(saldo=saldo_expr)
        .filter(saldo__gt=0)
        .select_related("produto")
        .order_by("validade", "id")[:limit]
    )

    itens = []
    for lote in qs:
        dias_rest = (lote.validade - hoje).days
        status = "vencido" if dias_rest < 0 else "prestes_vencer"
        itens.append(
            {
                "lote_id": lote.id,
                "produto": lote.produto.nome,
                "codigo": lote.codigo or f"ID {lote.id}",
                "validade": lote.validade.isoformat(),
                "dias_restantes": dias_rest,
                "status": status,
                "saldo_lote": float(lote.saldo or 0),
            }
        )

    return JsonResponse({"ok": True, "itens": itens, "total": len(itens)})


from django.contrib.auth.decorators import login_required
from django.http import JsonResponse


@login_required
def dashboard_estoque_dados(request):
    """
    Dados agregados do dashboard de estoque (stub).
    """
    return JsonResponse({"ok": True, "source": "dashboard_estoque_dados"})


@login_required
def ia_lotes_validade_view(request):
    """
    Endpoint da IA para análise de validade de lotes (stub).
    """
    return JsonResponse({"ok": True, "source": "ia_lotes_validade_view"})


@login_required
def api_lotes_prestes_vencer(request):
    """
    API de lotes prestes a vencer (stub).
    """
    return JsonResponse({"ok": True, "source": "api_lotes_prestes_vencer"})
