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
  // Se NÃO houver #listaHistorico, usamos o layout do Turbo
  const elList = document.getElementById("listaHistorico");
  if (!elList) {
    const btn = document.getElementById("btnTurbo");
    const st = document.getElementById("turboStatus");
    const box = document.getElementById("turboResult");
    const dica = document.getElementById("turboDica");
    const csrf = typeof getCsrfToken === "function" ? getCsrfToken : () => "";

    if (btn && st && box && dica) {
      btn.onclick = async () => {
        btn.disabled = true;

        // status ON
        st.textContent = "Analisando…";
        st.classList.remove("d-none");
        box.classList.add("d-none"); // esconde resultado antigo enquanto processa

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
          if (j && j.ok) {
            const titulo = j.title || "Dica dos últimos 30 dias";
            const texto = j.text || j.dica || "(sem texto)";
            const quando = j.created_at || new Date().toLocaleString("pt-BR");

            // Preenche a área do Turbo (já existia)
            dica.textContent = `${titulo} — ${texto}\n(Insight • ${quando})`;
            box.classList.remove("d-none");
            st.textContent = "✅ Pronto! Nova dica gerada.";

            // === MÉTRICAS DO PERÍODO (INSIRA A PARTIR DAQUI) ===
            const ul = document.getElementById("turboMetrics");
            const detailsEl = ul ? ul.closest("details") : null;

            if (ul) {
              const linhas = [];

              // 1) Se vier um array
              if (Array.isArray(j.metrics)) {
                for (const m of j.metrics) linhas.push(String(m));
              }

              // 2) Se vier um objeto { chave: valor }
              if (
                j.metrics &&
                !Array.isArray(j.metrics) &&
                typeof j.metrics === "object"
              ) {
                for (const [k, v] of Object.entries(j.metrics)) {
                  linhas.push(`${labelize(k)}: ${fmt(v)}`);
                }
              }

              // 3) Fallbacks comuns
              if (j.receitas != null)
                linhas.push(`Receitas (30d): ${fmtMoeda(j.receitas)}`);
              if (j.despesas != null)
                linhas.push(`Despesas (30d): ${fmtMoeda(j.despesas)}`);
              if (j.saldo != null)
                linhas.push(`Saldo (30d): ${fmtMoeda(j.saldo)}`);
              if (j.margem != null)
                linhas.push(`Margem: ${Number(j.margem).toFixed(1)}%`);
              if (j.periodo || j.range)
                linhas.push(`Período: ${j.periodo || j.range}`);

              // Render/mostrar
              if (linhas.length) {
                ul.innerHTML = linhas
                  .map((li) => `<li>${escapeHtml(li)}</li>`)
                  .join("");
                if (detailsEl) detailsEl.open = true; // abre o <details>
              } else {
                ul.innerHTML = "";
                if (detailsEl) detailsEl.open = false; // fecha se não houver métricas
              }
            }
            // === FIM DAS MÉTRICAS ===
          } else {
            st.textContent = "⚠️ Não consegui gerar a dica.";
          }
        } catch (e) {
          console.error(e);
          st.textContent = "Erro na solicitação.";
        } finally {
          btn.disabled = false;
          setTimeout(() => st.classList.add("d-none"), 2000); // oculta status depois
        }
      };
    }
  }
}

