# financeiro/views_metas_api.py
import calendar
from datetime import date, datetime

from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.utils.timezone import now
from django.views.decorators.http import require_GET


def get_metas_raw(dt_inicio: date, dt_fim: date):
    # TODO: troque pelos números reais do seu banco
    return [
        {"categoria": "Receitas", "valor": 5000, "limite": 4500},
        {"categoria": "Despesas Fixas", "valor": 2800, "limite": 2700},
        {"categoria": "Marketing", "valor": 950, "limite": 800},
    ]


def _parse_date(s: str):
    for fmt in ("%Y-%m-%d", "%Y-%m"):
        try:
            d = datetime.strptime(s, fmt).date()
            return d.replace(day=1) if fmt == "%Y-%m" else d
        except Exception:
            pass
    return None


def _status(valor, limite):
    try:
        if limite is None or valor is None:
            return "ok"
        if valor <= limite * 0.95:
            return "ok"
        if valor <= limite:
            return "atencao"
        return "estourou"
    except Exception:
        return "ok"


@login_required
@require_GET
def api_metas_status(request):
    """
    GET /financeiro/api/metas/status/?data_inicio=YYYY-MM-DD&data_fim=YYYY-MM-DD
    Retorna: {"items":[{categoria, status, valor, limite, pct?}]}
    """
    today = now().date()

    # defaults = mês atual
    first_day = date(today.year, today.month, 1)
    last_day = date(today.year, today.month, calendar.monthrange(today.year, today.month)[1])

    dt_inicio = _parse_date(request.GET.get("data_inicio")) or first_day
    dt_fim = _parse_date(request.GET.get("data_fim")) or last_day

    # saneamento: se invertido, troca
    if dt_inicio > dt_fim:
        dt_inicio, dt_fim = dt_fim, dt_inicio

    try:
        raw = get_metas_raw(dt_inicio, dt_fim) or []
        items = []
        for r in raw:
            cat = r.get("categoria") or "—"
            valor = float(r.get("valor") or 0)
            limite = r.get("limite")
            limite = float(limite) if limite is not None else None

            pct = None
            if limite and limite != 0:
                pct = round((valor / limite) * 100, 1)

            items.append(
                {
                    "categoria": cat,
                    "valor": valor,
                    "limite": limite,
                    "pct": pct,  # o front usa se houver; senão mostra "—"
                    "status": _status(valor, limite),  # "ok" | "atencao" | "estourou"
                }
            )

        return JsonResponse({"items": items}, status=200)
    except Exception as e:
        return JsonResponse({"error": f"Falha ao calcular metas: {type(e).__name__}"}, status=500)
