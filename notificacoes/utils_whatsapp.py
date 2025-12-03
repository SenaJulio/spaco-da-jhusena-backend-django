# notificacoes/utils_whatsapp.py
import logging
import requests

logger = logging.getLogger(__name__)

# ==================================================
# CONFIGURAÇÕES FIXAS (SEM SETTINGS, SEM CONFUSÃO)
# ==================================================

# TOKEN NOVO — cole aqui sempre que gerar outro na Meta
WHATSAPP_CLOUD_ACCESS_TOKEN = "EAAbVSLuSszMBQMOIe4OiNy3WkCROVMMNbJB9r3IperfZAZCqFherCGZC5BGRXGTAiuUZBkDNZCZCgMadYSqRhiZBX9Em0zoOaWM6vDcz8gl4sV0AqiChbzWyiipQUGfCXBBQNm1x4suTrrVT5Bzc0LncsZAGS227EW7L8woHrAm58UZCvWelh1FPPcMVbNj1WhgI0pC6f4XFRjYITWiV8SfCSr4oZBRoHJ4ua4zuqkmXZC3RbBgP27CW2NVZAf1wCSnnx3FreaM5a8lxZBoYFeVZBa45LAKrILZAwZDZD"

# ID do número de teste (fixo da Meta)
WHATSAPP_CLOUD_PHONE_ID = "833352466537041"

# Número padrão (você pode mudar depois se quiser)
WHATSAPP_DEFAULT_TO = "5531994898165"


# ==================================================
# MODO FAKE (seguro quando faltar token ou telefone)
# ==================================================
def _enviar_fake(destino, mensagem, motivo="MODO_FAKE"):
    logger.info(
        "[FAKE WHATSAPP] (%s) Enviando para %s: %s",
        motivo,
        destino,
        mensagem,
    )
    return True, {
        "fake": True,
        "canal": "whatsapp",
        "destino": destino,
        "mensagem": mensagem,
        "status": "ENVIADO_OK_FAKE",
        "motivo": motivo,
    }


# ==================================================
# ENVIO REAL VIA WHATSAPP CLOUD API
# ==================================================
def enviar_whatsapp(destino, mensagem):
    """
    Envia mensagem via WhatsApp Cloud API.
    Se faltar token ou phone_id → MODO_FAKE.
    """

    to = destino or WHATSAPP_DEFAULT_TO

    if not to:
        return _enviar_fake("(sem_destino)", mensagem, motivo="SEM_DESTINO")

    if not WHATSAPP_CLOUD_ACCESS_TOKEN or not WHATSAPP_CLOUD_PHONE_ID:
        return _enviar_fake(to, mensagem, motivo="CONFIG_INCOMPLETA")

    url = f"https://graph.facebook.com/v21.0/{WHATSAPP_CLOUD_PHONE_ID}/messages"
    headers = {
        "Authorization": f"Bearer {WHATSAPP_CLOUD_ACCESS_TOKEN}",
        "Content-Type": "application/json",
    }
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "text",
        "text": {"preview_url": False, "body": mensagem},
    }

    try:
        resp = requests.post(url, headers=headers, json=payload, timeout=10)

        try:
            data = resp.json()
        except ValueError:
            data = {"raw": resp.text}

        if not resp.ok:
            logger.error(
                "[WHATSAPP] Erro HTTP. status=%s, response=%s",
                resp.status_code,
                data,
            )
            return False, {
                "statexitus": "ERRO_HTTP",
                "status_code": resp.status_code,
                "response": data,
            }

        logger.info("[WHATSAPP] Enviado com sucesso para %s. Resposta: %s", to, data)

        return True, {
            "status": "ENVIADO_OK",
            "response": data,
            "destino": to,
        }

    except Exception as e:
        logger.exception("[WHATSAPP] Exceção: %s", e)
        return False, {
            "status": "ERRO_EXCECAO",
            "error": str(e),
            "destino": to,
        }


# notificacoes/utils_whatsapp.py
import logging
import requests

