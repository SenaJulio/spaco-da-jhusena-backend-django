// ======================================================
// historico_ia.js — versão “clean” (uma passada só)
// ======================================================
let __LAST_HIST_URL__ = "";

// ---- Guardião: impede rodar duas vezes o mesmo script
if (window.__IA_HIST_INIT_DONE__) {
  console.warn("⚠️ historico_ia.js já inicializado — abortando segunda carga.");
  throw new Error("historico_ia.js: init duplicado");
}
window.__IA_HIST_INIT_DONE__ = true;

console.log("🔍 historico_ia.js carregado");

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
function _normalizeTipo(v) {
  if (!v) return null;
  const s = String(v).toLowerCase();
  if (["positivo", "positivos", "positiva", "positivas"].includes(s))
    return "positiva";
  if (["alerta", "alertas"].includes(s)) return "alerta";
  if (["neutro", "neutros", "neutra", "neutras"].includes(s)) return "neutra";
  if (["all", "tudo", "todas", "todos"].includes(s)) return null;
  return s;
}
function getCsrfToken() {
  const meta = document.querySelector('meta[name="csrf-token"]');
  if (meta && meta.content) return meta.content;
  const match = document.cookie.match(/(^|;\s*)csrftoken=([^;]+)/);
  return match ? decodeURIComponent(match[2]) : "";
}

// ========= Constantes =========
const PREVIEW_LIMIT = 5; // quantos itens no preview do card verde
const MORE_INCREMENT = 10; // quanto carregar a mais no "Ver mais"

