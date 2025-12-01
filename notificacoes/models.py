from django.db import models
from django.conf import settings
from django.contrib.auth import get_user_model

User = get_user_model()

class Notificacao(models.Model):
    CANAL_CHOICES = (
        ("telegram", "Telegram"),
        ("whatsapp", "WhatsApp"),
    )

    STATUS_CHOICES = (
        ("pendente", "Pendente"),
        ("enviado", "Enviado"),
        ("erro", "Erro"),
    )

    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notificacoes",
        null=True,  # por enquanto deixamos nullable pra não brigar com dados antigos
        blank=True,
        help_text="Dono da conta que vai receber a mensagem.",
    )

    canal = models.CharField(
        max_length=20,
        choices=CANAL_CHOICES,
    )

    destino = models.CharField(
        max_length=100,
        help_text="chat_id do Telegram ou número do WhatsApp em formato internacional.",
    )

    titulo = models.CharField(
        max_length=200,
        blank=True,
    )

    mensagem = models.TextField()

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="pendente",
    )

    erro_msg = models.TextField(
        blank=True,
        help_text="Mensagem de erro retornada pela API, se houver.",
    )

    criado_em = models.DateTimeField(auto_now_add=True)
    enviado_em = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-criado_em"]

    def __str__(self):
        return f"[{self.canal}] {self.titulo or self.mensagem[:40]}"


class CanalNotificacaoUsuario(models.Model):
    """
    Define para qual destino (chat_id / número) cada usuário será notificado
    em um determinado canal (Telegram, WhatsApp, etc.).
    """

    CANAL_CHOICES = (
        ("telegram", "Telegram"),
        ("whatsapp", "WhatsApp"),
    )

    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="canais_notificacao",
    )

    canal = models.CharField(
        max_length=20,
        choices=CANAL_CHOICES,
    )

    destino = models.CharField(
        max_length=100,
        help_text="chat_id do Telegram ou número do WhatsApp (formato internacional).",
    )

    ativo = models.BooleanField(default=True)

    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("usuario", "canal", "ativo")
        verbose_name = "Canal de notificação do usuário"
        verbose_name_plural = "Canais de notificação dos usuários"

    def __str__(self):
        return f"{self.usuario} - {self.canal} -> {self.destino}"


class ExecucaoIAAuto(models.Model):
    """
    Log de execuções automáticas da IA (ex.: comando ia_auto_30d).
    Guarda se enviou para Telegram, se deu erro, texto da dica etc.
    """

    criado_em = models.DateTimeField(auto_now_add=True)

    usuario = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        help_text="Usuário dono do contexto da análise (se aplicável).",
    )

    origem = models.CharField(
        max_length=32,
        default="auto",
        help_text="Origem da dica (ex.: 'auto', 'cron', 'manual').",
    )

    tipo = models.CharField(
        max_length=20,
        blank=True,
        help_text="Tipo retornado pela IA (positiva / alerta / neutra...).",
    )

    texto = models.TextField(help_text="Texto da dica enviada (ou gerada) pela IA.")

    canal = models.CharField(
        max_length=20,
        default="telegram",
        help_text="Canal de envio: telegram / whatsapp / outro.",
    )

    sucesso_envio = models.BooleanField(
        default=False,
        help_text="True se o envio para o canal externo foi bem-sucedido.",
    )

    erro_envio = models.TextField(
        blank=True,
        help_text="Mensagem de erro do envio, se houver.",
    )

    meta = models.JSONField(
        blank=True,
        null=True,
        help_text="Payload extra da análise (ex.: dict com inicio/fim, saldo, etc).",
    )

    class Meta:
        ordering = ["-criado_em"]
        verbose_name = "Execução IA automática"
        verbose_name_plural = "Execuções IA automáticas"

    def __str__(self):
        base = self.criado_em.strftime("%d/%m/%Y %H:%M")
        return f"{base} — {self.tipo or 'sem tipo'} — {self.canal}"
