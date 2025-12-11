# ia/services/ia.py
from __future__ import annotations

from typing import Tuple
from django.db import transaction
from django.apps import apps

from ia.services.analytics import classificar_margem
from financeiro.services.ia_utils import _map_tipo


def _montar_texto(margem_pct: float, tipo: str) -> str:
    if tipo == "positiva":
        return (
            f"Ótimo! Saldo POSITIVO com margem de {margem_pct:.1f}%. "
            f"Reforce a reserva e programe um aporte no Tesouro Selic."
        )
    if tipo == "alerta":
        return (
            f"Atenção! Margem de {margem_pct:.1f}%. "
            f"Corte gastos variáveis e segure compras de estoque não essenciais."
        )
    return (
        f"Margem de {margem_pct:.1f}%. "
        f"Siga monitorando e ajuste pequenos gastos para subir acima de 15%."
    )


def gerar_dica(margem_pct: float) -> Tuple[str, str]:
    tipo = classificar_margem(margem_pct)  # "positiva" | "alerta" | "neutra"
    texto = _montar_texto(margem_pct, tipo)
    return texto, tipo


@transaction.atomic
def gerar_e_salvar_dica(usuario, margem_pct: float):
    """
    Gera a dica e salva em RecomendacaoIA de forma segura (sem imports antecipados).
    """
    if not usuario:
        raise ValueError("usuario é obrigatório para salvar a recomendação")

    texto, tipo = gerar_dica(margem_pct)

    # Lazy resolve do model evita AppRegistryNotReady e ciclos de import
    RecomendacaoIA = apps.get_model("financeiro", "RecomendacaoIA")
    rec = RecomendacaoIA.objects.create(
        usuario=usuario,
        texto=texto,        
        tipo=tipo,
    )
    return rec


# ia/services/ia.py

from django.apps import apps

RecomendacaoIA = apps.get_model("financeiro", "RecomendacaoIA")

def salvar_recomendacao_ia(usuario, texto, tipo_ia=None, saldo=None):
    """
    Centraliza a criação da RecomendacaoIA.

    - tipo_ia: 'positiva' / 'alerta' / 'neutra' (saída do _map_tipo)
    - se tipo_ia não vier, usamos _map_tipo(texto, saldo)
    - converte para o tipo usado no admin: 'Alerta', 'Economia', etc.
    """

    # se não passaram o tipo, a gente calcula
    if not tipo_ia:
        tipo_ia = _map_tipo(texto, saldo=saldo)

    tipo_ia = (tipo_ia or "").strip().lower()

    if tipo_ia == "alerta":
        tipo_admin = "Alerta"
    else:
        # tratamos positiva/neutra como dica boa de economia
        tipo_admin = "Economia"

    rec = RecomendacaoIA.objects.create(
        usuario=usuario,
        texto=texto,
        tipo=tipo_admin,  # 👈 nunca mais fica vazio
    )
    return rec

