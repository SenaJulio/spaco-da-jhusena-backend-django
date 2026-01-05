# financeiro/ia_engine.py
# -------------------------------------------------------------------
# Motor simples de IA para análise financeira mensal do Spaço da Jhuséna
# -------------------------------------------------------------------
from __future__ import annotations

from dataclasses import dataclass
from typing import List, Dict, Literal, Optional
import random


TipoAnalise = Literal["positiva", "alerta", "neutra"]


@dataclass
class MesResumo:
    ano: int
    mes: int
    label: str
    total_receitas: float
    total_despesas: float
    saldo: float

    @property
    def margem(self) -> float:
        """
        Margem = saldo / receitas, em %.
        Se não tiver receita, margem = 0.
        """
        if self.total_receitas <= 0:
            return 0.0
        return (self.saldo / self.total_receitas) * 100.0


# -------------------------------------------------------------------
# Textos-base (templates) da IA
# -------------------------------------------------------------------

TEXTOS_POSITIVOS = [
    "Excelente! Saldo POSITIVO de {saldo}, com margem de {margem:.1f}%. Continue reforçando reserva e evitando gastos desnecessários.",
    "Muito bom! Você fechou {mes_label} no azul, com saldo de {saldo} e margem de {margem:.1f}%. Mantenha esse padrão saudável.",
    "Parabéns! O mês de {mes_label} terminou com saldo positivo de {saldo}. Ótimo sinal de controle financeiro.",
]

TEXTOS_ALERTA = [
    "Atenção: o saldo de {saldo} em {mes_label} exige cuidado. Reveja despesas variáveis e considere reduzir pequenos excessos.",
    "Alerta ligado: as despesas pressionaram o caixa em {mes_label}. Vale olhar categorias que mais cresceram e cortar o que não for essencial.",
    "O mês de {mes_label} ficou no limite. Controle mais de perto as despesas e priorize o que é realmente necessário.",
]

TEXTOS_NEUTROS = [
    "{mes_label} fechou em leve equilíbrio. Não é ruim, mas há espaço para melhorar o saldo positivo nos próximos meses.",
    "Mês relativamente neutro: saldo próximo de zero em {mes_label}. Pequenos ajustes já podem gerar um resultado melhor.",
    "Resultado estável em {mes_label}. Um pouco mais de organização nas despesas pode levar o saldo para o campo positivo.",
]


TEXTOS_TENDENCIA = [
    "Na comparação com o mês anterior, o saldo variou em {variacao_saldo_pct:+.1f}%.",
    "O saldo teve variação de {variacao_saldo_pct:+.1f}% frente ao mês anterior.",
    "Em relação ao mês anterior, o saldo mudou {variacao_saldo_pct:+.1f}%.",
]

TEXTOS_RECOMENDACAO_EXTRA = [
    "Sugestão: separe um valor fixo semanal para reserva. Pequenos aportes constantes fazem grande diferença no longo prazo.",
    "Dica extra: categorize todas as despesas. Quanto mais claro o mapa de gastos, mais fácil cortar o que não agrega.",
    "Recomendação: defina um valor máximo mensal para despesas variáveis (alimentação fora, aplicativos, extras) e cumpra esse limite.",
]


# -------------------------------------------------------------------
# Funções principais da IA
# -------------------------------------------------------------------


def _escolher_texto(textos: List[str]) -> str:
    """Escolhe um texto aleatório da lista."""
    if not textos:
        return ""
    return random.choice(textos)


def _classificar_tipo(
    mes_atual: MesResumo,
    variacao_saldo_pct: Optional[float],
) -> TipoAnalise:
    """
    Classifica a análise em:
    - 'positiva'
    - 'alerta'
    - 'neutra'
    com base no saldo, margem e tendência.
    """
    saldo = mes_atual.saldo
    margem = mes_atual.margem

    # 🚨 saldo negativo é sempre alerta
    if saldo < 0:
        return "alerta"

    # 🚨 queda forte de saldo
    if variacao_saldo_pct is not None and variacao_saldo_pct < -30.0:
        return "alerta"

    # 🌱 cenário bom: saldo positivo + margem boa
    if saldo > 0 and margem >= 15:
        return "positiva"

    # 😐 saldo positivo, mas margem ainda fraca
    if saldo >= 0 and margem < 15:
        return "neutra"

    return "neutra"



def analisar_serie_mensal(series: List[Dict]) -> Dict:
    """
    Recebe a mesma estrutura de 'series' usada no JSON da view
    ia_resumo_mensal_series e devolve um dicionário com:

    - tipo          -> 'positiva' | 'alerta' | 'neutra'
    - resumo        -> texto principal
    - detalhe       -> texto complementar de tendência
    - recomendacao  -> dica extra
    - dados         -> métricas numéricas usadas na análise
    """

    if not series:
        return {
            "ok": False,
            "motivo": "sem_dados",
        }

    # Constrói objetos MesResumo
    meses: List[MesResumo] = []
    for row in series:
        meses.append(
            MesResumo(
                ano=row.get("ano"),
                mes=row.get("mes"),
                label=row.get("label") or f"{row.get('mes'):02d}/{row.get('ano')}",
                total_receitas=float(row.get("total_receitas") or 0),
                total_despesas=float(row.get("total_despesas") or 0),
                saldo=float(row.get("saldo") or 0),
            )
        )

    # Considera sempre o último mês como "mês atual" para análise
    mes_atual = meses[-1]

    # Calcula variação do saldo em relação ao mês anterior (se existir)
    variacao_saldo_pct: Optional[float] = None
    if len(meses) >= 2:
        saldo_anterior = meses[-2].saldo
        if saldo_anterior != 0:
            variacao_saldo_pct = ((mes_atual.saldo - saldo_anterior) / abs(saldo_anterior)) * 100.0
        else:
            # se saldo anterior era zero, apenas usa a diferença absoluta como %
            variacao_saldo_pct = 100.0 if mes_atual.saldo > 0 else -100.0

    tipo = _classificar_tipo(mes_atual, variacao_saldo_pct)

    # Escolhe o texto principal conforme o tipo
    if tipo == "positiva":
        base = _escolher_texto(TEXTOS_POSITIVOS)
    elif tipo == "alerta":
        base = _escolher_texto(TEXTOS_ALERTA)
    else:
        base = _escolher_texto(TEXTOS_NEUTROS)

    resumo = base.format(
        saldo=f"R$ {mes_atual.saldo:,.2f}".replace(",", "X").replace(".", ",").replace("X", "."),
        margem=mes_atual.margem,
        mes_label=mes_atual.label,
    )

    # Texto de tendência (se tiver variação calculada)
    detalhe = ""
    if variacao_saldo_pct is not None:
        detalhe_template = _escolher_texto(TEXTOS_TENDENCIA)
        detalhe = detalhe_template.format(variacao_saldo_pct=variacao_saldo_pct)

    # Recomendação extra genérica
    recomendacao = _escolher_texto(TEXTOS_RECOMENDACAO_EXTRA)

    return {
        "ok": True,
        "tipo": tipo,
        "resumo": resumo,
        "detalhe": detalhe,
        "recomendacao": recomendacao,
        "dados": {
            "mes_label": mes_atual.label,
            "saldo": mes_atual.saldo,
            "margem": mes_atual.margem,
            "total_receitas": mes_atual.total_receitas,
            "total_despesas": mes_atual.total_despesas,
            "variacao_saldo_pct": variacao_saldo_pct,
        },
    }
