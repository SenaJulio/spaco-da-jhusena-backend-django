// static/financeiro/historico_ia.js
document.addEventListener("DOMContentLoaded", function () {
  // evita rodar duas vezes se o script for incluído duplicado
  if (document.body.dataset.iaHistoricoInit === "1") return;
  document.body.dataset.iaHistoricoInit = "1";

  const API_URL = "/financeiro/ia/historico/";
  const KEY_LAST_SEEN = "iaHistoricoLastSeenAt";

const elList = document.getElementById("listaHistorico");
if (!elList) {
  console.warn(
    "[IA Histórico] #listaHistorico não encontrado. Abortando init."
  );
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

 fetch("/financeiro/ia/resumo-mensal/", {
   headers: { Accept: "application/json" },
   credentials: "same-origin",
 })
   .then(async (r) => {
     if (!r.ok) throw new Error(`HTTP ${r.status}`);
     // Em caso de HTML (ex.: redirect login), evita estourar JSON
     const text = await r.text();
     try {
       return JSON.parse(text);
     } catch {
       throw new Error("Resposta não é JSON");
     }
   })
   .then((data) => {
     // Normaliza o formato de dados
     // Se vier série (labels + valores), usa; senão, cria uma "mini série" a partir de receitas/despesas/saldo
     const hasSerie =
       Array.isArray(data?.labels) &&
       Array.isArray(data?.receitas) &&
       Array.isArray(data?.despesas);
     const labels = hasSerie
       ? data.labels.map((s) => String(s).slice(0, 7))
       : ["Receitas", "Despesas", "Saldo"];
     const serieReceitas = hasSerie
       ? data.receitas
       : [Number(data?.receitas) || 0, 0, 0];
     const serieDespesas = hasSerie
       ? data.despesas
       : [0, Number(data?.despesas) || 0, 0];
     const serieSaldo = hasSerie
       ? Array.isArray(data?.saldo)
         ? data.saldo
         : []
       : [
           0,
           0,
           Number(data?.saldo) ||
             (Number(data?.receitas) || 0) - (Number(data?.despesas) || 0),
         ];

     const elCanvas = document.getElementById("chartResumoIA");
     if (!elCanvas) return;

     const ctx = elCanvas.getContext("2d");

     // Evita re-render se já existir
     if (window._chartResumoIA instanceof Chart) {
       const ch = window._chartResumoIA;
       ch.data.labels = labels;
       ch.data.datasets[0].data = serieReceitas;
       ch.data.datasets[1].data = serieDespesas;
       // Se não houver saldo em série, garante comprimento igual
       if (ch.data.datasets[2])
         ch.data.datasets[2].data = serieSaldo.length
           ? serieSaldo
           : labels.map(() => null);
       ch.update("none");
       return;
     }

     window._chartResumoIA = new Chart(ctx, {
       type: "line",
       data: {
         labels,
         datasets: [
           {
             label: "Receitas",
             data: serieReceitas,
             tension: 0.3,
             fill: false,
           },
           {
             label: "Despesas",
             data: serieDespesas,
             tension: 0.3,
             fill: false,
           },
           {
             label: "Saldo",
             data: serieSaldo.length ? serieSaldo : labels.map(() => null),
             tension: 0.3,
             fill: false,
           },
         ],
       },
       options: {
         responsive: true,
         maintainAspectRatio: false,
         animation: false,
         plugins: {
           legend: { position: "top" },
           title: {
             display: true,
             text: hasSerie
               ? "Resumo IA (série mensal)"
               : "Resumo IA (snapshot do mês)",
           },
         },
         scales: { y: { beginAtZero: true } },
       },
     });
   })
   .catch((e) => {
     console.error("Falha ao carregar resumo mensal:", e);
     // opcional: exibir um aviso amigável no boxResumoMensal
     const box = document.getElementById("boxResumoMensal");
     if (box) {
       box.classList.remove("d-none");
       box.classList.add("alert-warning");
       box.innerHTML = "Não foi possível carregar o resumo mensal agora.";
     }
   });
});

// HOTFIX: se não existir a lista do histórico neste template,
// ainda assim ativamos o botão "⚡ Gerar Nova Dica" e saímos.


// === Helper para CSRF ===
function getCsrfToken() {
  // Tenta ler do <meta name="csrf-token">
  const meta = document.querySelector('meta[name="csrf-token"]');
  if (meta && meta.content) return meta.content;

  // Fallback: tenta pegar do cookie csrftoken
  const match = document.cookie.match(/(^|;\s*)csrftoken=([^;]+)/);
  return match ? decodeURIComponent(match[2]) : "";
}


{
  const elList = document.getElementById("listaHistorico");
  if (!elList) {
    const btn = document.getElementById("btnGerarDicaSimples");
    const st  = document.getElementById("statusDica");
    const csrf = (typeof getCsrfToken === "function") ? getCsrfToken : () => "";

    if (btn) {
      btn.onclick = async () => {
        btn.disabled = true;
        if (st) st.textContent = "Gerando...";
        try {
          const r = await fetch("/financeiro/api/insights/criar-simples/", {
            method: "POST",
            headers: {
              "X-Requested-With": "XMLHttpRequest",
              "X-CSRFToken": csrf(),
              "Accept": "application/json",
            },
            credentials: "same-origin",
          });
          const j = await r.json();
          if (j.ok) {
            // Atualiza o cartão do último insight (se existir)
            const container = document.getElementById("cardsInsight");
            if (container) {
              const card = document.createElement("div");
              card.className = "card border-success mt-3";
              card.innerHTML = `
                <div class="card-body">
                  <div class="small text-muted">Insight • ${j.created_at || new Date().toLocaleString()}</div>
                  <h5 class="card-title mb-1">${j.title || "Nova dica"}</h5>
                  <p class="mb-2">${j.text || j.dica || ""}</p>
                </div>`;
              const old = container.querySelector("[data-insight-bloco]") || container.firstElementChild;
              if (old) old.replaceWith(card); else container.appendChild(card);
            }
            if (st) st.textContent = "Pronto!";
          } else {
            if (st) st.textContent = "Não consegui gerar a dica.";
          }
        } catch (e) {
          console.error(e);
          if (st) st.textContent = "Erro.";
        } finally {
          btn.disabled = false;
          setTimeout(() => { if (st) st.textContent = ""; }, 1500);
        }
      };
    }
    //return; // evita acessar elementos que não existem neste template
  }
}

// === Botão "⚡ Gerar dica dos últimos 30 dias" ===
{
  const btn = document.getElementById("btnTurbo");
  const st = document.getElementById("statusDica"); // pode usar o mesmo span de status
  const csrf = (typeof getCsrfToken === "function") ? getCsrfToken : () => "";

  if (btn) {
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      if (st) st.textContent = "Gerando dica dos últimos 30 dias...";
      try {
        const r = await fetch("/financeiro/modo-turbo/dica30d/", {
          method: "POST",
          headers: {
            "X-Requested-With": "XMLHttpRequest",
            "X-CSRFToken": csrf(),
            Accept: "application/json",
          },
          credentials: "same-origin",
        });
        const j = await r.json();
        if (j.ok) {
          if (st) st.textContent = "✅ Pronto! Nova dica gerada.";
          console.log("Dica 30d:", j);
        } else {
          if (st) st.textContent = "⚠️ Não consegui gerar a dica.";
        }
      } catch (e) {
        console.error("Erro ao gerar dica dos 30 dias:", e);
        if (st) st.textContent = "Erro na solicitação.";
      } finally {
        btn.disabled = false;
        setTimeout(() => { if (st) st.textContent = ""; }, 2000);
      }
    });
  }
}
