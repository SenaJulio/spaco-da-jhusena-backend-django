# -----------------------------
# 📦 Importações padrão (stdlib)
# -----------------------------
import hashlib
import logging
import re
from collections import defaultdict
from datetime import date, datetime, timedelta
from decimal import Decimal
import builtins

# -----------------------------
# 🧩 Django
# -----------------------------
from django.apps import apps
from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.core.paginator import Paginator
from django.db import DatabaseError, models
from django.db.models import (
    Sum,
    Q,
    Count,
    Value,
    CharField,
    Case,
    When,
    DecimalField,
    F,
)
from django.db.models.functions import TruncDate, Coalesce, Abs, Cast
from django.http import JsonResponse
from django.shortcuts import redirect, render
from django.utils import timezone
from django.utils.dateparse import parse_date
from django.views.decorators.http import require_GET, require_POST, require_http_methods

# IA (motor oficial do preview)
from ia.services.analysis import analisar_30d_dict

# Modelos
from .models import Transacao, Insight

# Serviços locais de IA (geração e classificador oficial que já usa no projeto)
from .services.ia import generate_tip_last_30d, _map_tipo as map_tipo_ia


# --- Modelos opcionais/legados ---
try:
    from .models import RecomendacaoIA
except Exception:
    RecomendacaoIA = apps.get_model("financeiro", "RecomendacaoIA")

try:
    from .models import HistoricoIA
except Exception:
    try:
        HistoricoIA = apps.get_model("financeiro", "HistoricoIA")
    except Exception:
        HistoricoIA = None


def _get_text(o) -> str:
    """
    Extrai o texto da dica da IA, independente do nome do campo.
    """
    return (
        getattr(o, "texto", None)
        or getattr(o, "mensagem", None)
        or getattr(o, "recomendacao", None)
        or getattr(o, "conteudo", None)
        or ""
    )


# -----------------------------------------------------------------------------
# Classificadores auxiliares
# -----------------------------------------------------------------------------
def _map_tipo_painel(categoria: str, cor: str, metrics: dict) -> str:
    """
    Classifica recomendação do painel em:
      - 'oportunidade' → margem > 0  ou cor == 'success'
      - 'economia'     → margem == 0
      - 'alerta'       → margem < 0  ou cor == 'danger'
      - 'meta'         → categoria menciona 'meta'
    """
    try:
        margem = float((metrics or {}).get("margem", 0) or 0)
    except Exception:
        margem = 0.0

    cat = (categoria or "").lower().strip()

    if "meta" in cat:
        return "meta"
    if margem < 0 or cor == "danger":
        return "alerta"
    if margem == 0:
        return "economia"
    if margem > 0 or cor == "success":
        return "oportunidade"
    return "economia"


def _map_tipo_texto(texto: str) -> str:
    """
    Classificação textual simplificada para dicas salvas no histórico:
    """
    t = (texto or "").lower()
    positivas = (
        "ótimo",
        "excelente",
        "superávit",
        "superavit",
        "positivo",
        "acima da meta",
        "lucro",
        "margem positiva",
        "continue assim",
        "reforce a reserva",
        "aporte",
    )
    alertas = (
        "alerta",
        "atenção",
        "atencao",
        "risco",
        "queda",
        "negativo",
        "déficit",
        "deficit",
        "evite",
        "abaixo da meta",
        "corte",
        "reduza",
        "atraso",
        "inadimpl",
    )
    if any(k in t for k in alertas):
        return "alerta"
    if any(k in t for k in positivas):
        return "positiva"
    if re.search(r"(-\s*\d+([.,]\d+)?%?)", t):
        return "alerta"
    return "neutra"


def _fallback_classify(txt: str) -> str:
    t = (txt or "").lower()
    if any(
        k in t
        for k in [
            "alerta",
            "atenção",
            "risco",
            "evite",
            "corte",
            "reduza",
            "atraso",
            "déficit",
            "negativo",
            "queda",
            "abaixo",
            "gasto excessivo",
            "gastos excessivos",
            "estouro de caixa",
            "inadimpl",
        ]
    ):
        return "alerta"
    if any(
        k in t
        for k in [
            "saldo positivo",
            "positivo",
            "ótimo",
            "excelente",
            "parabéns",
            "superávit",
            "acima da meta",
            "margem",
            "reforce a reserva",
            "aporte extra",
            "continue assim",
        ]
    ):
        return "positiva"
    return "neutra"


# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------
def _date_range_kwargs(model, field_name: str, start, end, inclusive_end=True):
    """
    Retorna kwargs corretos para filtrar por faixa de datas
    (DateField vs DateTimeField).
    """
    f = model._meta.get_field(field_name)
    end_op = "lte" if inclusive_end else "lt"
    if f.get_internal_type() == "DateTimeField":
        return {f"{field_name}__date__gte": start, f"{field_name}__date__{end_op}": end}
    return {f"{field_name}__gte": start, f"{field_name}__{end_op}": end}


