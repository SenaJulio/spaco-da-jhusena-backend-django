# ia/services/analysis.py
from __future__ import annotations
from dataclasses import dataclass, asdict
from datetime import date, timedelta
from decimal import Decimal
from django.db.models import Sum
from django.utils import timezone


@dataclass
class Analise30D:
    inicio: str
    fim: str
    receitas: float
    despesas: float
    saldo: float
    margem_pct: float
    variacao_receitas_pct: float
    variacao_despesas_pct: float
    plano_acao: str
    tipo: str  # "positiva" | "alerta" | "neutra"
    explicacao: str = ""


def _pct(a: float, b: float) -> float:
    if b == 0:
        return 0.0
    return round(((a - b) / b) * 100.0, 1)


def _as_float(x) -> float:
    if x is None:
        return 0.0
    try:
        return float(x)
    except:
        return 0.0


def analisar_transacoes_30d(TransacaoModel, user) -> Analise30D:
    tz = timezone.get_current_timezone()
    fim = timezone.now().astimezone(tz)
    inicio = fim - timedelta(days=30)

    qs = TransacaoModel.objects.filter(usuario=user, data__gte=inicio, data__lte=fim)
    rec = _as_float(qs.filter(tipo="receita").aggregate(v=Sum("valor"))["v"])
    des = _as_float(qs.filter(tipo="despesa").aggregate(v=Sum("valor"))["v"])
    saldo = rec - des
    margem = round((saldo / rec) * 100.0, 1) if rec > 0 else 0.0

    # período anterior (comparação)
    prev_ini = inicio - timedelta(days=30)
    prev_fim = inicio
    qs_prev = TransacaoModel.objects.filter(usuario=user, data__gte=prev_ini, data__lte=prev_fim)
    rec_prev = _as_float(qs_prev.filter(tipo="receita").aggregate(v=Sum("valor"))["v"])
    des_prev = _as_float(qs_prev.filter(tipo="despesa").aggregate(v=Sum("valor"))["v"])

    var_rec = _pct(rec, rec_prev)
    var_des = _pct(des, des_prev)

    # plano de ação simples
    if saldo <= 0 or margem < 0:
        plano = "Corte 10–15% de despesas variáveis nesta semana e adie compras não essenciais."
        tipo = "alerta"
    elif margem < 20:
        plano = "Mantenha despesas sob controle e direcione 5% das receitas para a reserva."
        tipo = "neutra"
    else:
        plano = "Reforce a reserva e avalie aporte extra (1–2%) no Tesouro Selic."
        tipo = "positiva"

    return Analise30D(
        inicio=inicio.date().isoformat(),
        fim=fim.date().isoformat(),
        receitas=round(rec, 2),
        despesas=round(des, 2),
        saldo=round(saldo, 2),
        margem_pct=margem,
        variacao_receitas_pct=var_rec,
        variacao_despesas_pct=var_des,
        plano_acao=plano,
        tipo=tipo,
        explicacao="",
    )


def analisar_30d_dict(TransacaoModel, user) -> dict:
    return asdict(analisar_transacoes_30d(TransacaoModel, user))


def classificar_margem(margem_pct: float) -> str:
    if margem_pct >= 15.0:
        return "positiva"
    if margem_pct <= 0 or margem_pct < 5.0:
        return "alerta"
    return "neutra"
