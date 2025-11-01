# ia/services/classify.py
from __future__ import annotations
import re
from typing import Literal

TipoDica = Literal["positiva", "alerta", "neutra"]

_POSITIVAS = [
    r"\b(saldo\s*positivo|lucro|superávit|acima\s*da\s*média|bom\s*desempenho)\b",
    r"\b(margem\s*(boa|alta)|crescimento|melhora|otim(o|a))\b",
    r"\b(reforce\s*a\s*reserva|aplique|aporte\s*extra|investir)\b",
]

_ALERTAS = [
    r"\b(saldo\s*negativo|preju[ií]zo|déficit|abaixo\s*da\s*média)\b",
    r"\b(gasto[s]? excessivo[s]?|estouro|at(en|ê)ncia|alerta)\b",
    r"\b(reduza|corte|contingencie|evite|risco|queda)\b",
    r"\b(baixa\s*liquidez|atraso[s]?|inadimpl[eê]ncia)\b",
]

_NEUTRAS = [
    r"\b(estável|mantido|sem\s*variação|neutro|regular)\b",
    r"\b(acompanhar|monitorar|verifique|observe)\b",
]


def _score(text: str, patterns: list[str]) -> int:
    score = 0
    for p in patterns:
        if re.search(p, text, flags=re.IGNORECASE):
            score += 1
    return score


def _map_tipo(texto: str) -> TipoDica:
    """
    Classifica uma dica de IA em 'positiva', 'alerta' ou 'neutra'
    com base em palavras-chave. Em caso de empate, prioriza 'alerta' > 'positiva' > 'neutra'.
    """
    if not (texto or "").strip():
        return "neutra"

    pos = _score(texto, _POSITIVAS)
    alt = _score(texto, _ALERTAS)
    neu = _score(texto, _NEUTRAS)

    # desempate: alerta > positiva > neutra
    tripla = [("alerta", alt), ("positiva", pos), ("neutra", neu)]
    tripla.sort(key=lambda x: x[1], reverse=True)
    # se todos 0, considera neutra
    if tripla[0][1] == 0:
        return "neutra"
    return tripla[0][0]  # type: ignore[return-value]
