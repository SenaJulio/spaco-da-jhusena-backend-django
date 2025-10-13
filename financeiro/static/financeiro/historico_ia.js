// static/financeiro/historico_ia.js
document.addEventListener("DOMContentLoaded", function () {
  const API_URL = "/financeiro/ia/historico/";
  const KEY_LAST_SEEN = "iaHistoricoLastSeenAt";

  const elList = document.getElementById("listaHistorico");
  if (!elList) {
    return;
  }

  const elOvl = document.getElementById("ovlHistorico");
  const elBadge = document.getElementById("badgeNovas");
  const elBadgeCount = document.getElementById("badgeNovasCount");
  const btnMarcarLidas = document.getElementById("btnMarcarLidas");
  const btnReloadFeed = document.getElementById("btnReloadFeed");
  const filterButtons = document.querySelectorAll("[data-filter]");

  // contadores
  const elCountAll = document.getElementById("countAll");
  const elCountPos = document.getElementById("countPos");
  const elCountAlerta = document.getElementById("countAlerta");
  const elCountNeutra = document.getElementById("countNeutra");

  let allItems = [];
  let currentFilter = "all";
  let lastSeenAt = localStorage.getItem(KEY_LAST_SEEN) || null;
  let isRefreshing = false; // evita concorrência

  init();

  async function init() {
    toggleLoading(true);
    try {
      allItems = await fetchHistorico();
      updateBadge();
      updateCounters();
      render();
      autoScrollIfNew();
      setupEvents();
      startAutoRefresh();
    } catch (err) {
      console.error("Erro ao carregar histórico:", err);
      elList.innerHTML = `<div class="alert alert-danger">Falha ao carregar histórico da IA.</div>`;
    } finally {
      toggleLoading(false);
    }
  }

  function toggleLoading(show) {
    if (!elOvl) return;
    elOvl.classList.toggle("d-none", !show);
  }

  function fetchHistorico() {
    return fetch(API_URL, { headers: { Accept: "application/json" } })
      .then((r) => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then((data) => {
        return (data.items || data || [])
          .map((x) => ({
            id: x.id,
            created_at: x.created_at,
            title: x.title || "Dica da IA",
            text: x.text || x.dica || "",
            kind: (x.kind || x.categoria || "neutra").toLowerCase(),
          }))
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      });
  }

  function updateBadge() {
    if (!elBadge) return;
    if (!lastSeenAt) {
      elBadge.classList.add("d-none");
      return;
    }
    const count = allItems.filter(
      (it) => new Date(it.created_at) > new Date(lastSeenAt)
    ).length;
    if (count > 0) {
      if (elBadgeCount) elBadgeCount.textContent = String(count);
      elBadge.classList.remove("d-none");
    } else {
      elBadge.classList.add("d-none");
    }
  }

  function updateCounters() {
    const total = allItems.length;
    const pos = allItems.filter((i) => i.kind === "positiva").length;
    const alerta = allItems.filter((i) => i.kind === "alerta").length;
    const neutra = allItems.filter((i) => i.kind === "neutra").length;

    if (elCountAll) elCountAll.textContent = String(total);
    if (elCountPos) elCountPos.textContent = String(pos);
    if (elCountAlerta) elCountAlerta.textContent = String(alerta);
    if (elCountNeutra) elCountNeutra.textContent = String(neutra);
  }

  function render() {
    const filtered = allItems.filter((it) =>
      currentFilter === "all" ? true : it.kind === currentFilter
    );
    if (filtered.length === 0) {
      elList.innerHTML = `<div class="alert alert-light border">Nenhuma dica para o filtro selecionado.</div>`;
      return;
    }
    elList.innerHTML = filtered.map((it) => cardHTML(it)).join("");
    requestAnimationFrame(() => {
      document
        .querySelectorAll(".ia-card")
        .forEach((el) => el.classList.add("fade-in"));
    });
  }

  function cardHTML(it) {
    const isNew = lastSeenAt && new Date(it.created_at) > new Date(lastSeenAt);
    const chipClass =
      it.kind === "positiva"
        ? "chip-positiva"
        : it.kind === "alerta"
        ? "chip-alerta"
        : "chip-neutra";
    return `
      <div class="card ia-card ${isNew ? "is-new" : ""}">
        <div class="card-body">
          <div class="d-flex align-items-center justify-content-between">
            <div class="fw-semibold">${escapeHTML(it.title)}</div>
            <span class="chip ${chipClass}" title="Categoria">${it.kind}</span>
          </div>
          <p class="mt-2 mb-2" style="white-space:pre-wrap">${escapeHTML(
            it.text
          )}</p>
          <div class="text-muted small">Criada em: ${fmtDate(
            it.created_at
          )}</div>
        </div>
      </div>
    `;
  }

  function autoScrollIfNew() {
    if (!lastSeenAt) return;
    const firstNew = elList.querySelector(".ia-card.is-new");
    if (firstNew) {
      firstNew.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  function setupEvents() {
    if (filterButtons && filterButtons.length) {
      filterButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
          filterButtons.forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          currentFilter = btn.getAttribute("data-filter");
          render();
        });
      });
    }

    if (btnMarcarLidas) {
      btnMarcarLidas.addEventListener("click", () => {
        const newest = allItems[0]?.created_at;
        if (newest) {
          localStorage.setItem(KEY_LAST_SEEN, newest);
          lastSeenAt = newest;
          updateBadge();
          render();
        }
      });
    }

    if (btnReloadFeed) {
      btnReloadFeed.addEventListener("click", () => refreshNow());
    }
  }

  // ===== Auto-Refresh (60s) com pausa quando a aba não está visível =====
  let refreshTimer = null;

  function startAutoRefresh() {
    stopAutoRefresh();
    refreshTimer = setInterval(() => {
      if (document.hidden) return; // pausa quando aba não está visível
      refreshNow();
    }, 60000); // 60s
  }
  function stopAutoRefresh() {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  }

  async function refreshNow() {
    if (isRefreshing) return;
    isRefreshing = true;
    try {
      const latest = await fetchHistorico();
      // Se houver mudança, atualiza UI
      const changed = hasChanged(allItems, latest);
      allItems = latest;
      updateCounters();
      updateBadge();
      if (changed) {
        render();
        autoScrollIfNew();
      }
    } catch (e) {
      console.warn("Falha ao atualizar histórico:", e);
    } finally {
      isRefreshing = false;
    }
  }

  function hasChanged(prev, next) {
    if (prev.length !== next.length) return true;
    const a = prev[0]?.id,
      b = next[0]?.id;
    const ta = prev[0]?.created_at,
      tb = next[0]?.created_at;
    return a !== b || ta !== tb;
  }

  // ===== Utils =====
  function escapeHTML(s) {
    return (s ?? "").replace(
      /[&<>"']/g,
      (m) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        }[m])
    );
  }
  function fmtDate(s) {
    const d = new Date(s);
    if (!isNaN(d)) return d.toLocaleString();
    return s;
  }
});

