# financeiro/notifications.py
import json
import os
from urllib import parse, request


def send_telegram_message(text: str) -> tuple[bool, str | None]:
    """
    Envia uma mensagem simples para um chat do Telegram.
    Requer TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID no ambiente ou settings.
    Retorna (ok, erro).
    """
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    chat_id = os.getenv("TELEGRAM_CHAT_ID")

    if not token or not chat_id:
        return False, "TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID não configurados"

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    data = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML",  # permite negrito/itálico simples
        "disable_web_page_preview": True,
    }
    body = parse.urlencode(data).encode("utf-8")
    req = request.Request(
        url, data=body, headers={"Content-Type": "application/x-www-form-urlencoded"}
    )

    try:
        with request.urlopen(req, timeout=15) as resp:
            payload = resp.read().decode("utf-8")
            ok = json.loads(payload).get("ok", False)
            return (True, None) if ok else (False, payload)
    except Exception as e:
        return False, str(e)
