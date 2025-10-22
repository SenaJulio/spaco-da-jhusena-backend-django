# tests/test_agendamentos_smoke.py
from django.test import Client, TestCase
from django.urls import reverse


class AgendamentosSmokeTests(TestCase):
    def setUp(self):
        self.client = Client()

    def test_reverse_agendar_resolve(self):
        url = reverse("agendamentos:agendar")
        # Evita hardcode; só checa que termina com /agendar/
        self.assertTrue(url.endswith("/agendar/"), f"URL inesperada: {url}")

    def test_agendar_get_200(self):
        url = reverse("agendamentos:agendar")
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, 200)
