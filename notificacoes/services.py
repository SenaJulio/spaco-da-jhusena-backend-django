# notificacoes/services.py
import logging
import requests
from django.conf import settings
from django.utils import timezone

from .models import Notificacao, CanalNotificacaoUsuario

logger = logging.getLogger(__name__)


# ============================================================
# 🔵 CAMADA CENTRAL — decide qual canal enviar (Telegram/WhatsApp)
# ============================================================
def enviar_notificacao(notificacao: Notificacao):
    try:
        if notificacao.canal == "telegram":
            _enviar_telegram(notificacao)

        elif notificacao.canal == "whatsapp":
            _enviar_whatsapp(notificacao)

        else:
            raise ValueError(f"Canal não suportado: {notificacao.canal}")

        notificacao.status = "enviado"
        notificacao.erro_msg = ""
        notificacao.enviado_em = timezone.now()

    except Exception as exc:
        logger.exception("Falha ao enviar notificação")
        notificacao.status = "erro"
        notificacao.erro_msg = str(exc)

    notificacao.save(update_fields=["status", "erro_msg", "enviado_em"])
    return notificacao


# ============================================================
# 🔵 TELEGRAM REAL — usando o token do settings
# ============================================================
def _enviar_telegram(notificacao: Notificacao):
    token = getattr(settings, "TELEGRAM_BOT_TOKEN", "")
    if not token:
        raise ValueError("TELEGRAM_BOT_TOKEN não configurado no settings.")

    if not notificacao.destino:
        raise ValueError("Notificação sem destino para envio no Telegram.")

    url = f"https://api.telegram.org/bot{token}/sendMessage"

    payload = {
        "chat_id": notificacao.destino,
        "text": notificacao.mensagem,
    }

    try:
        resp = requests.post(url, json=payload, timeout=10)
        data = resp.json()
    except Exception as exc:
        raise RuntimeError(f"Falha na requisição ao Telegram: {exc}")

    if not resp.ok or not data.get("ok"):
        raise RuntimeError(f"Erro do Telegram API: status={resp.status_code}, body={data}")


# ============================================================
# 🟢 WHATSAPP FAKE POR ENQUANTO
# ============================================================
def _enviar_whatsapp(notificacao: Notificacao):
    print(f"[FAKE WHATSAPP] Enviando para {notificacao.destino}: {notificacao.mensagem}")
    # Aqui depois entra:
    # - PHONE_NUMBER_ID
    # - WHATSAPP_TOKEN
    # E a chamada real da API do WhatsApp Cloud API
    return True


# ============================================================
# 🔵 Envio manual da dica — usado para testes
# ============================================================
def notificar_dica_financeira_teste(mensagem: str, canal: str = "telegram", usuario=None):
    canal = (canal or "").lower()
    destino = "TESTE_LOCAL"

    print(f"[DEBUG NOTIF] usuario={usuario} (id={getattr(usuario, 'id', None)}), canal={canal}")

    canal_cfg = None
    if usuario is not None:
        qs = CanalNotificacaoUsuario.objects.filter(
            usuario=usuario,
            canal=canal,
            ativo=True,
        )
        print(f"[DEBUG NOTIF] canais_encontrados={qs.count()}")
        canal_cfg = qs.first()

    if canal_cfg:
        destino = canal_cfg.destino
        print(f"[DEBUG NOTIF] usando destino do canal: {destino}")
    else:
        print("[DEBUG NOTIF] nenhum canal ativo encontrado, usando TESTE_LOCAL")

    notif = Notificacao.objects.create(
        usuario=usuario,
        canal=canal,
        destino=destino,
        titulo="Dica financeira da IA",
        mensagem=mensagem,
    )

    enviar_notificacao(notif)
    return notif


# ============================================================
# 🔵 Formatação especial para o Telegram
# ============================================================
def formatar_mensagem_telegram(dica: str, tipo: str, periodo: dict) -> str:
    inicio = periodo.get("inicio", "")
    fim = periodo.get("fim", "")

    if tipo == "positiva":
        emoji = "✅"
        titulo_tipo = "Positiva"
    elif tipo == "alerta":
        emoji = "⚠️"
        titulo_tipo = "Alerta"
    else:
        emoji = "ℹ️"
        titulo_tipo = "Neutra"

    mensagem = (
        f"📊 *Dica Inteligente da IA*\n"
        f"Período analisado: {inicio} → {fim}\n"
        f"Tipo: {emoji} {titulo_tipo}\n\n"
        f"💡 {dica}\n\n"
        f"_Spaço da Jhuséna — Inteligência Financeira_"
    )
    return mensagem
