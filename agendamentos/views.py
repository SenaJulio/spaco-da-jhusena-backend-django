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
from django.views.decorators.http import require_GET
from rest_framework import generics
from django.utils.timezone import localdate
from financeiro.models import Transacao
from django.contrib.auth.decorators import login_required


from .forms import AgendamentoForm
from .models import Agendamento, Servico
from .serializers import AgendamentoSerializer
from django.shortcuts import get_object_or_404
import json

logger = logging.getLogger(__name__)


class AgendamentoCreateView(generics.CreateAPIView):
    queryset = Agendamento.objects.all()
    serializer_class = AgendamentoSerializer


from django.shortcuts import redirect, render
from django.contrib import messages


def agendar(request):
    if request.method == "POST":
        form = AgendamentoForm(request.POST)

        if form.is_valid():
            cd = form.cleaned_data

            # ✅ Anti-duplicado (evita 2 POSTs iguais)
            ja_existe = Agendamento.objects.filter(
                nome=cd.get("nome"),
                pet_nome=cd.get("pet_nome"),
                telefone=cd.get("telefone"),
                servico=cd.get("servico"),
                data=cd.get("data"),
                hora=cd.get("hora"),
            ).exists()

            if ja_existe:
                messages.warning(request, "Esse agendamento já existe. Duplicado evitado ✅")
                return redirect("agendamentos:agendamento_sucesso")

            # ✅ Salva só se não existir
            agendamento = form.save()

            # ✅ Monta mensagem
            assunto = "Confirmação de Agendamento - Spaço da Jhuséna"
            mensagem = (
                f"Olá {agendamento.nome},\n\n"
                f"Seu agendamento para o serviço {agendamento.servico} foi confirmado!\n"
                f"Pet: {getattr(agendamento, "pet_nome", '-')}\n"
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

            return redirect("agendamentos:agendamento_sucesso")

        return render(request, "agendamentos/agendar.html", {"form": form})

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
        pet_nome =data["nomePet"],
        telefone=data["telefone"],
        email=data["email"],
        servico=servico_obj,
        data=data["data"],
        hora=data["hora"],
    )

    return JsonResponse({"mensagem": "Agendamento salvo com sucesso!", "id": ag.id}, status=201)


@login_required
def dashboard_hoje(request):
    hoje = localdate()

    # campo de data é DateField
    campo_data = "data"  # ajuste se o nome for outro

    qs = (
        Agendamento.objects
        .filter(**{campo_data: hoje})
        .order_by(campo_data)
    )

    itens = []
    for a in qs:
        itens.append(
            {
                "id": a.id,
                "hora": "",  # DateField não tem hora
                "pet_nome": getattr(a, "pet_nome", "") or getattr(a, "tutor", ""),
                "servico": str(getattr(a, "servico", "")),
                "nome": getattr(a, "pet", "") or getattr(a, "pet_nome", ""),
                "status": a.status,
            }
        )

    return JsonResponse({"itens": itens})


@login_required
@require_POST
def acao_agendamento(request, id):
    ag = get_object_or_404(Agendamento, id=id)

    try:
        data = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"ok": False, "erro": "JSON inválido"}, status=400)

    acao = data.get("acao")

    if acao == "concluir":
        ag.status = "concluido"
    ag.save(update_fields=["status"])

    # 💰 cria lançamento financeiro (somente se ainda não existir)
    descricao = f"Serviço concluído: {ag.servico} (Agendamento #{ag.id})"

    ja_existe = Transacao.objects.filter(
        tipo="receita",
        descricao=descricao,
    ).exists()

    if not ja_existe:
        Transacao.objects.create(
            categoria="Agendamentos",
            tipo="receita",
            descricao=descricao,
            valor=0,          # valor ainda não definido
            data=localdate(),
        )

    elif acao == "cancelar":
        ag.status = "cancelado"
        ag.save(update_fields=["status"])

    else:
        return JsonResponse({"ok": False, "erro": "Ação inválida"}, status=400)

    return JsonResponse({"ok": True, "id": ag.id, "status": ag.status})


@require_GET
def horarios_ocupados(request):
    data = request.GET.get("data")  # "YYYY-MM-DD"
    if not data:
        return JsonResponse({"ok": False, "erro": "data obrigatória"}, status=400)

    qs = Agendamento.objects.filter(data=data).values_list("hora", flat=True)

    # retorna "HH:MM"
    ocupados = [h.strftime("%H:%M") for h in qs if h]
    return JsonResponse({"ok": True, "ocupados": ocupados})
