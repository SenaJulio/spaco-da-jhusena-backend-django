# Stdlib
import hashlib
import logging
from collections import defaultdict
from datetime import date, datetime, timedelta
from decimal import Decimal
import builtins

# Django
from django.apps import apps  # fallback para modelos
from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.core.paginator import Paginator
from django.db.models import Sum, Q
from django.http import JsonResponse
from django.shortcuts import redirect, render
from django.utils import timezone
from django.views.decorators.http import require_GET, require_POST

# App local
from .models import Insight, Transacao
from .services.ia import generate_tip_last_30d
# Pode existir em outro arquivo; mantido aqui para compat com teu projeto


# --- Modelos opcionais/legados ---
try:
    from .models import RecomendacaoIA
except Exception:
    RecomendacaoIA = apps.get_model("financeiro", "RecomendacaoIA")

try:
    HistoricoIA = apps.get_model("financeiro", "RecomendacaoIA")  # pode ser o mesmo
except Exception:
    HistoricoIA = None


# =============================================================================
# Helpers
# =============================================================================
def _parse_date(s: str):
    try:
        return datetime.strptime(s, "%Y-%m-%d").date()
    except Exception:
        return None


def _pick_cor_from_metrics(metrics: dict) -> str:
    """Escolhe uma cor (bootstrap-like) de forma segura a partir das métricas."""
    try:
        saldo = float((metrics or {}).get("saldo", 0))
        if saldo > 0:
            return "success"
        if saldo < 0:
            return "danger"
        return "secondary"
    except Exception:
        return "secondary"


def _map_tipo(categoria: str, cor: str, metrics: dict) -> str:
    """
    Mapeia para um tipo válido do seu model RecomendacaoIA.tipo.
    Tenta ser conservador: 'alerta' para negativo, 'geral' caso contrário.
    """
    try:
        margem = float((metrics or {}).get("margem", 0) or 0)
    except Exception:
        margem = 0.0

    if cor == "danger" or margem < 0:
        return "alerta"
    # ajuste para os choices do seu model; se não souber, use 'geral'
    return "geral"


def _infer_cor(obj) -> str:
    """Infere cor com base em campos comuns dos modelos/legados."""
    m = getattr(obj, "metrics", {}) or {}
    cor = m.get("cor")
    if cor:
        return cor
    cor_alt = getattr(obj, "cor", None)
    if cor_alt:
        return cor_alt
    cat = (
        getattr(obj, "categoria", None)
        or getattr(obj, "categoria_dominante", "")  # legado
        or ""
    ).lower()
    if cat in ("alerta", "vermelho"):
        return "vermelho"
    if cat in ("atenção", "atencao", "amarelo", "warning"):
        return "amarelo"
    if cat in ("positivo", "sucesso", "verde", "success"):
        return "verde"
    return "cinza"


# =============================================================================
# Dashboard
# =============================================================================
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
        {
            "total_receitas": total_receitas,
            "total_despesas": total_despesas,
            "saldo": saldo,
        },
    )


