# financeiro/services/ia_analise_30d.py
"""
Módulo local do app 'financeiro' para lógica de IA.
Observação:
- O preview oficial do painel usa ia.services.analysis.analisar_30d_dict(Transacao, user).
- Este arquivo fornece utilitários opcionais. Evitamos duplicar a lógica do preview.
"""

from datetime import date, timedelta
from decimal import Decimal

from django.utils import timezone

from financeiro.models import Transacao, RecomendacaoIA


def gerar_analise_30d_dict(usuario):
    """
    Analisa as transações dos últimos 30 dias e retorna um dicionário (sem salvar).
    """
    hoje = date.today()
    inicio = hoje - timedelta(days=30)

    qs = Transacao.objects.filter(data__range=(inicio, hoje))
    total_r = Decimal(sum(Decimal(t.valor) for t in qs.filter(tipo="receita")))
    total_d = Decimal(sum(Decimal(t.valor) for t in qs.filter(tipo="despesa")))
    saldo = total_r - total_d

    margem = (saldo / total_r * 100) if total_r else Decimal("0")
    tipo = "positiva" if saldo > 0 else ("alerta" if saldo < 0 else "neutra")

    if tipo == "positiva":
        plano = f"Ótimo! Saldo POSITIVO de R$ {saldo:.2f}. Reforce a reserva e avalie aporte extra."
    elif tipo == "alerta":
        plano = f"Atenção: Saldo negativo de R$ {saldo:.2f}. Revise despesas e segure saques."
    else:
        plano = "Saldo neutro. Mantenha consistência e busque novas fontes de receita."

    return {
        "inicio": inicio.isoformat(),
        "fim": hoje.isoformat(),
        "receitas": float(total_r),
        "despesas": float(total_d),
        "saldo": float(saldo),
        "margem_pct": float(round(margem, 1)),
        "plano_acao": plano,
        "tipo": tipo,
    }


def gerar_analise_30d_e_salvar(usuario):
    """
    Gera análise + salva no histórico (RecomendacaoIA). Útil para jobs manuais.
    """
    data = gerar_analise_30d_dict(usuario)
    rec = RecomendacaoIA.objects.create(
        usuario=usuario,
        texto=data.get("plano_acao") or "",
        tipo=data.get("tipo") or "neutra",
    )
    return {
        "ok": True,
        "analise": data,
        "historico_id": rec.id,
        "created_at": timezone.now().isoformat(),
    }
