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
from django.db.models.functions import TruncMonth
from django.utils.timezone import now
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
    ExpressionWrapper,
    
)
from django.db.models.functions import TruncDate, Coalesce, Abs, Cast
from django.http import JsonResponse
from django.shortcuts import redirect, render
from django.utils import timezone
from django.utils.dateparse import parse_date
from django.views.decorators.http import require_GET, require_POST, require_http_methods
from vendas.models import ItemVenda
from notificacoes.services import (
    notificar_dica_financeira_teste,
    formatar_mensagem_telegram,
)

from datetime import date
from django.http import JsonResponse
from django.db.models import Sum, F
<<<<<<< HEAD

=======
from financeiro.services.ia import salvar_recomendacao_ia
from estoque.services_ia import gerar_alertas_estoque_baixo
from .ia_estoque_bridge import registrar_alertas_lote_no_historico
from estoque.services_lotes import gerar_textos_alerta_lotes
>>>>>>> 660ae25 (atualizando modulos)

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


def map_tipo_textual(texto: str) -> str:
    """
    Normaliza o texto de dica em:
      - 'positiva'
      - 'alerta'
      - 'neutra'

    Usa, na ordem:
      1) map_tipo_oficial (se existir)
      2) _map_tipo_texto (helper local)
      3) _fallback_classify (hardcorezão)
    """
    tx = (texto or "").strip()
    if not tx:
        return "neutra"

    # 1) tenta o classificador oficial (importado lá em cima com fallback)
    try:
        k = map_tipo_oficial(tx)
    except NameError:
        k = ""

    if k in ("positiva", "alerta", "neutra"):
        return k

    # 2) tenta o helper local
    k2 = _map_tipo_texto(tx)
    if k2 in ("positiva", "alerta", "neutra"):
        return k2

    # 3) fallback hardcore
    return _fallback_classify(tx)


<<<<<<< HEAD
=======
def _map_db_tipo_to_hist_tipo(db_tipo: str, texto: str) -> str:
    """
    Converte o 'tipo' salvo no banco (Economia / Alerta / Oportunidade / Meta)
    para o tipo lógico do histórico: 'positiva' / 'alerta' / 'neutra'.

    Regra:
      - 'Alerta'                    -> 'alerta'
      - 'Economia'/'Oportunidade'/'Meta' -> 'positiva'
      - vazio/outra coisa           -> usa map_tipo_textual(texto)
    """
    t = (db_tipo or "").strip().lower()

    if t == "alerta":
        return "alerta"

    if t in ("economia", "oportunidade", "meta"):
        return "positiva"

    k = map_tipo_textual(texto)
    return k if k in ("positiva", "alerta", "neutra") else "neutra"


# ============================================================
# 2) Endpoint do Histórico da IA com filtros + paginação
# ============================================================