// ========= Main =========
document.addEventListener("DOMContentLoaded", () => {
  // evita rodar duas vezes se incluído por engano em duplicidade
  if (document.body.dataset.iaHistoricoInit === "1") return;
  document.body.dataset.iaHistoricoInit = "1";

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

  // FEED_URL (preferir data-feed-url). Força /v2/
  let FEED_URL =
    (list.dataset.feedUrl && list.dataset.feedUrl.trim()) ||
    "/financeiro/ia/historico/feed/v2/";
  if (
    FEED_URL.includes("/financeiro/ia/historico/feed/") &&
    !FEED_URL.includes("/v2/")
  ) {
    FEED_URL = FEED_URL.replace(
      "/financeiro/ia/historico/feed/",
      "/financeiro/ia/historico/feed/v2/"
    );
  }
  console.log("[Historico] FEED_URL =", FEED_URL);

  // Elementos adicionais
  const modalEl = document.getElementById("modalHistoricoIA");
  const modalList = document.getElementById("listaHistoricoModal");
  const btnVerMais = document.getElementById("btnVerMais");

  // Copia o preview para o modal ao abrir
  if (modalEl && list && modalList) {
    modalEl.addEventListener("show.bs.modal", function () {
      modalList.innerHTML = list.innerHTML;
    });
  }

  // Garante botão Ver mais (fallback)
  (function ensureVerMaisButton() {
    if (!list) return;
    let btn = document.getElementById("btnVerMais");
    if (!btn) {
      btn = document.createElement("button");
      btn.id = "btnVerMais";
      btn.className = "btn btn-outline-secondary btn-sm mt-2";
      btn.textContent = "Ver mais";
      list.insertAdjacentElement("afterend", btn);
    }
    btn.onclick = function () {
      // Se houver modal Bootstrap, apenas abre
      const modal = document.getElementById("modalHistoricoIA");
      if (modal && window.bootstrap && typeof bootstrap.Modal === "function") {
        const m = bootstrap.Modal.getOrCreateInstance(modal);
        m.show();
        return;
      }
      // Sem modal? Faz um fallback inocente
      window.scrollTo({ top: list.offsetTop, behavior: "smooth" });
    };
  })();

  // Badge/contadores/overlay
  const badge = document.getElementById("badgeNovas");
  const badgeCount = document.getElementById("badgeNovasCount");
  const btnReload =
    document.getElementById("btnReloadDicas") ||
    document.getElementById("btnReloadFeed");
  const btnMarcarLidas = document.getElementById("btnMarcarLidas");
  const btnHistoricoIA = document.getElementById("btnHistoricoIA");
  const elOvl = document.getElementById("ovlHistorico");

  const elCountAll = document.getElementById("countAll");
  const elCountPos = document.getElementById("countPos");
  const elCountAlerta = document.getElementById("countAlerta");
  const elCountNeutra = document.getElementById("countNeutra");

  // Filtros
  // >>>>>>>>> ALTERAÇÃO 1: aceitar data-ia-filtro também
  const filterButtons = document.querySelectorAll(
    "[data-ia-filtro],[data-filter]"
  );
  const btnFiltroIDs = {
    todas: document.getElementById("btnTodas"),
    positivas: document.getElementById("btnPositivas"),
    alertas: document.getElementById("btnAlertas"),
    neutras: document.getElementById("btnNeutras"),
  };

  // Estado
  const KEY_LAST_SEEN = "iaHistoricoLastSeenAt";
  let lastSeenAt = localStorage.getItem(KEY_LAST_SEEN) || null;
  let allItems = [];
  let filtroCategoria = ""; // ""=todas | neutra | positiva | alerta
  let refreshTimer = null;
  let BUSY = false;

  // ===== API: fetch histórico (assinatura flexível) =====
  async function fetchHistorico(a = 20, b = "") {
    // aceita fetchHistorico(20,"positiva") OU fetchHistorico("positiva")
    let limit = 20;
    let tipo = "";

    if (typeof a === "number" && Number.isFinite(a)) limit = a;
    else if (typeof a === "string" && isNaN(Number(a))) tipo = a;

    if (typeof b === "number" && Number.isFinite(b)) limit = b;
    else if (typeof b === "string" && isNaN(Number(b))) tipo = b;

    if (!Number.isFinite(limit) || limit <= 0) limit = 20;

    const qs = new URLSearchParams();
    qs.set("limit", String(limit));
    const t = _normalizeTipo(tipo);
    if (t) qs.set("tipo", t); // positiva | alerta | neutra

    const finalUrl = `${FEED_URL}?${qs.toString()}`;
    // Evita chamadas duplicadas para a mesma URL
    // Evita chamadas duplicadas para a mesma URL
    if (window.__LAST_HIST_URL__ === finalUrl) return;
    window.__LAST_HIST_URL__ = finalUrl;

    console.log("[Historico] GET", finalUrl);
    const r = await fetch(finalUrl, {
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

    // Ordena do mais recente
    items.sort((a, b) => b._stamp - a._stamp);
    return items;
  }

  // ===== Render =====
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

  function toggleLoading(show) {
    if (!elOvl) return;
    elOvl.classList.toggle("d-none", !show);
  }

  function renderLista(items) {
    const filtered = filtroCategoria
      ? items.filter((i) => i.tipo === filtroCategoria)
      : items;
    if (!filtered.length) {
      list.innerHTML = `<div class="alert alert-secondary mb-2">Nenhuma dica encontrada.</div>`;
      if (badge) badge.classList.add("d-none");
      atualizarContadoresUI(items);
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

  // ===== API pública (uma só) =====
  window.carregarHistorico = async function carregarHistorico(
    limit = 20,
    tipo = null
  ) {
    if (BUSY) return;
    BUSY = true;
    try {
      toggleLoading(true);
      if (btnReload) btnReload.disabled = true;
      filtroCategoria = _normalizeTipo(tipo) || "";
      allItems = await fetchHistorico(limit, filtroCategoria);
      renderLista(allItems);
      // auto scroll p/ primeira "nova"
      if (lastSeenAt) {
        const firstNew = list.querySelector(".ia-card.is-new");
        if (firstNew)
          firstNew.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    } catch (e) {
      console.error("Falha ao carregar histórico:", e);
      list.innerHTML = `<div class="alert alert-danger">Falha ao carregar histórico.</div>`;
    } finally {
      if (btnReload) btnReload.disabled = false;
      toggleLoading(false);
      BUSY = false;
    }
  };

  // ===== Ações / eventos =====
  btnReload?.addEventListener("click", () =>
    window.carregarHistorico(20, filtroCategoria)
  );
  btnMarcarLidas?.addEventListener("click", () => {
    const newest = allItems[0]?.criado_em;
    if (newest) {
      localStorage.setItem(KEY_LAST_SEEN, parseStamp(newest).toISOString());
      lastSeenAt = localStorage.getItem(KEY_LAST_SEEN);
      renderLista(allItems);
    }
  });
  btnHistoricoIA?.addEventListener("click", async () => {
    await window.carregarHistorico(20, filtroCategoria);
    const newest = allItems[0]?.criado_em;
    if (newest) {
      localStorage.setItem(KEY_LAST_SEEN, parseStamp(newest).toISOString());
      lastSeenAt = localStorage.getItem(KEY_LAST_SEEN);
      badge?.classList.add("d-none");
    }
  });

  // Filtros por atributo (recomendado — mantém compat)
  if (filterButtons && filterButtons.length) {
    filterButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        filterButtons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        // >>>>>>>>> ALTERAÇÃO 2: tentar data-ia-filtro e cair para data-filter
        const f = _normalizeTipo(
          btn.getAttribute("data-ia-filtro") || btn.getAttribute("data-filter")
        );
        window.carregarHistorico(20, f);
      });
    });
  }

  // Compat: botões por ID (se existirem)
  btnFiltroIDs.todas?.addEventListener("click", () =>
    window.carregarHistorico(20, null)
  );
  btnFiltroIDs.positivas?.addEventListener("click", () =>
    window.carregarHistorico(20, "positiva")
  );
  btnFiltroIDs.alertas?.addEventListener("click", () =>
    window.carregarHistorico(20, "alerta")
  );
  btnFiltroIDs.neutras?.addEventListener("click", () =>
    window.carregarHistorico(20, "neutra")
  );

  // Auto-refresh a cada 60s (pausa quando aba oculta)
  function startAutoRefresh() {
    stopAutoRefresh();
    refreshTimer = setInterval(() => {
      if (document.hidden) return;
      window.carregarHistorico(20, filtroCategoria);
    }, 60000);
  }
  function stopAutoRefresh() {
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = null;
  }

  // Init (uma chamada só)
  (async () => {
    await window.carregarHistorico(PREVIEW_LIMIT, null);
    startAutoRefresh();
  })();

  // “Ver mais” no preview (aumenta limit local)
  let _limitAtual = PREVIEW_LIMIT;
  document.getElementById("btnVerMais")?.addEventListener("click", async () => {
    _limitAtual += MORE_INCREMENT;
    await window.carregarHistorico(_limitAtual, filtroCategoria);
  });

  // ========= Modo Turbo (Gerar Dica 30d) =========
  const btnTurbo = document.getElementById("btnTurbo");
  const st = document.getElementById("turboStatus");
  const box = document.getElementById("turboResult");
  const dica = document.getElementById("turboDica");

  if (btnTurbo && st && box && dica) {
    btnTurbo.onclick = async () => {
      btnTurbo.disabled = true;
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

          // recarrega lista pra já aparecer a dica nova (se a API salvar)
          await window.carregarHistorico(PREVIEW_LIMIT, filtroCategoria);
        } else {
          st.textContent = "⚠️ Não consegui gerar a dica.";
        }
      } catch (e) {
        console.error(e);
        st.textContent = "Erro na solicitação.";
      } finally {
        btnTurbo.disabled = false;
        setTimeout(() => st.classList.add("d-none"), 2000);
      }
    };
  }

  // ========= Resumo Mensal da IA (gráfico + stats) =========
  (function resumoMensalIA() {
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
  })();
});
// === PATCH: Diagnóstico e wire dos botões ===
(function () {
  // 1) Diagnóstico: confira se os elementos existem
  const req = {
    listaHistorico: !!document.getElementById("listaHistorico"),
    btnTurbo:       !!document.getElementById("btnTurbo"),
    btnReloadDicas: !!document.getElementById("btnReloadDicas"),
    filtros:        !!document.querySelectorAll("[data-ia-filtro],[data-filter]").length,
  };
  console.log("🔎 Diagnóstico elementos:", req);

  // 2) Corrigir a URL do botão “Gerar dica 30d”
  //    >>> Estávamos usando /financeiro/modo-turbo/dica30d/, mas no seu backend está OK com /financeiro/ia/dica30d/
  const __BTN_TURBO_FIX__ = document.getElementById("btnTurbo");
  if (__BTN_TURBO_FIX__) {
    __BTN_TURBO_FIX__.onclick = async (ev) => {
      ev.preventDefault();
      const st  = document.getElementById("turboStatus");
      const box = document.getElementById("turboResult");
      const dica = document.getElementById("turboDica");
      try {
        __BTN_TURBO_FIX__.disabled = true;
        if (st) { st.textContent = "Analisando…"; st.classList.remove("d-none"); }
        if (box) box.classList.add("d-none");

        const r = await fetch("/financeiro/ia/dica30d/", {  // <<< URL corrigida
          method: "POST",
          headers: {
            "X-Requested-With": "XMLHttpRequest",
            "X-CSRFToken": (function () {
              const m = document.cookie.match(/(^|;\s*)csrftoken=([^;]+)/);
              return m ? decodeURIComponent(m[2]) : "";
            })(),
            "Accept": "application/json",
          },
          credentials: "same-origin",
        });

        const j = await r.json();
        console.log("✅ [Dica30d] resposta:", j);
        if (j && j.ok) {
          if (dica) {
            const titulo = j.title || "Dica dos últimos 30 dias";
            const texto  = j.text || j.dica || "(sem texto)";
            const quando = j.created_at || new Date().toLocaleString("pt-BR");
            dica.textContent = `${titulo} — ${texto}\n(Insight • ${quando})`;
          }
          if (box) box.classList.remove("d-none");
          if (st)  st.textContent = "✅ Pronto! Nova dica gerada.";
          // recarrega histórico para aparecer a dica recém-salva
          window.__HistoricoIA?.recarregar?.();
        } else {
          if (st) st.textContent = "⚠️ Não consegui gerar a dica.";
        }
      } catch (e) {
        console.error("💥 [Dica30d] erro:", e);
        if (st) st.textContent = "Erro na solicitação.";
      } finally {
        __BTN_TURBO_FIX__.disabled = false;
        setTimeout(() => { if (st) st.classList.add("d-none"); }, 2000);
      }
    };
  }

  // 3) “Atualizar histórico” → chama o carregador público
  const __BTN_RELOAD__ = document.getElementById("btnReloadDicas") || document.getElementById("btnReloadFeed");
  if (__BTN_RELOAD__) {
    __BTN_RELOAD__.addEventListener("click", (ev) => {
      ev.preventDefault();
      console.log("🔄 [Historico] recarregar()");
      window.__HistoricoIA?.recarregar?.();
    });
  }

  // 4) Filtros “Todas / Positivas / Alertas / Neutras”
  document.querySelectorAll("[data-ia-filtro],[data-filter]").forEach((btn) => {
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      const tipo = (btn.getAttribute("data-ia-filtro") || btn.getAttribute("data-filter") || "").toLowerCase();
      console.log("[Historico] filtro:", tipo || "(todas)");
      window.__HistoricoIA?.filtrar?.(tipo);
    });
  });

  // 5) “Ver Histórico” (se existir) → força uma carga antes de abrir
  const __BTN_VER_HIST__ = document.getElementById("btnHistoricoIA");
  if (__BTN_VER_HIST__) {
    __BTN_VER_HIST__.addEventListener("click", () => {
      console.log("🧠 [Historico] abrir modal + carregar()");
      window.carregarHistorico(20, "");
    });
  }
})();
