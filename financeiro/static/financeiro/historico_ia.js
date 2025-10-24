// static/financeiro/historico_ia.js
console.log("🔍 historico_ia.js carregado");
console.log("🕒 Último login do usuário:", new Date().toLocaleString());
console.log("🕒 Último login do usuário:", new Date().toLocaleString());
console.log("🕒 Último login do usuário:", new Date().toLocaleString());


// ========= Helpers globais =========
function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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
function normKind(v) {
  const s = String(v || "").toLowerCase();
  if (s.includes("posit")) return "positiva";
  if (s.includes("alert")) return "alerta";
  if (s.includes("neut")) return "neutra";
  return "geral";
}
// parse "dd/mm/yyyy HH:MM" ou ISO
function parseStamp(s) {
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return new Date(s); // ISO
  const m = String(s).match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/
  );
  if (!m) return new Date(s);
  const [, d, mo, y, h, i] = m.map(Number);
  return new Date(y, mo - 1, d, h, i);
}


const PREVIEW_LIMIT = 5;     // quantos itens no preview do card verde
const MODAL_PAGE_SIZE = 10;  // quantos itens por página no modal
const MORE_INCREMENT = 10;   // quanto carregar a mais no "Ver mais"

// ========= Histórico de Dicas (OFICIAL) =========
document.addEventListener("DOMContentLoaded", () => {
  // evita rodar duas vezes se incluído por engano em duplicidade
  if (document.body.dataset.iaHistoricoInit === "1") return;
  document.body.dataset.iaHistoricoInit = "1";

  // Elementos
  // Alvos (atual + futuros)
  const list =
    document.getElementById("listaHistorico") ||
    document.getElementById("listaHistoricoPreview") ||
    document.getElementById("listaHistoricoModal");

  if (!list) {
    console.warn(
      "⚠️ Nenhum container de histórico encontrado (#listaHistorico, #listaHistoricoPreview ou #listaHistoricoModal)."
    );
    return;
  }
  // Copia o conteúdo do preview (#listaHistorico) para o modal (#listaHistoricoModal) ao abrir
  const modalEl = document.getElementById("modalHistoricoIA");
  const modalList = document.getElementById("listaHistoricoModal");

  if (modalEl && list && modalList) {
    modalEl.addEventListener("show.bs.modal", function () {
      modalList.innerHTML = list.innerHTML; // simples e seguro
    });
  }

  // === Botão "Ver mais" dentro do modal ===
  const btnVerMais = document.getElementById("btnVerMais");
  let historicoOffset = 0;
  const PAGE_SIZE = 10;

  if (btnVerMais && modalList && list) {
    btnVerMais.addEventListener("click", async () => {
      try {
        const feedUrl =
          modalList.dataset.feedUrl || list.dataset.feedUrl || null;
        if (!feedUrl) return;

        historicoOffset += PAGE_SIZE;
        const qs = new URLSearchParams({
          limit: PAGE_SIZE,
          offset: historicoOffset,
        });
        const resp = await fetch(`${feedUrl}?${qs.toString()}`);
       const j = await resp.json();

       // Compat: aceita results, items ou data
       const itens = Array.isArray(j)
         ? j
         : j.results || j.items || j.data || [];
       if (!Array.isArray(itens) || itens.length === 0) {
         btnVerMais.disabled = true;
         btnVerMais.textContent = "Sem mais dicas";
         return;
       }


        // Adiciona novos cards sem apagar os anteriores
        const html = itens
          .map(
            (i) => `
        <div class="card mb-2">
          <div class="card-body">
            <small class="text-muted">${i.criado_em || ""} • ${
              i.tipo || ""
            }</small>
            <div>${i.texto || ""}</div>
          </div>
        </div>`
          )
          .join("");

        modalList.insertAdjacentHTML("beforeend", html);
        if (j.has_next === false) {
          btnVerMais.disabled = true;
          btnVerMais.textContent = "Sem mais dicas";
        }
      } catch (e) {
        console.error("Erro ao carregar mais dicas:", e);
      }
    });
  }

  // === Botão "Ver mais" mínimo e seguro (sem redeclarar variáveis globais) ===
  (function ensureVerMaisButton() {
    if (!list) return;

    var btn = document.getElementById("btnVerMais");
    if (!btn) {
      btn = document.createElement("button");
      btn.id = "btnVerMais";
      btn.className = "btn btn-outline-secondary btn-sm mt-2";
      btn.textContent = "Ver mais";
      list.insertAdjacentElement("afterend", btn);
    }

    btn.onclick = function () {
      // Se houver modal Bootstrap, apenas abre
      var modal = document.getElementById("modalHistoricoIA");
      if (modal && window.bootstrap && typeof bootstrap.Modal === "function") {
        var m = bootstrap.Modal.getOrCreateInstance(modal);
        m.show();
        return;
      }
      // Sem modal? Faz um fallback inocente (não quebra nada)
      window.scrollTo({ top: list.offsetTop, behavior: "smooth" });
    };
  })();

  const badge = document.getElementById("badgeNovas");
  const badgeCount = document.getElementById("badgeNovasCount");
  const btnReload =
    document.getElementById("btnReloadDicas") ||
    document.getElementById("btnReloadFeed");
  const btnMarcarLidas = document.getElementById("btnMarcarLidas");
  const btnHistoricoIA = document.getElementById("btnHistoricoIA");
  const elOvl = document.getElementById("ovlHistorico");

  // Filtros
  const btnTodas = document.getElementById("btnFiltroTodas");
  const btnNeutra = document.getElementById("btnFiltroNeutra");
  const btnGeral = document.getElementById("btnFiltroGeral");
  const filterButtons = document.querySelectorAll("[data-filter]");

  // Contadores
  const elCountAll = document.getElementById("countAll");
  const elCountPos = document.getElementById("countPos");
  const elCountAlerta = document.getElementById("countAlerta");
  const elCountNeutra = document.getElementById("countNeutra");

  // URL do feed (preferir data-feed-url vindo do template)
  const FEED_URL = list.dataset.feedUrl || "/financeiro/ia/historico/feed/";

  // Estado
  const KEY_LAST_SEEN = "iaHistoricoLastSeenAt";
  let lastSeenAt = localStorage.getItem(KEY_LAST_SEEN) || null;
  let allItems = [];
  let filtroCategoria = ""; // ""=todas | neutra | positiva | alerta
  let isRefreshing = false;
  let refreshTimer = null;

  // API
  async function fetchHistorico(limit = 20, tipo = "") {
    const qs = new URLSearchParams();
    qs.set("limit", String(limit));
    if (tipo) qs.set("tipo", tipo); // a view espera "tipo"

    const r = await fetch(`${FEED_URL}?${qs.toString()}`, {
      headers: { Accept: "application/json" },
      credentials: "same-origin",
    });
    if (!r.ok) throw new Error(`HTTP ${r.status} @ ${FEED_URL}`);
    const json = await r.json();

    const arr = (json && (json.items || json.results || json.data)) || [];
    const items = (Array.isArray(arr) ? arr : []).map((x) => {
      const criado =
        x.criado_em || x.created_at_br || x.created_at || x.data || "";
      const k = normKind(
        x.tipo || x.categoria || x.categoria_dominante || x.kind || "geral"
      );
      const txt = (x.text || x.texto || x.dica || x.conteudo || "")
        .toString()
        .trim();
      const title =
        x.title ||
        x.titulo ||
        (txt
          ? txt.split("\n")[0].slice(0, 60) + (txt.length > 60 ? "…" : "")
          : "Dica da IA");
      return {
        id: x.id,
        criado_em: criado,
        _stamp: parseStamp(criado)?.getTime() || 0,
        tipo: k, // neutra | positiva | alerta | geral
        title,
        text: txt || "Sem conteúdo disponível.",
      };
    });

    // Ordena mais recente primeiro
    items.sort((a, b) => b._stamp - a._stamp);
    return items;
  }

  // Render
  function cardHTML(it) {
    const quando = escapeHtml(it.criado_em || "");
    const tag = escapeHtml(it.tipo.charAt(0).toUpperCase() + it.tipo.slice(1));
    const isNew =
      lastSeenAt &&
      parseStamp(it.criado_em)?.getTime() > new Date(lastSeenAt).getTime();
    return `
      <div class="card border-success mb-3 shadow-sm ia-card ${
        isNew ? "is-new" : ""
      }" data-kind="${it.tipo}">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <span class="badge bg-success-subtle text-success border border-success-subtle">${tag}</span>
            <small class="text-muted">${quando}</small>
          </div>
          <h6 class="card-title text-success mb-1">${escapeHtml(it.title)}</h6>
          <p class="card-text mb-0" style="white-space: pre-wrap">${escapeHtml(
            it.text
          )}</p>
        </div>
      </div>`;
  }

  function renderLista(items) {
    // aplica filtro atual
    const filtered = filtroCategoria
      ? items.filter((i) => i.tipo === filtroCategoria)
      : items;
    if (!filtered.length) {
      list.innerHTML = `<div class="alert alert-secondary mb-2">Nenhuma dica encontrada.</div>`;
      if (badge) badge.classList.add("d-none");
      return;
    }
    list.innerHTML = filtered.map(cardHTML).join("");
    requestAnimationFrame(() =>
      list
        .querySelectorAll(".ia-card")
        .forEach((el) => el.classList.add("fade-in"))
    );
    atualizarBadge(filtered);
    atualizarContadoresUI(items);
  }

  // Badge “Novas”
  function atualizarBadge(itemsMostrados) {
    if (!badge || !badgeCount) return;
    if (!lastSeenAt) {
      badge.classList.add("d-none");
      return;
    }
    const cnt = itemsMostrados.filter((i) => {
      const ts = parseStamp(i.criado_em)?.getTime() || 0;
      return ts > new Date(lastSeenAt).getTime();
    }).length;

    if (cnt > 0) {
      badgeCount.textContent = String(cnt);
      badge.classList.remove("d-none");
    } else {
      badge.classList.add("d-none");
    }
  }

  function atualizarContadoresUI(itemsAll) {
    if (elCountAll) elCountAll.textContent = String(itemsAll.length);
    if (elCountPos)
      elCountPos.textContent = String(
        itemsAll.filter((i) => i.tipo === "positiva").length
      );
    if (elCountAlerta)
      elCountAlerta.textContent = String(
        itemsAll.filter((i) => i.tipo === "alerta").length
      );
    if (elCountNeutra)
      elCountNeutra.textContent = String(
        itemsAll.filter((i) => i.tipo === "neutra").length
      );
  }

  // Toggle loading
  function toggleLoading(show) {
    if (!elOvl) return;
    elOvl.classList.toggle("d-none", !show);
  }

  // API pública p/ console e outros scripts
  window.carregarHistorico = async function carregarHistorico(limit = 20) {
    try {
      if (btnReload) btnReload.disabled = true;
      toggleLoading(true);
      allItems = await fetchHistorico(limit, filtroCategoria);
      renderLista(allItems);
      // auto scroll p/ primeira nova
      if (lastSeenAt) {
        const firstNew = list.querySelector(".ia-card.is-new");
        if (firstNew)
          firstNew.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    } catch (e) {
      console.error("Falha ao buscar histórico:", e);
      list.innerHTML = `<div class="alert alert-danger">Falha ao carregar histórico.</div>`;
    } finally {
      toggleLoading(false);
      if (btnReload) btnReload.disabled = false;
    }
  };

  // Eventos
  if (btnReload) {
    btnReload.addEventListener("click", () => window.carregarHistorico(20));
  }
  if (btnMarcarLidas) {
    btnMarcarLidas.addEventListener("click", () => {
      const newest = allItems[0]?.criado_em;
      if (newest) {
        localStorage.setItem(KEY_LAST_SEEN, parseStamp(newest).toISOString());
        lastSeenAt = localStorage.getItem(KEY_LAST_SEEN);
        renderLista(allItems);
      }
    });
  }
  if (btnHistoricoIA) {
    btnHistoricoIA.addEventListener("click", async () => {
      await window.carregarHistorico(20);
      const newest = allItems[0]?.criado_em;
      if (newest) {
        localStorage.setItem(KEY_LAST_SEEN, parseStamp(newest).toISOString());
        lastSeenAt = localStorage.getItem(KEY_LAST_SEEN);
        if (badge) badge.classList.add("d-none");
      }
    });
  }

  // Filtros por categoria (IDs específicos)
  if (btnTodas)
    btnTodas.addEventListener("click", () => {
      filtroCategoria = "";
      window.carregarHistorico(20);
    });
  if (btnNeutra)
    btnNeutra.addEventListener("click", () => {
      filtroCategoria = "neutra";
      window.carregarHistorico(20);
    });
  if (btnGeral)
    btnGeral.addEventListener("click", () => {
      filtroCategoria = "geral";
      window.carregarHistorico(20);
    });

  // Filtros genéricos [data-filter]
  if (filterButtons && filterButtons.length) {
    filterButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        filterButtons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        const f = btn.getAttribute("data-filter") || "all";
        filtroCategoria = f === "all" ? "" : f; // "" => todas
        window.carregarHistorico(20);
      });
    });
  }

  // Auto-refresh a cada 60s (pausa quando aba oculta)
  function startAutoRefresh() {
    stopAutoRefresh();
    refreshTimer = setInterval(() => {
      if (document.hidden) return;
      window.carregarHistorico(20);
    }, 60000);
  }
  function stopAutoRefresh() {
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = null;
  }

  // Init
  + (async () => {
    await window.carregarHistorico(PREVIEW_LIMIT);
    startAutoRefresh();
  })();
  let _limitAtual = PREVIEW_LIMIT;
  document.getElementById("btnVerMais")?.addEventListener("click", async () => {
    _limitAtual += MORE_INCREMENT;
    await window.carregarHistorico(_limitAtual);
  });
});

