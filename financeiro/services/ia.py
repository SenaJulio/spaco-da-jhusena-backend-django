# financeiro/services/ia.py

from datetime import timedelta
import re
import unicodedata
from typing import Optional

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from django.apps import apps


# ---------- util interno: resolve o modelo só quando precisar ----------
def _get_recomendacao_model():
    """
    Tenta obter financeiro.RecomendacaoIA sem quebrar o import do módulo.
    Retorna o Model ou None.
    """
    # 1) tenta import local
    try:
        from .models import RecomendacaoIA  # type: ignore

        return RecomendacaoIA
    except Exception:
        pass

    # 2) tenta via apps.get_model (não explode se não existir)
    try:
        return apps.get_model("financeiro", "RecomendacaoIA")
    except Exception:
        return None


# ---------- Classificador ----------
def _map_tipo(texto: str) -> str:
    if not texto:
        return "neutra"

    t = str(texto).lower().strip()

    kw_alerta = {
        "saldo negativo",
        "margem negativa",
        "negativo",
        "déficit",
        "deficit",
        "prejuízo",
        "prejuizo",
        "atraso",
        "queda",
        "caiu",
        "aumento de despesas",
        "despesa subiu",
        "despesas subiram",
        "estourou",
        "ultrapassou",
        "acima do previsto",
        "fora da meta",
        "risco",
        "atenção",
        "alerta",
        "urgente",
    }
    kw_positiva = {
        "saldo positivo",
        "margem positiva",
        "positivo",
        "superávit",
        "superavit",
        "lucro",
        "margem",
        "cresceu",
        "subiu",
        "aumentou receita",
        "recorde",
        "ótimo",
        "otimo",
        "excelente",
        "parabéns",
        "parabens",
        "saudável",
        "saudavel",
    }
    kw_neutra = {
        "neutro",
        "estável",
        "estavel",
        "sem variação",
        "sem variacao",
        "manteve",
        "regular",
        "dentro da meta",
        "ok",
    }

    if any(k in t for k in kw_alerta):
        return "alerta"
    if any(k in t for k in kw_positiva):
        return "positiva"
    if any(k in t for k in kw_neutra):
        return "neutra"

    # Heurística com percentuais
    pct_matches = re.findall(r"(-?\d+[.,]?\d*)\s*%", t)

    def to_float(s: str) -> Optional[float]:
        try:
            return float(s.replace(",", "."))
        except Exception:
            return None

    if pct_matches:
        pct = next((to_float(s) for s in pct_matches if to_float(s) is not None), None)
        t_ctx = t[:500]
        if pct is not None:
            if "margem" in t_ctx:
                if pct >= 5:
                    return "positiva"
                if pct < 0:
                    return "alerta"
            receita_ref = ("receita" in t_ctx) or ("fatur" in t_ctx)
            despesa_ref = ("despesa" in t_ctx) or ("cust" in t_ctx)

            if (
                despesa_ref
                and any(x in t_ctx for x in ("queda", "redução", "reducao", "diminuiu"))
                and pct <= -3
            ):
                return "positiva"
            if (
                despesa_ref
                and any(x in t_ctx for x in ("aumento", "subiu", "cresceu"))
                and pct >= 5
            ):
                return "alerta"
            if (
                receita_ref
                and any(x in t_ctx for x in ("queda", "caiu", "diminuiu", "redução", "reducao"))
                and pct <= -3
            ):
                return "alerta"
            if (
                receita_ref
                and any(x in t_ctx for x in ("subiu", "cresceu", "aumentou"))
                and pct >= 3
            ):
                return "positiva"

    return "neutra"


def _moeda(v):
    return f"R$ {v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


# ---------- Geração da dica (últimos 30d) ----------
def generate_tip_last_30d(Transacao, usuario=None, auto_save=True):
    """
    Analisa os últimos 30 dias usando o modelo Transacao (campos: valor, data, tipo, [categoria?]).
    Se `usuario` for informado e `auto_save=True`, tenta salvar a dica em RecomendacaoIA.
    Retorna: (dica: str, metrics: dict, saved_id: int|None)
    """
    hoje = timezone.localdate()
    inicio = hoje - timedelta(days=30)

    base_qs = Transacao.objects.filter(data__gte=inicio, data__lte=hoje)
    receitas_qs = base_qs.filter(tipo="receita")
    despesas_qs = base_qs.filter(tipo="despesa")

    total_receitas = receitas_qs.aggregate(total=Sum("valor"))["total"] or 0
    total_despesas = despesas_qs.aggregate(total=Sum("valor"))["total"] or 0
    saldo = (total_receitas or 0) - (total_despesas or 0)

    # Top categoria (se existir)
    top_categoria, top_categoria_total = "—", 0
    try:
        if hasattr(Transacao, "categoria"):
            top = (
                despesas_qs.values("categoria")
                .annotate(total=Sum("valor"))
                .order_by("-total")
                .first()
            )
            if top:
                top_categoria = top.get("categoria") or "—"
                top_categoria_total = top.get("total") or 0
    except Exception:
        pass

    # Texto da dica
    if total_receitas == 0 and total_despesas == 0:
        dica = "Sem movimentos nos últimos 30 dias. Registre entradas e saídas para a IA aprender com seus dados."
    elif saldo < 0 and top_categoria_total > 0:
        dica = (
            f"Alerta: período NEGATIVO ({_moeda(saldo)}). "
            f"A categoria que mais pesou foi **{top_categoria}** ({_moeda(top_categoria_total)}). "
            "Defina um teto para essa categoria e tente renegociar um item recorrente."
        )
    elif saldo < 0:
        dica = (
            f"Seu saldo está negativo em {_moeda(saldo)} nos últimos 30 dias. "
            "Corte 1–2 gastos não essenciais esta semana e postergue compras grandes."
        )
    elif total_receitas > 0:
        margem = (saldo / total_receitas) * 100
        if margem < 10:
            dica = (
                f"Saldo POSITIVO, porém margem baixa ({margem:.1f}%). "
                "Meta: chegar a 15%. Ataque microgastos (delivery, apps, taxas) e antecipe 1 conta com desconto."
            )
        else:
            dica = (
                f"Ótimo! Saldo POSITIVO com margem de {margem:.1f}%. "
                "Reforce a reserva e programe um aporte extra no Tesouro Selic esta semana."
            )
    else:
        dica = "Há poucos dados para uma conclusão robusta. Continue registrando para calibrar melhor as recomendações."

    metrics = {
        "periodo": {"inicio": str(inicio), "fim": str(hoje)},
        "total_receitas": float(total_receitas or 0),
        "total_despesas": float(total_despesas or 0),
        "saldo": float(saldo or 0),
        "top_categoria": top_categoria,
        "top_categoria_total": float(top_categoria_total or 0),
    }

    tipo = _map_tipo(dica)

    # Salvar (defensivo)
    saved_id = None
    if auto_save and usuario is not None:
        RecomendacaoIA = _get_recomendacao_model()
        if RecomendacaoIA is not None:
            with transaction.atomic():
                rec = RecomendacaoIA.objects.create(
                    usuario=usuario,
                    texto=dica,
                    tipo=tipo,
                )
                saved_id = rec.id
        # se o modelo não existir, apenas não salva (sem erro)

    return dica, metrics, saved_id
