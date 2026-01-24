# 🧭 CHECKPOINT — UX Lotes Críticos

Data: 2026-01-24
Módulo: Dashboard Financeiro / Estoque
Status: ✅ Concluído

## 🎯 Objetivo
Exibir lotes críticos de forma clara, acionável e sem alarmismo excessivo.

## ✅ Entregas
- Card “Lotes críticos” renderizando corretamente
- Estrutura Bootstrap corrigida (`card-header` + `card-body`)
- CTA direto “Ir para estoque” funcional
- Badges inteligentes:
  - MONITORAR (a vencer)
  - VENCIDO (sem saldo)
  - AÇÃO IMEDIATA (vencido com saldo)
- Tooltip explicativo em “AÇÃO IMEDIATA”

## 🧠 Decisões Técnicas
- Fonte única de dados: `/estoque/api/ranking-critico/`
- Renderização centralizada no JS do dashboard
- UX prioriza clareza e redução de erro humano

## 📌 Próximo passo
- Badge “NOVO” quando surgir lote crítico
- Persistir estado “novo” (ex: localStorage ou backend)
## 🧠 UX — Lotes Críticos (Finalizado)

- Renderização estável no dashboard
- CTA direto para estoque
- Badges inteligentes (Monitorar / Vencido / Ação Imediata)
- Tooltip explicativo
- Badge NOVO com rearme automático por hash
- Estado persistido em localStorage
- Fluxo claro: detectar → agir → resolver

Status: ✅ FECHADO
