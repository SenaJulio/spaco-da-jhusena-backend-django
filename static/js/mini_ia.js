// static/js/mini_ia.js
(function () {
  "use strict";
  if (window.__MINI_IA_INIT__) return;
  window.__MINI_IA_INIT__ = true;

  const qs = (s) => document.querySelector(s);
  const getCsrf = () =>
    qs('meta[name="csrf-token"]')?.content ||
    document.cookie.match(/(^|;)\s*csrftoken=([^;]+)/)?.[2] ||
    "";

  function show(el, on = true) {
    if (!el) return;
    el.classList.toggle("d-none", !on);
  }

  document.addEventListener("DOMContentLoaded", () => {
    const btn = qs("#btnTurbo");
    if (!btn) return; // layout sem o botão

    const st = qs("#turboStatus");
    const box = qs("#turboResult");
    const dica = qs("#turboDica");
    const metUl = qs("#turboMetrics");

    btn.addEventListener("click", async () => {
      show(st, true);
      st.textContent = "Analisando últimos 30 dias…";
      btn.disabled = true;

      try {
        const r = await fetch("/financeiro/ia/gerar_dica_30d/", {
          method: "POST",
          headers: {
            "X-Requested-With": "XMLHttpRequest",
            "X-CSRFToken": getCsrf(),
          },
          credentials: "same-origin",
        });

        const j = await r.json();
        if (!j.ok) throw new Error("Falha ao gerar dica");

        // Mostra a dica no card β Mini-IA
        show(box, true);
        if (dica) dica.textContent = j.salvo?.texto || j.texto || j.dica || "—";

        if (metUl) {
          metUl.innerHTML = "";
          const mx = j.salvo?.metrics || j.metrics || {};
          for (const [k, v] of Object.entries(mx)) {
            metUl.insertAdjacentHTML(
              "beforeend",
              `<li><strong>${k}</strong>: ${v}</li>`
            );
          }
        }
        // guarda o ID recém-criado para destacar no histórico
        window.__LAST_DICA_ID__ = j.salvo?.id || j.id || null;

        // ✅ NOVO: atualiza o histórico imediatamente
        if (typeof window.carregarHistorico === "function") {
          console.log("🔄 Atualizando histórico após gerar dica...");
          await window.carregarHistorico(
            10,
            window.__HistoricoIA?.filtro || "",
            false
          );
        }

        st.textContent = "✅ Dica gerada, exibida e adicionada ao histórico!";
      } catch (err) {
        console.error("Mini-IA:", err);
        st.textContent = "❌ Erro ao gerar dica dos últimos 30 dias.";
      }
    });
  });
})();