# =============================================================================
# Mini-IA: Gerar dica dos últimos 30 dias
# =============================================================================
@require_POST
@login_required
def gerar_dica_30d(request):
    # 1) roda a Mini-IA existente
    dica, metrics = generate_tip_last_30d(Transacao)

    # 2) período (seguro)
    ps_str = (metrics.get("periodo") or {}).get("inicio") if isinstance(metrics, dict) else None
    pe_str = (metrics.get("periodo") or {}).get("fim") if isinstance(metrics, dict) else None
    try:
        ps = date.fromisoformat(ps_str) if ps_str else timezone.localdate()
        pe = date.fromisoformat(pe_str) if pe_str else timezone.localdate()
    except Exception:
        ps, pe = timezone.localdate(), timezone.localdate()

    categoria = (metrics.get("top_categoria") or "Geral") if isinstance(metrics, dict) else "Geral"
    cor = _pick_cor_from_metrics(metrics)

    # 3) fingerprint
    raw = f"{ps}|{pe}|{(dica or '').strip()}"
    fp = hashlib.sha256(raw.encode("utf-8")).hexdigest()

    saved = False
    rec_id = None

    # 4) Persistência opcional em HistoricoIA (se existir)
    if HistoricoIA is not None:
        try:
            campos = {f.name for f in HistoricoIA._meta.get_fields()}
            if "fingerprint" in campos:
                rec, created = HistoricoIA.objects.get_or_create(
                    fingerprint=fp,
                    defaults={
                        "period_start": ps if "period_start" in campos else None,
                        "period_end": pe if "period_end" in campos else None,
                        ("texto" if "texto" in campos else "dica"): (dica or "").strip(),
                        (
                            "categoria" if "categoria" in campos else "categoria_dominante"
                        ): categoria,
                        "score": 0 if "score" in campos else None,
                        "metrics": {**(metrics or {}), "cor": cor} if "metrics" in campos else None,
                        "source": "auto" if "source" in campos else None,
                        "generated_by": "modo_turbo_30d" if "generated_by" in campos else None,
                        "visible": True if "visible" in campos else None,
                    },
                )
                saved, rec_id = created, rec.id
            else:
                payload = {}
                if "texto" in campos:
                    payload["texto"] = (dica or "").strip()
                elif "dica" in campos:
                    payload["dica"] = (dica or "").strip()
                if "categoria" in campos:
                    payload["categoria"] = categoria
                elif "categoria_dominante" in campos:
                    payload["categoria_dominante"] = categoria
                if "cor" in campos:
                    payload["cor"] = cor
                if "created_at" in campos:
                    payload["created_at"] = timezone.localtime()
                if "period_start" in campos:
                    payload["period_start"] = ps
                if "period_end" in campos:
                    payload["period_end"] = pe
                rec = HistoricoIA.objects.create(**payload)
                saved, rec_id = True, rec.id
        except Exception:
            logging.getLogger(__name__).exception("Falha ao salvar em HistoricoIA")

    # 5) Salva no modelo do painel (RecomendacaoIA)
    try:
        tipo_escolhido = _map_tipo(categoria, cor, metrics)
        RecomendacaoIA.objects.create(
            usuario=request.user,
            texto=(dica or "").strip(),  # compat: seu model usa 'texto'
            tipo=tipo_escolhido,
        )
        if not saved:
            saved = True
    except Exception:
        logging.getLogger(__name__).exception("Falha ao salvar em RecomendacaoIA")

    # 6) Resposta
    agora = timezone.localtime()
    return JsonResponse(
        {
            "ok": True,
            "saved": saved,
            "id": rec_id,
            "dica": dica,
            "text": (dica or "").strip(),   # compat com front
            "texto": (dica or "").strip(),  # compat com front
            "metrics": metrics,
            "categoria": categoria,
            "cor": cor,
            "created_at": agora.strftime("%d/%m/%Y %H:%M"),
            "periodo": {"inicio": str(ps), "fim": str(pe)},
        }
    )


# =============================================================================
# Feed do painel (JSON) com filtros e paginação
# =============================================================================
@require_GET
@login_required
def ia_historico_feed(request):
    """Feed do histórico com filtros e paginação, compatível com o payload antigo."""
    page = int(request.GET.get("page", 1))
    per_page = int(request.GET.get("per_page", 10))
    # compat com 'limit' antigo (se vier, prioriza 1 página com 'limit' itens)
    limit = request.GET.get("limit")
    if limit:
        try:
            per_page = max(1, int(limit))
            page = 1
        except Exception:
            pass

    inicio = _parse_date(request.GET.get("inicio", "") or "")
    fim = _parse_date(request.GET.get("fim", "") or "")
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
        # detecta campo de data
        date_field = "created_at"
        try:
            HModel._meta.get_field("created_at")
        except Exception:
            date_field = "criado_em"

        qs = HModel.objects.all()

        # filtros por data (no campo detectado)
        if inicio:
            qs = qs.filter(**{f"{date_field}__date__gte": inicio})
        if fim:
            qs = qs.filter(**{f"{date_field}__date__lte": fim})

        # filtro por categoria
        if categoria:
            qs = qs.filter(
                Q(categoria__iexact=categoria) | Q(categoria_dominante__iexact=categoria)
            )

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
                    "data": data_iso,          # compat
                    "created_at": data_iso,    # alias padronizado
                    "created_at_br": data_br,  # pronto p/ exibir
                    "periodo": {
                        "inicio": str(getattr(r, "period_start", "") or ""),
                        "fim": str(getattr(r, "period_end", "") or ""),
                    },
                    "categoria": cat,
                    "cor": cor,
                    "text": (texto or "").strip(),
                    "texto": (texto or "").strip(),  # compat
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

        # filtros Insight
        if inicio:
            qs = qs.filter(created_at__date__gte=inicio)
        if fim:
            qs = qs.filter(created_at__date__lte=fim)
        if categoria:
            qs = qs.filter(
                Q(kind__iexact=categoria) | Q(categoria_dominante__iexact=categoria)
            )

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

    # se nenhum dos modelos existir
    return JsonResponse({"ok": True, "items": [], "page": 1, "has_next": False, "count": 0})


