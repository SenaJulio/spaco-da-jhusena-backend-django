# core/decorators.py
from django.http import JsonResponse
from django.contrib import messages
from django.shortcuts import redirect

def bloquear_demo(view_func):
    def _wrapped(request, *args, **kwargs):
        user = getattr(request, "user", None)
        username = (getattr(user, "username", "") or "").strip().lower()
        is_demo = bool(user and user.is_authenticated and username == "demo")

        if is_demo and request.method in ("POST", "PUT", "PATCH", "DELETE"):
            msg = "🧪 Ação desabilitada no MODO DEMO."

            accept = (request.headers.get("Accept") or "").lower()
            xrw = request.headers.get("X-Requested-With") or ""
            ctype = (request.headers.get("Content-Type") or "").lower()

            # ✅ considera JSON também pelo Content-Type
            wants_json = (
                ("application/json" in accept)
                or (xrw == "XMLHttpRequest")
                or ("application/json" in ctype)
            )

            if wants_json:
                return JsonResponse(
                    {"ok": False, "error": msg},
                    status=403,
                    json_dumps_params={"ensure_ascii": False},
                )

            messages.warning(request, msg)
            return redirect(request.META.get("HTTP_REFERER", "/"))

        return view_func(request, *args, **kwargs)

    return _wrapped
