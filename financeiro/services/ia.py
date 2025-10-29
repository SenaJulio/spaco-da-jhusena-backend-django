# financeiro/services/ia.py
from datetime import timedelta

from django.db.models import Sum
from django.utils import timezone 
from django.db import transaction
from django.contrib.auth import get_user_model
from financeiro.models import RecomendacaoIA


# financeiro/services/ia.py (topo)
# topo do arquivo (garanta imports únicos)
import re
import unicodedata
from typing import Optional


# ---------- Normalização ----------
def _norm(s: str) -> str:
    if not s:
        return ""
    s = s.strip().lower()
    s = unicodedata.normalize("NFD", s)
    s = "".join(ch for ch in s if unicodedata.category(ch) != "Mn")
    s = re.sub(r"[\n\r\t]+", " ", s)
    s = re.sub(r"[!?:;()\[\]{}\"'«»“”’·•…]", " ", s)  # mantém % , .
    s = re.sub(r"\s+", " ", s)
    return s.strip()


# ---------- Palavras-chave ----------
_POS_KW = {
    "otimo",
    "excelente",
    "bom",
    "muito bom",
    "saldo positivo",
    "lucro",
    "acima da meta",
    "margem positiva",
    "superavit",
    "sobra",
    "crescimento",
    "recuperacao",
    "reforce a reserva",
    "aporte extra",
    "continue assim",
    "recorde",
}
_ALERT_KW = {
    "alerta",
    "atencao",
    "cuidado",
    "risco",
    "queda",
    "abaixo",
    "deficit",
    "prejuizo",
    "negativo",
    "gasto alto",
    "estouro",
    "acima do orcamento",
    "aperto de caixa",
    "corte",
    "reduza",
    "evite",
    "inadimpl",
    "atraso",
}
_NEU_KW = {"neutro", "estavel", "sem mudanca", "manter", "regular", "ok"}

_PCT_RE = re.compile(r"(?<![\w])(-?\d{1,3}(?:[.,]\d+)?)\s*%")


def _extract_percent(texto: str) -> Optional[float]:
    if not texto:
        return None
    m = _PCT_RE.search(texto)
    if not m:
        return None
    try:
        return float(m.group(1).replace(",", "."))
    except ValueError:
        return None


def _score_by_keywords(tlow: str) -> int:
    score = 0
    for kw in _POS_KW:
        if kw in tlow:
            score += 2
    for kw in _ALERT_KW:
        if kw in tlow:
            score -= 2
    # sinais fortes
    if "saldo positivo" in tlow or "margem positiva" in tlow:
        score += 3
    if "saldo negativo" in tlow or "margem negativa" in tlow:
        score -= 3
    return score


# ---------- Classificador Único ----------
# services/ia.py


def _map_tipo(texto: str) -> str:
    """
    Classifica a dica da IA em 'positiva', 'alerta' ou 'neutra' com base em
    palavras-chave e pistas numéricas (%). Regras priorizam segurança:
    - qualquer sinal claro de risco/negativo => 'alerta'
    - sinais claros de bom desempenho => 'positiva'
    - caso ambíguo => 'neutra'
    """

    if not texto:
        return "neutra"

    t = str(texto).lower().strip()

    # --- Palavras-chave base ---
    kw_alerta = {
        "negativo",
        "déficit",
        "deficit",
        "prejuízo",
        "prejuizo",
        "atraso",
        "queda",
        "caiu",
        "despesa subiu",
        "despesas subiram",
        "aumento de despesas",
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

    def has_any(fragmentos: set[str]) -> bool:
        return any(kw in t for kw in fragmentos)

    # Regras curtas muito assertivas
    if "saldo negativo" in t or "margem negativa" in t:
        return "alerta"
    if "saldo positivo" in t or "margem positiva" in t:
        return "positiva"

    # Palavra-chave direta
    if has_any(kw_alerta):
        return "alerta"
    if has_any(kw_positiva):
        return "positiva"
    if has_any(kw_neutra):
        return "neutra"

    # --- Heurísticas com percentual ---
    # capta valores tipo 12%, -3.5 %, 7,2%
    pct_matches = re.findall(r"(-?\d+[.,]?\d*)\s*%", t)

    def to_float(s: str) -> Optional[float]:
        try:
            return float(s.replace(",", "."))
        except Exception:
            return None

    if pct_matches:
        # Usa o primeiro percentual relevante encontrado
        pct = next((to_float(s) for s in pct_matches if to_float(s) is not None), None)

        # janelas de contexto simples (500 chars)
        ctx_len = 500
        t_ctx = t[:ctx_len]

        if pct is not None:
            # Margem alta tende a ser positiva
            if "margem" in t_ctx:
                if pct >= 5:
                    return "positiva"
                elif pct < 0:
                    return "alerta"

            # Receitas e despesas
            receita_ref = ("receita" in t_ctx) or ("fatur" in t_ctx)
            despesa_ref = "despesa" in t_ctx or "cust" in t_ctx

            # Queda / redução de despesas => positivo
            if despesa_ref and any(x in t_ctx for x in ("queda", "redução", "reducao", "diminuiu")):
                if pct <= -3:
                    return "positiva"

            # Aumento forte de despesas => alerta
            if despesa_ref and any(x in t_ctx for x in ("aumento", "subiu", "cresceu")):
                if pct >= 5:
                    return "alerta"

            # Queda de receita => alerta
            if receita_ref and any(
                x in t_ctx for x in ("queda", "caiu", "diminuiu", "redução", "reducao")
            ):
                if pct <= -3:
                    return "alerta"

            # Aumento de receita => positivo
            if receita_ref and any(x in t_ctx for x in ("subiu", "cresceu", "aumentou")):
                if pct >= 3:
                    return "positiva"

    # Fallback seguro
    return "neutra"


def _moeda(v):
    return f"R$ {v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def generate_tip_last_30d(Transacao, usuario=None, auto_save=True):
    """
    Analisa os últimos 30 dias usando o modelo Transacao (campos: valor, data, tipo, [categoria?]).
    Se `usuario` for informado e `auto_save=True`, salva a dica em RecomendacaoIA.
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

    # Top categoria se existir o campo
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

    # Heurísticas -> texto da dica
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

    # Classificar a dica gerada
    tipo = _map_tipo(dica)

    # Salvar automaticamente no histórico da IA (se houver usuário)
    saved_id = None
    if auto_save and usuario is not None:
        with transaction.atomic():
            rec = RecomendacaoIA.objects.create(
                usuario=usuario,
                texto=dica,
                tipo=tipo,
            )
            saved_id = rec.id

    return dica, metrics, saved_id