// ===== Resumo Mensal da IA (gráfico + stats) =====
document.addEventListener("DOMContentLoaded", function(){
  const elCanvas = document.getElementById("chartResumoIA");
  if(!elCanvas) return;

  fetch("/financeiro/ia/resumo-mensal/", {headers:{"Accept":"application/json"}})
    .then(r => r.json())
    .then(data => {
      const lbls = data.labels.map(s => s.slice(0,7)); // YYYY-MM
      const ctx = elCanvas.getContext("2d");

      // cria série
      const chart = new Chart(ctx, {
        type: "line",
        data: {
          labels: lbls,
          datasets: [
            { label: "Total",    data: data.total,    tension: 0.25 },
            { label: "Positivas",data: data.positivas,tension: 0.25 },
            { label: "Alertas",  data: data.alertas,  tension: 0.25 },
            { label: "Neutras",  data: data.neutras,  tension: 0.25 },
          ]
        },
        options: {
          responsive: true,
          plugins: { legend: { position: "bottom" } },
          scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
        }
      });

      // estatísticas rápidas + previsão
      const lastTotal = data.total[data.total.length-1] || 0;
      const prevTotal = data.total[data.total.length-2] || 0;
      const delta = lastTotal - prevTotal;
      const pct = prevTotal ? ((delta/prevTotal)*100).toFixed(1) : "—";
      const nextLabel = (data.forecast_next?.label || "").slice(0,7);
      const nextTotal = data.forecast_next?.total ?? 0;

      const elStats = document.getElementById("resumoIAStats");
      if(elStats){
        elStats.innerHTML = `
          Mês atual: <b>${lbls[lbls.length-1] || "-"}</b> |
          Total: <b>${lastTotal}</b> (${delta >= 0 ? "+" : ""}${delta}, ${pct}% vs. mês anterior) |
          Previsão ${nextLabel ? "para "+nextLabel : ""}: <b>${nextTotal}</b>
        `;
      }
    })
    .catch(e => {
      console.warn("Falha ao carregar resumo mensal:", e);
    });
});
