# financeiro/views_insights.py
import csv
from collections import defaultdict
from datetime import date, datetime, timedelta
from decimal import Decimal

from django.contrib.auth.decorators import login_required
from django.core.cache import cache
from django.core.paginator import Paginator
from django.db.models import Sum
from django.http import HttpResponse, JsonResponse
from django.utils.dateparse import parse_date
from django.views.decorators.http import require_GET, require_http_methods, require_POST

from . import models as mdl  # acesso seguro aos modelos

# Models e serviços
from .services.insights import generate_simple_insight

# Referências obrigatórias
Receita = mdl.Receita
Despesa = mdl.Despesa
Insight = mdl.Insight

# Referências opcionais (fallback)
MetaCategoriaMensal = getattr(mdl, "MetaCategoriaMensal", None)
MetaCategoria = getattr(mdl, "MetaCategoria", None)


# -------------------- Helpers --------------------


def _today():
    return date.today()


def _parse_ymd(s):
    """Converte 'YYYY-MM-DD' em date (ou None)."""
    if not s:
        return None
    try:
        d = parse_date(s)
        return d if isinstance(d, date) else None
    except Exception:
        return None


def _normalize_period(request):
    """
    Lê ?data_inicio=&data_fim= (YYYY-MM-DD).
    Padrão: últimos 30 dias (hoje incluso). Corrige inversões.
    """
    di = _parse_ymd(request.GET.get("data_inicio"))
    df = _parse_ymd(request.GET.get("data_fim"))

    if not di and not df:
        df = _today()
        di = df - timedelta(days=29)
    elif di and not df:
        df = di + timedelta(days=29)
    elif df and not di:
        di = df - timedelta(days=29)

    if di > df:
        di, df = df, di
    return di, df


def _sum_decimal(qs, field="valor"):
    agg = qs.aggregate(total=Sum(field))
    return agg["total"] or Decimal("0")


def _to_float(v):
    try:
        return float(v)
    except Exception:
        return 0.0


def _daterange(a, b):
    d = a
    while d <= b:
        yield d
        d += timedelta(days=1)


# -------------------- INSIGHTS: listar / gerar / exportar / deletar --------------------

RATE_SECONDS = 30  # rate-limit entre cliques


@login_required(login_url="/admin/login/")
@require_http_methods(["GET"])
def listar_insights_view(request):
    page = int(request.GET.get("page", 1))
    per_page = int(request.GET.get("per_page", 20))

    # filtros por período (pela data de criação do insight)
    di = _parse_ymd(request.GET.get("data_inicio"))
    df = _parse_ymd(request.GET.get("data_fim"))

    qs = Insight.objects.order_by("-created_at")
    if di:
        qs = qs.filter(created_at__date__gte=di)
    if df:
        qs = qs.filter(created_at__date__lte=df)

    paginator = Paginator(qs, per_page)
    page_obj = paginator.get_page(page)

    items = [
        {
            "id": ins.id,
            "created_at": ins.created_at.strftime("%d/%m/%Y %H:%M"),
            "title": ins.title,
            "text": ins.text,
            "kind": ins.kind,
            "categoria_dominante": ins.category_dominante,
        }
        for ins in page_obj.object_list
    ]

    return JsonResponse(
        {
            "ok": True,
            "items": items,
            "page": page_obj.number,
            "has_next": page_obj.has_next(),
            "has_prev": page_obj.has_previous(),
            "num_pages": paginator.num_pages,
        }
    )


@login_required(login_url="/admin/login/")
@require_http_methods(["GET", "POST"])
def gerar_insight_view(request):
    key = f"insight_rate_{request.user.id}"
    if cache.get(key):
        return JsonResponse(
            {"ok": False, "error": "rate_limited", "retry_in": RATE_SECONDS}, status=429
        )
    cache.set(key, 1, timeout=RATE_SECONDS)

    ins = generate_simple_insight()
    return JsonResponse(
        {
            "ok": True,
            "id": ins.id,
            "title": ins.title,
            "text": ins.text,
            "kind": ins.kind,
            "categoria_dominante": ins.category_dominante,
            "created_at": ins.created_at.strftime("%d/%m/%Y %H:%M"),
        }
    )


