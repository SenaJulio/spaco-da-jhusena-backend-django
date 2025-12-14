# 🐾 Spaço da Jhuséna — ERP Inteligente para Pet Shops

Sistema completo de gestão desenvolvido para **pet shops, clínicas veterinárias e negócios de serviços**, com foco em **controle financeiro inteligente**, **estoque por lote com validade**, **alertas automáticos** e **Inteligência Artificial aplicada à tomada de decisão**.

---

## 🧠 Visão Geral

O **Spaço da Jhuséna** é um ERP real, criado a partir das necessidades práticas de um pet shop em operação, com o objetivo de:

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

## 🚀 Como Rodar Localmente

```bash
# Criar ambiente virtual
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Instalar dependências
pip install -r requirements.txt

# Aplicar migrações
python manage.py migrate

# Criar usuário administrador
python manage.py createsuperuser

# Iniciar servidor
python manage.py runserver

Acesse:
http://127.0.0.1:8000/admin/

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