def _parse_date_local(s: str):
    try:
        return datetime.strptime(s, "%Y-%m-%d").date()
    except Exception:
        return None


def _pick_cor_from_metrics(metrics: dict) -> str:
    try:
        saldo = float((metrics or {}).get("saldo", 0))
        if saldo > 0:
            return "success"
        if saldo < 0:
            return "danger"
        return "secondary"
    except Exception:
        return "secondary"


def _infer_cor(obj) -> str:
    m = getattr(obj, "metrics", {}) or {}
    cor = m.get("cor")
    if cor:
        return cor
    cor_alt = getattr(obj, "cor", None)
    if cor_alt:
        return cor_alt
    cat = (getattr(obj, "categoria", None) or getattr(obj, "categoria_dominante", "") or "").lower()
    if cat in ("alerta", "vermelho"):
        return "vermelho"
    if cat in ("atenção", "atencao", "amarelo", "warning"):
        return "amarelo"
    if cat in ("positivo", "sucesso", "verde", "success"):
        return "verde"
    return "cinza"


# -----------------------------------------------------------------------------
# Dashboard (template)
# -----------------------------------------------------------------------------
@login_required(login_url="/admin/login/")
def dashboard_financeiro(request):
    if not getattr(request.user, "is_authenticated", False):
        login_url = getattr(settings, "LOGIN_URL", "/admin/login/")
        return redirect(f"{login_url}?next={request.path}")

    total_receitas = (
        Transacao.objects.filter(tipo="receita").aggregate(total=Sum("valor"))["total"] or 0
    )
    total_despesas = (
        Transacao.objects.filter(tipo="despesa").aggregate(total=Sum("valor"))["total"] or 0
    )
    saldo = total_receitas - total_despesas

    return render(
        request,
        "financeiro/dashboard.html",
        {"total_receitas": total_receitas, "total_despesas": total_despesas, "saldo": saldo},
    )


# -----------------------------------------------------------------------------
# Mini-IA: Gerar dica dos últimos 30 dias (já salva em RecomendacaoIA)
# -----------------------------------------------------------------------------
from ia.services.analysis import analisar_30d_dict  # já existe e funciona


@require_http_methods(["GET", "POST"])
@login_required
def gerar_dica_30d(request):
    try:
        metrics = analisar_30d_dict(Transacao, request.user)
        dica = metrics.get("plano_acao") or metrics.get("mensagem") or ""
        saved_id = None  # se quiser salvar em RecomendacaoIA depois, pode incluir
    except Exception as e:
        return JsonResponse({"ok": False, "error": str(e)}, status=500)

    ps_str = (metrics.get("periodo") or {}).get("inicio") if isinstance(metrics, dict) else None
    pe_str = (metrics.get("periodo") or {}).get("fim") if isinstance(metrics, dict) else None
    try:
        ps = date.fromisoformat(ps_str) if ps_str else timezone.localdate()
        pe = date.fromisoformat(pe_str) if pe_str else timezone.localdate()
    except Exception:
        ps = pe = timezone.localdate()

    agora = timezone.localtime()

    payload = {
        "ok": True,
        "salvo": {
            "id": saved_id,
            "tipo": map_tipo_ia(dica),
            "texto": (dica or "").strip(),
            "text": (dica or "").strip(),
            "created_at": agora.strftime("%d/%m/%Y %H:%M"),
            "metrics": metrics,
            "periodo": {"inicio": str(ps), "fim": str(pe)},
        },
    }
    return JsonResponse(payload)