@login_required
def ia_historico_feed_v2(request):
    """
    Endpoint do Histórico da IA.

    Junta:
      - RecomendacaoIA (IA TURBO)
      - HistoricoIA (alertas extras, como lote vencido), se existir.

    Aceita:
      - ?filtro= (todas/positiva/alerta/neutra)
      - ?limit=
      - ?offset=
      - ?debug=1 para info extra
    """
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

    tz = timezone.get_current_timezone()
    normalizados = []
    counts = {"positiva": 0, "alerta": 0, "neutra": 0}
    total = 0

    # 3A) Base IA TURBO (RecomendacaoIA)
    base_turbo = RecomendacaoIA.objects.filter(usuario=user).order_by("-criado_em")

    for rec in base_turbo:
        tnorm = _map_db_tipo_to_hist_tipo(getattr(rec, "tipo", "") or "", rec.texto or "")
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
                "origem": "turbo",
            }
        )

    # 3B) Base HistoricoIA (alertas de lote etc.), se existir
    if HistoricoIA is not None:
        base_hist = HistoricoIA.objects.filter(usuario=user).order_by("-criado_em")

        for rec in base_hist:
            texto = rec.texto or ""
            tnorm = _map_db_tipo_to_hist_tipo(getattr(rec, "tipo", "") or "", texto)
            if tnorm not in ("positiva", "alerta", "neutra"):
                tnorm = "neutra"

            # 💡 tenta extrair saldo do texto (p/ badge "30 un")
            saldo_lote = None
            try:
                m = re.search(r"saldo de\s+(\d+)\s+unidade", texto)
                if m:
                    saldo_lote = int(m.group(1))
            except Exception:
                saldo_lote = None

            counts[tnorm] += 1
            total += 1

            dt_local = timezone.localtime(rec.criado_em, tz) if rec.criado_em else None

            normalizados.append(
                {
                    "id": rec.id,
                    "tipo": tnorm,
                    "texto": texto,
                    "criado_em": rec.criado_em.isoformat() if rec.criado_em else "",
                    "criado_em_fmt": dt_local.strftime("%d/%m/%Y %H:%M") if dt_local else "",
                    "_stamp": rec.criado_em.timestamp() if rec.criado_em else 0,
                    "origem": getattr(rec, "origem", "legacy") or "legacy",
                    "saldo_lote": saldo_lote,
                }
            )

    # 3C) Ordena todo mundo por data desc
    normalizados.sort(key=lambda it: it.get("_stamp", 0), reverse=True)

    # 4) Aplica filtro em cima do tipo normalizado
    if tipo_param in ("positiva", "alerta", "neutra"):
        filtrados = [it for it in normalizados if it["tipo"] == tipo_param]
        filtro_label = tipo_param
    else:
        filtrados = normalizados
        filtro_label = "todas"

    total_filtrado = len(filtrados)

    # 5) Paginação
    page_items = filtrados[offset : offset + limit]
    has_more = total_filtrado > (offset + len(page_items))

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
                "origem": it.get("origem", "turbo"),
            }
            for it in page_items
        ],
        "limit": limit,
        "offset": offset,
        "returned": len(page_items),
        "total_filtered": total_filtrado,
        "has_more": has_more,
        "hasMore": has_more,
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


>>>>>>> 660ae25 (atualizando modulos)
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


# ============================================================
# MÉTRICAS — Despesas Fixas vs Variáveis (mensal)
# ============================================================


def despesas_fixas_variaveis_mensal(request):
    """
    Calcula o total de despesas fixas e variáveis no mês atual.
    Regra:
      - categoria == 'Despesas Fixas'  -> fixas
      - demais categorias de despesa   -> variáveis
    """
    hoje = now().date()
    ano = hoje.year
    mes = hoje.month

    filtro_despesa = Q(tipo="despesa") | Q(tipo="D")

    agg = Transacao.objects.filter(
        filtro_despesa,
        data__year=ano,
        data__month=mes,
    ).aggregate(
        total_fixas=Sum("valor", filter=Q(categoria="Despesas Fixas")),
        total_variaveis=Sum("valor", filter=~Q(categoria="Despesas Fixas")),
    )

    fixas = float(agg.get("total_fixas") or 0)
    variaveis = float(agg.get("total_variaveis") or 0)
    total = fixas + variaveis

    if total > 0:
        pct_fixas = (fixas / total) * 100.0
        pct_variaveis = (variaveis / total) * 100.0
    else:
        pct_fixas = 0.0
        pct_variaveis = 0.0

    return JsonResponse(
        {
            "ok": True,
            "mes_label": f"{mes:02d}/{ano}",
            "fixas": fixas,
            "variaveis": variaveis,
            "total": total,
            "pct_fixas": pct_fixas,
            "pct_variaveis": pct_variaveis,
        }
    )

# -----------------------------------------------------------------------------
# Dashboard (template)
# -----------------------------------------------------------------------------
@login_required(login_url="/admin/login/")
def dashboard_financeiro(request):
<<<<<<< HEAD
=======
    try:
        gerar_alertas_estoque_baixo(usuario=request.user, limite_padrao=3)
    except Exception as exc:
        print("[IA ESTOQUE BAIXO - dashboard]", exc)