@login_required(login_url="/admin/login/")
@require_GET
def export_insights_csv(request):
    di = _parse_ymd(request.GET.get("data_inicio"))
    df = _parse_ymd(request.GET.get("data_fim"))

    qs = Insight.objects.order_by("-created_at")
    if di:
        qs = qs.filter(created_at__date__gte=di)
    if df:
        qs = qs.filter(created_at__date__lte=df)

    stamp = datetime.now().strftime("%Y%m%d_%H%M")
    filename = f"insights_{stamp}.csv"

    resp = HttpResponse(content_type="text/csv; charset=utf-8")
    resp["Content-Disposition"] = f'attachment; filename="{filename}"'
    resp.write("\ufeff")  # BOM p/ Excel

    w = csv.writer(resp, delimiter=";")
    w.writerow(["id", "created_at", "kind", "title", "text", "categoria_dominante"])
    for ins in qs:
        w.writerow(
            [
                ins.id,
                ins.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                ins.kind,
                ins.title,
                ins.text,
                ins.category_dominante or "",
            ]
        )
    return resp


def _export_csv_response(filename_base):
    stamp = datetime.now().strftime("%Y%m%d_%H%M")
    resp = HttpResponse(content_type="text/csv; charset=utf-8")
    resp["Content-Disposition"] = f'attachment; filename="{filename_base}_{stamp}.csv"'
    resp.write("\ufeff")  # BOM
    return resp


@login_required(login_url="/admin/login/")
@require_GET
def export_receitas_csv(request):
    di = _parse_ymd(request.GET.get("data_inicio"))
    df = _parse_ymd(request.GET.get("data_fim"))
    categoria = request.GET.get("categoria")

    qs = Receita.objects.order_by("-data")
    if di:
        qs = qs.filter(data__gte=di)
    if df:
        qs = qs.filter(data__lte=df)
    if categoria and categoria.lower() not in ("todas", "toda"):
        qs = qs.filter(categoria=categoria)

    resp = _export_csv_response("receitas")
    w = csv.writer(resp, delimiter=";")
    w.writerow(["id", "data", "categoria", "descricao", "valor"])
    for r in qs:
        w.writerow(
            [
                r.id,
                r.data.strftime("%Y-%m-%d"),
                getattr(r, "categoria", "") or "",
                getattr(r, "descricao", "") or "",
                r.valor,
            ]
        )
    return resp


@login_required(login_url="/admin/login/")
@require_GET
def export_despesas_csv(request):
    di = _parse_ymd(request.GET.get("data_inicio"))
    df = _parse_ymd(request.GET.get("data_fim"))
    categoria = request.GET.get("categoria")

    qs = Despesa.objects.order_by("-data")
    if di:
        qs = qs.filter(data__gte=di)
    if df:
        qs = qs.filter(data__lte=df)
    if categoria and categoria.lower() not in ("todas", "toda"):
        qs = qs.filter(categoria=categoria)

    resp = _export_csv_response("despesas")
    w = csv.writer(resp, delimiter=";")
    w.writerow(["id", "data", "categoria", "descricao", "valor"])
    for d in qs:
        w.writerow(
            [
                d.id,
                d.data.strftime("%Y-%m-%d"),
                getattr(d, "categoria", "") or "",
                getattr(d, "descricao", "") or "",
                d.valor,
            ]
        )
    return resp


