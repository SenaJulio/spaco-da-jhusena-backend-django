# 🧭 CHECKPOINT — Spaço da Jhuséna

Data: 2026-01-20  
Branch: main  
Commit-base (ponto estável): a74bf73  

## ✅ O que está 100% funcionando (1 frase)
Modo DEMO seguro e vendável + PDV com bloqueio de ações e toasts amigáveis.

---

## 🚦 Smoke Test (2 minutos) — COMO CONFIRMAR QUE TÁ OK
1. Login com usuário: demo
2. Abrir /pdv/
3. Adicionar 2 produtos no carrinho
4. Clicar FINALIZAR
✅ Esperado: Toast “Ação desabilitada no MODO DEMO” + resposta 403 sem travar botão

5. Login com usuário real (admin/operador)
6. Abrir /pdv/
7. Finalizar uma venda real
✅ Esperado: venda salva + estoque movimentado

---

## 🧪 Como ligar DEMO (comandos)
python manage.py create_demo
python manage.py seed_demo

---

## ⚠️ Erros comuns e correção rápida
- IntegrityError empresa_id NULL:
  ✅ conferir core/signals.py (perfil sempre com empresa)
- Unicode quebrado em mensagens:
  ✅ ensure_ascii=False nas respostas JSON
- Botão FINALIZAR fica preso:
  ✅ pdv.js destrava em catch/finally

---

## 🎯 Próximo passo ÚNICO (micro-passo)
[ ] Expandir @bloquear_demo para TODOS os endpoints sensíveis (CRUD produtos/estoque/config).

Arquivos prováveis:
- core/decorators.py
- urls / views de estoque e produtos

---

## 📂 Arquivos-chave mexidos neste marco
- core/decorators.py
- core/signals.py
- core/management/commands/create_demo.py
- core/management/commands/seed_demo.py
- pdv/views.py
- pdv/static/pdv/pdv.js
- templates/base.html
