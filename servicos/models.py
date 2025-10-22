# Create your models here.
# servicos/models.py

from django.db import models


class Servico(models.Model):
    nome = models.CharField(max_length=100)
    preco = models.DecimalField(max_digits=8, decimal_places=2)
    duracao = models.DurationField(null=True, blank=True)  # opcional

    def __str__(self):
        return self.nome
