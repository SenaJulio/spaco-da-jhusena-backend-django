from collections import Counter
from datetime import date, timedelta
from django.db.models import Sum
from ..models import Transacao, Insight


def generate_simple_insight():
    """
    Gera 1 Insight básico olhando os últimos 30 dias usando Transacao(tipo, valor, data, descricao).
    - saldo < 0 => ALERT
    - saldo >= 0 => TIP
    - Mostra a 'categoria_dominante' de forma compatível (usa a descrição mais frequente das DESPESAS).
    Retorna o objeto Insight criado.
    """
    hoje = date.today()
    inicio = hoje - timedelta(days=30)

    # Filtrar por tipo corretamente
    receitas_qs = Transacao.objects.filter(tipo="receita", data__gte=inicio, data__lte=hoje)
    despesas_qs = Transacao.objects.filter(tipo="despesa", data__gte=inicio, data__lte=hoje)

    total_receitas = receitas_qs.aggregate(total=Sum("valor"))["total"] or 0
    total_despesas = despesas_qs.aggregate(total=Sum("valor"))["total"] or 0
    saldo = float(total_receitas) - float(total_despesas)

    # "Categoria" dominante compatível: usa descricao das DESPESAS mais frequente
    descricoes = list(despesas_qs.values_list("descricao", flat=True))
    categoria_dominante = None
    if descricoes:
        categoria_dominante = Counter(descricoes).most_common(1)[0][0] or None

    if saldo < 0:
        kind = "ALERT"
        title = "🚨 Caixa negativo nos últimos 30 dias"
        text = (
            f"Despesas (R$ {float(total_despesas):,.2f}) maiores que receitas "
            f"(R$ {float(total_receitas):,.2f}). "
            "Corte 10–15% nos itens que mais pesam e avalie reajuste/divulgação."
        )
    else:
        kind = "TIP"
        title = "🎉 Saldo positivo nos últimos 30 dias"
        text = (
            f"Receitas (R$ {float(total_receitas):,.2f}) maiores que despesas "
            f"(R$ {float(total_despesas):,.2f}). "
            "Reserve 5–10% da receita e mantenha o controle de gastos."
        )

    ins = Insight.objects.create(
        title=title,
        text=text,
        kind=kind,
        category_dominante=categoria_dominante,  # campo opcional; ignore se seu modelo não tiver
        generated_by="manual",
    )
    return ins
