from django.contrib.auth.models import User
from django.db import models


# --- Transações ---
class Transacao(models.Model):
    TIPO_CHOICES = [
        ("receita", "Receita"),
        ("despesa", "Despesa"),
    ]

    categoria = models.CharField(max_length=100, blank=True, null=True)
    tipo = models.CharField(max_length=10, choices=TIPO_CHOICES)
    descricao = models.CharField(max_length=100)
    valor = models.DecimalField(max_digits=10, decimal_places=2)
    data = models.DateField()

    # 🔗 ligação opcional com Venda
    venda = models.ForeignKey(
        "vendas.Venda",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="transacoes",
        verbose_name="Venda relacionada",
    )

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

    # ✅ novo campo para compatibilidade com o teste
    generated_by = models.CharField(max_length=16, default="manual")

    def __init__(self, *args, **kwargs):
        # aceita alias usado nos testes: category_dominante -> categoria_dominante
        alias = kwargs.pop("category_dominante", None)
        if alias is not None and "categoria_dominante" not in kwargs:
            kwargs["categoria_dominante"] = alias
        super().__init__(*args, **kwargs)

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

    def save(self, *args, **kwargs):
        """
        Se ninguém informar o tipo, usamos 'economia' como padrão
        para não ficar vazio ('-' no admin).
        """
        if not self.tipo:
            self.tipo = "economia"
        super().save(*args, **kwargs)

    def tipo_display(self):
        """
        Mostra o rótulo bonitinho no admin (Economia, Alerta, etc.).
        Se o valor estiver estranho, mostra o próprio valor.
        """
        if not self.tipo:
            return ""
        mapa = dict(self.TIPO_OPCOES)
        return mapa.get(self.tipo, self.tipo)

    tipo_display.short_description = "Tipo"


class HistoricoIA(models.Model):
    TIPOS = [
        ("positiva", "Positiva"),
        ("alerta", "Alerta"),
        ("neutra", "Neutra"),
    ]

    texto = models.TextField()
    tipo = models.CharField(max_length=20, choices=TIPOS, default="neutra")
    criado_em = models.DateTimeField(auto_now_add=True)

    origem = models.CharField(
        max_length=20, default="manual", help_text="Origem da recomendação"  # manual / auto
    )

    usuario = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)

    def __str__(self):
        return f"{self.tipo.upper()} - {self.criado_em:%d/%m/%Y %H:%M}"