@login_required(login_url="/admin/login/")
@require_POST
def delete_insights_view(request):
    if not request.user.is_staff:
        return JsonResponse({"ok": False, "error": "not_allowed"}, status=403)

    di = _parse_ymd(request.POST.get("data_inicio"))
    df = _parse_ymd(request.POST.get("data_fim"))

    qs = Insight.objects.all()
    if di:
        qs = qs.filter(created_at__date__gte=di)
    if df:
        qs = qs.filter(created_at__date__lte=df)

    deleted = qs.count()
    qs.delete()
    return JsonResponse({"ok": True, "deleted": deleted})


# -------------------- MÉTRICAS: cards --------------------


@login_required(login_url="/admin/login/")
@require_GET
def metrics_resumo_view(request):
    di, df = _normalize_period(request)

    # período atual
    r_now = _sum_decimal(Receita.objects.filter(data__gte=di, data__lte=df))
    d_now = _sum_decimal(Despesa.objects.filter(data__gte=di, data__lte=df))
    s_now = r_now - d_now

    # período anterior (mesmo nº de dias)
    dias = (df - di).days + 1
    prev_end = di - timedelta(days=1)
    prev_start = prev_end - timedelta(days=dias - 1)

    r_prev = _sum_decimal(Receita.objects.filter(data__gte=prev_start, data__lte=prev_end))
    d_prev = _sum_decimal(Despesa.objects.filter(data__gte=prev_start, data__lte=prev_end))
    s_prev = r_prev - d_prev

    def pct(curr, prev):
        if prev == 0:
            return 0.0 if curr == 0 else 100.0
        try:
            return float((curr - prev) / abs(prev) * 100)
        except Exception:
            return 0.0

    return JsonResponse(
        {
            "ok": True,
            "current": {
                "receitas": _to_float(r_now),
                "despesas": _to_float(d_now),
                "saldo": _to_float(s_now),
            },
            "prev": {
                "receitas": _to_float(r_prev),
                "despesas": _to_float(d_prev),
                "saldo": _to_float(s_prev),
            },
            "var": {
                "receitas_pct": round(pct(r_now, r_prev), 2),
                "despesas_pct": round(pct(d_now, d_prev), 2),
                "saldo_pct": round(pct(s_now, s_prev), 2),
            },
            "period": {
                "start": di.isoformat(),
                "end": df.isoformat(),
                "prev_start": prev_start.isoformat(),
                "prev_end": prev_end.isoformat(),
            },
        }
    )


# -------------------- MÉTRICAS: série diária (linha/barras) --------------------


@login_required(login_url="/admin/login/")
@require_GET
def metrics_serie_diaria_view(request):
    di, df = _normalize_period(request)

    r_map = defaultdict(Decimal)
    d_map = defaultdict(Decimal)

    for row in (
        Receita.objects.filter(data__gte=di, data__lte=df)
        .values("data")
        .annotate(total=Sum("valor"))
    ):
        r_map[row["data"]] = row["total"] or Decimal("0")

    for row in (
        Despesa.objects.filter(data__gte=di, data__lte=df)
        .values("data")
        .annotate(total=Sum("valor"))
    ):
        d_map[row["data"]] = row["total"] or Decimal("0")

    labels, receitas, despesas = [], [], []
    for dia in _daterange(di, df):
        labels.append(dia.isoformat())
        receitas.append(_to_float(r_map.get(dia, 0)))
        despesas.append(_to_float(d_map.get(dia, 0)))

    return JsonResponse(
        {
            "ok": True,
            "labels": labels,
            "receitas": receitas,
            "despesas": despesas,
            "period": {"start": di.isoformat(), "end": df.isoformat()},
        }
    )


# -------------------- MÉTRICAS: pizza despesas por categoria --------------------


@login_required(login_url="/admin/login/")
@require_GET
def metrics_despesas_por_categoria_view(request):
    di, df = _normalize_period(request)

    labels, values = [], []
    qs = (
        Despesa.objects.filter(data__gte=di, data__lte=df)
        .values("categoria")
        .annotate(total=Sum("valor"))
        .order_by("-total")
    )
    for row in qs:
        labels.append(row.get("categoria") or "Outros")
        values.append(_to_float(row.get("total") or 0))

    return JsonResponse({"ok": True, "labels": labels, "values": values})


