# financeiro/ia_estoque_bridge.py
from django.utils import timezone
from estoque.services_lotes import gerar_textos_alerta_lotes
from financeiro.models import HistoricoIA  # AQUI é o certo, tem campo 'origem'


def anexar_alertas_estoque_no_texto(
    texto_base: str, dias_aviso: int = 30, max_itens: int = 3
) -> str:
    """
    Anexa alertas de estoque vencido / a vencer no texto principal da IA.
    """
    msgs = gerar_textos_alerta_lotes(dias_aviso=dias_aviso)

    if not msgs:
        return texto_base or ""

    linhas = [m["texto"] for m in msgs[:max_itens]]

    bloco = "\n\n📦 Estoque — lotes vencidos / a vencer:\n"
    for linha in linhas:
        bloco += f"- {linha}\n"

    if len(msgs) > max_itens:
        bloco += f"... e mais {len(msgs) - max_itens} lote(s) com vencimento próximo.\n"

    return (texto_base or "") + bloco


def registrar_alertas_lote_no_historico(usuario=None, dias_aviso: int = 30, max_itens: int = 5):
    """
    Cria registros na tabela HistoricoIA para cada alerta de lote vencido / prestes a vencer.
    """
    msgs = gerar_textos_alerta_lotes(dias_aviso=dias_aviso)

    if not msgs:
        return 0

    criados = 0
    agora = timezone.now()

    for m in msgs[:max_itens]:
        HistoricoIA.objects.create(
            texto=m["texto"],
            tipo="alerta",  # tarja ALERTA
            origem="lote",  # usado pra diferenciar no front
            usuario=usuario,
            criado_em=agora,
        )
        criados += 1

    return criados
