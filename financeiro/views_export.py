# financeiro/views_export.py
from datetime import timedelta
import csv

from django.http import HttpResponse
from django.utils import timezone
from django.contrib.auth.decorators import login_required
from django.apps import apps

# Se existir no seu projeto, usamos para classificar; caso contrário, seguimos sem ele.
try:
    from .services.ia import _map_tipo
except Exception:

    def _map_tipo(texto: str) -> str:
        # fallback simples
        t = (texto or "").lower()
        if any(k in t for k in ["alerta", "atenção", "risco", "cuidado"]):
            return "alerta"
        if any(k in t for k in ["ótimo", "positivo", "bem", "excelente", "bom"]):
            return "positiva"
        return "neutra"


def _get_models():
    """Tenta usar RecomendacaoIA; se não existir, cai para Insight."""
    RecomendacaoIA = None
    Insight = None
    try:
        RecomendacaoIA = apps.get_model("financeiro", "RecomendacaoIA")
    except Exception:
        pass
    try:
        Insight = apps.get_model("financeiro", "Insight")
    except Exception:
        pass
    return RecomendacaoIA, Insight


def _query_historico(user, tipo: str, days: int = 90):
    """
    Retorna uma lista de dicts: {created_at, tipo, titulo, mensagem}
    - Respeita filtro de 'tipo' (positiva|alerta|neutra|todas)
    - Janela padrão: últimos 90 dias
    """
    now = timezone.now()
    dt_from = now - timedelta(days=days)
    RecomendacaoIA, Insight = _get_models()
    itens = []

    if RecomendacaoIA:
        qs = RecomendacaoIA.objects.filter(user=user, created_at__gte=dt_from).order_by(
            "-created_at"
        )
        for rec in qs:
            msg = getattr(rec, "mensagem", "") or getattr(rec, "texto", "")
            tpo = getattr(rec, "tipo", "") or _map_tipo(msg)
            itens.append(
                {
                    "created_at": rec.created_at,
                    "tipo": (tpo or "neutra").lower(),
                    "titulo": getattr(rec, "titulo", "") or "Dica da IA",
                    "mensagem": msg,
                }
            )

    elif Insight:
        qs = Insight.objects.filter(user=user, created_at__gte=dt_from).order_by("-created_at")
        for ins in qs:
            msg = getattr(ins, "mensagem", "") or getattr(ins, "texto", "")
            tpo = getattr(ins, "tipo", "") or _map_tipo(msg)
            itens.append(
                {
                    "created_at": ins.created_at,
                    "tipo": (tpo or "neutra").lower(),
                    "titulo": getattr(ins, "titulo", "") or "Insight",
                    "mensagem": msg,
                }
            )

    # filtro por tipo (se não for 'todas' ou vazio)
    tipo = (tipo or "").strip().lower()
    if tipo and tipo in {"positiva", "alerta", "neutra"}:
        itens = [i for i in itens if i["tipo"] == tipo]

    # ordena desc pela data
    itens.sort(key=lambda x: x["created_at"], reverse=True)
    return itens


@login_required
def historico_ia_csv_v2(request):
    """
    Exporta CSV do histórico v2:
      GET /financeiro/ia/historico/export/csv/?tipo=positiva|alerta|neutra|todas&dias=90
    Colunas: data, tipo, titulo, mensagem
    """
    tipo = request.GET.get("tipo", "").strip().lower()
    try:
        dias = int(request.GET.get("dias", 90))
    except Exception:
        dias = 90
    dias = max(1, min(dias, 365))

    itens = _query_historico(request.user, tipo=tipo, days=dias)

    # prepara resposta CSV
    resp = HttpResponse(content_type="text/csv; charset=utf-8")
    resp["Content-Disposition"] = 'attachment; filename="historico_ia_v2.csv"'

    writer = csv.writer(resp)
    writer.writerow(["data", "tipo", "titulo", "mensagem"])
    for i in itens:
        # data em ISO local
        data_str = timezone.localtime(i["created_at"]).strftime("%Y-%m-%d %H:%M:%S")
        writer.writerow([data_str, i["tipo"], i["titulo"], i["mensagem"]])

    return resp
