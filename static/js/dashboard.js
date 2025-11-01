/* =========================================================
 * Spaço da Jhuséna — Dashboard unificado (corrigido)
 * ========================================================= */

const DEBUG_DASH = false;
const dlog = (...a) => {
  if (DEBUG_DASH) console.log(...a);
};

console.log("🐶 Spaço da Jhuséna Dev ativo — Painel carregado com sucesso!");

// Badge dev (opcional)
document.addEventListener("DOMContentLoaded", () => {
  const elBadge = document.getElementById("devBadge");
  const elText = document.getElementById("devBadgeText");
  if (elBadge && elText) {
    elText.textContent = `Painel carregado em ${new Date().toLocaleString()}`;
    elBadge.style.display = "inline-flex";
  }
});

// Preview simples do histórico (só se não houver lista completa nem módulo novo)
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("listaHistorico") || window.__HistoricoIA) {
    dlog("🧠 Histórico completo/módulo novo detectado — preview simples off.");
    return;
  }

  fetch("/financeiro/ia/historico/feed/v2/?limit=5", {
    headers: { Accept: "application/json" },
  })
    .then((r) => r.json())
    .then((data) => {
      const items = Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.results)
        ? data.results
        : Array.isArray(data?.data)
        ? data.data
        : [];

      let host = document.getElementById("historicoSimples");
      if (!host) {
        host = document.createElement("div");
        host.id = "historicoSimples";
        host.className = "card mb-3";
        host.innerHTML = `
          <div class="card-body">
            <h5 class="card-title mb-2">🧠 Histórico (últimas)</h5>
            <div id="historicoSimplesList"></div>
          </div>
        `;
        const anchor =
          document.getElementById("devBadge") || document.querySelector("h1");
        if (anchor?.parentNode)
          anchor.parentNode.insertBefore(host, anchor.nextSibling);
        else document.body.appendChild(host);
      }

      const esc = (s) =>
        String(s ?? "")
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#039;");

      const wrap = host.querySelector("#historicoSimplesList") || host;
      if (!items.length) {
        wrap.innerHTML = `<div class="text-muted">Sem dicas ainda.</div>`;
        return;
      }

      wrap.innerHTML = items
        .map((i) => {
          const quando = i.created_at_br || i.created_at || i.criado_em || "";
          const cat = i.categoria || i.tipo || "Geral";
          const txt = (i.texto || i.text || i.dica || "")
            .toString()
            .replace(/\n/g, "<br>");
          return `
          <div class="border-bottom py-2">
            <small class="text-muted">${esc(quando)} • ${esc(cat)}</small>
            <div>${txt}</div>
          </div>
        `;
        })
        .join("");
    })
    .catch((err) => console.error("Falha ao buscar preview histórico:", err));
});

