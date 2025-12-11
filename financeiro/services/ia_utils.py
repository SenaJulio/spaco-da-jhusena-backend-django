# financeiro/services/ia_utils.py
from decimal import Decimal
from typing import Optional

# Palavras-chave reforçadas (organizadas e ampliadas)
ALERTAS = {
    "atenção",
    "cuidado",
    "alerta",
    "urgente",
    "negativo",
    "saldo negativo",
    "margem negativa",
    "déficit",
    "deficit",
    "queda",
    "caiu",
    "prejuízo",
    "prejuizo",
    "estourou",
    "acima do previsto",
    "fora da meta",
    "gasto excessivo",
}

POSITIVAS = {
    "ótimo",
    "otimo",
    "positivo",
    "saldo positivo",
    "margem positiva",
    "superávit",
    "superavit",
    "sobra",
    "parabéns",
    "parabens",
    "bom",
    "excelente",
    "cresceu",
    "subiu",
    "melhorou",
    "acima da meta",
    "recorde",
}


def _map_tipo(texto: str, saldo: Optional[Decimal] = None) -> str:
    """
    Classifica o tipo de dica da IA:
      1) Se saldo informado: >0 => positiva, <0 => alerta
      2) Senão, analisa palavras-chave
      3) Senão, retorna 'neutra'
    """
    try:
        tx = (texto or "").lower().strip()
    except Exception:
        tx = ""

    # 1) O saldo manda mais (padrão do painel financeiro)
    if saldo is not None:
        try:
            s = Decimal(saldo)
            if s > 0:
                return "positiva"
            if s < 0:
                return "alerta"
        except Exception:
            pass

    # 2) Palavras-chave
    if any(k in tx for k in ALERTAS):
        return "alerta"
    if any(k in tx for k in POSITIVAS):
        return "positiva"

    # 3) Fallback neutro
    return "neutra"
