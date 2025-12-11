# financeiro/services_ia.py
from django.utils import timezone
from notificacoes.telegram_utils import enviar_telegram

from django.contrib.auth import get_user_model
from django.db import transaction

from .models import Transacao, HistoricoIA
from ia.services.analysis import analisar_30d_dict
from financeiro.ia_estoque_bridge import registrar_alertas_lote_no_historico


User = get_user_model()


def gerar_dica_30d_auto(origem="auto", user=None):
    """
    Gera uma nova dica automática usando o modelo 30d,
    SALVA no HistoricoIA e devolve um dicionário amigável.
    """
    analise = analisar_30d_dict(Transacao, user)

    texto = analise.get("plano_acao") or analise.get("resumo") or "Sem conteúdo gerado."

    with transaction.atomic():
        # 1) Cria o card principal da IA
        hist = HistoricoIA.objects.create(
            texto=texto,
            tipo=analise.get("tipo", "neutra") or "neutra",
            origem=origem,
            usuario=user if isinstance(user, User) else None,
        )

        # 2) CRIA TAMBÉM OS ALERTAS DE LOTE VENCIDO / A VENCER
        registrar_alertas_lote_no_historico(
            usuario=user if isinstance(user, User) else None,
            dias_aviso=30,
            max_itens=5,
        )

    # retorno original
    return {
        "ok": True,
        "tipo": hist.tipo,
        "origem": hist.origem,
        "texto": hist.texto,
        "analise": analise,
        "id": hist.id,
        "user_id": hist.usuario_id,
        "user_str": str(hist.usuario) if hist.usuario_id else None,
    }


def gerar_dica_30d_auto_e_notificar(origem="auto_cron", chat_id=None):
    """
    Usa o mesmo motor gerar_dica_30d_auto(),
    reaproveita a dica gerada e envia um resumo pro Telegram.
    Retorna o payload da dica.
    """
    payload = gerar_dica_30d_auto(origem=origem)

    texto = payload.get("texto") or "Sem conteúdo gerado."
    analise = payload.get("analise") or {}

    inicio = analise.get("inicio") or ""
    fim = analise.get("fim") or ""
    saldo = analise.get("saldo") or 0
    margem = analise.get("margem_pct") or 0
    tipo = (analise.get("tipo") or payload.get("tipo") or "neutra").lower()

    # emoji de status
    if tipo == "positiva":
        emoji = "🟢"
    elif tipo == "alerta":
        emoji = "🟡"
    else:
        emoji = "⚪"

    now = timezone.localtime()
    stamp = now.strftime("%d/%m/%Y %H:%M")

    # monta mensagem enxuta e profissional
    msg = (
        (
            f"📊 <b>IA 30 dias — nova dica automática</b>\n"
            f"{emoji} <b>Tipo:</b> {tipo.capitalize()}\n"
            f"📅 <b>Período:</b> {inicio} até {fim}\n"
            f"💰 <b>Saldo:</b> R$ {saldo:,.2f}\n"
            f"📉 <b>Margem:</b> {margem:.1f}%\n"
            f"⏱ <b>Gerado em:</b> {stamp}\n\n"
            f"📝 <b>Plano de ação:</b> {texto}"
        )
        .replace(",", "X")
        .replace("X", ",")
    )  # gambizinha pra não quebrar formatação BR

    enviar_telegram(msg, chat_id=chat_id)

    return payload