# -----------------------------------------------------------------------------
# Feed do painel (JSON) com filtros e paginação) — legado compatível
# -----------------------------------------------------------------------------
@require_GET
@login_required
def ia_historico_feed(request):
    """Feed do histórico com filtros e paginação, compatível com o payload antigo."""
    page = int(request.GET.get("page", 1))
    per_page = int(request.GET.get("per_page", 10))
    limit = request.GET.get("limit")
    if limit:
        try:
            per_page = max(1, int(limit))
            page = 1
        except Exception:
            pass

    inicio = _parse_date_local(request.GET.get("inicio", "") or "")
    fim = _parse_date_local(request.GET.get("fim", "") or "")
    categoria = (request.GET.get("categoria") or "").strip()

    HModel = IModel = None
    try:
        HModel = apps.get_model("financeiro", "RecomendacaoIA")
    except Exception:
        pass
    try:
        IModel = apps.get_model("financeiro", "Insight")
    except Exception:
        pass

    results = []

    if HModel:
        date_field = "created_at"
        try:
            HModel._meta.get_field("created_at")
        except Exception:
            date_field = "criado_em"

        qs = HModel.objects.filter(usuario=request.user)

        if inicio:
            qs = qs.filter(**{f"{date_field}__date__gte": inicio})
        if fim:
            qs = qs.filter(**{f"{date_field}__date__lte": fim})

        if categoria:
            qs = qs.filter(tipo__iexact=categoria)

        qs = qs.order_by(f"-{date_field}")

        paginator = Paginator(qs, per_page)
        page_obj = paginator.get_page(page)

        for r in page_obj:
            texto = getattr(r, "texto", None) or getattr(r, "dica", "") or ""
            cat = (
                getattr(r, "categoria", None)
                or getattr(r, "categoria_dominante", "Geral")
                or "Geral"
            )
            cor = _infer_cor(r)
            created_dt = getattr(r, date_field, None)
            if created_dt:
                try:
                    data_iso = created_dt.isoformat(timespec="seconds")
                    data_br = timezone.localtime(created_dt).strftime("%d/%m/%Y %H:%M")
                except Exception:
                    data_iso = str(created_dt)
                    data_br = str(created_dt)
            else:
                data_iso = ""
                data_br = ""

            results.append(
                {
                    "id": r.id,
                    "data": data_iso,
                    "created_at": data_iso,
                    "created_at_br": data_br,
                    "periodo": {
                        "inicio": str(getattr(r, "period_start", "") or ""),
                        "fim": str(getattr(r, "period_end", "") or ""),
                    },
                    "categoria": cat,
                    "cor": cor,
                    "text": (texto or "").strip(),
                    "texto": (texto or "").strip(),
                    "title": getattr(r, "titulo", None) or "Dica da IA",
                }
            )

        return JsonResponse(
            {
                "ok": True,
                "items": results,
                "page": page_obj.number,
                "has_next": page_obj.has_next(),
                "next_page": page_obj.next_page_number() if page_obj.has_next() else None,
                "count": paginator.count,
            }
        )

    elif IModel:
        qs = IModel.objects.all()

        if inicio:
            qs = qs.filter(created_at__date__gte=inicio)
        if fim:
            qs = qs.filter(created_at__date__lte=fim)
        if categoria:
            qs = qs.filter(Q(kind__iexact=categoria) | Q(categoria_dominante__iexact=categoria))

        qs = qs.order_by("-created_at")
        paginator = Paginator(qs, per_page)
        page_obj = paginator.get_page(page)

        for ins in page_obj:
            created_dt = ins.created_at
            try:
                data_iso = created_dt.isoformat(timespec="seconds")
                data_br = timezone.localtime(created_dt).strftime("%d/%m/%Y %H:%M")
            except Exception:
                data_iso = str(created_dt)
                data_br = str(created_dt)

            results.append(
                {
                    "id": ins.id,
                    "data": data_iso,
                    "created_at": data_iso,
                    "created_at_br": data_br,
                    "periodo": {"inicio": "", "fim": ""},
                    "categoria": getattr(ins, "kind", "Insight"),
                    "cor": "cinza",
                    "text": (getattr(ins, "text", "") or "").strip(),
                    "texto": (getattr(ins, "text", "") or "").strip(),
                    "title": getattr(ins, "title", None) or "Insight da IA",
                }
            )

        return JsonResponse(
            {
                "ok": True,
                "items": results,
                "page": page_obj.number,
                "has_next": page_obj.has_next(),
                "next_page": page_obj.next_page_number() if page_obj.has_next() else None,
                "count": paginator.count,
            }
        )

    return JsonResponse({"ok": True, "items": [], "page": 1, "has_next": False, "count": 0})


# -----------------------------------------------------------------------------
# Histórico textual (lista simples)
# -----------------------------------------------------------------------------
@require_GET
@login_required
def ia_historico(request):
    limit = 10
    try:
        limit = max(1, min(int(request.GET.get("limit", 10)), 100))
    except Exception:
        pass

    qs = RecomendacaoIA.objects.filter(usuario=request.user).order_by("-criado_em")[:limit]

    items = [
        {
            "id": r.id,
            "criado_em": r.criado_em.strftime("%d/%m/%Y %H:%M"),
            "tipo": getattr(r, "get_tipo_display", lambda: r.tipo)(),
            "texto": r.texto,
        }
        for r in qs
    ]

    return JsonResponse({"ok": True, "items": items})


