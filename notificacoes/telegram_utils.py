# notificacoes/telegram_utils.py
import requests
from django.conf import settings

TELEGRAM_BOT_TOKEN = getattr(settings, "TELEGRAM_BOT_TOKEN", None)
TELEGRAM_CHAT_ID_DEFAULT = getattr(settings, "TELEGRAM_CHAT_ID_DEFAULT", None)


def enviar_telegram(texto, chat_id=None):
    """
    Envia uma mensagem simples de texto para o Telegram.
    Usa o chat_id informado ou o TELEGRAM_CHAT_ID_DEFAULT do settings.
    """
    token = TELEGRAM_BOT_TOKEN
    dest = chat_id or TELEGRAM_CHAT_ID_DEFAULT

    if not token or not dest:
        print("[TELEGRAM] Token ou chat_id não configurados.")
        print("  TELEGRAM_BOT_TOKEN =", bool(token))
        print("  TELEGRAM_CHAT_ID_DEFAULT =", dest)
        return False

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        "chat_id": dest,
        "text": texto,
        "parse_mode": "HTML",
    }

    try:
        resp = requests.post(url, json=payload, timeout=10)

        if resp.status_code != 200:
            print("[TELEGRAM] FALHA:")
            print("  Status:", resp.status_code)
            print("  Body  :", resp.text)
            return False

        return True

    except Exception as e:
        print("[TELEGRAM] Erro ao enviar mensagem:", e)
        return False
