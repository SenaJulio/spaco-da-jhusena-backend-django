### Contexto rápido

Este repositório é o backend Django (Python 3, Django 5.2.x) do projeto "Spaço da Jhuséna" — um mini-ERP com painel financeiro e um componente de "Mini-IA" que gera recomendações e insights a partir de transações.

Principais apps: `core`, `financeiro`, `clientes`, `produtos`, `servicos`, `agendamentos`, `vendas`, `usuarios`, `estoque`.

Ponto de entrada: `manage.py`. Configurações em `config/settings.py`. Banco local de desenvolvimento: `db.sqlite3`.

### Objetivo das instruções

Fornecer orientação prática e exemplos para agentes AI (Copilot-style) que vão editar, debugar ou adicionar features neste código. Foque em mudanças pequenas e seguras: novas views, correções em endpoints de IA, pequenas melhorias em queries e compatibilidade com modelos legados.

### Regras e convenções importantes

- Virtualenv: projeto usa virtualenv; scripts de desenvolvimento no README. No Windows PowerShell ative com `.\venv\Scripts\Activate.ps1`.
- Dependências: `requirements.txt` (Django 5.2.4). Não adicione versões maiores sem atualizar `requirements.txt`.
- Timezone & idioma: `TIME_ZONE = 'America/Sao_Paulo'` e `LANGUAGE_CODE = 'pt-br'` — formatação de datas e strings deve respeitar pt-br quando for exibida ao usuário.
- Models legados: handlers de IA e histórico tentam usar tanto `RecomendacaoIA` quanto `Insight`/`HistoricoIA`. Verifique existência com `apps.get_model('financeiro', 'RecomendacaoIA')` antes de assumir campos.
- Datas: muitos endpoints aceitam DateField ou DateTimeField. Use helpers fornecidos (`_date_range_kwargs`, `TruncDate`, `_parse_ymd`) para compatibilidade.

### Padrões de código observados (exemplos)

- Endpoints de IA e dashboard: `financeiro/views_financeiro.py` contém helpers reutilizáveis — prefira reutilizá-los em novas rotas.
  - Ex.: gerar dica 30 dias chama `financeiro/services/ia.py::generate_tip_last_30d(Transacao)` e depois persiste em `RecomendacaoIA`/`HistoricoIA` quando possíveis.
- Serviços: código de "IA" fica em `financeiro/services/ia.py` — mantenha lógica estatística simples lá (retorne texto + metrics dict).
- Serialização leve: endpoints JSON retornam dicionários simples (ex.: `ia_resumo_mensal`, `dados_grafico_filtrados`) — siga o mesmo formato para compatibilidade com o frontend.

### Fluxo de dados e integrações chave

- Transações são o dado fonte (`financeiro.models.Transacao`). Campos esperados: `tipo`, `valor`, `data`, possivelmente `categoria`.
- O pipeline IA: consultas em `Transacao` -> `services/ia.generate_tip_last_30d` -> view salva em `RecomendacaoIA` e/ou `HistoricoIA` e retorna JSON para o frontend.

### Testes e execução rápida

- Rodar migrações e servidor (dev):
  1. Ativar venv (PowerShell): `.\venv\Scripts\Activate.ps1`
  2. `pip install -r requirements.txt`
  3. `python manage.py migrate`
  4. `python manage.py runserver`
- Tests: `pytest` (configurado via `pytest.ini` que define DJANGO_SETTINGS_MODULE=config.settings).

### Orientações de alteração segura para agentes

- Ao modificar endpoints que filtram por data, use `_date_range_kwargs` para evitar regressões entre DateField/DateTimeField.
- Ao persistir recomendações (RecomendacaoIA/HistoricoIA), cheque campos dinamicamente (conforme `views_financeiro.py`) para manter compatibilidade com deploys que tenham esquemas diferentes.
- Prefira adicionar pequenas funções em `financeiro/services/` para lógica não relacionada a HTTP (facilita testes).
- Evite hardcodar credenciais: `config/settings.py` atualmente contém um SECRET_KEY e EMAIL_HOST_PASSWORD em texto — não modifique para produzir credenciais válidas, mas ao preparar código para produção, extraia para variáveis de ambiente.

### Arquivos/chaves para referência rápida

- `config/settings.py` — configurações centrais, INSTALLED_APPS, timezone, staticfiles
- `manage.py` — CLI do Django
- `financeiro/views_financeiro.py` — endpoints do painel e IA, helpers de data e compatibilidade com modelos legados
- `financeiro/models.py` — Transacao, Insight, RecomendacaoIA
- `financeiro/services/ia.py` — lógica de geração de dicas (retorna (texto, metrics))
- `financeiro/urls.py` — rotas públicas do app (ex.: `/financeiro/ia/resumo-mensal/`, `/financeiro/modo-turbo/dica30d/`)
- `README.md` — instruções de setup e visão geral do projeto

### Segurança e limites

- Não exponha senhas ou chaves que apareçam em `settings.py` para repositórios externos. Se for necessário alterar o arquivo, mova segredos para env vars e deixe placeholders.
- Evite rodar jobs pesados na mesma request; se adicionar processamento mais custoso, avalie delegar para task queue (não presente hoje).

Se algo importante estiver em falta ou você quiser que eu seja mais detalhado em alguma seção (ex.: padrões de template, fluxo de deploy), diga o alvo e eu atualizo esse arquivo.
