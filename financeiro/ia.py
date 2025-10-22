# financeiro/ia.py
from datetime import timedelta
from decimal import Decimal

from django.db.models import Sum
from django.utils import timezone

from .models import Despesa, Receita


def compute_metrics(data_inicio, data_fim):
    # Totais do período
    receitas_qs = Receita.objects.filter(data__range=(data_inicio, data_fim))
    despesas_qs = Despesa.objects.filter(data__range=(data_inicio, data_fim))

    total_receitas = receitas_qs.aggregate(total=Sum("valor"))["total"] or Decimal("0")
    total_despesas = despesas_qs.aggregate(total=Sum("valor"))["total"] or Decimal("0")
    margem = total_receitas - total_despesas

    # Categorias dominantes
    by_cat = despesas_qs.values("tipo").annotate(total=Sum("valor")).order_by("-total")
    categoria_top = by_cat[0]["tipo"] if by_cat else "Outros"

    # Variação vs período anterior de mesmo tamanho
    delta = data_fim - data_inicio
    prev_start = data_inicio - delta - timedelta(days=1)
    prev_end = data_inicio - timedelta(days=1)
    prev_receitas = Receita.objects.filter(data__range=(prev_start, prev_end)).aggregate(
        total=Sum("valor")
    )["total"] or Decimal("0")
    prev_despesas = Despesa.objects.filter(data__range=(prev_start, prev_end)).aggregate(
        total=Sum("valor")
    )["total"] or Decimal("0")
    prev_margem = prev_receitas - prev_despesas
    crescimento_receita = (
        float(((total_receitas - prev_receitas) / prev_receitas) * 100) if prev_receitas else None
    )
    crescimento_margem = (
        float(((margem - prev_margem) / prev_margem) * 100) if prev_margem else None
    )

    return {
        "total_receitas": float(total_receitas),
        "total_despesas": float(total_despesas),
        "margem": float(margem),
        "categoria_top": categoria_top,
        "crescimento_receita_pct": crescimento_receita,
        "crescimento_margem_pct": crescimento_margem,
        "periodo": {"inicio": str(data_inicio), "fim": str(data_fim)},
        "comparacao_anterior": {"inicio": str(prev_start), "fim": str(prev_end)},
    }


def rule_engine(metrics):
    r = Decimal(str(metrics["total_receitas"]))
    d = Decimal(str(metrics["total_despesas"]))
    margem = Decimal(str(metrics["margem"]))
    cat = metrics["categoria_top"]
    crec = metrics["crescimento_receita_pct"]
    cmarg = metrics["crescimento_margem_pct"]

    textos = []
    categoria = "Geral"
    score = Decimal("60")

    # Regras simples e explicáveis
    if r == 0 and d == 0:
        textos.append(
            "Sem movimento no período: cadastre receitas e despesas para ativar a análise."
        )
        categoria = "Dados"
        score = Decimal("40")
    elif margem > 0:
        textos.append("🎉 Ótimo trabalho! Sua margem está positiva neste período.")
        categoria = "Desempenho"
        score = Decimal("75")
    else:
        textos.append(
            "⚠️ Margem negativa. Reveja custos e ajuste preços de serviços mais demandados."
        )
        categoria = "Corte de Custos"
        score = Decimal("70")

    # Foco na categoria dominante de despesa
    if cat and cat != "Outros":
        textos.append(
            f"Categoria de despesa dominante: **{cat}**. Vale auditar lançamentos e negociar fornecedores."
        )

    # Tendências
    if crec is not None:
        if crec > 10:
            textos.append(
                f"Receitas cresceram {crec:.1f}% vs período anterior. Aproveite a tendência e faça campanhas de fidelização."
            )
        elif crec < -10:
            textos.append(
                f"Receitas caíram {abs(crec):.1f}% vs período anterior. Reforce divulgação dos serviços com melhor margem."
            )

    if cmarg is not None and cmarg < -10:
        textos.append(
            "Margem piorou em relação ao período anterior. Revise preços de banho/tosa e combos."
        )

    texto_final = " ".join(textos)
    return {"texto": texto_final, "categoria": categoria, "score": float(score)}
