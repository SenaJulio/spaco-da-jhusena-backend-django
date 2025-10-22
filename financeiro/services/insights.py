# financeiro/services/insights.py
from collections import Counter
from datetime import date, timedelta

from django.db.models import Sum

from ..models import (  # ajuste o import se seus modelos estiverem em outro arquivo
    Despesa,
    Insight,
    Receita,
)


def generate_simple_insight():
    """
    Gera 1 Insight básico olhando os últimos 30 dias.
    Regras simples:
      - Se saldo < 0 => ALERT
      - Se saldo >= 0 => TIP
      - Mostra categoria de despesa mais frequente, se houver
    Retorna o objeto Insight criado.
    """
    hoje = date.today()
    inicio = hoje - timedelta(days=30)

    total_receitas = (
        Receita.objects.filter(data__gte=inicio, data__lte=hoje).aggregate(total=Sum("valor"))[
            "total"
        ]
    ) or 0
    total_despesas = (
        Despesa.objects.filter(data__gte=inicio, data__lte=hoje).aggregate(total=Sum("valor"))[
            "total"
        ]
    ) or 0
    saldo = float(total_receitas) - float(total_despesas)

    # Categoria dominante de despesas no período
    categorias = list(
        Despesa.objects.filter(data__gte=inicio, data__lte=hoje).values_list("categoria", flat=True)
    )

    categoria_dominante = None
    if categorias:
        categoria_dominante = Counter(categorias).most_common(1)[0][0]

    if saldo < 0:
        kind = "ALERT"
        title = "🚨 Caixa negativo nos últimos 30 dias"
        text = (
            f"Despesas (R$ {total_despesas:,.2f}) maiores que receitas (R$ {total_receitas:,.2f}). "
            "Corte 10–15% nas maiores categorias e avalie reajuste de preço/divulgação."
        )
    else:
        kind = "TIP"
        title = "🎉 Saldo positivo nos últimos 30 dias"
        text = (
            f"Receitas (R$ {total_receitas:,.2f}) maiores que despesas (R$ {total_despesas:,.2f}). "
            "Separe 5–10% da receita para reserva e mantenha o controle de gastos."
        )

    ins = Insight.objects.create(
        title=title,
        text=text,
        kind=kind,
        category_dominante=categoria_dominante,
        generated_by="manual",
    )
    return ins