>>>>>>> 660ae25 (atualizando modulos)
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
        # 1) calcula métricas dos últimos 30 dias
        metrics = analisar_30d_dict(Transacao, request.user)
        dica = (metrics.get("plano_acao") or metrics.get("mensagem") or "").strip()

        # classifica a dica em positiva/alerta/neutra
        tipo_classificado = map_tipo_ia(dica)

        # 2) SALVA NO HISTÓRICO (RecomendacaoIA)
        rec = RecomendacaoIA.objects.create(
            usuario=request.user,
            texto=dica,
            # frontend trabalha com positiva/alerta/neutra
            tipo=tipo_classificado or "economia",
        )
        saved_id = rec.id
        criado_em = rec.criado_em

        # 🔔 NOVO: dispara notificação (por enquanto FAKE) para WhatsApp
        try:
            notificar_dica_financeira_teste(
                mensagem=dica,
                canal="whatsapp",  # aqui escolhe o canal
                usuario=request.user,  # pra pegar CanalNotificacaoUsuario se tiver
            )
        except Exception as notif_exc:
            # não vamos quebrar a geração da dica se der erro de notificação
            print("[DEBUG NOTIF WHATSAPP]", notif_exc)

        # 3) monta mensagem bonita pro Telegram
        periodo_dict = metrics.get("periodo") or {}
    # mensagem_formatada = formatar_mensagem_telegram(
    #     dica=dica,
    #    tipo=tipo_classificado,
    #     periodo=periodo_dict,
    #  )

    # 4) dispara notificação (central de notificações)
    #  notificar_dica_financeira_teste(
    #     mensagem_formatada,
    #     canal="telegram",
    #    usuario=request.user,
    # )

    except Exception as e:
        # se der qualquer erro aqui em cima, volta 500 com texto de erro
        return JsonResponse({"ok": False, "error": str(e)}, status=500)

    # 5) monta período em objetos date pra devolver no payload (como antes)
    ps_str = (metrics.get("periodo") or {}).get("inicio") if isinstance(metrics, dict) else None
    pe_str = (metrics.get("periodo") or {}).get("fim") if isinstance(metrics, dict) else None
    try:
        ps = date.fromisoformat(ps_str) if ps_str else timezone.localdate()
        pe = date.fromisoformat(pe_str) if pe_str else timezone.localdate()
    except Exception:
        ps = pe = timezone.localdate()

    # se por algum motivo der erro lá em cima, garante um datetime
    if "criado_em" not in locals():
        criado_em = timezone.localtime()

    payload = {
        "ok": True,
        "salvo": {
            "id": saved_id,
            "tipo": tipo_classificado,
            "texto": dica,
            "text": dica,
            # o historico_ia.js entende esse formato dd/mm/aaaa HH:MM
            "created_at": criado_em.strftime("%d/%m/%Y %H:%M"),
            "criado_em": criado_em.strftime("%d/%m/%Y %H:%M"),
            "criado_em_fmt": criado_em.strftime("%d/%m/%Y %H:%M"),
            "metrics": metrics,
            "periodo": {"inicio": str(ps), "fim": str(pe)},
        },
    }
    return JsonResponse(payload)


@require_http_methods(["GET", "POST"])
@login_required
def enviar_dica_30d(request):
    """
    Envia a ÚLTIMA dica 30d do usuário logado para o Telegram.
    (Depois a gente pode evoluir para escolher por ID.)
    """
    try:
        rec = RecomendacaoIA.objects.filter(usuario=request.user).latest("criado_em")
    except RecomendacaoIA.DoesNotExist:
        return JsonResponse(
            {"ok": False, "error": "Nenhuma dica encontrada para enviar."},
            status=400,
        )

    metrics = analisar_30d_dict(Transacao, request.user)
    periodo_dict = metrics.get("periodo") or {}

    mensagem_formatada = formatar_mensagem_telegram(
        dica=rec.texto,
        tipo=rec.tipo,
        periodo=periodo_dict,
    )

    notificar_dica_financeira_teste(
        mensagem_formatada,
        canal="telegram",
        usuario=request.user,
    )

    return JsonResponse(
        {
            "ok": True,
            "enviado": {
                "id": rec.id,
                "texto": rec.texto,
                "tipo": rec.tipo,
                "periodo": periodo_dict,
            },
        }
    )


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


