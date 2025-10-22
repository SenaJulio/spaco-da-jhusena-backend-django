# tests/test_financeiro_smoke.py
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import Client, TestCase
from django.urls import reverse

from financeiro.models import Insight

User = get_user_model()


class FinanceiroSmokeTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(username="jose", password="123456", is_staff=True)

    def test_dashboard_requires_login(self):
        # ajuste a URL do seu dashboard se for diferente
        resp = self.client.get("/financeiro/dashboard/")
        self.assertIn(resp.status_code, (302, 301))  # redireciona pro login

    def test_listar_insights_autenticado(self):
        self.client.login(username="jose", password="123456")
        Insight.objects.create(title="Teste", text="ok", kind="TIP", generated_by="manual")
        url = reverse("financeiro:listar_insights")
        r = self.client.get(url)
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertTrue(data.get("ok"))
        self.assertGreaterEqual(len(data.get("items", [])), 1)

    def test_gerar_insight_cria_registro(self):
        self.client.login(username="jose", password="123456")
        cache.clear()  # evita bloquear pelo rate-limit
        url = reverse("financeiro:gerar_insight")
        before = Insight.objects.count()
        r = self.client.post(url)
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertTrue(data.get("ok"))
        self.assertGreater(Insight.objects.count(), before)
