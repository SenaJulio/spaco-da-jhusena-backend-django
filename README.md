# 🐾 Spaço da Jhuséna — ERP Inteligente para Pet Shops (Backend)

Sistema completo de gestão desenvolvido para **pet shops, clínicas veterinárias e negócios de serviços**, com foco em **controle financeiro inteligente**, **estoque por lote com validade**, **agendamentos** e **Inteligência Artificial aplicada à tomada de decisão**.

Este repositório contém o **backend oficial do Spaço da Jhuséna**, desenvolvido em Django.

---

## 🧠 Visão Geral

O **Spaço da Jhuséna** é um ERP real, criado a partir das necessidades práticas de um pet shop em operação, com o objetivo de:

- organizar processos internos
- reduzir erros humanos
- evitar perdas com estoque vencido
- oferecer visão clara das finanças
- automatizar alertas críticos
- apoiar decisões com Inteligência Artificial

👉 **Status:** v1.0 funcional, estável e pronto para demonstração e implantação assistida.

---

## 🧩 Principais Módulos

### 💰 Financeiro Inteligente
- Controle de receitas, despesas e saldo
- Filtros por período e categorias
- Gráficos interativos (linha, pizza e rankings)
- Diagnósticos automáticos
- Resumo mensal com margem e crescimento

### 🤖 Inteligência Artificial
- Análise automática dos últimos 30 dias
- Geração de insights financeiros
- Classificação de dicas (positiva / alerta / neutra)
- Histórico de recomendações
- Geração de dicas sob demanda pelo painel

### 📦 Estoque Inteligente (por Lotes)
- Controle de entradas e saídas
- Gestão por **lotes com validade**
- FIFO automático
- Bloqueio de venda de lote vencido
- Aviso de lote próximo do vencimento
- Ranking de lotes críticos
- Alertas integrados à IA

### 📅 Agendamentos
- Página pública de agendamento
- Dashboard interno com:
  - contadores
  - gráfico de status
  - agendamentos do dia
  - ações rápidas (concluir / cancelar)
- Integração com financeiro (serviço concluído gera receita)

### 🛒 Vendas
- Registro de vendas
- Integração automática com estoque
- Geração de lançamentos financeiros
- Proteção contra estoque negativo

### 🔔 Notificações Externas
- Integração com Telegram (funcional)
- Estrutura pronta para WhatsApp Cloud API
- Envio de alertas e insights automáticos

---

## 🛠️ Stack Tecnológica

- **Backend:** Python 3.10+ / Django 4.x
- **Banco de Dados:** SQLite (desenvolvimento) / PostgreSQL (produção)
- **Frontend:** HTML, Bootstrap, JavaScript
- **Gráficos:** Chart.js
- **IA:** Lógica própria baseada em análise financeira
- **Integrações:** Telegram Bot API, WhatsApp Cloud API

---

## 🔒 Regras de Negócio Importantes

- Venda de **lote vencido é bloqueada**
- Lote próximo do vencimento gera **aviso explícito**
- Estoque não fica negativo
- Operações críticas são transacionais
- Alertas não duplicam indevidamente

---

## 🚀 Como Rodar Localmente

### 1️⃣ Pré-requisitos
- Python 3.10 ou 3.11
- Git

---

### 2️⃣ Clonar o projeto
```bash
git clone https://github.com/SenaJulio/spaco-da-jhusena-backend-django.git
cd spaco-da-jhusena-backend-django


3️⃣ Criar ambiente virtual

Windows

python -m venv venv
venv\Scripts\activate


Linux / Mac

python3 -m venv venv
source venv/bin/activate

4️⃣ Instalar dependências
pip install -r requirements.txt


5️⃣ Configurar variáveis de ambiente

Crie o arquivo .env a partir do modelo:

cp .env.example .env

Edite o .env conforme necessário:

DJANGO_SECRET_KEY=coloque_sua_chave
DEBUG=True
ALLOWED_HOSTS=127.0.0.1,localhost
TIME_ZONE=America/Sao_Paulo
LANGUAGE_CODE=pt-br


6️⃣ Banco de dados
python manage.py migrate

7️⃣ Criar usuário administrador
python manage.py createsuperuser


8️⃣ Iniciar servidor
python manage.py runserver


Acesse:

Admin: http://127.0.0.1:8000/admin/

Home: http://127.0.0.1:8000/


🔗 Rotas Principais

/ — Tela inicial

/admin/ — Administração

/financeiro/dashboard/

/estoque/dashboard/

/agendamentos/dashboard/

/agendamentos/agendar/ (público)



📌 Status do Projeto

✅ Versão v1.0 — Funcional, estável e pronta para demonstração
🔜 Evoluções futuras incluem melhorias de UX, mobile e automações adicionais.


📄 Licença

Este repositório contém código de um sistema proprietário.
Uso comercial, redistribuição ou cópia somente mediante autorização do autor.



👤 Autor

Sena Júlio
Desenvolvedor do Spaço da Jhuséna
🔗 LinkedIn: https://www.linkedin.com/in/julio-sena-4668a7178/