# Admin Theme v1 — Spaço da Jhuséna

## Objetivo
- Fundo uniforme (sem “faixa”)
- Respeitar data-theme (dark/light/auto)
- Estilo só no Django Admin

## Regra de Ouro (não quebrar)
- Fundo fica em: html[data-theme] e body
- Wrappers (#main, #content-start, #content-related etc.) ficam transparentes

## Arquivos
- CSS: core/static/css/admin_custom.css
- Template: core/templates/admin/base_site.html (inclui o CSS)