# =============================================================================
# Histórico textual (lista simples)
# =============================================================================
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
            "tipo": r.get_tipo_display(),
            "texto": r.texto,
        }
        for r in qs
    ]

    return JsonResponse({"ok": True, "items": items})


# =============================================================================
# Resumo mensal — SÉRIE (para gráficos históricos)  [opcional]
# =============================================================================
@require_GET
@login_required
def ia_resumo_mensal_series(request):
    """Mantido caso você utilize este endpoint para Chart.js com série histórica."""
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

    rows = Insight.objects.filter(created_at__gte=inicio_janela).values_list(
        "created_at", "kind"
    )

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

    # Previsão linear simples
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
    next_label = (last.replace(day=28) + timedelta(days=4)).replace(day=1).strftime("%Y-%m-01")

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


# =============================================================================
# Resumo mensal — SIMPLES (usado pelo dashboard.html)
# =============================================================================
@require_GET
@login_required
def ia_resumo_mensal(request):
    hoje = timezone.now()
    mes = hoje.month
    ano = hoje.year

    qs_mes = Transacao.objects.filter(data__year=ano, data__month=mes)

    total_receitas = qs_mes.filter(tipo="receita").aggregate(Sum("valor"))["valor__sum"] or 0
    total_despesas = qs_mes.filter(tipo="despesa").aggregate(Sum("valor"))["valor__sum"] or 0

    saldo = (total_receitas or 0) - (total_despesas or 0)
    margem = (saldo / total_receitas * 100) if total_receitas else 0

    if saldo > 0:
        dica = f"Saldo POSITIVO em {margem:.1f}%. Reforce a reserva e evite novos gastos."
    elif saldo < 0:
        dica = "Saldo NEGATIVO! Reveja as despesas: você gastou mais do que ganhou."
    else:
        dica = "Saldo neutro. Hora de revisar metas e otimizar despesas."

    return JsonResponse(
        {
            "mes": hoje.strftime("%m/%Y"),
            "receitas": float(total_receitas),
            "despesas": float(total_despesas),
            "saldo": float(saldo),
            "margem": round(margem, 1),
            "dica": dica,
        }
    )


# =============================================================================
# Geração sob demanda (opção simples)
# =============================================================================
@login_required
@require_POST
def gerar_dica_sob_demanda(request):
    # Gera automaticamente com base nas transações atuais
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


# =============================================================================
# Fallback seguro de gerar_texto_dica (se não existir em outro módulo)
# =============================================================================
# no topo do fallback (logo antes de gerar os textos), adicione:
def _brl(val: Decimal) -> str:
    q = val.quantize(Decimal("0.01"))
    s = f"{q:,.2f}"              # 1,234.56
    s = s.replace(",", "X")      # 1X234.56
    s = s.replace(".", ",")      # 1X234,56
    s = s.replace("X", ".")      # 1.234,56
    return f"R$ {s}"

if not hasattr(builtins, "gerar_texto_dica"):

    def _dec(x):
        try:
            return Decimal(str(x or "0"))
        except Exception:
            return Decimal("0")

    def gerar_texto_dica(dados):
        from django.db.models import Sum as _Sum  # local import p/ evitar circularidade

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
                f"✅ Superávit de  {_brl(saldo)}. Sugestão: aportar ~R$ {aporte} no Tesouro Selic.",
                "oportunidade",
            )

        return (
            f"🔻 Déficit de R$ {abs(saldo):.2f}. Tente cortar 10% nas 3 maiores despesas.",
            "economia",
        )
