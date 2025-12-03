# financeiro/views.py
# Apenas endpoints auxiliares específicos (ex: WhatsApp)

from django.contrib.auth.decorators import login_required
from django.http import JsonResponse

from notificacoes.utils_whatsapp import enviar_whatsapp


@login_required
def api_enviar_whatsapp(request):
    """
    Endpoint simples para enviar mensagem via WhatsApp Cloud API (ou versão fake).

    Exemplo:
      /financeiro/whatsapp/enviar/?tel=5531999999999&msg=Olá

    Ele tenta ser robusto independente de como `enviar_whatsapp` foi implementada:
    - Se retornar (ok, info) → trata como tupla.
    - Se retornar dict       → usa direto.
    - Se retornar string/outro → coloca em "info".
    """
    tel = request.GET.get("tel") or None
    msg = request.GET.get("msg") or "Teste rápido do Spaço da Jhuséna 🐾"

    # Se nenhum tel E nenhuma msg, reclama
    if not tel and not msg:
        return JsonResponse(
            {"ok": False, "error": "Informe pelo menos 'tel' ou 'msg'."},
            status=400,
        )

    try:
        resultado = enviar_whatsapp(tel, msg)
    except Exception as exc:
        return JsonResponse(
            {"ok": False, "error": f"Falha ao chamar enviar_whatsapp: {exc}"},
            status=500,
        )

    # Normaliza o retorno para sempre virar um JSON bonitinho
    if isinstance(resultado, tuple) and len(resultado) == 2:
        ok, info = resultado
        data = {"ok": bool(ok), "info": info}
        status_code = 200 if ok else 400
    elif isinstance(resultado, dict):
        ok = resultado.get("ok", True)
        data = resultado
        status_code = 200 if ok else 400
    else:
        data = {
            "ok": True,
            "info": resultado if resultado is not None else "Mensagem processada.",
        }
        status_code = 200

    return JsonResponse(data, status=status_code)
