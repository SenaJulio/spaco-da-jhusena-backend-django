# estoque/services_ia.py
from datetime import timedelta

from django.utils import timezone

from estoque.models import LoteProduto

from decimal import Decimal

from django.db.models import Sum, Case, When, F, DecimalField

from estoque.models import Produto
from financeiro.services.ia import salvar_recomendacao_ia


def _annotate_saldo(queryset):
    """
    Anota o saldo de estoque (entradas - saídas) no queryset de Produto.
    """
    return queryset.annotate(
        saldo_calc=Sum(
            Case(
                When(movimentos__tipo="E", then=F("movimentos__quantidade")),
                When(movimentos__tipo="S", then=-F("movimentos__quantidade")),
                default=0,
                output_field=DecimalField(),
            )
        )
    )


def gerar_alertas_estoque_baixo(usuario, limite_padrao=3):
    """
    Gera recomendações de ALERTA na IA para produtos com estoque baixo.

    - Só considera produtos: controla_estoque=True e ativo=True
    - Se saldo <= 0  → alerta CRÍTICO
    - Se 0 < saldo <= limite_padrao → alerta de ESTOQUE BAIXO
    - Cada produto gera 1 texto de alerta na RecomendacaoIA via salvar_recomendacao_ia().
    """
    if not usuario or not getattr(usuario, "is_authenticated", False):
        return []

    qs = Produto.objects.filter(controla_estoque=True, ativo=True)
    qs = _annotate_saldo(qs)

    criados = []

    for produto in qs:
        saldo = produto.saldo_calc or Decimal("0")

        # nada de alerta se saldo está tranquilo
        if saldo > limite_padrao:
            continue

        if saldo <= 0:
            nivel = "CRÍTICO"
            msg_extra = "Risco de perda de venda. Priorize a reposição imediatamente."
        else:
            nivel = "BAIXO"
            msg_extra = "Programe a reposição desse item antes que falte."

        texto = (
            f"ALERTA de estoque {nivel}: o produto '{produto.nome}' está com saldo de "
            f"{saldo} unidade(s). {msg_extra}"
        )

        rec = salvar_recomendacao_ia(
            usuario=usuario,
            texto=texto,
            tipo_ia="alerta",  # 👈 vai virar 'Alerta' no admin e 'alerta' no histórico
        )

        criados.append(
            {
                "produto": produto.nome,
                "saldo": float(saldo),
                "nivel": nivel,
                "recomendacao_id": rec.id,
            }
        )

    return criados


def gerar_alertas_validade_lotes(user, dias_aviso: int = 15) -> int:
    """
    Varre os lotes com validade próxima / vencida e gera alertas na RecomendacaoIA.
    Retorna quantos alertas foram criados.
    """
    hoje = timezone.localdate()
    limite = hoje + timedelta(days=dias_aviso)

    lotes = LoteProduto.objects.select_related("produto").order_by("validade", "criado_em")

    total_gerados = 0

    for lote in lotes:
        if not lote.validade:
            continue

        saldo = lote.saldo_atual
        if saldo <= 0:
            continue

        val = lote.validade

        # já vencido
        if val < hoje:
            dias = (hoje - val).days
            texto = (
                f"ALERTA de validade: o produto '{lote.produto.nome}' "
                f"(lote '{lote.codigo or 'sem código'}') está VENCIDO há {dias} dia(s) "
                f"(validade {val:%d/%m/%Y}) e ainda há {saldo} unidade(s) em estoque."
            )
            salvar_recomendacao_ia(user, texto, tipo_ia="alerta")
            total_gerados += 1
            continue

        # dentro da janela de aviso (ex.: 15 dias)
        if hoje <= val <= limite:
            dias = (val - hoje).days
            texto = (
                f"Lote perto de vencer: o produto '{lote.produto.nome}' "
                f"(lote '{lote.codigo or 'sem código'}') vence em {dias} dia(s) "
                f"(validade {val:%d/%m/%Y}) com {saldo} unidade(s) em estoque."
            )
            salvar_recomendacao_ia(user, texto, tipo_ia="alerta")
            total_gerados += 1

    return total_gerados
