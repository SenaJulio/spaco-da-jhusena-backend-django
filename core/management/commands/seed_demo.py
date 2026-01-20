from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from django.apps import apps
from decimal import Decimal


class Command(BaseCommand):
    help = "Cria dados de exemplo para a Empresa DEMO (estoque + (opcional) PDV/financeiro) de forma idempotente."

    def _get_model(self, app_label, model_name):
        try:
            return apps.get_model(app_label, model_name)
        except LookupError:
            return None

    @transaction.atomic
    def handle(self, *args, **options):
        User = get_user_model()

        # ---- garante usuario demo
        demo_user = User.objects.filter(username="demo").first()
        if not demo_user:
            self.stdout.write(self.style.ERROR("❌ Usuário 'demo' não existe. Rode: python manage.py create_demo"))
            return

        # ---- pega Perfil e Empresa
        Perfil = self._get_model("core", "Perfil")
        Empresa = self._get_model("core", "Empresa")
        if not Perfil or not Empresa:
            self.stdout.write(self.style.ERROR("❌ Models core.Perfil/core.Empresa não encontrados."))
            return

        perfil = Perfil.objects.select_related("empresa").filter(user=demo_user).first()
        if not perfil or not getattr(perfil, "empresa_id", None):
            self.stdout.write(self.style.ERROR("❌ Perfil do demo sem empresa. Verifique core/signals.py e o create_demo."))
            return

        empresa = perfil.empresa

        # ---- models de estoque (tentando nomes comuns do seu projeto)
        Produto = (
            self._get_model("estoque", "Produto")
            or self._get_model("estoque", "ProdutoEstoque")
            or self._get_model("core", "Produto")
        )
        LoteProduto = (
            self._get_model("estoque", "LoteProduto")
            or self._get_model("estoque", "Lote")
        )

        # Se seu projeto usa outros nomes, o comando não vai quebrar silenciosamente: ele avisa.
        if not Produto:
            self.stdout.write(self.style.ERROR("❌ Não encontrei model de Produto (estoque.Produto / estoque.ProdutoEstoque / core.Produto)."))
            return

        if not LoteProduto:
            self.stdout.write(self.style.ERROR("❌ Não encontrei model de Lote (estoque.LoteProduto / estoque.Lote)."))
            return

        # ---- cria produtos (idempotente por nome + empresa quando existir)
        now = timezone.now()

        # Helper para criar/achar produto com/sem campo empresa
        def get_or_create_prod(nome, preco, minimo=5):
            filtros = {"nome": nome}
            if hasattr(Produto, "empresa"):
                filtros["empresa"] = empresa

            obj = Produto.objects.filter(**filtros).first()
            if obj:
                # atualiza preço
                if hasattr(obj, "preco_venda") and obj.preco_venda != preco:
                    obj.preco_venda = preco

                # atualiza estoque_minimo (se existir)
                if hasattr(obj, "estoque_minimo") and obj.estoque_minimo != minimo:
                    obj.estoque_minimo = minimo

                obj.save()
                return obj

            data = {"nome": nome}
            if hasattr(Produto, "empresa"):
                data["empresa"] = empresa

            # campos reais do seu model:
            if hasattr(Produto, "preco_venda"):
                data["preco_venda"] = preco

            if hasattr(Produto, "estoque_minimo"):
                data["estoque_minimo"] = minimo

            # defaults úteis se existirem
            if hasattr(Produto, "ativo"):
                data["ativo"] = True
            if hasattr(Produto, "controla_estoque"):
                data["controla_estoque"] = True

            return Produto.objects.create(**data)


        p1 = get_or_create_prod("Shampoo Neutro 5L (Demo)", Decimal("49.90"), minimo=2)
        p2 = get_or_create_prod("Perfume Pet 120ml (Demo)", Decimal("29.90"), minimo=5)
        p3 = get_or_create_prod("Luva de Tosa (Demo)", Decimal("19.90"), minimo=3)

        # ---- cria lotes (idempotente por produto + numero/lote quando existir)
        def get_or_create_lote(prod, numero, qtd, venc_dias):
            filtros = {}
            # campos típicos
            if hasattr(LoteProduto, "produto"):
                filtros["produto"] = prod
            if hasattr(LoteProduto, "empresa"):
                filtros["empresa"] = empresa
            # numero pode ser "numero", "codigo", "lote"
            if hasattr(LoteProduto, "numero"):
                filtros["numero"] = numero
            elif hasattr(LoteProduto, "codigo"):
                filtros["codigo"] = numero
            elif hasattr(LoteProduto, "lote"):
                filtros["lote"] = numero

            lote = LoteProduto.objects.filter(**filtros).first()
            if lote:
                # tenta atualizar saldo/qtd se existir
                if hasattr(lote, "saldo"):
                    lote.saldo = qtd
                elif hasattr(lote, "qtd"):
                    lote.qtd = qtd
                lote.save()
                return lote

            data = dict(filtros)

            # vencimento
            venc = now.date() + timezone.timedelta(days=venc_dias)
            if hasattr(LoteProduto, "vencimento"):
                data["vencimento"] = venc
            elif hasattr(LoteProduto, "validade"):
                data["validade"] = venc

            # quantidades
            if hasattr(LoteProduto, "saldo"):
                data["saldo"] = qtd
            elif hasattr(LoteProduto, "qtd"):
                data["qtd"] = qtd
            elif hasattr(LoteProduto, "quantidade"):
                data["quantidade"] = qtd

            # preco_unit se existir
            if hasattr(LoteProduto, "preco_unit"):
                data["preco_unit"] = getattr(prod, "preco", Decimal("0")) or Decimal("0")

            return LoteProduto.objects.create(**data)

        # 2 lotes ok + 1 lote vencido (pra mostrar ranking/alertas)
        get_or_create_lote(p1, "L-DEM-001", 12, venc_dias=120)
        get_or_create_lote(p2, "L-DEM-002", 25, venc_dias=60)
        get_or_create_lote(p3, "L-DEM-003", 7, venc_dias=-10)  # vencido

        self.stdout.write(self.style.SUCCESS("✅ Dados DEMO semeados com sucesso!"))
        self.stdout.write(f"Empresa DEMO: {empresa.nome} (id={empresa.id})")
        self.stdout.write("👉 Recarregue PDV e Estoque; agora devem aparecer produtos/lotes.")
