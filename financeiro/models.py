from django.contrib.auth.models import User
from django.db import models


# --- Transações ---
class Transacao(models.Model):
    TIPO_CHOICES = [
        ("receita", "Receita"),
        ("despesa", "Despesa"),
    ]

    tipo = models.CharField(max_length=10, choices=TIPO_CHOICES)
    descricao = models.CharField(max_length=100)
    valor = models.DecimalField(max_digits=10, decimal_places=2)
    data = models.DateField()

    def __str__(self):
        return f"{self.descricao} - {self.tipo} - R$ {self.valor}"


# --- Insights (dicas do painel) ---
class Insight(models.Model):
    KIND_CHOICES = [
        ("financeiro", "Financeiro"),
        ("meta", "Meta"),
        ("alerta", "Alerta"),
    ]

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    title = models.CharField(max_length=120)
    text = models.TextField()
    kind = models.CharField(max_length=30, choices=KIND_CHOICES, default="financeiro")
    categoria_dominante = models.CharField(max_length=50, blank=True, default="")
    score = models.DecimalField(max_digits=5, decimal_places=2, default=0)

    def __str__(self):
        return f"[{self.kind}] {self.title} ({self.created_at:%d/%m/%Y %H:%M})"


# --- Histórico de recomendações da IA ---
class RecomendacaoIA(models.Model):
    TIPO_OPCOES = [
        ("economia", "Economia"),
        ("alerta", "Alerta"),
        ("oportunidade", "Oportunidade"),
        ("meta", "Meta"),
    ]

    usuario = models.ForeignKey(User, on_delete=models.CASCADE)
    texto = models.TextField()
    tipo = models.CharField(max_length=20, choices=TIPO_OPCOES, default="economia")
    criado_em = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.tipo.upper()} - {self.texto[:50]}..."
