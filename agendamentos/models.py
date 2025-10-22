from django.db import models

from servicos.models import Servico


class Agendamento(models.Model):
    nome = models.CharField(max_length=100)  # Nome do tutor
    cliente = models.CharField(max_length=100, null=True, blank=True)  # Nome do pet
    email = models.EmailField()
    telefone = models.CharField(max_length=20, null=True, blank=True)
    data = models.DateField()
    hora = models.TimeField()
    servico = models.ForeignKey(Servico, on_delete=models.CASCADE)
    criado_em = models.DateTimeField(auto_now_add=True)

    STATUS_CHOICES = [
        ("agendado", "Agendado"),
        ("concluido", "Concluído"),
        ("cancelado", "Cancelado"),
    ]

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="agendado",
    )

    def __str__(self):
        return f"{self.cliente} - {self.servico.nome} em {self.data} às {self.hora}"
