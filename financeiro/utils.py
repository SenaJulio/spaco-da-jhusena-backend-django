from collections import defaultdict
from datetime import date
from decimal import Decimal

from .models import RecomendacaoIA as HistoricoIA  # alias compatível

# Helper para pegar atributo com nomes diferentes (categoria|tipo, valor|amount...)
def _attr(obj, *names):
    for n in names:
        if hasattr(obj, n):
            return getattr(obj, n)
    return None


def obter_categoria_dominante(items):
    """
    Aceita lista/QuerySet de despesas com .categoria OU .tipo e .valor.
    Retorna (nome_da_categoria, total_em_float)
    """
    if not items:
        return "Outros", 0.0

    soma_por_cat = defaultdict(float)
    for it in items:
        cat = _attr(it, "categoria", "tipo") or "Outros"
        val = _attr(it, "valor", "amount", "value") or 0
        try:
            soma_por_cat[str(cat)] += float(val)
        except Exception:
            pass

    if not soma_por_cat:
        return "Outros", 0.0

    cat, total = max(soma_por_cat.items(), key=lambda kv: kv[1])
    return cat, total


def gerar_dica_ia(receitas, despesas):
    """
    Mantém a sua regra antiga (cores e mensagens), mas já retorna também
    categoria 'lógica' e score para salvar no modelo novo.
    """
    total_receitas = sum(float(_attr(r, "valor") or 0) for r in (receitas or []))
    total_despesas = sum(float(_attr(d, "valor") or 0) for d in (despesas or []))
    saldo = total_receitas - total_despesas
    categoria_top, total_cat = obter_categoria_dominante(despesas or [])

    metrics = {
        "total_receitas": total_receitas,
        "total_despesas": total_despesas,
        "saldo": saldo,
        "categoria_dominante": categoria_top,
    }

    # Casos
    if total_receitas == 0 and total_despesas == 0:
        return {
            "texto": "Comece a registrar receitas e despesas para ver insights aqui 😉",
            "cor": "gray",
            "categoria": "Dados",
            "score": 40,
            "metrics": metrics,
        }

    if saldo > 300:
        return {
            "texto": "🎉 Ótimo trabalho! Seu negócio está com boa margem de lucro neste mês.",
            "cor": "green",
            "categoria": "Desempenho",
            "score": 75,
            "metrics": metrics,
        }

    if saldo > 0:
        msg = (
            f"👍 Você está no azul, mas fique de olho nas despesas com {categoria_top}, que estão crescendo."
            if total_cat > 0
            else "👍 Você está no azul, mas fique de olho nas despesas que estão subindo."
        )
        return {
            "texto": msg,
            "cor": "blue",
            "categoria": "Atenção",
            "score": 65,
            "metrics": metrics,
        }

    if saldo == 0:
        return {
            "texto": "🟡 Você empatou neste mês. Que tal revisar os custos fixos e tentar uma promoção?",
            "cor": "gold",
            "categoria": "Neutro",
            "score": 55,
            "metrics": metrics,
        }

    # saldo < 0
    msg = (
        f"🚨 Cuidado! Você está no vermelho e {categoria_top} está consumindo muito. Reveja essa categoria!"
        if total_cat > 0
        else "🚨 Cuidado! Você está gastando mais do que ganha. Reveja suas despesas com atenção!"
    )
    return {
        "texto": msg,
        "cor": "red",
        "categoria": "Corte de Custos",
        "score": 70,
        "metrics": metrics,
    }


def _inferir_periodo(receitas, despesas):
    """
    Tenta deduzir o período pelo atributo .data/.date dos itens; se não houver,
    usa (primeiro dia do mês atual, hoje).
    """
    datas = []
    for it in receitas or []:
        d = _attr(it, "data", "date")
        if d:
            datas.append(d)
    for it in despesas or []:
        d = _attr(it, "data", "date")
        if d:
            datas.append(d)

    if datas:
        return min(datas), max(datas)

    today = date.today()
    return today.replace(day=1), today


def processar_dica_e_salvar(receitas, despesas, source="manual"):
    """
    Gera a dica (lógica antiga), e salva no modelo novo (HistoricoIA/RecomendacaoIA)
    com os campos corretos: texto/categoria/score/metrics/period_start/end.
    """
    dica = gerar_dica_ia(receitas, despesas)  # dict
    period_start, period_end = _inferir_periodo(receitas, despesas)

    rec = HistoricoIA(
        period_start=period_start,
        period_end=period_end,
        texto=dica["texto"],
        categoria=dica["categoria"],
        score=dica["score"],
        metrics=dica["metrics"],
        source=source,
        generated_by="rule_engine_legacy",
    )
    rec.save()
    return dica  # se quiser, retorne também rec.id

# --- utils de período e conversão (usados em views_insights.py) ---
from datetime import date
from django.utils.dateparse import parse_date


def _normalize_period(request):
    """
    Lê ?inicio=YYYY-MM-DD e ?fim=YYYY-MM-DD do request.
    Se não vierem, usa 1º dia do mês atual até hoje.
    Retorna (di, df) como objetos date.
    """
    hoje = date.today()
    di_str = request.GET.get("inicio")
    df_str = request.GET.get("fim")

    di = parse_date(di_str) if di_str else hoje.replace(day=1)
    df = parse_date(df_str) if df_str else hoje

    # Fallbacks seguros se parse falhar
    if di is None:
        di = hoje.replace(day=1)
    if df is None:
        df = hoje

    return di, df


def _to_float(x):
    try:
        return float(x)
    except Exception:
        return 0.0
