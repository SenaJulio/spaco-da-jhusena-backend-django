# financeiro/views_ia.py (exemplo de endpoint)
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_POST
from django.http import JsonResponse
from ia.services.ia import gerar_e_salvar_dica
from financeiro.services.ia import generate_tip_last_30d, _map_tipo
from financeiro.models import Transacao
from financeiro.ia_estoque_bridge import registrar_alertas_lote_no_historico

@require_POST
def gerar_dica_30d(request):
    """
    Exemplo: você calcula a margem dos últimos 30 dias em outro lugar
    e só passa o valor aqui. Por enquanto, vou ilustrar com um parâmetro.
    """
    try:
        margem_pct = float(request.POST.get("margem_pct", "0"))
    except ValueError:
        return JsonResponse({"ok": False, "error": "margem_pct inválida"}, status=400)

    rec = gerar_e_salvar_dica(request.user, margem_pct)
    return JsonResponse(
        {
            "ok": True,
            "saved": True,
            "id": rec.id,
            "dica": rec.texto,
            "tipo": rec.tipo,
            "criado_em": rec.criado_em.isoformat(),
        }
    )


@require_POST
@login_required
def ia_gerar_dica_30d(request):
    dica, metrics, rec_id = generate_tip_last_30d(Transacao, usuario=request.user, auto_save=True)
    return JsonResponse(
        {
            "ok": True,
            "saved": bool(rec_id),
            "id": rec_id,
            "dica": dica,
            "tipo": _map_tipo(dica),
            "metrics": metrics,
        }
    )