# -----------------------------------------------------------------------------
# Resumo mensal — SÉRIE (opcional)
# -----------------------------------------------------------------------------
@login_required
def ia_resumo_mensal_series(request):
    tz = timezone.get_current_timezone()
    hoje = timezone.now().astimezone(tz)

    def _primeiro_dia_mes(d: datetime) -> datetime:
        return d.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    def _add_mes(d: datetime) -> datetime:
        y, m = d.year, d.month
        if m == 12:
            return d.replace(year=y + 1, month=1)
        return d.replace(month=m + 1)

    inicio_janela = _primeiro_dia_mes(hoje) - timedelta(days=31 * 6)
    inicio_janela = _primeiro_dia_mes(inicio_janela)

    rows = Insight.objects.filter(created_at__gte=inicio_janela).values_list("created_at", "kind")

    agg = defaultdict(lambda: {"positiva": 0, "alerta": 0, "neutra": 0, "total": 0})
    for created_at, kind in rows:
        dt = timezone.localtime(created_at, tz)
        mes = _primeiro_dia_mes(dt)
        key = mes.strftime("%Y-%m-01")
        k = (kind or "neutra").lower()
        if k not in ("positiva", "alerta", "neutra"):
            k = "neutra"
        agg[key][k] += 1
        agg[key]["total"] += 1

    labels = []
    cur = inicio_janela
    for _ in range(7):
        labels.append(cur.strftime("%Y-%m-01"))
        cur = _add_mes(cur)

    totais, pos, alerta, neutra = [], [], [], []
    for key in labels:
        d = agg[key]
        totais.append(d["total"])
        pos.append(d["positiva"])
        alerta.append(d["alerta"])
        neutra.append(d["neutra"])

    n = len(totais)
    if n >= 2:
        xs = list(range(n))
        sumx = sum(xs)
        sumy = sum(totais)
        sumxy = sum(x * y for x, y in zip(xs, totais))
        sumx2 = sum(x * x for x in xs)
        denom = (n * sumx2 - sumx * sumx) or 1
        a = (n * sumxy - sumx * sumy) / denom
        b = (sumy - a * sumx) / n
        next_x = n
        forecast_total = max(0, round(a * next_x + b))
    else:
        forecast_total = totais[-1] if n == 1 else 0

    last = datetime.strptime(labels[-1], "%Y-%m-01")
    next_label = (last.replace(day=28) + timedelta(days=4)).replace(day=1).strftime("%Y-%m-%01")

    return JsonResponse(
        {
            "labels": labels,
            "total": totais,
            "positivas": pos,
            "alertas": alerta,
            "neutras": neutra,
            "forecast_next": {"label": next_label, "total": forecast_total},
        }
    )


# -----------------------------------------------------------------------------
# Resumo mensal — SIMPLES
# -----------------------------------------------------------------------------
def _parse_date_safely(s, default=None):
    d = parse_date(s) if s else None
    return d or default


def _month_bounds(d):
    first = d.replace(day=1)
    if first.month == 12:
        last = first.replace(year=first.year + 1, month=1, day=1) - timedelta(days=1)
    else:
        last = first.replace(month=first.month + 1, day=1) - timedelta(days=1)
    return first, last


def _parse_ymd(s: str):
    try:
        return datetime.strptime(s, "%Y-%m-%d").date()
    except Exception:
        return None


# --- Aliases de tipo que cobrimos (se usar em outro lugar) ---
TIPO_RECEITA = ("receita", "Receita", "R")
TIPO_DESPESA = ("despesa", "Despesa", "D")


@login_required
def dados_financeiros_filtrados(request):
    try:
        inicio = request.GET.get("inicio")
        fim = request.GET.get("fim")
        if not inicio or not fim:
            return JsonResponse(
                {"error": "Parâmetros 'inicio' e 'fim' são obrigatórios."}, status=400
            )

        dt_inicio = _parse_ymd(inicio)
        dt_fim = _parse_ymd(fim)
        if not dt_inicio or not dt_fim or dt_inicio > dt_fim:
            return JsonResponse({"error": "Período inválido."}, status=400)

        base = Transacao.objects.filter(
            **_date_range_kwargs(Transacao, "data", dt_inicio, dt_fim, inclusive_end=True)
        )

        rec_qs = (
            base.filter(tipo__in=TIPO_RECEITA)
            .annotate(dia=TruncDate("data"))
            .values("dia")
            .annotate(total=Sum("valor"))
            .order_by("dia")
        )
        dep_qs = (
            base.filter(tipo__in=TIPO_DESPESA)
            .annotate(dia=TruncDate("data"))
            .values("dia")
            .annotate(total=Sum("valor"))
            .order_by("dia")
        )

        rec_map = {row["dia"]: float(row["total"] or 0) for row in rec_qs}
        dep_map = {row["dia"]: float(row["total"] or 0) for row in dep_qs}

        dias, receitas, despesas, saldo = [], [], [], []
        cur = dt_inicio
        while cur <= dt_fim:
            r = rec_map.get(cur, 0.0)
            d = dep_map.get(cur, 0.0)
            dias.append(cur.strftime("%Y-%m-%d"))
            receitas.append(r)
            despesas.append(d)
            saldo.append(r - d)
            cur += timedelta(days=1)

        return JsonResponse(
            {"dias": dias, "receitas": receitas, "despesas": despesas, "saldo": saldo}, status=200
        )

    except (ValueError, DatabaseError) as e:
        logging.getLogger(__name__).exception("Erro de dados no dados_financeiros_filtrados")
        return JsonResponse({"ok": False, "error": str(e)}, status=500)
    except Exception as e:
        logging.getLogger(__name__).exception("Erro inesperado no dados_financeiros_filtrados")
        return JsonResponse({"ok": False, "error": str(e)}, status=500)


