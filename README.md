<div align="center">

# 🐾 **Spaço da Jhuséna**  
### 💚 Painel Financeiro Inteligente + Mini ERP Pet Shop

<img src="https://i.imgur.com/Sg2EhRc.png" alt="Banner Spaço da Jhuséna" width="700"/>

> Sistema de gestão financeira e inteligência artificial desenvolvido em **Django + Bootstrap + Chart.js + IA Analítica**.  
> O projeto nasceu para transformar os dados do pet shop em decisões automáticas, precisas e inteligentes.

---

</div>

<p align="center">
  <img src="https://img.shields.io/badge/Django-5.0+-success?style=for-the-badge&logo=django">
  <img src="https://img.shields.io/badge/Python-3.11-blue?style=for-the-badge&logo=python">
  <img src="https://img.shields.io/badge/Chart.js-Visual%20Analytics-orange?style=for-the-badge&logo=chartdotjs">
  <img src="https://img.shields.io/badge/IA-Financeira-purple?style=for-the-badge&logo=openai">
</p>

---

## 💡 Visão Geral

O **Spaço da Jhuséna** é um **mini-ERP com IA** voltado para pet shops e microempresas.  
Ele combina **gestão financeira, análise automática e inteligência artificial**, permitindo:

- Controle de receitas, despesas e categorias;
- Geração de **dicas financeiras inteligentes** baseadas nos últimos 30 dias;
- Histórico detalhado com classificação **(positiva / alerta / neutra)**;
- Painel com **gráficos interativos (Chart.js)**;
- Botão **“Gerar Dica com IA”** (modo Turbo);
- Estrutura modular pronta para expansão (agendamentos, estoque e PDV).

---

## ⚙️ Instalação e Configuração

```bash
# 1. Clonar o repositório
git clone git@github.com:SenaJulio/spaco-da-jhusena-backend-django.git
cd spaco-da-jhusena-backend-django

# 2. Criar e ativar o ambiente virtual
python -m venv venv
source venv/Scripts/activate  # Windows
# ou
source venv/bin/activate      # Linux / Mac

# 3. Instalar dependências
pip install -r requirements.txt

# 4. Criar o banco de dados
python manage.py migrate

# 5. Criar superusuário
python manage.py createsuperuser

# 6. Executar o servidor local
python manage.py runserver


👉 Acesse no navegador:
http://127.0.0.1:8000/financeiro/dashboard/


📁 Estrutura de Pastas
financeiro/
 ├── models.py                # Modelos: Transacao, RecomendacaoIA, Insight
 ├── views_financeiro.py      # Lógica principal e endpoints da IA
 ├── services/
 │    └── ia.py               # Módulo de inteligência artificial (map_tipo + generate_tip_last_30d)
 ├── templates/financeiro/
 │    └── dashboard.html      # Painel financeiro com IA
 └── static/js/
      └── historico_ia.js     # Controle do histórico e filtros de dicas
core/
 ├── templates/base.html      # Template base
config/
 ├── settings.py              # Configuração principal do Django


✅ Fase 1 — Fundamentos do Painel Financeiro

| Módulo                                             | Descrição                                               | Status |
| -------------------------------------------------- | ------------------------------------------------------- | ------ |
| 🧱 Estrutura Django + apps (`financeiro`, `core`)  | Projeto funcional e modularizado                        | ✅      |
| 💾 Models `Transacao`, `RecomendacaoIA`, `Insight` | Estrutura de dados completa                             | ✅      |
| 💡 Função `generate_tip_last_30d()`                | IA gera dica com base nos últimos 30 dias               | ✅      |
| 🧠 Classificador `_map_tipo()`                     | Analisa e classifica dicas (positiva / alerta / neutra) | ✅      |
| 🔗 Endpoint `/financeiro/ia/dica30d/`              | Retorna nova dica e salva no histórico                  | ✅      |
| 📊 Gráficos Chart.js (receitas/despesas/saldo)     | Integrados ao dashboard                                 | ✅      |
| 🧾 Histórico da IA (`/v2/`)                        | Feed JSON com contadores e filtros dinâmicos            | ✅      |
| 🧩 `historico_ia.js` (frontend unificado)          | Controla filtros, recarrega e atualiza badges           | ✅      |
| 🧑‍💼 Template `dashboard.html`                    | Layout limpo, responsivo e integrado à IA               | ✅      |
| 🔐 Sistema de login e usuário vinculado            | IA e dados isolados por conta                           | ✅      |


🚀 Fase 2 — Inteligência e Histórico Expandido (em andamento)

| Módulo                                                 | Descrição                              | Status          |
| ------------------------------------------------------ | -------------------------------------- | --------------- |
| 🕐 Histórico completo com “Ver mais” e paginação       | Carregar +10 por vez no feed v2        | ⚙️ Em andamento |
| 🗂️ Filtros (Positivas / Alertas / Neutras)            | Backend + frontend sincronizados       | ✅               |
| 🧩 Histórico `RecomendacaoIA`                          | Banco e lógica 100% operantes          | ✅               |
| 🧠 IA aprende com últimos 30 dias                      | Análise consolidada e testada          | ✅               |
| 💬 Registro de ações do usuário (“seguido / ignorado”) | Futuro aprimoramento de aprendizado    | ⏳ Pendente      |
| 🔔 Notificações automáticas (WhatsApp / Telegram)      | Dicas semanais e alertas financeiros   | ⏳ Pendente      |
| 📈 Gráfico comparativo de tipos de dica                | Chart.js (positivas, alertas, neutras) | ⏳ Pendente      |
| 🧩 Integração com agendamentos e estoque               | Expansão ERP completa                  | ⏳ Planejado     |


🌐 Fase 3 — Deploy e Acesso Externo


| Módulo                          | Descrição                       | Status      |
| ------------------------------- | ------------------------------- | ----------- |
| ☁️ Publicação do backend Django | Render / Railway / Deta         | ⏳ A fazer   |
| 🔑 Variáveis de ambiente `.env` | Config segura de chaves e banco | ⏳ A fazer   |
| 🧭 Domínio personalizado        | Ex: `spacodajhusena.site`       | ⏳ A fazer   |
| 💻 Painel público para clientes | Agendamento de serviços online  | ⏳ Planejado |


🧠 Fase 4 — IA Estratégica e Automação

| Módulo                                 | Descrição                                   | Status      |
| -------------------------------------- | ------------------------------------------- | ----------- |
| 📊 Comparativo 30d vs 30d anterior     | IA detecta tendências automáticas           | ⏳ Planejado |
| 🪄 Planos de ação automáticos          | Sugestões personalizadas da IA              | ⏳ Planejado |
| 🧾 Histórico IA exportável (PDF/Excel) | Relatórios inteligentes                     | ⏳ Planejado |
| 💬 Chat interativo com IA              | "Pergunte à IA Financeira" dentro do painel | ⏳ Planejado |

🧩 Status Técnico

✅ Branch ativa: dev

🔑 Autenticação SSH GitHub configurada

🧠 IA financeira validada e funcional

⚙️ Backend testado com dados reais (julioSena)

🧩 Estrutura modular pronta para expansão

💚 Cor predominante: Verde — identidade visual Spaço da Jhuséna


💬 Créditos
Desenvolvido com ❤️ por Júlio Sena
Agente de Trânsito, desenvolvedor e criador do Projeto Spaço da Jhuséna.
Mentoria técnica: ChatGPT (OpenAI) — Modo Dev IA Django
2025 © Todos os direitos reservados.


"Transformando gestão pet shop em inteligência de negócio."
— Spaço da Jhuséna 🐾💚


---

