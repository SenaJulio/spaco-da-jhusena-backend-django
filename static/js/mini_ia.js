// static/js/mini_ia.js
(function () {
  "use strict";
  if (window.__MINI_IA_INIT__) return;
  window.__MINI_IA_INIT__ = true;

  const qs = (s) => document.querySelector(s);

  // Helper CSRF único
  const getCsrf = () =>
    qs('meta[name="csrf-token"]')?.content ||
    document.cookie.match(/(^|;)\s*csrftoken=([^;]+)/)?.[2] ||
    "";

  function show(el, on = true) {
    if (!el) return;
    el.classList.toggle("d-none", !on);
  }

  function resetCardTipo(card) {
    if (!card) return;
    card.classList.remove(
      "sj-ia-card-positive",
      "sj-ia-card-alert",
      "sj-ia-card-neutral"
    );
  }

  function aplicarEstiloPorTipo(card, tipo, tipoSpan) {
    if (!card) return;

    resetCardTipo(card);

    let emoji = "ℹ️";
    let label = "Neutra";

    if (tipo === "positiva") {
      card.classList.add("sj-ia-card-positive");
      emoji = "✅";
      label = "Positiva";
      tipoSpan?.classList.remove("sj-ia-chip-alerta", "sj-ia-chip-neutra");
      tipoSpan?.classList.add("sj-ia-chip-positiva");
    } else if (tipo === "alerta") {
      card.classList.add("sj-ia-card-alert");
      emoji = "⚠️";
      label = "Alerta";
      tipoSpan?.classList.remove("sj-ia-chip-positiva", "sj-ia-chip-neutra");
      tipoSpan?.classList.add("sj-ia-chip-alerta");
    } else {
      card.classList.add("sj-ia-card-neutral");
      tipoSpan?.classList.remove("sj-ia-chip-positiva", "sj-ia-chip-alerta");
      tipoSpan?.classList.add("sj-ia-chip-neutra");
    }

    if (tipoSpan) {
      tipoSpan.textContent = `${emoji} ${label}`;
    }
  }

  // === Enviar última dica para Telegram ===
  async function sjEnviarUltimaDicaTelegram() {
    const btn = document.getElementById("btnEnviarDicaTelegram");
    if (!btn) return;

    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Enviando...";

    try {
      const resp = await fetch("/financeiro/ia/enviar_dica_30d/", {
        method: "POST",
        headers: {
          "X-CSRFToken": getCsrf(),
          "X-Requested-With": "XMLHttpRequest",
        },
        credentials: "same-origin",
      });

      const data = await resp.json();

      if (!resp.ok || !data.ok) {
        const msg = (data && data.error) || "Falha ao enviar dica.";
        alert("❌ Erro ao enviar para o Telegram:\n" + msg);
      } else {
        alert("✅ Dica enviada para o Telegram com sucesso!");
        console.log("Enviado:", data.enviado);
      }
    } catch (err) {
      console.error("Erro ao enviar dica para Telegram:", err);
      alert("❌ Erro inesperado ao enviar a dica. Veja o console.");
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const btnGerar = qs("#btnGerarDicaIA");
    const st = qs("#turboStatus");
    const box = qs("#turboResult");
    const dica = qs("#turboDica");
    const metUl = qs("#turboMetrics");
    const card = qs(".sj-card-ia");
    const spanTipo = qs("#turboTipo");
    const spanPeriodo = qs("#turboPeriodo");
    const bar = qs("#iaSuccessBar");
    const iaIcon = qs("#iaIcon");

    // --- Botão GERAR DICA ---
    if (btnGerar) {
      btnGerar.addEventListener("click", async () => {
        show(st, true);
        st.textContent = "Analisando últimos 30 dias…";
        btnGerar.disabled = true;

        if (iaIcon) {
          iaIcon.classList.add("sj-ia-spin");
        }

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
          console.log("DEBUG DICA:", j);
          if (!j.ok) throw new Error(j.error || "Falha ao gerar dica");

          // Mostra a dica no card β Mini-IA
          show(box, true);

          const salvo = j.salvo || {};
          const texto = salvo.texto || j.texto || j.dica || "—";
          const metrics = salvo.metrics || j.metrics || {};
          const periodo = salvo.periodo || j.periodo || {};

          // Texto principal
          if (dica) {
            dica.textContent = texto;
            dica.classList.remove("sj-ia-fade");
            dica.getBoundingClientRect(); // reinicia animação sem warning
            dica.classList.add("sj-ia-fade");
          }

          // Período
          if (spanPeriodo) {
            const pi = periodo.inicio || "—";
            const pf = periodo.fim || "—";
            spanPeriodo.textContent = `${pi} → ${pf}`;
          }

          // Tipo
          const tipo = salvo.tipo || j.tipo || "neutra";
          aplicarEstiloPorTipo(card, tipo, spanTipo);

          // Métricas
          if (metUl) {
            metUl.innerHTML = "";
            const mx = metrics || {};
            for (const [k, v] of Object.entries(mx)) {
              metUl.insertAdjacentHTML(
                "beforeend",
                `<li><strong>${k}</strong>: ${v}</li>`
              );
            }
          }
          // id da nova dica salva no backend
          const novoId = salvo.id || j.id || null;

          // Atualiza o histórico com o filtro atual
          if (novoId != null) {
            if (
              typeof window.recarregarHistoricoComFiltroAtual === "function"
            ) {
              console.log("🔄 Recarregando histórico com filtro atual…");
              await window.recarregarHistoricoComFiltroAtual();
            } else if (typeof window.carregarHistorico === "function") {
              console.log("🔄 Recarregando histórico padrão…");
              await window.carregarHistorico(
                20,
                window.__HistoricoIA?.filtro || "",
                false
              );
            }

            // Depois que recarregar, destaca o card certo
            setTimeout(() => {
              const cont = document.getElementById("listaHistorico");
              if (!cont) return;

              const item = cont.querySelector(`.ia-card[data-id="${novoId}"]`);
              if (!item) return;

              item.classList.add("just-added");
              item.scrollIntoView({ behavior: "smooth", block: "center" });

              // remove o destaque depois de 2s
              setTimeout(() => {
                item.classList.remove("just-added");
              }, 8000);
            }, 500);
          }

          // guarda o ID recém-criado para destacar no histórico
          // guarda o ID recém-criado para destacar no histórico
          window.__LAST_DICA_ID__ = salvo.id || j.id || null;

          // Atualiza o histórico usando o helper global do dashboard
          if (typeof window.recarregarHistoricoComFiltroAtual === "function") {
            console.log(
              "🔄 Atualizando histórico após gerar dica (filtro atual)..."
            );
            await window.recarregarHistoricoComFiltroAtual();
          }

          // Depois de recarregar, destacamos visualmente a nova dica
          setTimeout(() => {
            const lastId = window.__LAST_DICA_ID__;
            if (!lastId) return;

            const item = document.querySelector(`[data-id='${lastId}']`);
            if (!item) return;

            // aplica highlight visual
            item.classList.add("sj-new-item-highlight");

            // rola até o item
            item.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });

            // badge “Nova dica adicionada”
            const badge = document.createElement("span");
            badge.className = "sj-hist-badge-new";
            badge.textContent = "Nova dica adicionada";
            item.appendChild(badge);

            // remove o highlight depois de 2s
            setTimeout(() => {
              item.classList.remove("sj-new-item-highlight");
            }, 2000);
          }, 400);

          // Barra de sucesso
          if (bar) {
            show(bar, false);
            bar.classList.remove("sj-ia-success-bar");
            dica.getBoundingClientRect();
            show(bar, true);
            bar.classList.add("sj-ia-success-bar");
          }

          st.textContent = "✅ Dica gerada, exibida e adicionada ao histórico!";
        } catch (err) {
          console.error("Mini-IA:", err);
          st.textContent = "❌ Erro ao gerar dica dos últimos 30 dias.";
        } finally {
          btnGerar.disabled = false;
          if (iaIcon) {
            iaIcon.classList.remove("sj-ia-spin");
          }
        }
      });
    }

    // --- Botão ENVIAR DICA PARA TELEGRAM ---
    const btnEnviar = qs("#btnEnviarDicaTelegram");
    if (btnEnviar) {
      btnEnviar.addEventListener("click", () => {
        sjEnviarUltimaDicaTelegram();
      });
    }
  });
})();
