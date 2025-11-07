import calendar
import json
from collections import Counter
from datetime import date, datetime, timedelta
from decimal import Decimal

from django.core.serializers.json import DjangoJSONEncoder
from django.db.models import CharField, Count, F, Sum, Q
from django.db.models.functions import Cast, TruncMonth
from django.http import JsonResponse
from django.shortcuts import render
from django.urls import include, path
from django.utils.dateparse import parse_date

from .models import Despesa, Receita


# JSON Encoder customizado para converter Decimal em float
class CustomJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super().default(obj)


def custom_json_response(data, **kwargs):
    return JsonResponse(data, encoder=CustomJSONEncoder, **kwargs)


def despesas_repetidas(despesas):
    categorias = [d.tipo for d in despesas]
    mais_comum = Counter(categorias).most_common(1)
    if mais_comum:
        cat, qtd = mais_comum[0]
        return f"Você teve {qtd} despesas com '{cat}'. Avalie se pode agrupar ou renegociar esses gastos."
    return ""


from itertools import chain

from django.db.models import CharField, F, Value
from django.db.models.functions import Cast


def dashboard(request):
    hoje = date.today()
    sete_dias_atras = hoje - timedelta(days=7)

    data_inicio = request.GET.get("data_inicio") or sete_dias_atras.strftime("%Y-%m-%d")
    data_fim = request.GET.get("data_fim") or hoje.strftime("%Y-%m-%d")

    data_inicio_obj = parse_date(data_inicio)
    data_fim_obj = parse_date(data_fim)

    receitas = Receita.objects.filter(data__range=[data_inicio_obj, data_fim_obj])
    despesas = Despesa.objects.filter(data__range=[data_inicio_obj, data_fim_obj])

    # Junta receitas e despesas numa lista única
    movimentos = list(chain(receitas, despesas))

    # Formata valores
    for m in movimentos:
        m.valor_brl = (
            f"R$ {float(m.valor):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
        )

    # Totais
    receitas_total = receitas.aggregate(total=Sum("valor"))["total"] or 0
    despesas_total = despesas.aggregate(total=Sum("valor"))["total"] or 0

    receitas_total_brl = (
        f"R$ {receitas_total:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    )
    despesas_total_brl = (
        f"R$ {despesas_total:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    )

    dados_grafico = {
        "labels": ["Receitas", "Despesas"],
        "valores": [float(receitas_total), float(despesas_total)],
    }

    # 📌 Gera dica inteligente usando função já criada
    dica_ia = sugestoes_economia(despesas)

    # 📤 Prepara mensagem pra WhatsApp/Telegram (integração externa)
    mensagem_envio = (
        f"📊 *Resumo Financeiro* ({data_inicio} a {data_fim})\n"
        f"💰 Receitas: {receitas_total_brl}\n"
        f"💸 Despesas: {despesas_total_brl}\n"
        f"💡 Dica: {dica_ia}"
    )

    # Aqui você chamaria sua função de envio, ex:
    # enviar_whatsapp(mensagem_envio)
    # enviar_telegram(mensagem_envio)

    return render(
        request,
        "financeiro/dashboard.html",
        {
            "movimentos": movimentos,
            "receitas_total": receitas_total_brl,
            "despesas_total": despesas_total_brl,
            "dados_grafico": dados_grafico,
            "data_inicio": data_inicio,
            "data_fim": data_fim,
            "dica_ia": dica_ia,  # também passa pro template
            "dados_grafico": dados_grafico,
        },
    )


def detalhe_transacao(request, id):
    try:
        receita = Receita.objects.get(pk=id)
        return JsonResponse(
            {
                "tipo": receita.servico,
                "valor": float(receita.valor),
                "data": receita.data.strftime("%d/%m/%Y"),
                "descricao": receita.descricao,
            }
        )
    except Receita.DoesNotExist:
        try:
            despesa = Despesa.objects.get(pk=id)
            return JsonResponse(
                {
                    "tipo": despesa.tipo,
                    "valor": float(despesa.valor),
                    "data": despesa.data.strftime("%d/%m/%Y"),
                    "descricao": despesa.descricao,
                },
                encoder=DjangoJSONEncoder,
            )
        except Despesa.DoesNotExist:
            return JsonResponse(
                {"erro": "Transação não encontrada"},
                status=404,
                encoder=DjangoJSONEncoder,
            )


def sugestoes_economia(despesas):
    sugestoes = []

    if not despesas:
        return "Nenhuma despesa registrada no período. Parabéns pelo controle!"

    categorias = {}
    for d in despesas:
        cat = d.tipo
        categorias[cat] = categorias.get(cat, 0) + float(d.valor)

    mais_gasto = max(categorias, key=categorias.get)
    valor_gasto = categorias[mais_gasto]
    dica = f"Sua maior despesa foi com '{mais_gasto}' (R$ {valor_gasto:.2f})."

    if mais_gasto == "Água":
        dica += " Considere revisar o uso de água nos banhos ou usar redutores de vazão."
    elif mais_gasto == "Produtos de limpeza":
        dica += " Talvez comprar em atacado ajude a economizar."
    elif mais_gasto == "Salários":
        dica += " Se for viável, terceirizar parte do serviço pode ajudar."
    else:
        dica += " Avalie se há formas de reduzir ou renegociar custos."

    sugestoes.append(dica)

    dias_categoria = [(d.tipo, d.data.weekday()) for d in despesas]
    contagem = Counter(dias_categoria)
    mais_comum = contagem.most_common(1)

    if mais_comum:
        categoria, dia_semana = mais_comum[0][0]
        dia_nome = calendar.day_name[dia_semana]
        sugestoes.append(
            f"Você costuma gastar com '{categoria}' toda {dia_nome}. Há algo que possa ser otimizado nessa rotina?"
        )

    return " ".join(sugestoes)


def analise_gastos_ia(request):
    hoje = date.today()
    inicio_mes = hoje.replace(day=1)
    fim_mes = (inicio_mes + timedelta(days=32)).replace(day=1) - timedelta(days=1)

    dias_passados = (hoje - inicio_mes).days or 1
    dias_restantes = (fim_mes - hoje).days

    despesas = Despesa.objects.filter(data__range=[inicio_mes, hoje])

    categorias = despesas.values("servico").annotate(total=Sum("valor"), quantidade=Count("id"))

    analise = []
    for c in categorias:
        media_diaria = c["total"] / dias_passados
        projecao_fim_mes = c["total"] + (media_diaria * dias_restantes)

        analise.append(
            {
                "categoria": c["servico"],
                "total": float(c["total"]),
                "media_diaria": round(media_diaria, 2),
                "projecao": round(projecao_fim_mes, 2),
                "quantidade": c["quantidade"],
            }
        )

    return JsonResponse({"analise_categorias": analise}, encoder=DjangoJSONEncoder)


def lista_receitas(request):
    receitas = Receita.objects.all()
    return render(request, "financeiro/receitas.html", {"receitas": receitas})


def lista_despesas(request):
    despesas = Despesa.objects.all()
    return render(request, "financeiro/despesas.html", {"despesas": despesas})


from datetime import date, timedelta
from itertools import chain

from django.db.models import Sum
from django.shortcuts import render
from django.utils.dateparse import parse_date

from .models import Despesa, HistoricoDicas, Receita
from .utils import (  # ou gerar_dica_financeira, dependendo de como está no seu projeto
    sugestoes_economia,
)


def dashboard_financeiro(request):
    hoje = date.today()

    # Captura parâmetros de data da URL
    data_inicio_str = request.GET.get("data_inicio")
    data_fim_str = request.GET.get("data_fim")

    # Define padrão se não houver valores
    if not data_fim_str:
        data_fim = hoje
    else:
        data_fim = parse_date(data_fim_str)

    if not data_inicio_str:
        data_inicio = data_fim - timedelta(days=30)
    else:
        data_inicio = parse_date(data_inicio_str)

    # Corrige se usuário inverter datas
    if data_inicio > data_fim:
        data_inicio, data_fim = data_fim, data_inicio

    # Busca receitas e despesas no período
    receitas = Receita.objects.filter(data__range=[data_inicio, data_fim])
    despesas = Despesa.objects.filter(data__range=[data_inicio, data_fim])

    # Junta movimentos
    movimentos = list(chain(receitas, despesas))

    # Formata valores em BRL
    for m in movimentos:
        m.valor_brl = (
            f"R$ {float(m.valor):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
        )

    # Totais
    receitas_total = receitas.aggregate(total=Sum("valor"))["total"] or 0
    despesas_total = despesas.aggregate(total=Sum("valor"))["total"] or 0
    saldo = receitas_total - despesas_total

    receitas_total_brl = (
        f"R$ {receitas_total:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    )
    despesas_total_brl = (
        f"R$ {despesas_total:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    )
    saldo_brl = f"R$ {saldo:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

    # Dados do gráfico
    dados_grafico = {
        "labels": ["Receitas", "Despesas"],
        "valores": [receitas_total, despesas_total],
    }

    # Gera dica inteligente
    dica_ia = sugestoes_economia(despesas)

    # Mensagem para WhatsApp/Telegram
    mensagem_envio = (
        f"📊 *Resumo Financeiro* ({data_inicio.strftime('%d/%m/%Y')} a {data_fim.strftime('%d/%m/%Y')})\n"
        f"💰 Receitas: {receitas_total_brl}\n"
        f"💸 Despesas: {despesas_total_brl}\n"
        f"💵 Saldo: {saldo_brl}\n"
        f"💡 Dica: {dica_ia}"
    )
    # Aqui você poderia chamar enviar_whatsapp(mensagem_envio) ou enviar_telegram(mensagem_envio)

    # Salva dica no histórico
    categoria_dominante = "Outros"  # Aqui você pode mudar para detectar com base nas despesas
    HistoricoDicas.objects.create(
        data=date.today(), dica=dica_ia, categoria_dominante=categoria_dominante
    )

    # Recupera histórico para exibir
    historico_dicas = HistoricoDicas.objects.all().order_by("-data")


from .models import HistoricoDicas

# dentro de financeiro/views.py

from django.http import JsonResponse
from .models import Transacao
from django.db.models import Count
from django.contrib.auth.decorators import login_required
from django.db.models.functions import TruncDate


@login_required
def categorias_transacao(request):
    """
    Retorna a lista de categorias distintas das transações
    para popular o filtro do gráfico.
    """
    try:
        categorias = (
            Transacao.objects.exclude(categoria__isnull=True)
            .exclude(categoria__exact="")
            .values_list("categoria", flat=True)
            .distinct()
            .order_by("categoria")
        )
        return JsonResponse({"ok": True, "categorias": list(categorias)})
    except Exception as e:
        return JsonResponse({"ok": False, "error": str(e)})

from datetime import date, timedelta
from django.contrib.auth.decorators import login_required
from django.db.models import Sum, Q
from django.db.models.functions import TruncDate
from django.http import JsonResponse
from django.utils.dateparse import parse_date
from django.views.decorators.http import require_GET

from .models import Transacao


@require_GET
@login_required
def dados_grafico_filtrados(request):
    """
    Séries diárias (receitas, despesas, saldo acumulado) + pizza por categoria,
    filtradas entre 'inicio' e 'fim' (YYYY-MM-DD).
    """
    inicio_str = (request.GET.get("inicio") or "").strip()
    fim_str = (request.GET.get("fim") or "").strip()

    hoje = date.today()
    inicio = parse_date(inicio_str) or (hoje - timedelta(days=30))
    fim = parse_date(fim_str) or hoje

    # Janela inclusiva [inicio, fim]
    base_qs = Transacao.objects.filter(data__range=[inicio, fim])
    data_field = "data"

    # Se não houver por 'data', tenta 'created_at'
    if not base_qs.exists() and hasattr(Transacao, "created_at"):
        base_qs = Transacao.objects.filter(created_at__date__range=[inicio, fim])
        data_field = "created_at"

    # Agrega por dia
    qs = base_qs.annotate(dia=TruncDate(data_field))
    agg = (
        qs.values("dia")
        .annotate(
            receitas=Sum("valor", filter=Q(tipo="receita")),
            despesas=Sum("valor", filter=Q(tipo="despesa")),
        )
        .order_by("dia")
    )

    dias, receitas, despesas, saldo = [], [], [], []
    acc = 0.0
    for a in agg:
        r = float(a["receitas"] or 0)
        d = float(a["despesas"] or 0)
        acc += r - d
        dias.append(a["dia"].strftime("%d/%m"))
        receitas.append(r)
        despesas.append(d)
        saldo.append(acc)

    # Pizza por categoria
    cat_qs = base_qs.values("categoria").annotate(total=Sum("valor")).order_by("-total")
    categorias = [(c["categoria"] or "Sem categoria") for c in cat_qs]
    valores = [float(c["total"] or 0) for c in cat_qs]

    # --- resumo da janela atual ---
    janela_total_receitas = base_qs.filter(tipo="receita").aggregate(v=Sum("valor"))["v"] or 0
    janela_total_despesas = base_qs.filter(tipo="despesa").aggregate(v=Sum("valor"))["v"] or 0
    resumo_janela = {
        "label": f"{inicio.strftime('%d/%m/%Y')}–{fim.strftime('%d/%m/%Y')}",
        "total_receitas": float(janela_total_receitas),
        "total_despesas": float(janela_total_despesas),
        "saldo": float(janela_total_receitas - janela_total_despesas),
    }

    # --- mês corrente (opcional) ---
    inicio_mes = hoje.replace(day=1)
    mes_qs = Transacao.objects.filter(data__range=[inicio_mes, hoje])
    mes_total_receitas = mes_qs.filter(tipo="receita").aggregate(v=Sum("valor"))["v"] or 0
    mes_total_despesas = mes_qs.filter(tipo="despesa").aggregate(v=Sum("valor"))["v"] or 0
    resumo_mes_corrente = {
        "mes_label": hoje.strftime("%b/%Y"),
        "total_receitas": float(mes_total_receitas),
        "total_despesas": float(mes_total_despesas),
        "saldo": float(mes_total_receitas - mes_total_despesas),
    }

    # ⚠️ marcador de versão para ter CERTEZA que pegamos a view certa
    debug_sig = "dados_grafico_filtrados:v2"

    return JsonResponse(
        {
            "ok": True,
            "inicio": str(inicio),
            "fim": str(fim),
            "dias": dias,
            "receitas": receitas,
            "despesas": despesas,
            "saldo": saldo,
            "categorias": categorias,
            "valores": valores,
            "resumo_janela": resumo_janela,
            "resumo_mes_corrente": resumo_mes_corrente,
            "debug": debug_sig,
        }
    )