@login_required
def ia_resumo_mensal(request):
    ano = request.GET.get("ano")
    mes = request.GET.get("mes")
    today = date.today()
    try:
        ano = int(ano) if ano else today.year
        mes = int(mes) if mes else today.month
    except ValueError:
        return JsonResponse({"error": "Parâmetros 'ano' e 'mes' inválidos."}, status=400)

    dt_inicio = date(ano, mes, 1)
    dt_fim = date(ano + (1 if mes == 12 else 0), (mes % 12) + 1, 1)  # exclusivo

    base = Transacao.objects.filter(
        **_date_range_kwargs(Transacao, "data", dt_inicio, dt_fim, inclusive_end=False)
    )

    rec_total = float(base.filter(tipo="receita").aggregate(soma=Sum("valor")).get("soma") or 0)
    dep_total = float(base.filter(tipo="despesa").aggregate(soma=Sum("valor")).get("soma") or 0)

    saldo = rec_total - dep_total
    perc_pos = round((saldo / rec_total) * 100, 1) if rec_total > 0 else 0.0
    resumo = (
        f"Receitas: R$ {rec_total:,.2f} | Despesas: R$ {dep_total:,.2f} | "
        f"Saldo: R$ {saldo:,.2f} | Margem: {perc_pos}%"
    )
    dica = (
        "Ótimo! Saldo POSITIVO — reforce a reserva e considere um aporte no Tesouro Selic."
        if saldo >= 0
        else "Alerta! Saldo NEGATIVO — revise despesas e adie gastos não essenciais."
    )

    return JsonResponse(
        {
            "ano": ano,
            "mes": mes,
            "total_receitas": rec_total,
            "total_despesas": dep_total,
            "saldo": saldo,
            "percentual_positivo": perc_pos,
            "resumo": resumo,
            "dica": dica,
        },
        status=200,
    )


# -----------------------------------------------------------------------------
# 🔥 Endpoint que alimenta os GRÁFICOS do dashboard
# -----------------------------------------------------------------------------
def _daterange(ini, fim):
    d = ini
    while d <= fim:
        yield d
        d += timedelta(days=1)


def _to_float(x) -> float:
    try:
        if x is None:
            return 0.0
        if isinstance(x, Decimal):
            return float(x)
        return float(x)
    except Exception:
        return 0.0


@login_required
@require_GET
def dados_grafico_filtrados(request):
    """
    GET /financeiro/dados_grafico_filtrados/?inicio=YYYY-MM-DD&fim=YYYY-MM-DD&categoria=...&debug=1
    """
    hoje = timezone.localdate()

    # 1) Pega datas da querystring (ou define padrão)
    ini = parse_date(request.GET.get("inicio") or "") or hoje.replace(day=1)
    fim = parse_date(request.GET.get("fim") or "") or hoje
    if fim < ini:
        ini, fim = fim, ini

    # 2) Base de transações
    qs = Transacao.objects.all()

    # DateField vs DateTimeField
    data_field = Transacao._meta.get_field("data")
    if isinstance(data_field, models.DateTimeField):
        filtro = {"data__date__range": (ini, fim)}
        trunc_expr = TruncDate("data")
    else:
        filtro = {"data__range": (ini, fim)}
        trunc_expr = F("data")

    base = qs.filter(**filtro)

    # 3) Configuração de Decimals para agregações
    DEC = DecimalField(max_digits=18, decimal_places=2)
    ZERO_DEC = Value(Decimal("0.00"), output_field=DEC)

    # 4) Agrega por dia: receitas, despesas (sempre positivas) e nº de lançamentos
    diarios = (
        base.annotate(dia=trunc_expr)
        .values("dia")
        .annotate(
            rec=Coalesce(
                Sum(
                    Case(
                        When(valor__gte=0, then=Cast(F("valor"), DEC)),
                        default=ZERO_DEC,
                        output_field=DEC,
                    )
                ),
                ZERO_DEC,
                output_field=DEC,
            ),
            des=Coalesce(
                Sum(
                    Case(
                        When(valor__lt=0, then=Cast(Abs(F("valor")), DEC)),
                        default=ZERO_DEC,
                        output_field=DEC,
                    )
                ),
                ZERO_DEC,
                output_field=DEC,
            ),
            n=Count("id"),
        )
        .order_by("dia")
    )

    mapa = {row["dia"]: row for row in diarios}

    # 5) Monta séries diárias para o gráfico de linhas
    dias_labels, receitas, despesas, saldo = [], [], [], []
    for d in _daterange(ini, fim):
        dias_labels.append(d.strftime("%d/%m"))
        row = mapa.get(d)
        r = _to_float(row["rec"]) if row else 0.0
        de = _to_float(row["des"]) if row else 0.0
        receitas.append(r)
        despesas.append(de)
        saldo.append(r - de)

    # 6) Pizza: categorias reais (se o campo existir), focando em DESPESAS
    model_fields = {f.name for f in Transacao._meta.get_fields() if hasattr(f, "attname")}

    # Pizza por categoria (DESPESAS) com "Top N + Outras"
    if "categoria" in model_fields:
        cat_qs = (
            base.values("categoria")
            .annotate(
                total=Coalesce(
                    Sum(Cast(Abs(F("valor")), DEC), output_field=DEC),
                    ZERO_DEC,
                    output_field=DEC,
                )
            )
            .order_by("-total")
        )

        # monta lista crua [(nome, valor_float), ...]
        raw_cats = []
        for row in cat_qs:
            nome = row["categoria"] or "Outras"
            valor = _to_float(row["total"])
            raw_cats.append((nome, valor))

        # ordena por valor (já vem ordenado, mas garantimos)
        raw_cats.sort(key=lambda x: x[1], reverse=True)

        TOP_N = 5  # mostra no máximo 5 categorias + "Outras"
        top = raw_cats[:TOP_N]
        resto = raw_cats[TOP_N:]

        outras_total = sum(v for _, v in resto) if resto else 0.0

        categorias = [nome for (nome, _) in top]
        valores = [valor for (_, valor) in top]

        if outras_total > 0:
            categorias.append("Outras")
            valores.append(outras_total)
    else:
        categorias = []
        valores = []

    # 7) Monta resposta JSON
    resp = {
        "ok": True,
        "inicio": ini.isoformat(),
        "fim": fim.isoformat(),
        "dias": dias_labels,
        "receitas": receitas,
        "despesas": despesas,
        "saldo": saldo,
        "categorias": categorias,
        "valores": valores,
    }

    if request.GET.get("debug") == "1":
        tipos_unicos = list(base.values_list("tipo", flat=True).distinct())
        resp["debug"] = {"tipos_unicos": tipos_unicos}

    return JsonResponse(resp)


