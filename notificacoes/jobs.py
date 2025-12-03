import logging
from django.contrib.auth import get_user_model

from notificacoes.engine_notificacoes import montar_mensagem_final
from notificacoes.services import notificar_dica_financeira_teste

logger = logging.getLogger(__name__)

User = get_user_model()


# ============================================================
# FUNÇÃO CENTRAL — EXECUTAR NOTIFICAÇÕES SEMANAIS
# ============================================================


def executar_notificacoes_semanais(canal="telegram", dry_run=False, only_user_id=None):
    """
    Dispara (ou simula) o envio de notificações semanais
    para os usuários ativos do sistema.

    Parâmetros:
      - canal: "telegram" (padrão) ou "whatsapp" (quando estiver liberado)
      - dry_run: se True, só LOGA o que faria, sem enviar nada
      - only_user_id: se informado, roda só para esse usuário específico

    Exemplo de uso no shell:

    >>> from notificacoes.jobs import executar_notificacoes_semanais
    >>> executar_notificacoes_semanais(dry_run=True)
    (simulação, sem enviar)

    >>> executar_notificacoes_semanais(canal="telegram", dry_run=False)
    (envio real via Telegram)
    """
    if only_user_id is not None:
        users = User.objects.filter(id=only_user_id, is_active=True)
        logger.info(f"[NOTIF_WEEKLY] Rodando APENAS para user_id={only_user_id}")
    else:
        users = User.objects.filter(is_active=True)
        logger.info(f"[NOTIF_WEEKLY] Rodando para {users.count()} usuários ativos")

    enviados = 0
    falhas = 0

    for user in users:
        try:
            logger.info(f"[NOTIF_WEEKLY] Processando usuário: {user.username} (id={user.id})")

            # 1) Monta a mensagem bonitona usando o motor da semana
            msg = montar_mensagem_final(user)

            if dry_run:
                # Só loga o que faria
                logger.info(
                    f"[NOTIF_WEEKLY][DRY_RUN] Mensagem para {user.username}:\n{msg}\n{'-'*60}"
                )
                continue

            # 2) Dispara via central de notificações (já existente no projeto)
            notificar_dica_financeira_teste(
                mensagem=msg,
                canal=canal,
                usuario=user,
            )

            enviados += 1
            logger.info(
                f"[NOTIF_WEEKLY] Notificação enviada com sucesso para {user.username} via {canal}"
            )
        except Exception as e:
            falhas += 1
            logger.exception(
                f"[NOTIF_WEEKLY] Falha ao enviar notificação para {user.username} (id={user.id})"
            )

    resumo = {
        "usuarios_processados": users.count(),
        "enviados": enviados,
        "falhas": falhas,
        "canal": canal,
        "dry_run": dry_run,
    }

    logger.info(f"[NOTIF_WEEKLY] RESUMO FINAL: {resumo}")
    return resumo


# ============================================================
# AZEITANDO UM HELP RÁPIDO
# ============================================================


def help_notificacoes():
    """
    Só pra você lembrar rápido no shell o que fazer.
    """
    txt = """
🧠 COMO USAR AS NOTIFICAÇÕES SEMANAIS

No shell do Django:

  >>> from notificacoes.jobs import executar_notificacoes_semanais

Simular (sem enviar nada), só pra ver logs:
  >>> executar_notificacoes_semanais(dry_run=True)

Enviar pra todo mundo ativo via Telegram:
  >>> executar_notificacoes_semanais(canal="telegram", dry_run=False)

Enviar APENAS para um usuário específico (ex: id=1):
  >>> executar_notificacoes_semanais(only_user_id=1, canal="telegram", dry_run=False)
"""
    print(txt)
 