// ========= Resumo Mensal da IA (gráfico + stats) =========
document.addEventListener("DOMContentLoaded", function () {
  const elCanvas = document.getElementById("chartResumoIA");
  if (!elCanvas) return;

  fetch("/financeiro/ia/resumo-mensal/", {
    headers: { Accept: "application/json" },
    credentials: "same-origin",
  })
    .then(async (r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const text = await r.text();
      try {
        return JSON.parse(text);
      } catch {
        throw new Error("Resposta não é JSON");
      }
    })
    .then((data) => {
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

      const ctx = elCanvas.getContext("2d");
      if (window._chartResumoIA instanceof Chart) {
        const ch = window._chartResumoIA;
        ch.data.labels = labels;
        ch.data.datasets[0].data = serieReceitas;
        ch.data.datasets[1].data = serieDespesas;
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
      const box = document.getElementById("boxResumoMensal");
      if (box) {
        box.classList.remove("d-none");
        box.classList.add("alert-warning");
        box.innerHTML = "Não foi possível carregar o resumo mensal agora.";
      }
    });
});
// IDs esperados no HTML: btnTodas, btnPositivas, btnAlertas, btnNeutras, listaHistorico
const API_HIST_V2 = "/financeiro/ia/historico/feed/v2/";

async function carregarHistorico(tipo=null, limit=20) {
  const url = new URL(API_HIST_V2, window.location.origin);
  if (tipo) url.searchParams.set("tipo", tipo);
  url.searchParams.set("limit", limit);

  const res = await fetch(url, { credentials: "same-origin" });
  const j = await res.json();

  const elList = document.getElementById("listaHistorico");
  if (!elList) return;

  elList.innerHTML = "";
  if (!j.ok || !j.items || j.items.length === 0) {
    elList.innerHTML = `<div class="card p-3 text-muted">Nenhuma dica encontrada.</div>`;
    return;
  }

  for (const it of j.items) {
    const tipo = (it.tipo || "neutra").toLowerCase();
    const badge =
      tipo === "positiva" ? '<span class="badge bg-success">Positiva</span>' :
      tipo === "alerta"   ? '<span class="badge bg-danger">Alerta</span>' :
                            '<span class="badge bg-secondary">Neutra</span>';

    elList.insertAdjacentHTML("beforeend", `
      <div class="card mb-2">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-center">
            <strong>Dica da IA</strong>
            ${badge}
          </div>
          <div class="small text-muted">${it.criado_em || ""}</div>
          <p class="mb-0">${it.texto || it.text || ""}</p>
        </div>
      </div>
    `);
  }
}

// Liga os botões
document.getElementById("btnTodas")?.addEventListener("click", () => carregarHistorico(null));
document.getElementById("btnPositivas")?.addEventListener("click", () => carregarHistorico("positiva"));
document.getElementById("btnAlertas")?.addEventListener("click", () => carregarHistorico("alerta"));
document.getElementById("btnNeutras")?.addEventListener("click", () => carregarHistorico("neutra"));

// Carrega padrão ao abrir (todas)
carregarHistorico(null);


// ========= Modo Turbo (Gerar Dica 30d) =========
function getCsrfToken() {
  const meta = document.querySelector('meta[name="csrf-token"]');
  if (meta && meta.content) return meta.content;
  const match = document.cookie.match(/(^|;\s*)csrftoken=([^;]+)/);
  return match ? decodeURIComponent(match[2]) : "";
}

document.addEventListener("DOMContentLoaded", () => {
  const elList = document.getElementById("listaHistorico");
  // Se não estiver na página de histórico, ainda assim ligamos o Turbo
  const btn = document.getElementById("btnTurbo");
  const st = document.getElementById("turboStatus");
  const box = document.getElementById("turboResult");
  const dica = document.getElementById("turboDica");

  if (btn && st && box && dica) {
    btn.onclick = async () => {
      btn.disabled = true;
      st.textContent = "Analisando…";
      st.classList.remove("d-none");
      box.classList.add("d-none");

      try {
        const r = await fetch("/financeiro/modo-turbo/dica30d/", {
          method: "POST",
          headers: {
            "X-Requested-With": "XMLHttpRequest",
            "X-CSRFToken": getCsrfToken(),
            Accept: "application/json",
          },
          credentials: "same-origin",
        });
        const j = await r.json();
        if (j && j.ok) {
          const titulo = j.title || "Dica dos últimos 30 dias";
          const texto = j.text || j.dica || "(sem texto)";
          const quando = j.created_at || new Date().toLocaleString("pt-BR");
          dica.textContent = `${titulo} — ${texto}\n(Insight • ${quando})`;
          box.classList.remove("d-none");
          st.textContent = "✅ Pronto! Nova dica gerada.";

          // métricas (opcional)
          const ul = document.getElementById("turboMetrics");
          const detailsEl = ul ? ul.closest("details") : null;
          if (ul) {
            const linhas = [];
            if (Array.isArray(j.metrics))
              for (const m of j.metrics) linhas.push(String(m));
            if (
              j.metrics &&
              !Array.isArray(j.metrics) &&
              typeof j.metrics === "object"
            ) {
              for (const [k, v] of Object.entries(j.metrics))
                linhas.push(`${labelize(k)}: ${fmt(v)}`);
            }
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

            if (linhas.length) {
              ul.innerHTML = linhas
                .map((li) => `<li>${escapeHtml(li)}</li>`)
                .join("");
              if (detailsEl) detailsEl.open = true;
            } else {
              ul.innerHTML = "";
              if (detailsEl) detailsEl.open = false;
            }
          }
        } else {
          st.textContent = "⚠️ Não consegui gerar a dica.";
        }
      } catch (e) {
        console.error(e);
        st.textContent = "Erro na solicitação.";
      } finally {
        btn.disabled = false;
        setTimeout(() => st.classList.add("d-none"), 2000);
      }
    };
  }
  // ---- Histórico IA (V2) ----
  const API_HIST_V2 = "/financeiro/ia/historico/feed/v2/";

  async function carregarHistorico(tipo = null, limit = 20) {
    const url = new URL(API_HIST_V2, window.location.origin);
    if (tipo && tipo !== "all") url.searchParams.set("tipo", tipo);
    url.searchParams.set("limit", limit);

    const res = await fetch(url, { credentials: "same-origin" });
    const j = await res.json();

    const elList = document.getElementById("listaHistorico");
    if (!elList) return;

    elList.innerHTML = "";
    if (!j.ok || !j.items || j.items.length === 0) {
      elList.innerHTML = `<div class="card p-3 text-muted">Nenhuma dica encontrada.</div>`;
      atualizarContadores(0, 0, 0, 0);
      return;
    }

    let total = 0,
      pos = 0,
      alertas = 0,
      neutras = 0;

    for (const it of j.items) {
      const tipoItem = (it.tipo || "neutra").toLowerCase();
      total++;
      if (tipoItem === "positiva") pos++;
      else if (tipoItem === "alerta") alertas++;
      else neutras++;

      const badge =
        tipoItem === "positiva"
          ? '<span class="badge bg-success">Positiva</span>'
          : tipoItem === "alerta"
          ? '<span class="badge bg-warning text-dark">Alerta</span>'
          : '<span class="badge bg-secondary">Neutra</span>';

      elList.insertAdjacentHTML(
        "beforeend",
        `
        <div class="card mb-2">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-center">
              <strong>Dica da IA</strong>
              ${badge}
            </div>
            <div class="small text-muted">${it.criado_em || ""}</div>
            <p class="mb-0">${(it.texto || it.text || "").toString()}</p>
          </div>
        </div>
      `
      );
    }

    atualizarContadores(total, pos, alertas, neutras);
  }

  function atualizarContadores(total, pos, alertas, neutras) {
    const set = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.textContent = v;
    };
    set("countAll", total);
    set("countPos", pos);
    set("countAlerta", alertas);
    set("countNeutra", neutras);
  }

  // Liga os botões por data-filter (HTML que você mostrou)
  document.querySelectorAll("[data-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll("[data-filter]")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const tipo = btn.getAttribute("data-filter");
      carregarHistorico(tipo === "all" ? null : tipo);
    });
  });

  // Carrega padrão (todas)
  carregarHistorico(null);

  // Botões (use estes IDs no HTML)
  document
    .getElementById("btnTodas")
    ?.addEventListener("click", () => carregarHistorico(null));
  document
    .getElementById("btnPositivas")
    ?.addEventListener("click", () => carregarHistorico("positiva"));
  document
    .getElementById("btnAlertas")
    ?.addEventListener("click", () => carregarHistorico("alerta"));
  document
    .getElementById("btnNeutras")
    ?.addEventListener("click", () => carregarHistorico("neutra"));

  // Carrega padrão (todas)
  carregarHistorico(null);
});