# -----------------------------------------------------------------------------
# Geração sob demanda (opção simples)
# -----------------------------------------------------------------------------
@login_required
@require_POST
def gerar_dica_sob_demanda(request):
    texto_da_dica, tipo = gerar_texto_dica(Transacao.objects.all())
    texto_da_dica = (texto_da_dica or "").strip()
    tipo = (tipo or "economia").strip().lower()

    try:
        rec = RecomendacaoIA.objects.create(
            usuario=request.user,
            texto=texto_da_dica,
            tipo=tipo,
        )
        return JsonResponse({"ok": True, "id": rec.id, "dica": texto_da_dica, "tipo": tipo})
    except Exception:
        logging.getLogger(__name__).exception("Falha ao salvar dica sob demanda")
        return JsonResponse({"ok": False, "error": "Falha ao salvar"}, status=500)


# -----------------------------------------------------------------------------
# Fallback seguro de gerar_texto_dica (se não existir em outro módulo)
# -----------------------------------------------------------------------------
def _brl(val: Decimal) -> str:
    q = val.quantize(Decimal("0.01"))
    s = f"{q:,.2f}"  # 1,234.56
    s = s.replace(",", "X").replace(".", ",").replace("X", ".")
    return f"R$ {s}"


if not hasattr(builtins, "gerar_texto_dica"):

    def _dec(x):
        try:
            return Decimal(str(x or "0"))
        except Exception:
            return Decimal("0")

    def gerar_texto_dica(dados):
        from django.db.models import Sum as _Sum  # local import

        total_receitas = Decimal("0")
        total_despesas = Decimal("0")

        if isinstance(dados, dict):
            total_receitas = _dec(dados.get("total_receitas"))
            total_despesas = _dec(dados.get("total_despesas"))
        elif hasattr(dados, "model") and hasattr(dados, "aggregate"):
            try:
                agg = dados.values("tipo").annotate(total=_Sum("valor"))
                for row in agg:
                    if row["tipo"] == "receita":
                        total_receitas += _dec(row["total"])
                    elif row["tipo"] == "despesa":
                        total_despesas += _dec(row["total"])
            except Exception:
                pass
        elif isinstance(dados, (list, tuple)):
            for it in dados:
                t = (it.get("tipo") or "").lower()
                v = _dec(it.get("valor"))
                if t == "receita":
                    total_receitas += v
                elif t == "despesa":
                    total_despesas += v

        if total_receitas == 0 and total_despesas == 0:
            return (
                "Sem movimentações recentes. Registre receitas e despesas para gerar recomendações.",
                "meta",
            )

        saldo = total_receitas - total_despesas
        consumo = (total_despesas / total_receitas) if total_receitas > 0 else Decimal("0")

        if total_receitas > 0 and consumo >= Decimal("0.90"):
            return (
                f"⚠️ Gastos consumiram {consumo:.0%} das receitas. Revise fixas e renegocie serviços.",
                "alerta",
            )

        if saldo > 0:
            aporte = (saldo * Decimal("0.20")).quantize(Decimal("0.01"))
            return (
                f"✅ Superávit de {_brl(saldo)}. Sugestão: aportar ~{_brl(aporte)} no Tesouro Selic.",
                "oportunidade",
            )

        return (
            f"🔻 Déficit de {_brl(abs(saldo))}. Tente cortar 10% nas 3 maiores despesas.",
            "economia",
        )


