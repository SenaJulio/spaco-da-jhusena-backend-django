# 🐶 Spaço da Jhuséna — Backend (Django + IA)

Mini-ERP e **Painel Financeiro Inteligente** com recomendações automáticas (Mini-IA).  
Integra dados financeiros, gráficos e inteligência para otimizar decisões do negócio.

---

## 🚀 Principais Recursos
- 📊 **Dashboard:** Receitas, Despesas, Saldo e gráfico interativo  
- 🧠 **Mini-IA:** recomendações automáticas (ex.: “Saldo POSITIVO 57.1%…”)  
- 🕒 **Histórico da IA:** timeline com dicas anteriores  
- 🔎 **Filtros + “Ver mais”** — *(Fase 4)*  
- 🔔 **Notificações (Telegram/WhatsApp)** — *(Fase 5)*  
- 📈 **Analytics (tendências 30 dias, categorias)** — *(Fase 6)*  

---

## 🧩 Stack
- **Python 3** · **Django 4+**  
- **Bootstrap 5** · **Chart.js**  
- **SQLite** (ambiente de desenvolvimento)  
- **jQuery/Alpine.js** (auxílio no front)

---

## ⚙️ Setup Rápido (dev)
```bash
python -m venv venv
# Windows (PowerShell)
.\venv\Scripts\Activate.ps1
# Git Bash / MINGW
source venv/Scripts/activate

pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver

Acesse: http://127.0.0.1:8000/financeiro/dashboard/

🔐 Exemplo de .env
DEBUG=True
SECRET_KEY=troque-esta-chave
ALLOWED_HOSTS=127.0.0.1,localhost
TIME_ZONE=America/Sao_Paulo
LANGUAGE_CODE=pt-br

🗂️ Estrutura (resumo)
core/            # settings e urls
financeiro/      # painel + IA
clientes/ estoque/ servicos/ usuarios/ vendas/
static/ staticfiles/
manage.py  requirements.txt  README.md

🔗 Links úteis

➡️ Frontend (React): SenaJulio/spaco-da-jhusena

💚 Desenvolvido por Júlio Sena — projeto real em evolução.