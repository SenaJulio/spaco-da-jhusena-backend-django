<<<<<<< HEAD
# 🐾 Spaço da Jhuséna — ERP Inteligente para Pet Shops (Backend)

Sistema completo de gestão desenvolvido para **pet shops, clínicas veterinárias e negócios de serviços**, com foco em **controle financeiro inteligente**, **estoque por lote com validade**, **agendamentos** e **Inteligência Artificial aplicada à tomada de decisão**.

Este repositório contém o **backend oficial do Spaço da Jhuséna**, desenvolvido em Django.

<p align="center">
  <!-- Badges -->
  <img src="https://img.shields.io/badge/status-em%20desenvolvimento-green?style=flat-square">
  <img src="https://img.shields.io/badge/version-0.9-blue?style=flat-square">
  <img src="https://img.shields.io/badge/Plataforma-GitHub%20Pages-black?style=flat-square">
  <img src="https://img.shields.io/badge/IA-Ativada-success?style=flat-square">
</p>
=======
# 🐾 Spaço da Jhuséna — ERP Inteligente para Pet Shops

Sistema completo de gestão desenvolvido para **pet shops, clínicas veterinárias e negócios de serviços**, com foco em **controle financeiro inteligente**, **estoque por lote com validade**, **alertas automáticos** e **Inteligência Artificial aplicada à tomada de decisão**.
>>>>>>> 519c13b (docs: atualiza README do ERP Spaço da Jhuséna (v1.0))

---

## 🧠 Visão Geral

<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
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
=======
> Abaixo ficará seu mockup ou print principal da interface.

=======
>>>>>>> 872dc69 (Enhance README formatting and content)
<p align="center">
  <img src="docs/preview-dashboard.png" alt="Painel Financeiro Inteligente — Demo" width="800">
</p>
=======
O **Spaço da Jhuséna** é um ERP real, criado a partir das necessidades práticas de um pet shop em operação, com o objetivo de:
>>>>>>> 519c13b (docs: atualiza README do ERP Spaço da Jhuséna (v1.0))

- organizar processos internos
- reduzir erros humanos
- oferecer visão clara das finanças
- automatizar alertas críticos
- apoiar decisões com Inteligência Artificial

Este repositório contém o **backend completo do sistema**, desenvolvido em Django.

---

## 🧩 Principais Módulos

### 💰 Financeiro Inteligente
- Controle de receitas, despesas e saldo
- Filtros por período e categorias
- Gráficos interativos (linha, pizza e rankings)
- Diagnósticos automáticos
- Resumo mensal com margem

### 🤖 Inteligência Artificial
- Análise automática dos últimos 30 dias
- Geração de insights financeiros
- Classificação de dicas (positiva / alerta / neutra)
- Histórico de recomendações
- Geração de dicas sob demanda

### 📦 Estoque Inteligente
- Controle de entradas e saídas
- Gestão por **lotes com validade**
- FIFO automático
- Bloqueio de venda de lote vencido
- Aviso de lote próximo do vencimento
- Alertas inteligentes integrados à IA

### 🛒 Vendas
- Registro de vendas
- Integração automática com estoque
- Geração de lançamentos financeiros
- Proteção contra inconsistências de estoque

### 🔔 Notificações Externas
- Integração com Telegram
- Integração com WhatsApp (Cloud API)
- Envio de alertas e insights automáticos

---

## 🛠️ Stack Tecnológica

- **Backend:** Python 3.13, Django 4.x
- **Banco de Dados:** SQLite (desenvolvimento) / PostgreSQL (produção)
- **Frontend:** HTML, Bootstrap, JavaScript
- **Gráficos:** Chart.js
- **IA:** Lógica própria baseada em análise financeira
- **Integrações:** Telegram Bot API, WhatsApp Cloud API

---

## 🔒 Regras de Negócio Importantes

- Venda de **lote vencido é bloqueada**
- Lote próximo do vencimento gera **aviso (warning)**
- Estoque não fica negativo
- Todas as operações críticas são transacionais
- Alertas não duplicam indevidamente

---

<<<<<<< HEAD
# 🧪 Como Rodar Localmente

A demo é 100% estática.  
Não há dependências nem servidor backend.
>>>>>>> 0c202ff (Revise README for demo clarity and formatting)
=======
## 🚀 Como Rodar Localmente
>>>>>>> 519c13b (docs: atualiza README do ERP Spaço da Jhuséna (v1.0))

### 1️⃣ Pré-requisitos
- Python 3.10 ou 3.11
- Git

---

### 2️⃣ Clonar o projeto
```bash
<<<<<<< HEAD
<<<<<<< HEAD
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
<<<<<<< HEAD
=======
Sena Júlio
Desenvolvedor do Spaço da Jhuséna
🔗 LinkedIn: https://www.linkedin.com/in/julio-sena-4668a7178/
=======
# Clone o repositório
git clone https://github.com/senajulio/jhusena-demo.git
=======
# Criar ambiente virtual
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
>>>>>>> 519c13b (docs: atualiza README do ERP Spaço da Jhuséna (v1.0))

# Instalar dependências
pip install -r requirements.txt

# Aplicar migrações
python manage.py migrate

# Criar usuário administrador
python manage.py createsuperuser

# Iniciar servidor
python manage.py runserver

<<<<<<< HEAD
<<<<<<< HEAD
>>>>>>> 2fa7464 (Revise README with project overview and features)
=======
Desenvolvedor: Sena Júlio
WhatsApp: +55 31 99489-8165
E-mail: gm.sena@hotmail.com
=======
Acesse:
http://127.0.0.1:8000/admin/
>>>>>>> 519c13b (docs: atualiza README do ERP Spaço da Jhuséna (v1.0))

📌 Status do Projeto

✅ Versão v1.0 — Funcional, estável e pronta para demonstração

Este sistema faz parte de um projeto maior que inclui:

versão demo pública

roadmap de evolução

versão comercial

📄 Licença

Este repositório contém código de um sistema proprietário.
Uso comercial, redistribuição ou cópia somente mediante autorização do autor.

👤 Autor

Sena Júlio
Desenvolvedor do Spaço da Jhuséna
LinkedIn: https://www.linkedin.com/in/julio-sena-4668a7178/

<<<<<<< HEAD
# Abra o index.html no navegador
>>>>>>> 0c202ff (Revise README for demo clarity and formatting)
=======

<<<<<<< HEAD
---

## 🎯 Agora sim: README COMPLETO, PROFISSIONAL e INTEGRAL.

Se quiser, posso:

🔸 Criar uma **versão ainda mais premium** com seções estilizadas  
🔸 Criar **badges personalizadas**  
🔸 Criar um **mockup futurista da landing**  
🔸 Criar um **PDF comercial** pra enviar pra clientes

Só falar!

>>>>>>> 872dc69 (Enhance README formatting and content)
=======
>>>>>>> 519c13b (docs: atualiza README do ERP Spaço da Jhuséna (v1.0))
>>>>>>> origin/main
