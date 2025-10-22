from django.db import models


# Create your models here.
class Produto(models.Model):
    nome = models.CharField(max_length=100)
    codigo_barras = models.CharField(max_length=13, unique=True)
    preco_venda = models.DecimalField(max_digits=10, decimal_places=2)
    custo = models.DecimalField(max_digits=10, decimal_places=2)
    estoque = models.IntegerField()
    categoria = models.CharField(max_length=50)
    unidade = models.CharField(max_length=10)

    def __str__(self):

        return self.nome