# -----------------------------------------------------------------------------
# Diagnóstico Transacao (único)
# -----------------------------------------------------------------------------
@login_required
def diag_transacao(request):
    """
    Diagnóstico: retorna campos, exemplo e metadados do modelo Transacao.
    Endpoint: /financeiro/diag/transacao
    """
    try:
        TransacaoModel = apps.get_model("financeiro", "Transacao")
    except LookupError:
        return JsonResponse({"ok": False, "error": "Modelo Transacao não encontrado."}, status=404)

    sample = TransacaoModel.objects.order_by("-id").values().first() or {}

    field_names = [f.name for f in TransacaoModel._meta.fields]
    data_field = next((f for f in field_names if "data" in f), None)
    has_tipo = any("tipo" in f for f in field_names)
    has_categoria = any("categ" in f for f in field_names)

    return JsonResponse(
        {
            "ok": True,
            "model": "Transacao",
            "fields": field_names,
            "data_field": data_field,
            "has_tipo": has_tipo,
            "has_categoria": has_categoria,
            "sample": sample,
            "count": TransacaoModel.objects.count(),
        }
    )


# -----------------------------------------------------------------------------
# Categorias reais de Transacao
# -----------------------------------------------------------------------------
@login_required
def categorias_transacao(request):
    """
    Retorna as categorias reais existentes em Transacao.categoria (distintas e ordenadas).
    """
    try:
        fields = {f.name for f in Transacao._meta.get_fields()}
        if "categoria" not in fields:
            return JsonResponse({"ok": True, "categorias": []})

        qs = (
            Transacao.objects.exclude(categoria__isnull=True)
            .exclude(categoria__exact="")
            .values_list("categoria", flat=True)
            .distinct()
            .order_by("categoria")
        )
        return JsonResponse({"ok": True, "categorias": list(qs)})
    except Exception as e:
        logging.getLogger(__name__).exception("Erro em categorias_transacao")
        return JsonResponse({"ok": False, "categorias": [], "error": str(e)}, status=500)


# -----------------------------------------------------------------------------
# Feed histórico v2 (com filtro textual e contadores)
# -----------------------------------------------------------------------------
# (opcional) use o classificador oficial se existir
try:
    from .services.ia_utils import _map_tipo as map_tipo_oficial  # positiva | alerta | neutra
except Exception:
    # fallback simples se services/ia_utils.py não existir ainda
    def map_tipo_oficial(texto: str) -> str:
        tx = (texto or "").lower()
        ALERTAS = (
            "atenção",
            "cuidado",
            "negativo",
            "déficit",
            "deficit",
            "queda",
            "alerta",
            "urgente",
            "gasto excessivo",
            "acima do previsto",
        )
        POSITIVAS = (
            "ótimo",
            "otimo",
            "positivo",
            "sobra",
            "superávit",
            "superavit",
            "parabéns",
            "bom",
            "melhorou",
            "cresceu",
            "acima da meta",
        )
        if any(k in tx for k in ALERTAS):
            return "alerta"
        if any(k in tx for k in POSITIVAS):
            return "positiva"
        return "neutra"