(function () {
  "use strict";

  // Evita rodar 2x
  if (window.__SJ_DASH_ONCE__) {
    dlog("Dashboard já inicializado — evitando duplicidade.");
    return;
  }
  window.__SJ_DASH_ONCE__ = true;

  /* =============== Utils =============== */
  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
  const pad2 = (n) => String(n).padStart(2, "0");
  const fmtYMD = (d) =>
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const firstDayOfMonth = (d) =>
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-01`;

  async function sjFetchJSON(url) {
    const r = await fetch(url, {
      headers: {
        "X-Requested-With": "XMLHttpRequest",
        Accept: "application/json",
      },
      credentials: "same-origin",
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      throw new Error(`HTTP ${r.status} @ ${url}: ${txt.slice(0, 300)}`);
    }
    return r.json();
  }

  /* =============== Chart helpers =============== */
  const sjCharts = {};
  function getOrCreateChart(ctx, key, config) {
    if (sjCharts[key]) {
      sjCharts[key].data = config.data;
      sjCharts[key].options = config.options || {};
      sjCharts[key].update();
      return sjCharts[key];
    }
    const prev = Chart.getChart(ctx.canvas);
    if (prev) prev.destroy();
    const ch = new Chart(ctx, config);
    sjCharts[key] = ch;
    queueMicrotask(() => {
      try {
        ch.resize();
      } catch {}
    });
    return ch;
  }

  function montarGraficoEvolucao(
    dias = [],
    receitas = [],
    despesas = [],
    saldo = []
  ) {
    const el = document.getElementById("graficoEvolucao");
    const empty = document.getElementById("evolucaoEmpty");
    if (!el) return;

    const hasData = Array.isArray(dias) && dias.length > 0;
    if (!hasData) {
      if (empty) empty.hidden = false;
      el.style.display = "none";
      const inst = Chart.getChart(el);
      if (inst) inst.destroy();
      return;
    }
    if (empty) empty.hidden = true;
    el.style.display = "";

    const ctx = el.getContext("2d");
    return getOrCreateChart(ctx, "sj-evolucao", {
      type: "line",
      data: {
        labels: dias,
        datasets: [
          {
            label: "Receitas",
            data: receitas,
            borderWidth: 2,
            fill: false,
            tension: 0.2,
          },
          {
            label: "Despesas",
            data: despesas,
            borderWidth: 2,
            fill: false,
            tension: 0.2,
          },
          {
            label: "Saldo",
            data: saldo,
            borderWidth: 2,
            fill: false,
            tension: 0.2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        parsing: false,
        interaction: { mode: "index", intersect: false },
        plugins: { legend: { position: "bottom" } },
        scales: {
          x: { ticks: { maxRotation: 0, autoSkip: true } },
          y: { beginAtZero: true },
        },
      },
    });
  }

  function montarGraficoCategorias(categorias = [], valores = []) {
    const el = document.getElementById("graficoCategorias");
    const empty = document.getElementById("categoriasEmpty");
    if (!el) return;

    const hasData = Array.isArray(categorias) && categorias.length > 0;
    if (!hasData) {
      if (empty) empty.hidden = false;
      el.style.display = "none";
      const inst = Chart.getChart(el);
      if (inst) inst.destroy();
      return;
    }
    if (empty) empty.hidden = true;
    el.style.display = "";

    const ctx = el.getContext("2d");
    return getOrCreateChart(ctx, "sj-categorias", {
      type: "doughnut",
      data: {
        labels: categorias,
        datasets: [{ label: "Total", data: valores, borderWidth: 1 }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        parsing: false,
        plugins: { legend: { position: "bottom" } },
      },
    });
  }

  /* =============== Popular o <select id="filtroCategoria"> com categorias reais =============== */
  document.addEventListener("DOMContentLoaded", () => {
    const sel = document.getElementById("filtroCategoria");
    if (!sel) return;

    const IA_LABELS = [
      { value: "", label: "Todas" },
      { value: "Geral", label: "Geral" },
      { value: "Alerta", label: "Alerta" },
      { value: "Meta", label: "Meta" },
      { value: "Dica", label: "Dica" },
    ];

    if (sel.dataset.hydrated === "1") return;

    sel.innerHTML = "";
    for (const o of IA_LABELS) {
      const opt = document.createElement("option");
      opt.value = o.value;
      opt.textContent = o.label;
      sel.appendChild(opt);
    }

    const url = window.URL_CATEGORIAS || "/financeiro/dashboard/categorias/";
    fetch(url, {
      headers: {
        "X-Requested-With": "XMLHttpRequest",
        Accept: "application/json",
      },
      credentials: "same-origin",
    })
      .then((r) => r.json())
      .then((j) => {
        if (
          !j ||
          !j.ok ||
          !Array.isArray(j.categorias) ||
          !j.categorias.length
        ) {
          sel.dataset.hydrated = "1";
          return;
        }

        const sep = document.createElement("option");
        sep.disabled = true;
        sep.textContent = "──────────";
        sel.appendChild(sep);

        for (const c of j.categorias) {
          const opt = document.createElement("option");
          opt.value = c;
          opt.textContent = c;
          sel.appendChild(opt);
        }
        sel.dataset.hydrated = "1";
      })
      .catch((err) => {
        console.warn(
          "Categorias: fallback silencioso (sem campo 'categoria' ou erro).",
          err
        );
        sel.dataset.hydrated = "1";
      });
  });

  /* =============== Dashboard — filtros e gráficos =============== */
  document.addEventListener("DOMContentLoaded", async function () {
    const $ini =
      document.querySelector("#filtroInicio") ||
      document.querySelector("#data_inicio");
    const $fim =
      document.querySelector("#filtroFim") ||
      document.querySelector("#data_fim");
    const hoje = new Date();
    const iniDefault = firstDayOfMonth(hoje);
    const fimDefault = fmtYMD(hoje);

    if ($ini && !$ini.value) $ini.value = iniDefault;
    if ($fim && !$fim.value) $fim.value = fimDefault;

    let inicio = $ini?.value || iniDefault;
    let fim = $fim?.value || fimDefault;

    async function recarregar() {
      const base =
        window.URL_DADOS_GRAFICO || "/financeiro/dados_grafico_filtrados/";

      const _inicio = $ini?.value || iniDefault;
      const _fim = $fim?.value || fimDefault;

      const $cat = document.getElementById("filtroCategoria");
      
      const categoria = $cat && $cat.value ? $cat.value.trim() : "";
      const IA_LABELS_SET = new Set(["Geral", "Alerta", "Meta", "Dica"]);
      const qs = new URLSearchParams();
      qs.set("inicio", _inicio);
      qs.set("fim", _fim);
      if (categoria && !IA_LABELS_SET.has(categoria)) {
        qs.set("categoria", categoria); // só manda se for categoria REAL
      }


      const url = `${base}?${qs.toString()}`;
      console.log("[Dashboard] GET", url);

      const dados = await sjFetchJSON(url);
      if (!dados || !Array.isArray(dados.dias)) {
        throw new Error(
          "Payload inválido: esperado {dias, receitas, despesas, saldo}"
        );
      }

      montarGraficoEvolucao(
        dados.dias,
        dados.receitas,
        dados.despesas,
        dados.saldo
      );

      if (Array.isArray(dados.categorias) && Array.isArray(dados.valores)) {
        montarGraficoCategorias(dados.categorias, dados.valores);
      } else {
        montarGraficoCategorias([], []);
      }
    }

    try {
      await recarregar();
    } catch (err) {
      console.error("❌ Erro ao carregar/desenhar gráficos:", err);
      alert("Erro ao carregar os gráficos. Veja o console para detalhes.");
    }

    [$ini, $fim].forEach((el) => {
      if (!el) return;
      el.addEventListener("change", () => {
        inicio = $ini?.value || iniDefault;
        fim = $fim?.value || fimDefault;
        recarregar().catch((e) => console.error(e));
      });
    });

    const $cat = document.getElementById("filtroCategoria");
    if ($cat) {
      $cat.addEventListener("change", () => {
        recarregar().catch((e) => console.error(e));
      });
    }

    const btnAplicar =
      document.getElementById("btnAplicarFiltros") ||
      document.getElementById("filtrar-btn");
    if (btnAplicar) {
      btnAplicar.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const st = document.getElementById("statusFiltros");
        btnAplicar.disabled = true;
        if (st) st.textContent = "⏳ Aplicando filtros...";
        try {
          if ($ini?.value) inicio = $ini.value;
          if ($fim?.value) fim = $fim.value;
          await recarregar();
          if (st) st.textContent = "✅ Filtros aplicados!";
        } catch (e) {
          console.error("Erro ao aplicar filtros:", e);
          if (st) st.textContent = "Erro ao aplicar filtros.";
        } finally {
          btnAplicar.disabled = false;
          setTimeout(() => {
            if (st) st.textContent = "";
          }, 2000);
        }
      });
    }
  });

  /* =============== Botão "Gerar nova dica" (simples) =============== */
  document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("btnGerarDica");
    const st = document.getElementById("statusDica");
    const csrf = typeof getCsrfToken === "function" ? getCsrfToken : () => "";

    if (!btn) return;

    btn.addEventListener("click", async () => {
      btn.disabled = true;
      if (st) st.textContent = "Gerando dica...";
      try {
        const r = await fetch("/financeiro/api/insights/criar-simples/", {
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
          if (st) st.textContent = "✅ Nova dica gerada!";
          const box =
            document.getElementById("cardsInsight") ||
            document.getElementById("listaHistorico");
          if (box) {
            const data = j.created_at || new Date().toLocaleString("pt-BR");
            const titulo = j.title || "Nova dica";
            const texto = j.text || j.dica || "";
            const card = document.createElement("div");
            card.className = "card border-success mt-3";
            card.innerHTML = `
              <div class="card-body">
                <div class="small text-muted">Insight • ${escapeHtml(
                  String(data)
                )}</div>
                <h5 class="card-title mb-1">${escapeHtml(String(titulo))}</h5>
                <p class="mb-0" style="white-space:pre-wrap">${escapeHtml(
                  String(texto)
                )}</p>
              </div>`;
            const placeholder = document.getElementById(
              "placeholderInsightCard"
            );
            if (placeholder) placeholder.replaceWith(card);
            else box.prepend(card);
          }
          if (window.__HistoricoIA) window.__HistoricoIA.recarregar();
          else document.getElementById("btnReloadDicas")?.click();
        } else {
          if (st) st.textContent = "⚠️ Não consegui gerar a dica.";
        }
      } catch (e) {
        console.error("Erro ao gerar dica simples:", e);
        if (st) st.textContent = "Erro na solicitação.";
      } finally {
        btn.disabled = false;
        setTimeout(() => {
          if (st) st.textContent = "";
        }, 2000);
      }
    });
  });

  // Oculta botões duplicados "Gerar nova dica"
  document.addEventListener("DOMContentLoaded", () => {
    const main = document.getElementById("btnGerarDica");
    if (!main) return;
    const all = Array.from(document.querySelectorAll("button")).filter(
      (b) =>
        b !== main && b.textContent.trim().toLowerCase() === "gerar nova dica"
    );
    for (const b of all) {
      b.classList.add("d-none");
      b.disabled = true;
      b.setAttribute("data-duplicado", "true");
    }
  });

  /* =============== LEGACY Histórico (período + categoria + ver mais) =============== */
  document.addEventListener("DOMContentLoaded", () => {
    if (window.__HistoricoIA) {
      dlog("LEGACY histórico desativado (módulo novo detectado).");
      return;
    }

    const wrap = document.getElementById("listaHistorico");
    if (!wrap || !wrap.parentNode) return;

    const elIni =
      document.getElementById("filtroInicio") ||
      document.querySelector('input[name="inicio"]') ||
      document.querySelector('input[data-role="inicio"]');

    const elFim =
      document.getElementById("filtroFim") ||
      document.querySelector('input[name="fim"]') ||
      document.querySelector('input[data-role="fim"]');

    const elCat =
      document.getElementById("filtroCategoria") ||
      document.querySelector('select[name="categoria"]') ||
      document.querySelector('input[name="categoria"]');

    const PER_PAGE = 10;
    let page = 1;
    let loading = false;

    let btn = document.getElementById("btnVerMaisHistorico");
    if (!btn) {
      btn = document.createElement("button");
      btn.id = "btnVerMaisHistorico";
      btn.className = "btn btn-outline-secondary btn-sm mt-2";
      btn.textContent = "Ver mais";
      wrap.parentNode.appendChild(btn);
    }

    function normItems(payload) {
      return (
        (Array.isArray(payload?.items) && payload.items) ||
        (Array.isArray(payload?.results) && payload.results) ||
        (Array.isArray(payload?.data?.items) && payload.data.items) ||
        (Array.isArray(payload?.data) && payload.data) ||
        (Array.isArray(payload) && payload) ||
        []
      );
    }

    function renderItems(items, append = true) {
      const esc = (s) => escapeHtml(String(s ?? ""));
      const arr = Array.isArray(items) ? items : [];
      const html = arr
        .map((i) => {
          const quando =
            i.created_at_br || i.created_at || i.criado_em || i.data || "";
          const cat = i.categoria || i.tipo || "Geral";
          const titulo = i.title || "Dica da IA";
          const texto = (i.texto || i.text || i.dica || "").toString();
          return `
          <div class="card border-success mb-3 shadow-sm">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <span class="badge bg-success-subtle text-success border border-success-subtle">${esc(
                  cat
                )}</span>
                <small class="text-muted">${esc(quando)}</small>
              </div>
              <h6 class="card-title text-success mb-1">${esc(titulo)}</h6>
              <p class="card-text mb-0" style="white-space: pre-wrap">${esc(
                texto
              )}</p>
            </div>
          </div>`;
        })
        .join("");

      if (append) wrap.insertAdjacentHTML("beforeend", html);
      else
        wrap.innerHTML =
          html ||
          `<div class="alert alert-secondary mb-2">Nenhuma dica encontrada.</div>`;
    }

    function buildParams(nextPage) {
      const params = new URLSearchParams({
        page: String(nextPage),
        per_page: String(PER_PAGE),
      });
      const vIni = elIni?.value?.trim();
      const vFim = elFim?.value?.trim();
      const vCat = elCat?.value?.trim();
      if (vIni) params.set("inicio", vIni);
      if (vFim) params.set("fim", vFim);
      if (vCat && vCat.toLowerCase() !== "todas") params.set("categoria", vCat);
      return params.toString();
    }

    async function loadPage(nextPage, append) {
      if (loading) return;
      loading = true;

      let loader = document.getElementById("historicoLoadingRow");
      if (!loader) {
        loader = document.createElement("div");
        loader.id = "historicoLoadingRow";
        loader.className = "text-muted small mt-3";
        loader.innerHTML = "Carregando…";
      }
      if (append) wrap.appendChild(loader);
      else wrap.parentNode.insertBefore(loader, wrap);

      const prevLabel = btn.textContent;
      btn.disabled = true;
      btn.textContent = append ? "Carregando…" : "Atualizando…";

      try {
        const url = `/financeiro/ia/historico/feed/v2/?${buildParams(
          nextPage
        )}`;
        dlog("[Histórico LEGACY] GET", url);
        const r = await fetch(url, { headers: { Accept: "application/json" } });
        const j = await r.json();

        const items = normItems(j);
        renderItems(items, append);

        // efeito visual leve
        try {
          const last = wrap.lastElementChild;
          if (last) {
            last.style.outline = "1px dashed #999";
            last.style.background = "rgba(0,0,0,.03)";
            setTimeout(() => {
              last.style.outline = "";
              last.style.background = "";
            }, 1200);
            last.scrollIntoView({ behavior: "smooth", block: "end" });
          }
        } catch {}

        page = j.page || nextPage;
        const hasNext = Boolean(j.has_next);
        if (!hasNext || !items.length) {
          btn.textContent = "Fim";
          btn.disabled = true;
          let endMsg = document.getElementById("historicoEndMsg");
          if (!endMsg) {
            endMsg = document.createElement("div");
            endMsg.id = "historicoEndMsg";
            endMsg.className = "text-muted small mt-2";
            endMsg.textContent = "Não há mais registros para carregar.";
            btn.parentNode.insertBefore(endMsg, btn);
          }
        } else {
          btn.textContent = prevLabel; // "Ver mais"
          btn.disabled = false;
        }
      } catch (e) {
        console.error("Erro ao carregar histórico (LEGACY):", e);
        btn.textContent = "Tentar novamente";
        btn.disabled = false;
      } finally {
        if (loader?.parentNode) loader.parentNode.removeChild(loader);
        loading = false;
      }
    }

    btn.onclick = () => {
      const dbg = `/financeiro/ia/historico/feed/v2/?${buildParams(page + 1)}`;
      dlog("[Histórico LEGACY] Ver mais:", {
        currentPage: page,
        nextPage: page + 1,
        url: dbg,
      });
      loadPage(page + 1, true);
    };

    async function onFiltersChange() {
      page = 1;
      btn.disabled = false;
      btn.textContent = "Ver mais";
      await loadPage(1, false);
    }

    if (elIni) elIni.addEventListener("change", onFiltersChange);
    if (elFim) elFim.addEventListener("change", onFiltersChange);
    if (elCat) elCat.addEventListener("change", onFiltersChange);

    // carregamento inicial
    loadPage(1, false).catch((e) => console.error(e));
  });

  /* =============== Histórico — salvar/restaurar rolagem =============== */
  document.addEventListener("DOMContentLoaded", () => {
    const wrap = document.getElementById("listaHistorico");
    const KEY = "iaHistoricoScroll:" + location.pathname;

    function restore() {
      try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return;
        const s = JSON.parse(raw);
        if (wrap && typeof s.wrap === "number") wrap.scrollTop = s.wrap;
        else if (typeof s.win === "number") window.scrollTo(0, s.win);
      } catch {}
    }

    const save = () => {
      try {
        const data = {
          ts: Date.now(),
          wrap: wrap ? wrap.scrollTop : null,
          win: window.scrollY,
        };
        localStorage.setItem(KEY, JSON.stringify(data));
      } catch {}
    };
    const debounce = (fn, ms = 150) => {
      let t;
      return () => {
        clearTimeout(t);
        t = setTimeout(fn, ms);
      };
    };
    const onScroll = debounce(save, 150);

    if (wrap) wrap.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("beforeunload", save);
    setTimeout(restore, 120);
  });

  /* =============== Botão Modal "Atualizar histórico" =============== */
  document.addEventListener("DOMContentLoaded", () => {
    const btnModalReload = document.getElementById("btnReloadDicasModal");
    if (!btnModalReload) return;

    btnModalReload.addEventListener("click", (ev) => {
      if (!ev.isTrusted) return;
      console.log("🧠 [Historico] Recarregando via botão do modal...");
      try {
        if (
          window.__HistoricoIA &&
          typeof window.__HistoricoIA.recarregar === "function"
        ) {
          window.__HistoricoIA.recarregar();
        } else {
          console.warn(
            "⚠️ Módulo __HistoricoIA não encontrado — recarregar ignorado."
          );
        }
      } catch (err) {
        console.error("💥 Erro ao tentar recarregar histórico via modal:", err);
      }
    });
  });

  /* =============== IA: Gerar Nova Dica (últimos 30 dias) + limpar badge modal =============== */
  document.addEventListener("DOMContentLoaded", function () {
    const btn = document.getElementById("btnGerarDica30d");
    const st = document.getElementById("stDica30d");
    if (!btn) return;

    function getCookie(name) {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop().split(";").shift();
    }

    btn.addEventListener("click", async () => {
      console.log("⚡ [Dica30d] clique detectado");
      try {
        btn.disabled = true;
        if (st) st.textContent = "Gerando dica...";

        const resp = await fetch("/financeiro/ia/dica30d/", {
          method: "POST",
          headers: { "X-CSRFToken": getCookie("csrftoken") },
        });
        const data = await resp.json();
        console.log("✅ [Dica30d] resposta:", data);

        // guarda os últimos itens (se vierem) — usado por algum badge externo opcional
        const items = data.results || data.items || data || [];
        window.__IA_HIST_LAST_ITEMS = items;
        if (window.__IA_HIST_BADGE_UPDATE) window.__IA_HIST_BADGE_UPDATE(items);

        if (data.ok) {
          if (st)
            st.textContent = `✅ ${data.tipo?.toUpperCase() || ""}: ${
              data.dica
            }`;
          if (window.__HistoricoIA) window.__HistoricoIA.recarregar();
          else document.getElementById("btnReloadDicas")?.click();
        } else {
          if (st) st.textContent = "⚠️ Não consegui gerar a dica.";
        }
      } catch (e) {
        console.error("💥 [Dica30d] erro:", e);
        if (st) st.textContent = "Erro ao gerar dica.";
      } finally {
        setTimeout(() => {
          if (st) st.textContent = "";
        }, 4000);
        btn.disabled = false;
      }
    });

    // Zera badge ao abrir o modal (se você usar modal com id="modalHistoricoIA")
    (function () {
      const MODAL_ID = "modalHistoricoIA";
      const modalEl = document.getElementById(MODAL_ID);
      if (modalEl) {
        modalEl.addEventListener("shown.bs.modal", () => {
          if (window.__IA_HIST_MARK_SEEN && window.__IA_HIST_LAST_ITEMS) {
            window.__IA_HIST_MARK_SEEN(window.__IA_HIST_LAST_ITEMS);
          }
        });
      }
    })();
  });
})(); // FIM IIFE