@login_required
def ia_alertas_periodos_criticos(request):
    """
    Analisa a série mensal (receitas, despesas, saldo)
    e retorna alertas de períodos críticos / pontos de atenção.
    """
    hoje = now().date()
    inicio = hoje.replace(month=1, day=1)
    fim = hoje

    qs = (
        Transacao.objects.filter(data__gte=inicio, data__lte=fim)
        .annotate(mes=TruncMonth("data"))
        .values("mes")
        .annotate(
            total_receitas=Sum("valor", filter=Q(tipo__in=TIPO_RECEITA)),
            total_despesas=Sum("valor", filter=Q(tipo__in=TIPO_DESPESA)),
        )
        .order_by("mes")
    )

    series = []
    for row in qs:
        mes = row["mes"]
        receitas = float(row["total_receitas"] or 0)
        despesas = float(row["total_despesas"] or 0)
        saldo = receitas - despesas
        margem = (saldo / receitas * 100.0) if receitas > 0 else 0.0

        series.append(
            {
                "ano": mes.year,
                "mes": mes.month,
                "label": f"{mes.month:02d}/{mes.year}",
                "total_receitas": receitas,
                "total_despesas": despesas,
                "saldo": saldo,
                "margem": margem,
            }
        )

    # se tiver pouco dado, não inventa alerta
    if len(series) < 2:
        return JsonResponse(
            {
                "ok": True,
                "motivo": "poucos_dados",
                "alertas": [],
                "series": series,
            }
        )

    alertas = []

    # 1) Pior saldo do ano
    pior = min(series, key=lambda s: s["saldo"])
    if pior["saldo"] < 0:
        alertas.append(
            {
                "tipo": "critico",
                "titulo": "Mês com pior saldo do ano",
                "mes": pior["label"],
                "texto": (
                    f"No mês {pior['label']} o saldo ficou NEGATIVO em "
                    f"R$ {pior['saldo']:.2f}. Reveja despesas e cortes desse período."
                ),
            }
        )

    # 2) Maior queda de saldo entre meses consecutivos
    maior_queda = None
    for prev, cur in zip(series, series[1:]):
        diff = cur["saldo"] - prev["saldo"]  # se negativo, caiu
        if diff < 0:
            if (maior_queda is None) or (diff < maior_queda["diff"]):
                maior_queda = {
                    "diff": diff,
                    "mes_anterior": prev,
                    "mes_atual": cur,
                }

    if maior_queda:
        prev = maior_queda["mes_anterior"]
        cur = maior_queda["mes_atual"]
        alertas.append(
            {
                "tipo": "atencao",
                "titulo": "Maior queda de saldo entre meses",
                "mes": cur["label"],
                "texto": (
                    f"Entre {prev['label']} e {cur['label']} o saldo caiu "
                    f"R$ {abs(maior_queda['diff']):.2f}. Avalie o que mudou nesse período "
                    "em receitas e despesas."
                ),
            }
        )

    # 3) Margem muito apertada (menos de 10%) no último mês
    ultimo = series[-1]
    if ultimo["total_receitas"] > 0 and ultimo["margem"] < 10:
        alertas.append(
            {
                "tipo": "alerta",
                "titulo": "Margem apertada no mês atual",
                "mes": ultimo["label"],
                "texto": (
                    f"No mês {ultimo['label']} a margem foi de apenas "
                    f"{ultimo['margem']:.1f}%. Risco de o caixa ficar negativo "
                    "se as despesas subirem ou as vendas caírem."
                ),
            }
        )

    return JsonResponse(
        {
            "ok": True,
            "alertas": alertas,
            "series": series,
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


def ia_resumo_mensal_series(request):
    """
    Série mensal agregada para a IA (receitas, despesas, saldo por mês).
    Exemplo de resposta:
    {
      "ok": true,
      "inicio": "2025-01-01",
      "fim": "2025-11-01",
      "series": [
        {
          "ano": 2025,
          "mes": 1,
          "label": "01/2025",
          "total_receitas": 1234.56,
          "total_despesas": 789.10,
          "saldo": 445.46
        },
        ...
      ]
    }
    """
    hoje = now().date()

    # aqui podemos ser simples: pegar tudo desde janeiro do ano atual
    inicio = hoje.replace(month=1, day=1)
    fim = hoje

    qs = (
        Transacao.objects.filter(data__gte=inicio, data__lte=fim)  # <<< sem __date
        .annotate(mes=TruncMonth("data"))
        .values("mes")
        .annotate(
            total_receitas=Sum("valor", filter=Q(tipo="R")),
            total_despesas=Sum("valor", filter=Q(tipo="D")),
        )
        .order_by("mes")
    )

    series = []
    for row in qs:
        mes = row["mes"]
        receitas = row["total_receitas"] or 0
        despesas = row["total_despesas"] or 0
        saldo = receitas - despesas

        series.append(
            {
                "ano": mes.year,
                "mes": mes.month,
                "label": f"{mes.month:02d}/{mes.year}",
                "total_receitas": float(receitas),
                "total_despesas": float(despesas),
                "saldo": float(saldo),
            }
        )

    data = {
        "ok": True,
        "inicio": inicio.isoformat(),
        "fim": fim.isoformat(),
        "series": series,
    }
    return JsonResponse(data)


# ============================================================
# IA — Análise Mensal (preview)
# Usa o motor financeiro/ia_engine.py
# ============================================================

from .ia_engine import analisar_serie_mensal  # importa o motor


def ia_analise_mensal_preview(request):
    """
    Gera uma análise inteligente do mês atual,
    usando os dados da série mensal consolidada.
    """
    # Reaproveitamos a mesma lógica da ia_resumo_mensal_series
    hoje = now().date()
    inicio = hoje.replace(month=1, day=1)
    fim = hoje

    qs = (
        Transacao.objects.filter(data__gte=inicio, data__lte=fim)
        .annotate(mes=TruncMonth("data"))
        .values("mes")
        .annotate(
            total_receitas=Sum("valor", filter=Q(tipo="R")),
            total_despesas=Sum("valor", filter=Q(tipo="D")),
        )
        .order_by("mes")
    )

    # Normalizamos igual ao endpoint de séries
    series = []
    for row in qs:
        mes = row["mes"]
        receitas = float(row["total_receitas"] or 0)
        despesas = float(row["total_despesas"] or 0)
        saldo = receitas - despesas

        series.append(
            {
                "ano": mes.year,
                "mes": mes.month,
                "label": f"{mes.month:02d}/{mes.year}",
                "total_receitas": receitas,
                "total_despesas": despesas,
                "saldo": saldo,
            }
        )

    # Chama o motor da IA
    resultado = analisar_serie_mensal(series)

    return JsonResponse(resultado)

# ============================================================
# MÉTRICAS — Ranking mensal de categorias
# ============================================================


def ranking_categorias_mensal(request):
    """
    Retorna o ranking de categorias do mês atual,
    somando todas as transações do mês por categoria (campo texto).
    """
    hoje = now().date()
    mes = hoje.month
    ano = hoje.year

    qs = (
        Transacao.objects.filter(data__year=ano, data__month=mes)
        .values("categoria")  # << agora é direto no campo
        .annotate(total=Sum("valor"))
        .order_by("-total")
    )

    categorias = []
    for row in qs:
        nome = row["categoria"] or "Sem categoria"
        categorias.append({"categoria": nome, "total": float(row["total"] or 0)})

    return JsonResponse({"ok": True, "mes_label": f"{mes:02d}/{ano}", "categorias": categorias})

# ============================================================
# MÉTRICAS — Ranking mensal de serviços/produtos (por ItemVenda)
# ============================================================


@login_required
def ranking_servicos_mensal(request):
    """
    Ranking dos serviços/produtos mais vendidos no mês atual,
    somando quantidade * preco_unitario por produto,
    usando a DATA da VENDA (sem depender da transação).
    """
    hoje = now().date()
    mes = hoje.month
    ano = hoje.year

    valor_total_expr = ExpressionWrapper(
        F("quantidade") * F("preco_unitario"),
        output_field=DecimalField(max_digits=12, decimal_places=2),
    )

    qs = (
        ItemVenda.objects.filter(
            venda__data__year=ano,
            venda__data__month=mes,
        )
        .values("produto__nome")
        .annotate(total=Sum(valor_total_expr))
        .order_by("-total")
    )

    itens = []
    for row in qs:
        nome = row["produto__nome"] or "Sem nome"
        itens.append(
            {
                "nome": nome,
                "total": float(row["total"] or 0),
            }
        )

    return JsonResponse(
        {
            "ok": True,
            "mes_label": f"{mes:02d}/{ano}",
            "servicos": itens,
        }
    )

# ============================================================
# MÉTRICAS — Categoria que mais cresceu (variação mensal)
# ============================================================


def categoria_que_mais_cresceu(request):
    """
    Compara cada categoria entre mês atual e mês anterior
    e retorna a que mais cresceu em %.
    """
    hoje = now().date()
    ano = hoje.year
    mes = hoje.month

    # Mês atual
    qs_atual = (
        Transacao.objects.filter(data__year=ano, data__month=mes)
        .values("categoria")
        .annotate(total=Sum("valor"))
    )
    atual = {row["categoria"]: float(row["total"] or 0) for row in qs_atual}

    # Mês anterior
    mes_ant = mes - 1 if mes > 1 else 12
    ano_ant = ano if mes > 1 else ano - 1

    qs_ant = (
        Transacao.objects.filter(data__year=ano_ant, data__month=mes_ant)
        .values("categoria")
        .annotate(total=Sum("valor"))
    )
    anterior = {row["categoria"]: float(row["total"] or 0) for row in qs_ant}

    variacoes = []
    for cat, valor_atual in atual.items():
        valor_ant = anterior.get(cat, 0)
        if valor_ant == 0:
            variacao = 100.0 if valor_atual > 0 else 0
        else:
            variacao = ((valor_atual - valor_ant) / valor_ant) * 100

        variacoes.append(
            {
                "categoria": cat,
                "variacao": variacao,
                "atual": valor_atual,
                "anterior": valor_ant,
            }
        )

    if not variacoes:
        return JsonResponse({"ok": True, "mensagem": "Sem dados suficientes."})

    # pega a maior variação
    maior = max(variacoes, key=lambda x: x["variacao"])

    return JsonResponse(
        {
            "ok": True,
            "categoria": maior["categoria"],
            "variacao": maior["variacao"],
            "atual": maior["atual"],
            "anterior": maior["anterior"],
            "mes_atual": f"{mes:02d}/{ano}",
            "mes_anterior": f"{mes_ant:02d}/{ano_ant}",
        }
    )
<<<<<<< HEAD
=======


from django.views.decorators.http import require_POST
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from .ia_estoque_bridge import registrar_alertas_lote_no_historico


@login_required
@require_POST
def ia_alertas_lotes(request):
         
    try:
        msgs = gerar_textos_alerta_lotes(dias_aviso=30)
        if not msgs:
            return JsonResponse({"ok": True, "total_criados": 0, "ids": []})

        agora = timezone.now()
        janela = agora - timedelta(hours=24)

        ids = []
        pulados = 0
   
        for m in msgs:
            lote_id = m.get("lote_id")
            status = m.get("tipo")  # "vencido" / "prestes_vencer"
            validade = m.get("validade")  # "YYYY-MM-DD"

            # 🔑 Assinatura única lógica do alerta
            dedup_key = f"lote:{lote_id}|status:{status}|val:{validade}"

            # ✅ Se já existe algo igual nas últimas 24h, não cria de novo
            ja_existe = HistoricoIA.objects.filter(
                usuario=request.user,
                origem="lote",
                criado_em__gte=janela,
                texto__contains=dedup_key,
            ).exists()

            if ja_existe:
                pulados += 1
                continue

            # salva texto COM a chave escondida no final (não atrapalha visual)
            texto = (m.get("texto") or "").strip()
            texto_salvo = f"{texto}\n\n[{dedup_key}]"

            obj = HistoricoIA.objects.create(
                usuario=request.user,
                texto=texto_salvo,
                tipo="alerta",
                origem="lote",
                criado_em=agora,
            )
            ids.append(obj.id)

        return JsonResponse({"ok": True, "total_criados": len(ids), "ids": ids, "pulados": pulados})

    except Exception as exc:
        return JsonResponse({"ok": False, "error": str(exc)}, status=500)


@login_required
def ia_alertas_estoque_baixo(request):
    """
    Gera recomendações de ALERTA de estoque baixo e retorna um resumo em JSON.
    Integra direto com o histórico da IA (RecomendacaoIA).
    """
    if request.method != "POST":
        return JsonResponse({"ok": False, "error": "Método não permitido"}, status=405)

    try:
        criados = gerar_alertas_estoque_baixo(usuario=request.user, limite_padrao=3)
    except Exception as exc:
        return JsonResponse({"ok": False, "error": str(exc)}, status=500)

    return JsonResponse(
        {
            "ok": True,
            "total_alertas_criados": len(criados),
            "itens": criados,
        }
    )
>>>>>>> 660ae25 (atualizando modulos)