function fmtMoeda(x) {
  const n = Number(x) || 0;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmt(v) {
  if (typeof v === "number") return v.toLocaleString("pt-BR");
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("pt-BR") : String(v);
}
function labelize(k) {
  return String(k)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("btnReloadDicas");
  const list = document.getElementById("listaHistorico"); // container onde as dicas aparecerão
  const badge = document.getElementById("badgeNovas");
  const badgeCount = document.getElementById("badgeNovasCount");

  if (!btn || !list) return;

  btn.addEventListener("click", () => carregarHistorico(20));
  // opcional: carregue ao abrir a página
  // carregarHistorico(20);

  async function carregarHistorico(limit = 20) {
    btn.disabled = true;
    const urls = [
      `/financeiro/ia/historico/feed/?limit=${limit}`,
      `/financeiro/ia/historico/?limit=${limit}`,
    ];
    let data = null;

    for (const url of urls) {
      try {
        const r = await fetch(url, {
          headers: { Accept: "application/json" },
          credentials: "same-origin",
        });
        if (!r.ok) continue;
        data = await r.json();
        break;
      } catch (_) {}
    }

    render(data);
    btn.disabled = false;
  }

  function render(json) {
    // Normaliza formatos comuns de API: items | results | data
    const items = (json && (json.items || json.results || json.data)) || [];
    if (!Array.isArray(items) || items.length === 0) {
      list.innerHTML = `<div class="alert alert-secondary mb-2">Nenhuma dica encontrada.</div>`;
      if (badge) badge.classList.add("d-none");
      return;
    }

    // Monta HTML dos cards
    const html = items.map(toCardHTML).join("");
    list.innerHTML = html;
     
    atualizarContadores();

    // Badge de novas (se a API trouxer algo como json.novas)
    if (badge && badgeCount) {
      const n = Number(json?.novas || 0);
      if (n > 0) {
        badgeCount.textContent = String(n);
        badge.classList.remove("d-none");
      } else {
        badge.classList.add("d-none");
      }
    }
  }

  function toCardHTML(item) {
    const quando = escapeHtml(
      item.created_at || item.data || new Date().toLocaleString("pt-BR")
    );
    const titulo = escapeHtml(item.title || item.titulo || "Dica da IA");
    const texto = escapeHtml(item.text || item.dica || item.conteudo || "");
    const tag = escapeHtml(item.categoria || item.kind || item.tipo || "Geral");

    return `
      <div class="card border-success mb-2">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-center mb-1">
            <span class="badge bg-success-subtle text-success border border-success-subtle">${tag}</span>
            <small class="text-muted">${quando}</small>
          </div>
          <h6 class="mb-1">${titulo}</h6>
          <p class="mb-0" style="white-space:pre-wrap">${texto}</p>
        </div>
      </div>
    `;
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
});

// === Filtros rápidos do histórico ===
document.addEventListener("DOMContentLoaded", () => {
  const list = document.getElementById("listaHistorico");
  if (!list) return;

  // Liga os botões de filtro
  const btns = Array.from(document.querySelectorAll('[data-filter]'));
  for (const b of btns) {
    b.addEventListener("click", () => {
      // visual "active"
      btns.forEach(x => x.classList.remove("active"));
      b.classList.add("active");

      const f = b.getAttribute("data-filter") || "all";
      aplicarFiltro(f);
      atualizarContadores();
    });
  }

  function aplicarFiltro(filtro) {
    const cards = Array.from(list.querySelectorAll(".card[data-kind]"));
    for (const card of cards) {
      const kind = card.getAttribute("data-kind");
      const show = (filtro === "all") ? true : (kind === filtro);
      card.style.display = show ? "" : "none";
    }
  }

  function atualizarContadores() {
    const allCards  = Array.from(list.querySelectorAll(".card[data-kind]"));
    const visiveis  = allCards.filter(c => c.style.display !== "none");
    const countAll  = document.getElementById("countAll");
    const countPos  = document.getElementById("countPos");
    const countAlt  = document.getElementById("countAlerta");
    const countNeu  = document.getElementById("countNeutra");

    // totais por categoria (considera TODOS os cards carregados)
    const tot = { positiva: 0, alerta: 0, neutra: 0, geral: 0 };
    for (const c of allCards) {
      const k = c.getAttribute("data-kind");
      if (tot[k] != null) tot[k]++;
    }

    if (countAll) countAll.textContent = String(allCards.length);
    if (countPos) countPos.textContent = String(tot.positiva);
    if (countAlt) countAlt.textContent = String(tot.alerta);
    if (countNeu) countNeu.textContent = String(tot.neutra);
  }

  // Chame isso DEPOIS que você renderizar os cards (ex.: no final da sua função render)
  // Exemplo: se você tem uma função render(json), adicione no fim:
  // atualizarContadores();
});

// === Helper: normaliza categoria/kind para data-kind ===
function normKind(v) {
  const s = String(v || "").toLowerCase();
  if (s.includes("posit")) return "positiva";
  if (s.includes("alert")) return "alerta";
  if (s.includes("neut"))  return "neutra";
  return "geral";
}

// Helpers de segurança (amanhã a gente melhora)
function firstLine(s, max = 60) {
  if (!s) return "";
  const str = String(s).trim().split(/\r?\n/)[0];
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
}

// Se ainda não existir, evita erro ao chamar
if (typeof atualizarContadores !== "function") {
  function atualizarContadores() { /* no-op temporário */ }
}
