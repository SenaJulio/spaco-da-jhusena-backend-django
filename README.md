<p align="center">
  <strong>🐶 Spaço da Jhuséna — Backend (Django + IA)</strong><br>
  Mini-ERP e Painel Financeiro Inteligente com recomendações automáticas (Mini-IA)
</p>

---

## 🚀 Principais Recursos
- 📊 Dashboard (Receitas, Despesas, Saldo, gráfico)
- 🧠 Mini-IA: recomendações automáticas (ex.: “Saldo POSITIVO 57.1%…”)
- 🕒 Histórico de dicas da IA (timeline)
- 🔎 Filtros do histórico + “Ver mais” (Fase 4)
- 🔔 Notificações (Telegram/WhatsApp) — Fase 5
- 📈 Analytics (tendências 30 dias, categorias) — Fase 6

## 🧩 Stack
- **Python 3** · **Django 4+**
- **Bootstrap 5** · **Chart.js**
- SQLite (dev)
- jQuery/Alpine.js (auxiliar no front)

## ⚙️ Setup Rápido (dev)
```bash
python -m venv venv
# Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# Git Bash/MINGW:
source venv/Scripts/activate

pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver

DEBUG=True
SECRET_KEY=troque-esta-chave
ALLOWED_HOSTS=127.0.0.1,localhost
TIME_ZONE=America/Sao_Paulo
LANGUAGE_CODE=pt-br

core/            # settings/urls
financeiro/      # painel + IA
clientes/ estoque/ servicos/ usuarios/ vendas/
static/ staticfiles/
manage.py  requirements.txt  README.md
