import json
import logging
from datetime import datetime

from django.conf import settings
from django.contrib import messages
from django.core.mail import send_mail
from django.db.models import Count
from django.db.models.functions import TruncMonth
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.http import require_POST
from rest_framework import generics

from .forms import AgendamentoForm
from .models import Agendamento, Servico
from .serializers import AgendamentoSerializer

logger = logging.getLogger(__name__)


class AgendamentoCreateView(generics.CreateAPIView):
    queryset = Agendamento.objects.all()
    serializer_class = AgendamentoSerializer


def agendar(request):
    if request.method == "POST":
        form = AgendamentoForm(request.POST)

        if form.is_valid():
            agendamento = form.save()

            # ✅ Monta mensagem
            assunto = "Confirmação de Agendamento - Spaço da Jhuséna"
            mensagem = (
                f"Olá {agendamento.nome},\n\n"
                f"Seu agendamento para o serviço {agendamento.servico} foi confirmado!\n"
                f"Pet: {getattr(agendamento, 'cliente', '-')}\n"
                f"Data: {agendamento.data.strftime('%d/%m/%Y')}\n"
                f"Hora: {agendamento.hora.strftime('%H:%M')}\n\n"
                "Obrigado por confiar no Spaço da Jhuséna 💚🐶\n"
            )

            remetente = getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@spaco.local")
            destinatario = [agendamento.email]

            # ✅ E-mail é opcional (não derruba o agendamento)
            if getattr(settings, "ENABLE_EMAIL", False):
                try:
                    send_mail(
                        assunto,
                        mensagem,
                        remetente,
                        destinatario,
                        fail_silently=False,
                    )
                except Exception as e:
                    logger.exception("Falha ao enviar e-mail do agendamento: %s", e)

            # ✅ Sempre redireciona quando salva
            return redirect("agendamentos:agendamento_sucesso")

        # ❌ Form inválido → cai aqui e re-renderiza com erros
        return render(request, "agendamentos/agendar.html", {"form": form})

    # GET
    form = AgendamentoForm()
    return render(request, "agendamentos/agendar.html", {"form": form})


def agendar_servico(request):
    # alias para compatibilizar com a URL atual
    return agendar(request)


def agendamento_sucesso(request):
    return render(request, "agendamentos/agendamento_sucesso.html")


def listar_agendamentos(request):
    status_filter = request.GET.get("status")

    if status_filter:
        agendamentos = Agendamento.objects.filter(status=status_filter)
    else:
        agendamentos = Agendamento.objects.all().order_by("-data", "-hora")

    contagem = {
        "agendado": Agendamento.objects.filter(status="agendado").count(),
        "pendente": Agendamento.objects.filter(status="pendente").count(),
        "concluido": Agendamento.objects.filter(status="concluido").count(),
        "cancelado": Agendamento.objects.filter(status="cancelado").count(),
    }

    return render(
        request,
        "agendamentos/listar.html",
        {"agendamentos": agendamentos, "request": request, "contagem": contagem},
    )


def concluir_agendamento(request, id):
    agendamento = get_object_or_404(Agendamento, id=id)
    agendamento.status = "concluido"
    agendamento.save()
    messages.success(request, "Agendamento concluído com sucesso!")
    return redirect("agendamentos:listar_agendamentos")


def cancelar_agendamento(request, id):
    agendamento = get_object_or_404(Agendamento, id=id)
    agendamento.status = "cancelado"
    agendamento.save()
    messages.warning(request, "Agendamento cancelado.")
    return redirect("agendamentos:listar_agendamentos")


def dashboard_agendamentos(request):
    data_inicio = request.GET.get("data_inicio")
    data_fim = request.GET.get("data_fim")

    agendamentos_qs = Agendamento.objects.all()

    if data_inicio:
        try:
            data_inicio_obj = datetime.strptime(data_inicio, "%Y-%m-%d")
            agendamentos_qs = agendamentos_qs.filter(data__gte=data_inicio_obj)
        except ValueError:
            pass

    if data_fim:
        try:
            data_fim_obj = datetime.strptime(data_fim, "%Y-%m-%d")
            agendamentos_qs = agendamentos_qs.filter(data__lte=data_fim_obj)
        except ValueError:
            pass

    contagem_status = agendamentos_qs.values("status").annotate(total=Count("id"))
    evolucao_mensal = (
        agendamentos_qs.annotate(mes=TruncMonth("data"))
        .values("mes")
        .annotate(total=Count("id"))
        .order_by("mes")
    )

    context = {
        "contagem_status": list(contagem_status),
        "evolucao_mensal": list(evolucao_mensal),
        "data_inicio": data_inicio or "",
        "data_fim": data_fim or "",
    }

    return render(request, "agendamentos/dashboard.html", context)


def dashboard_dados_ajax(request):
    data_inicio = request.GET.get("data_inicio")
    data_fim = request.GET.get("data_fim")

    agendamentos_qs = Agendamento.objects.all()

    if data_inicio:
        try:
            data_inicio_obj = datetime.strptime(data_inicio, "%Y-%m-%d")
            agendamentos_qs = agendamentos_qs.filter(data__gte=data_inicio_obj)
        except ValueError:
            pass

    if data_fim:
        try:
            data_fim_obj = datetime.strptime(data_fim, "%Y-%m-%d")
            agendamentos_qs = agendamentos_qs.filter(data__lte=data_fim_obj)
        except ValueError:
            pass

    contagem_status = list(agendamentos_qs.values("status").annotate(total=Count("id")))
    evolucao_mensal = list(
        agendamentos_qs.annotate(mes=TruncMonth("data"))
        .values("mes")
        .annotate(total=Count("id"))
        .order_by("mes")
    )

    for item in evolucao_mensal:
        item["mes"] = item["mes"].strftime("%Y-%m")

    return JsonResponse(
        {
            "contagem_status": contagem_status,
            "evolucao_mensal": evolucao_mensal,
        }
    )


@require_POST
def criar_agendamento(request):
    try:
        data = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"erro": "JSON inválido."}, status=400)

    required = ["nomeTutor", "nomePet", "telefone", "email", "servico", "data", "hora"]
    faltando = [k for k in required if not data.get(k)]
    if faltando:
        return JsonResponse(
            {"erro": f"Campos obrigatórios faltando: {', '.join(faltando)}"}, status=400
        )

    try:
        servico_obj = Servico.objects.get(nome=data["servico"])
    except Servico.DoesNotExist:
        return JsonResponse({"erro": "Serviço não encontrado."}, status=400)

    ag = Agendamento.objects.create(
        nome=data["nomeTutor"],
        cliente=data["nomePet"],
        telefone=data["telefone"],
        email=data["email"],
        servico=servico_obj,
        data=data["data"],
        hora=data["hora"],
    )

    return JsonResponse({"mensagem": "Agendamento salvo com sucesso!", "id": ag.id}, status=201)
