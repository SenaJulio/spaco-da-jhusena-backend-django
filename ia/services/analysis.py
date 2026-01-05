# ia/services/analysis.py
from __future__ import annotations
from dataclasses import dataclass, asdict
from datetime import timedelta
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
    if not b:
        return 0.0
    return round(((a - b) / b) * 100.0, 1)


def _to_float(x) -> float:
    try:
        return float(x or 0)
    except:
        return 0.0


def analisar_transacoes_30d(TransacaoModel, user) -> Analise30D:
    tz = timezone.get_current_timezone()
    fim = timezone.now().astimezone(tz)
    inicio = fim - timedelta(days=30)

    qs = TransacaoModel.objects.filter(data__gte=inicio, data__lte=fim)
    rec = _to_float(qs.filter(tipo="receita").aggregate(v=Sum("valor"))["v"])
    des = _to_float(qs.filter(tipo="despesa").aggregate(v=Sum("valor"))["v"])
    saldo = rec - des
    margem = round((saldo / rec) * 100.0, 1) if rec > 0 else 0.0

    # período anterior (comparação)
    prev_ini = inicio - timedelta(days=30)
    prev_fim = inicio
    qs_prev = TransacaoModel.objects.filter(data__gte=prev_ini, data__lte=prev_fim)
    rec_prev = _to_float(qs_prev.filter(tipo="receita").aggregate(v=Sum("valor"))["v"])
    des_prev = _to_float(qs_prev.filter(tipo="despesa").aggregate(v=Sum("valor"))["v"])

    var_rec = _pct(rec, rec_prev)
    var_des = _pct(des, des_prev)
     
     # Explicação humana (IA explicável)
    motivos = []

    if saldo > 0:
                motivos.append("saldo positivo")

    if var_des is not None and var_des < 0:
                motivos.append(f"despesas caíram {abs(round(var_des, 1))}%")

    if var_rec is not None and var_rec > 0:
                motivos.append(f"receitas subiram {round(var_rec, 1)}%")

    if margem >= 15:
                motivos.append(f"margem saudável ({margem}%)")

    explicacao = " | ".join(motivos) if motivos else "Análise baseada no comportamento financeiro recente."

    if saldo <= 0 or margem < 0:
                    plano = "Corte 10-15% de despesas variáveis nesta semana e adie compras não essenciais."
                    tipo = "alerta"

    elif margem < 15:
                    plano = "Mantenha despesas sob controle e direcione 5% das receitas para a reserva."
                    tipo = "neutra"

    else:
        # margem ok (>=15) OU despesas caindo já conta como cenário positivo
        if var_des is not None and var_des < 0:
            plano = "Ótimo! Despesas caíram. Reforce a reserva e mantenha o controle dos custos."
            tipo = "positiva"
        elif margem >= 20:
            plano = "Reforce a reserva e avalie aporte extra (1-2%) no Tesouro Selic."
            tipo = "positiva"
        else:
            plano = "Boa evolução. Mantenha o controle e busque elevar a margem aos poucos."
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
        explicacao=explicacao,

    )


def analisar_30d_dict(TransacaoModel, user) -> dict:
    return asdict(analisar_transacoes_30d(TransacaoModel, user))
