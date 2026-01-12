import logging
from datetime import timedelta
from django.utils import timezone
from django.db.models import Sum
from django.apps import apps


logger = logging.getLogger(__name__)

# ============================================================
# FUNÇÕES AUXILIARES
# ============================================================


def _format_brl(value):
    """Formata número em BRL no padrão Spaço da Jhuséna."""
    try:
        val = float(value or 0)
        return f"R$ {val:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    except Exception:
        return "R$ 0,00"


def _get_periodo_semana():
    """
    Retorna início e fim da semana atual.
    Semana = segunda → domingo.
    """
    hoje = timezone.localdate()
    inicio = hoje - timedelta(days=hoje.weekday())  # Monday
    fim = inicio + timedelta(days=6)
    return inicio, fim


# ============================================================
# ANÁLISE DA SEMANA — RESUMO PRINCIPAL
# ============================================================
Transacao = apps.get_model("financeiro", "Transacao")


def analisar_financas_semana(user):
    """
    Retorna um dicionário com:
      inicio, fim, receitas, despesas, saldo, margem
    """
    inicio, fim = _get_periodo_semana()

    # FIX ✔: campo data é DateField → usar data__gte e data__lte
    qs = Transacao.objects.filter(data__gte=inicio, data__lte=fim)

    # Receitas = tipos: receita / R
    receitas = float(qs.filter(tipo__in=["receita", "R"]).aggregate(soma=Sum("valor"))["soma"] or 0)

    # Despesas = tipos: despesa / D
    despesas = float(qs.filter(tipo__in=["despesa", "D"]).aggregate(soma=Sum("valor"))["soma"] or 0)

    saldo = receitas - despesas
    margem = (saldo / receitas * 100) if receitas > 0 else 0

    return {
        "inicio": str(inicio),
        "fim": str(fim),
        "receitas": receitas,
        "despesas": despesas,
        "saldo": saldo,
        "margem": margem,
    }


# ============================================================
# DETECTAR ALERTAS INTELIGENTES
# ============================================================


def detectar_alertas_semana(metrics):
    """
    Gera alertas automáticos com base no comportamento da semana.
    """
    alertas = []

    receitas = metrics["receitas"]
    despesas = metrics["despesas"]
    saldo = metrics["saldo"]
    margem = metrics["margem"]

    # 1) saldo NEGATIVO
    if saldo < 0:
        alertas.append("Saldo NEGATIVO nesta semana. Atenção redobrada no caixa.")

    # 2) despesas consumindo quase tudo
    if receitas > 0:
        consumo = despesas / receitas
        if consumo >= 0.90:
            alertas.append("Despesas consumiram mais de 90% das receitas. Risco alto.")

    # 3) margem fraca
    if receitas > 0 and margem < 10:
        alertas.append(f"Margem muito baixa ({margem:.1f}%). Reveja os principais gastos.")

    return alertas


# ============================================================
# MENSAGEM FINAL — TEXTO PARA TELEGRAM
# ============================================================


def montar_mensagem_final(user):
    """
    Monta o texto final que será enviado via Telegram.
    """
    metrics = analisar_financas_semana(user)
    alertas = detectar_alertas_semana(metrics)

    receitas_brl = _format_brl(metrics["receitas"])
    despesas_brl = _format_brl(metrics["despesas"])
    saldo_brl = _format_brl(metrics["saldo"])

    msg = []

    msg.append("📊 *Resumo da Semana — Spaço da Jhuséna*")
    msg.append(f"Período: {metrics['inicio']} → {metrics['fim']}\n")

    msg.append(f"💰 *Receitas:* {receitas_brl}")
    msg.append(f"💸 *Despesas:* {despesas_brl}")
    msg.append(f"💵 *Saldo:* {saldo_brl}")
    msg.append(f"📈 *Margem:* {metrics['margem']:.1f}%\n")

    # ---------------- ALERTAS ----------------
    if alertas:
        msg.append("⚠️ *Alertas Detectados:*")
        for a in alertas:
            msg.append(f"• {a}")
    else:
        msg.append("✅ Nenhum alerta detectado. Semana saudável!")

    # ---------------- RECOMENDAÇÕES ----------------
    if metrics["saldo"] > 0:
        msg.append("\n💡 Sugestão: Considere um pequeno aporte no Tesouro Selic.")
    else:
        msg.append("\n💡 Sugestão: Corte 5–10% das maiores despesas para recuperar o caixa.")

    msg.append("\n_Spaço da Jhuséna — Inteligência Financeira 🐾_")

    texto_final = "\n".join(msg)

    logger.debug(f"[NOTIF MSG] Mensagem montada: \n{texto_final}")

    return texto_final