@login_required
def ia_historico_feed_v2(request):
    user = request.user

    # 1) Compatibilidade: aceitar ?filtro= ou ?tipo=
    filtro_raw = (request.GET.get("filtro") or request.GET.get("tipo") or "").strip().lower()
    tipo_param = filtro_raw if filtro_raw in ("positiva", "alerta", "neutra") else ""

    # 2) Sanitiza paginação
    try:
        limit = int(request.GET.get("limit", 20))
    except ValueError:
        limit = 20
    limit = max(1, min(limit, 100))

    try:
        offset = max(0, int(request.GET.get("offset", 0)))
    except ValueError:
        offset = 0

    # 3) Base do usuário (ordenado por data)
    base = RecomendacaoIA.objects.filter(usuario=user).order_by("-criado_em")

    # 4) Normaliza tipo de TODO mundo (positiva/alerta/neutra) e conta
    tz = timezone.get_current_timezone()
    normalizados = []  # lista com dicts já normalizados
    counts = {"positiva": 0, "alerta": 0, "neutra": 0}
    total = 0

    for rec in base:
        tnorm = (rec.tipo or "").strip().lower()
        if tnorm not in ("positiva", "alerta", "neutra"):
            # classificador textual auxiliar
            tnorm = map_tipo_textual(rec.texto or "") or "neutra" # type: ignore

        if tnorm not in ("positiva", "alerta", "neutra"):
            tnorm = "neutra"

        counts[tnorm] += 1
        total += 1

        dt_local = timezone.localtime(rec.criado_em, tz) if rec.criado_em else None

        normalizados.append(
            {
                "id": rec.id,
                "tipo": tnorm,
                "texto": rec.texto or "",
                "criado_em": rec.criado_em.isoformat() if rec.criado_em else "",
                "criado_em_fmt": dt_local.strftime("%d/%m/%Y %H:%M") if dt_local else "",
                "_stamp": rec.criado_em.timestamp() if rec.criado_em else 0,
            }
        )

    # 5) Aplica filtro de tipo em cima do tipo NORMALIZADO
    if tipo_param in ("positiva", "alerta", "neutra"):
        filtrados = [it for it in normalizados if it["tipo"] == tipo_param]
        filtro_label = tipo_param
    else:
        filtrados = normalizados
        filtro_label = "todas"

    total_filtrado = len(filtrados)

    # 6) Paginação simples via slice
    page_items = filtrados[offset : offset + limit]
    has_more = total_filtrado > (offset + len(page_items))

    # 7) Monta resposta
    resp = {
        "ok": True,
        "filtro": filtro_label,
        "count": {**counts, "total": total},
        "items": [
            {
                "id": it["id"],
                "tipo": it["tipo"],
                "texto": it["texto"],
                "criado_em": it["criado_em"],
                "criado_em_fmt": it["criado_em_fmt"],
            }
            for it in page_items
        ],
        "limit": limit,
        "offset": offset,
        "returned": len(page_items),
        "total_filtered": total_filtrado,
        "has_more": has_more,
        "hasMore": has_more,  # compat com front antigo
    }

    if request.GET.get("debug") == "1":
        resp["__debug"] = {
            "user": {
                "id": request.user.id,
                "username": getattr(request.user, "username", None),
                "email": getattr(request.user, "email", None),
            },
            "params": {
                "filtro": filtro_raw,
                "tipo_param": tipo_param,
                "limit": limit,
                "offset": offset,
            },
        }

    return JsonResponse(resp)


# -----------------------------------------------------------------------------
# Insights utilitários
# -----------------------------------------------------------------------------
@login_required
@require_GET
def listar_insights(request):
    qs = Insight.objects.all().order_by("-id")[:50]
    items = []
    for ins in qs:
        items.append(
            {
                "id": ins.id,
                "texto": getattr(ins, "texto", "") or getattr(ins, "descricao", "") or "",
                "categoria_dominante": getattr(ins, "categoria_dominante", None),
            }
        )
    return JsonResponse({"ok": True, "count": len(items), "items": items})


@login_required
@require_POST
def gerar_insight(request):
    dica, metrics, saved_id = generate_tip_last_30d(Transacao, usuario=request.user, auto_save=True)

    fields = {f.name for f in Insight._meta.get_fields() if hasattr(f, "attname")}
    data = {}

    if "usuario" in fields:
        data["usuario"] = request.user
    elif "user" in fields:
        data["user"] = request.user

    if "texto" in fields:
        data["texto"] = dica
    elif "descricao" in fields:
        data["descricao"] = dica

    top_cat = (metrics or {}).get("top_categoria") or None
    if "categoria_dominante" in fields:
        data["categoria_dominante"] = top_cat
    elif "category_dominante" in fields:
        data["category_dominante"] = top_cat

    try:
        total_rec = float((metrics or {}).get("total_receitas") or 0.0)
        saldo = float((metrics or {}).get("saldo") or 0.0)
        margem = (saldo / total_rec * 100.0) if total_rec else 0.0
    except Exception:
        margem = 0.0
    if "margem" in fields:
        data["margem"] = margem

    try:
        ins = Insight.objects.create(**data)
    except TypeError:
        ins = Insight.objects.create()

    return JsonResponse(
        {
            "ok": True,
            "id": getattr(ins, "id", None),
            "dica": dica,
            "metrics": metrics,
            "recomendacao_id": saved_id,
        }
    )


# -----------------------------------------------------------------------------
# IA Preview / Gerar
# -----------------------------------------------------------------------------
@login_required
@require_GET
def ia_analise_30d_preview(request):
    try:
        data = analisar_30d_dict(Transacao, request.user)
        return JsonResponse({"ok": True, "analise": data})
    except Exception as e:
        return JsonResponse({"ok": False, "error": str(e)}, status=500)


# Alias para compatibilidade com a rota antiga
ia_analise_preview = ia_analise_30d_preview


@login_required
@require_POST
def ia_analise_30d_gerar(request):
    """
    Alias seguro que gera a dica via generate_tip_last_30d (já salva em RecomendacaoIA)
    para manter compatibilidade com o front e com o feed v2.
    """
    return gerar_dica_30d(request)
