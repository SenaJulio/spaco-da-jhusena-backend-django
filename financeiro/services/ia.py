# financeiro/services/ia.py
from datetime import timedelta

from django.db.models import Sum
from django.utils import timezone 
from django.db import transaction
from django.contrib.auth import get_user_model
from financeiro.models import RecomendacaoIA


import re
import unicodedata


def _norm(s: str) -> str:
    # normaliza para comparação robusta: minúsculas e sem acento
    s = s.lower()
    s = unicodedata.normalize("NFD", s)
    s = "".join(ch for ch in s if unicodedata.category(ch) != "Mn")
    return s


def _map_tipo(texto: str) -> str:
    """
    Classifica a dica em 'positiva', 'alerta' ou 'neutra' usando
    palavras-chave + detecção de percentual no texto.
    """
    if not texto:
        return "neutra"

    t = _norm(texto)

    # ALERTA — qualquer ocorrência classifica
    alertas = [
        "alerta",
        "atencao",
        "risco",
        "evite",
        "corte",
        "reduza",
        "atraso",
        "deficit",
        "negativo",
        "queda",
        "abaixo",
        "gasto excessivo",
        "gastos excessivos",
        "estouro de caixa",
        "inadimpl",  # cobre inadimplencia/inadimplente
    ]

    # POSITIVA — qualquer ocorrência classifica
    positivas = [
        "saldo positivo",
        "positivo",
        "otimo",
        "excelente",
        "parabens",
        "superavit",
        "acima da meta",
        "margem",
        "reforce a reserva",
        "aporte extra",
        "continue assim",
        "sobrou",
        "lucro",
    ]

    if any(k in t for k in alertas):
        return "alerta"
    if any(k in t for k in positivas):
        return "positiva"

    # Heurística por percentual no texto (ex.: "12,3%")
    m = re.search(r"(-?\d+[.,]?\d*)\s*%", t)
    if m:
        try:
            val = float(m.group(1).replace(",", "."))
            if val >= 5:  # margem ≥ +5% => positiva
                return "positiva"
            if val <= -1:  # margem ≤ -1% => alerta
                return "alerta"
        except ValueError:
            pass

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
