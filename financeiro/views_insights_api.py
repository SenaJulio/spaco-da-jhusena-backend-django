# financeiro/views_insights_api.py
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_POST

from .models import Insight


@login_required
@require_POST
def api_criar_insight_simples(request):
    # Dica inicial simples só para validar o fluxo
    agora = timezone.localtime()
    title = f"Dica gerada em {agora:%d/%m %H:%M}"
    text = "Registre receitas e despesas diariamente. Em 7 dias, você já enxerga padrões claros."
    ins = Insight.objects.create(
        title=title, text=text, kind="financeiro", categoria_dominante="rotina", score=75
    )
    return JsonResponse(
        {
            "ok": True,
            "id": ins.id,
            "created_at": ins.created_at.strftime("%d/%m/%Y %H:%M"),
            "title": ins.title,
            "text": ins.text,
            "kind": "Financeiro",
            "categoria": ins.categoria_dominante,
            "score": float(ins.score),
        }
    )
