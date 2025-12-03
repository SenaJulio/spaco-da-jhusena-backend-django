# notificacoes/telegram_utils.py
import requests
from django.conf import settings


TELEGRAM_BOT_TOKEN = getattr(settings, "TELEGRAM_BOT_TOKEN", None)
TELEGRAM_CHAT_ID_DEFAULT = getattr(settings, "TELEGRAM_CHAT_ID_DEFAULT", None)


def enviar_telegram(texto: str, chat_id: str | None = None) -> bool:
    """
    Envia mensagem de texto para um chat no Telegram.

    - Usa o BOT_TOKEN definido no settings.
    - Se chat_id não for informado, usa o padrão TELEGRAM_CHAT_ID_DEFAULT.
    - Retorna True se enviado com sucesso, False caso contrário.
    """

    token = TELEGRAM_BOT_TOKEN
    dest = chat_id or TELEGRAM_CHAT_ID_DEFAULT

    if not token:
        print("[TELEGRAM] ERRO: TELEGRAM_BOT_TOKEN não configurado.")
        return False

    if not dest:
        print(
            "[TELEGRAM] ERRO: Nenhum chat_id informado e "
            "TELEGRAM_CHAT_ID_DEFAULT não configurado."
        )
        return False

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        "chat_id": dest,
        "text": texto,
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
    }

    try:
        resp = requests.post(url, json=payload, timeout=10)

        # Erro da API do Telegram
        if resp.status_code != 200:
            print("[TELEGRAM] FALHA AO ENVIAR:")
            print("  Status:", resp.status_code)
            print("  Body  :", resp.text)
            return False

        data = resp.json()

        # A API pode retornar status 200 mas ok=False (erro do BOT)
        if not data.get("ok"):
            print("[TELEGRAM] API retornou erro:")
            print("  Descrição:", data.get("description"))
            return False

        return True

    except requests.Timeout:
        print("[TELEGRAM] Erro: Timeout ao chamar API.")
        return False

    except Exception as e:
        print("[TELEGRAM] Erro inesperado:", e)
        return False
