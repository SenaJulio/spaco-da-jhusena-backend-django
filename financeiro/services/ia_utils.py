# financeiro/services/ia_utils.py
from decimal import Decimal
from typing import Optional

ALERTAS = (
    "atenção",
    "cuidado",
    "negativo",
    "déficit",
    "deficit",
    "queda",
    "alerta",
    "urgente",
    "gasto excessivo",
    "acima do previsto",
)
POSITIVAS = (
    "ótimo",
    "otimo",
    "positivo",
    "sobra",
    "superávit",
    "superavit",
    "parabéns",
    "bom",
    "melhorou",
    "cresceu",
    "acima da meta",
)


def _map_tipo(texto: str, saldo: Optional[Decimal] = None) -> str:
    """
    Heurística simples:
      1) Se saldo informado: >0 => positiva, <0 => alerta
      2) Caso contrário, palavras-chave
      3) Senão, neutra
    """
    try:
        tx = (texto or "").lower()
    except Exception:
        tx = ""

    if saldo is not None:
        try:
            s = Decimal(saldo)
            if s > 0:
                return "positiva"
            if s < 0:
                return "alerta"
        except Exception:
            pass

    if any(k in tx for k in ALERTAS):
        return "alerta"
    if any(k in tx for k in POSITIVAS):
        return "positiva"
    return "neutra"