logger = logging.getLogger(__name__)

# ==================================================
# CONFIGURAÇÕES FIXAS (SEM SETTINGS, SEM CONFUSÃO)
# ==================================================
#
# ⚠ IMPORTANTE:
# - NÃO COMMITAR O TOKEN REAL NO GITHUB.
# - Use esse arquivo só no ambiente local ou
#   carregue o token via variável de ambiente depois.
#
# Cole aqui o token gerado na Meta:
WHATSAPP_CLOUD_ACCESS_TOKEN = "COLE_SEU_TOKEN_DA_META_AQUI"

# ID do número de teste (fixo da Meta para o seu app)
WHATSAPP_CLOUD_PHONE_ID = "833352466537041"

# Número padrão (você pode mudar depois se quiser)
WHATSAPP_DEFAULT_TO = "5531994898165"


# ==================================================
# MODO FAKE (seguro quando faltar token ou telefone)
# ==================================================
def _enviar_fake(destino, mensagem, motivo="MODO_FAKE"):
    """
    Simula envio de mensagem via WhatsApp.
    Usado quando não há token/phone_id/destino configurado.
    """
    logger.info(
        "[FAKE WHATSAPP] (%s) Enviando para %s: %s",
        motivo,
        destino,
        mensagem,
    )
    return True, {
        "fake": True,
        "canal": "whatsapp",
        "destino": destino,
        "mensagem": mensagem,
        "status": "ENVIADO_OK_FAKE",
        "motivo": motivo,
    }


# ==================================================
# ENVIO REAL VIA WHATSAPP CLOUD API
# ==================================================
def enviar_whatsapp(destino, mensagem):
    """
    Envia mensagem via WhatsApp Cloud API.

    Retorno:
      (ok: bool, payload: dict)

    - ok = True  → mensagem enviada (ou fake OK)
    - ok = False → houve erro; veja payload["status"]
    """

    to = destino or WHATSAPP_DEFAULT_TO

    # Sem destino → nem tenta bater na API
    if not to:
        return _enviar_fake("(sem_destino)", mensagem, motivo="SEM_DESTINO")

    # Configuração incompleta → modo fake
    if not WHATSAPP_CLOUD_ACCESS_TOKEN or not WHATSAPP_CLOUD_PHONE_ID:
        return _enviar_fake(to, mensagem, motivo="CONFIG_INCOMPLETA")

    url = f"https://graph.facebook.com/v21.0/{WHATSAPP_CLOUD_PHONE_ID}/messages"
    headers = {
        "Authorization": f"Bearer {WHATSAPP_CLOUD_ACCESS_TOKEN}",
        "Content-Type": "application/json",
    }
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "text",
        "text": {
            "preview_url": False,
            "body": mensagem,
        },
    }

    try:
        resp = requests.post(url, headers=headers, json=payload, timeout=10)

        try:
            data = resp.json()
        except ValueError:
            data = {"raw": resp.text}

        if not resp.ok:
            logger.error(
                "[WHATSAPP] Erro HTTP. status=%s, response=%s",
                resp.status_code,
                data,
            )
            return False, {
                "canal": "whatsapp",
                "status": "ERRO_HTTP",
                "status_code": resp.status_code,
                "response": data,
                "destino": to,
            }

        logger.info("[WHATSAPP] Enviado com sucesso para %s. Resposta: %s", to, data)

        return True, {
            "canal": "whatsapp",
            "status": "ENVIADO_OK",
            "response": data,
            "destino": to,
        }

    except requests.Timeout as e:
        logger.exception("[WHATSAPP] Timeout ao enviar mensagem: %s", e)
        return False, {
            "canal": "whatsapp",
            "status": "ERRO_TIMEOUT",
            "error": str(e),
            "destino": to,
        }

    except Exception as e:
        logger.exception("[WHATSAPP] Exceção ao enviar mensagem: %s", e)
        return False, {
            "canal": "whatsapp",
            "status": "ERRO_EXCECAO",
            "error": str(e),
            "destino": to,
        }