# -------------------- MÉTRICAS: status de metas por categoria --------------------


def _coleta_teto_despesa(meta_obj):
    """
    Descobre o campo de teto para DESPESA no modelo de meta,
    independente do nome do atributo.
    """
    candidatos = [
        "despesa_teto",
        "meta_despesa",
        "teto_despesa",
        "limite_despesa",
        "teto",
        "limite",
        "meta",
    ]
    for nome in candidatos:
        if hasattr(meta_obj, nome):
            try:
                return Decimal(getattr(meta_obj, nome) or 0)
            except Exception:
                continue
    return None


@login_required(login_url="/admin/login/")
@require_GET
def metrics_metas_status_view(request):
    """
    Se existir MetaCategoriaMensal: usa metas do mês/ano do início do período.
    Senão: usa MetaCategoria(ativo=True) como teto fixo.
    Retorna [{categoria, gasto, teto, pct, status}], ordenado por criticidade.
    """
    di, df = _normalize_period(request)

    # 1) Gastos do período por categoria
    gastos = {}
    rotulos = {}
    for row in (
        Despesa.objects.filter(data__gte=di, data__lte=df)
        .values("categoria")
        .annotate(total=Sum("valor"))
    ):
        cat_raw = row.get("categoria") or "Outros"
        key = (cat_raw or "Outros").strip().lower()
        gastos[key] = gastos.get(key, Decimal("0")) + (row.get("total") or Decimal("0"))
        rotulos.setdefault(key, cat_raw)

    # 2) Metas
    metas = {}
    if MetaCategoriaMensal is not None:
        ref_year, ref_month = di.year, di.month
        for m in MetaCategoriaMensal.objects.filter(ano=ref_year, mes=ref_month):
            cat_raw = getattr(m, "categoria", None) or "Outros"
            key = cat_raw.strip().lower()
            rotulos.setdefault(key, cat_raw)
            metas[key] = _coleta_teto_despesa(m)  # pode ser None
    elif MetaCategoria is not None:
        for m in MetaCategoria.objects.filter(ativo=True):
            cat_raw = getattr(m, "categoria", None) or "Outros"
            key = cat_raw.strip().lower()
            rotulos.setdefault(key, cat_raw)
            # tenta campos padrão do MetaCategoria simples
            teto = None
            for nome in ("teto", "limite", "meta", "teto_despesa"):
                if hasattr(m, nome):
                    try:
                        teto = Decimal(getattr(m, nome) or 0)
                    except Exception:
                        teto = None
                    break
            metas[key] = teto

    categorias = sorted(set(gastos.keys()) | set(metas.keys()))
    items = []
    for key in categorias:
        label = rotulos.get(key, key.title())
        gasto = Decimal(gastos.get(key, 0) or 0)
        teto = metas.get(key, None)

        if teto is None or teto <= 0:
            items.append(
                {
                    "categoria": label,
                    "gasto": _to_float(gasto),
                    "teto": None,
                    "pct": None,
                    "status": "SEM_META",
                }
            )
            continue

        try:
            pct = float((gasto / teto) * 100) if teto != 0 else None
        except Exception:
            pct = None

        if gasto <= teto:
            status = "OK"
        elif pct is not None and pct <= 110:
            status = "ATENCAO"
        else:
            status = "ESTOURO"

        items.append(
            {
                "categoria": label,
                "gasto": _to_float(gasto),
                "teto": _to_float(teto),
                "pct": round(pct, 1) if pct is not None else None,
                "status": status,
            }
        )

    ordem = {"ESTOURO": 0, "ATENCAO": 1, "SEM_META": 2, "OK": 3}
    items.sort(key=lambda it: (ordem.get(it["status"], 99), -(it.get("pct") or -1)))
    return JsonResponse({"ok": True, "items": items})
