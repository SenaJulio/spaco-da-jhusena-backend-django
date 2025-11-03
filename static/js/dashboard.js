/* ==========================================================================
 * Spaço da Jhuséna — Dashboard FULL (seguro, modular, sem quebrar layout)
 * Versão: 2025-11-03
 * --------------------------------------------------------------------------
 * Filosofia:
 * - NÃO cria nem move elementos de layout existentes (a menos que você ative
 *   flags opcionais explícitas).
 * - Usa apenas IDs já presentes no template:
 *     #filtroInicio, #filtroFim, #filtroCategoria, #btnAplicarFiltros|#filtrar-btn
 *     canvas#graficoEvolucao, canvas#graficoCategorias
 *     #evolucaoEmpty, #categoriasEmpty (opcionais)
 *     #btnGerarDica, #statusDica (opcionais)
 *     #btnGerarDica30d, #stDica30d (opcionais)
 *     #btnReloadDicasModal (opcional)
 *     #listaHistorico (LEGACY opcional)
 * --------------------------------------------------------------------------
 * Rotas esperadas no backend:
 *   - window.URL_DADOS_GRAFICO ou '/financeiro/dados_grafico_filtrados/'
 *   - window.URL_CATEGORIAS    ou '/financeiro/dashboard/categorias/'
 *   - '/financeiro/ia/dica30d/' (POST) (opcional)
 *   - '/financeiro/api/insights/criar-simples/' (POST) (opcional)
 *   - '/financeiro/ia/historico/feed/v2/' (LEGACY opcional)
 * ==========================================================================*/

(function () {
  "use strict";

  // ======================= FEATURE FLAGS =======================
  const FEATURES = {
    HYDRATE_CATEGORY_SELECT: true, // popula <select id="filtroCategoria"> com categorias reais do backend
    LEGACY_HISTORICO_LIST: true, // ativa loader legacy do histórico para #listaHistorico se módulo novo não existir
    SAVE_SCROLL_STATE: true, // salva/restaura rolagem do histórico
    TURBO_BUTTON: true, // ativa botão #btnGerarDica30d (se houver)
    SIMPLE_TIP_BUTTON: true, // ativa botão #btnGerarDica (se houver)
    // NÃO cria DIVs extras; somente usa o que existir no HTML.
  };

  // ======================= THEME/COLORS ========================
  const cssVar = (name, fallback) =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() ||
    fallback;

  const CHART_COLORS = {
    receitas: cssVar("--cor-principal", "#2e7d32"),
    despesas: "#d32f2f",
    saldo: "#f9a825",
    grid: "rgba(0,0,0,0.08)",
    text: "#1b5e20",
  };

  // ===================== CHART.JS DEFAULTS =====================
  function applyChartDefaults() {
    if (!window.Chart) return;
    try {
      charts.defaults.font.family =
        "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
      charts.defaults.color = CHART_COLORS.text;
      charts.defaults.plugins.legend.labels.boxWidth = 14;
      charts.defaults.plugins.legend.labels.boxHeight = 14;
    } catch {}
  }
  if (window.Chart) applyChartDefaults();
  document.addEventListener("DOMContentLoaded", applyChartDefaults);

  // ======================== UTILITÁRIOS ========================
  const pad2 = (n) => String(n).padStart(2, "0");
  const fmtYMD = (d) =>
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const firstDayOfMonth = (d) =>
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-01`;

  function toNumberBR(x) {
    if (x == null) return 0;
    if (typeof x === "number" && Number.isFinite(x)) return x;
    const s = String(x)
      .replace(/\s+/g, "")
      .replace(/\.(?=\d{3}(?:\D|$))/g, "") // remove milhar
      .replace(",", ".") // vírgula decimal
      .replace(/[^\d.+-Ee]/g, "");
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }

  function _alignSeries(labels = [], ...series) {
    const L = Array.isArray(labels) ? labels.length : 0;
    const out = series.map((arr) => {
      const src = Array.isArray(arr) ? arr : [];
      const dst = new Array(L);
      for (let i = 0; i < L; i++) dst[i] = toNumberBR(src[i]);
      return dst;
    });
    return {
      labels: Array.isArray(labels) ? labels.slice(0, L) : [],
      series: out,
    };
  }

  function debounce(fn, ms = 300) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  // ====================== FETCH COM ABORT ======================
  let __lastCtrl;
  async function sjFetchJSON(url) {
    if (__lastCtrl) {
      try {
        __lastCtrl.abort();
      } catch {}
    }
    __lastCtrl = new AbortController();
    const r = await fetch(url, {
      headers: {
        "X-Requested-With": "XMLHttpRequest",
        Accept: "application/json",
      },
      credentials: "same-origin",
      signal: __lastCtrl.signal,
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      throw new Error(`HTTP ${r.status} @ ${url}: ${txt.slice(0, 300)}`);
    }
    return r.json();
  }

  // ========================== CHARTS ===========================
  const charts = {};
  function destroyChartByCanvas(canvas) {
    try {
      const inst = charts.getChart(canvas);
      if (inst) inst.destroy();
    } catch {}
  }
  function getOrCreateChart(ctx, key, config) {
    destroyChartByCanvas(ctx.canvas); // evita “isPluginEnabled undefined.filter” do Chart.js
    if (charts[key]) {
      try {
        charts[key].destroy();
      } catch {}
      charts[key] = null;
    }
    const ch = new charts(ctx, config);
    charts[key] = ch;
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
    const canvas = document.getElementById("graficoEvolucao");
    const empty = document.getElementById("evolucaoEmpty");
    if (!canvas || !window.Chart) return;

    const hasData = Array.isArray(dias) && dias.length > 0;
    if (!hasData) {
      if (empty) {
        empty.hidden = false;
        empty.textContent = "Sem movimentações no período.";
      }
      destroyChartByCanvas(canvas);
      canvas.style.display = "none";
      return;
    }
    if (empty) empty.hidden = true;
    canvas.style.display = "";

    const {
      labels,
      series: [R, D, S],
    } = _alignSeries(dias, receitas, despesas, saldo);
    const allZero = [...R, ...D, ...S].every((v) => (v || 0) === 0);
    const Rz = allZero ? R.map(() => 0.000001) : R;
    const Dz = allZero ? D.map(() => 0.000001) : D;
    const Sz = allZero ? S.map(() => 0.000001) : S;

    const yScale = allZero
      ? {
          min: 0,
          suggestedMax: 1,
          grid: { color: CHART_COLORS.grid },
          ticks: {
            color: CHART_COLORS.text,
            callback: (v) => v.toLocaleString("pt-BR"),
          },
        }
      : {
          beginAtZero: true,
          grid: { color: CHART_COLORS.grid },
          ticks: {
            color: CHART_COLORS.text,
            callback: (v) => v.toLocaleString("pt-BR"),
          },
        };

    const ctx = canvas.getContext("2d");
    return getOrCreateChart(ctx, "sj-evolucao", {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Receitas",
            data: Rz,
            borderColor: CHART_COLORS.receitas,
            backgroundColor: CHART_COLORS.receitas + "33",
            borderWidth: 2,
            fill: true,
            tension: 0.35,
            pointRadius: 2,
            pointBackgroundColor: CHART_COLORS.receitas,
          },
          {
            label: "Despesas",
            data: Dz,
            borderColor: CHART_COLORS.despesas,
            backgroundColor: CHART_COLORS.despesas + "22",
            borderWidth: 2,
            fill: true,
            tension: 0.35,
            pointRadius: 2,
            pointBackgroundColor: CHART_COLORS.despesas,
          },
          {
            label: "Saldo",
            data: Sz,
            borderColor: CHART_COLORS.saldo,
            backgroundColor: CHART_COLORS.saldo + "22",
            borderWidth: 2,
            fill: false,
            tension: 0.3,
            pointRadius: 2,
            pointBackgroundColor: CHART_COLORS.saldo,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        parsing: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: {
            position: "bottom",
            labels: { color: CHART_COLORS.text, font: { size: 13 } },
          },
          tooltip: {
            backgroundColor: "#fff",
            borderColor: "#a5d6a7",
            borderWidth: 1,
            titleColor: CHART_COLORS.text,
            bodyColor: CHART_COLORS.text,
            callbacks: {
              label: (ctx) => {
                const v = Number(ctx.parsed?.y ?? 0);
                return `${ctx.dataset?.label || ""}: R$ ${v.toLocaleString(
                  "pt-BR",
                  { minimumFractionDigits: 2 }
                )}`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { color: CHART_COLORS.grid },
            ticks: { maxRotation: 0, autoSkip: true, color: CHART_COLORS.text },
          },
          y: yScale,
        },
      },
    });
  }

  function montarGraficoCategorias(categorias = [], valores = []) {
    const canvas = document.getElementById("graficoCategorias");
    const empty = document.getElementById("categoriasEmpty");
    if (!canvas || !window.Chart) return;

    const hasData = Array.isArray(categorias) && categorias.length > 0;
    if (!hasData) {
      if (empty) {
        empty.hidden = false;
        empty.textContent = "Sem categorias neste período.";
      }
      destroyChartByCanvas(canvas);
      canvas.style.display = "none";
      return;
    }
    if (empty) empty.hidden = true;
    canvas.style.display = "";

    const ctx = canvas.getContext("2d");
    const dataVals = (Array.isArray(valores) ? valores : []).map((v) =>
      toNumberBR(v)
    );

    return getOrCreateChart(ctx, "sj-categorias", {
      type: "doughnut",
      data: {
        labels: categorias,
        datasets: [
          {
            label: "Total",
            data: dataVals,
            backgroundColor: [
              "#66bb6a",
              "#81c784",
              "#a5d6a7",
              "#c8e6c9",
              "#ef9a9a",
              "#ffcdd2",
              "#fff59d",
              "#fff176",
              "#80cbc4",
              "#4db6ac",
            ],
            borderColor: "#ffffff",
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        parsing: false,
        cutout: "65%",
        plugins: {
          legend: { position: "bottom", labels: { color: CHART_COLORS.text } },
          tooltip: {
            backgroundColor: "#fff",
            borderColor: "#a5d6a7",
            borderWidth: 1,
            titleColor: CHART_COLORS.text,
            bodyColor: CHART_COLORS.text,
            callbacks: {
              label: (ctx) => {
                const v = Number(ctx.parsed ?? 0);
                const val = Number.isFinite(v) ? v : 0;
                return `${ctx.label}: R$ ${val.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                })}`;
              },
            },
          },
        },
      },
    });
  }

  // ==================== CATEGORIA: HYDRATE =====================
  document.addEventListener("DOMContentLoaded", () => {
    if (!FEATURES.HYDRATE_CATEGORY_SELECT) return;
    const sel = document.getElementById("filtroCategoria");
    if (!sel) return;
    if (sel.dataset.hydrated === "1") return;

    // Mantém opções existentes; só acrescenta categorias reais abaixo
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
        // separador
        const sep = document.createElement("option");
        sep.disabled = true;
        sep.textContent = "──────────";
        sel.appendChild(sep);
        // categorias reais
        for (const c of j.categorias) {
          const opt = document.createElement("option");
          opt.value = c;
          opt.textContent = c;
          sel.appendChild(opt);
        }
        sel.dataset.hydrated = "1";
      })
      .catch(() => {
        sel.dataset.hydrated = "1";
      });
  });

  // ========================= DASHBOARD =========================
  document.addEventListener("DOMContentLoaded", () => {
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

    async function recarregar() {
      const base =
        window.URL_DADOS_GRAFICO || "/financeiro/dados_grafico_filtrados/";
      const vIni = $ini?.value || iniDefault;
      const vFim = $fim?.value || fimDefault;

      const $cat = document.getElementById("filtroCategoria");
      const categoria = $cat && $cat.value ? $cat.value.trim() : "";
      const IA_LABELS_SET = new Set(["", "Geral", "Alerta", "Meta", "Dica"]);

      const qs = new URLSearchParams();
      qs.set("inicio", vIni);
      qs.set("fim", vFim);
      if (categoria && !IA_LABELS_SET.has(categoria))
        qs.set("categoria", categoria);

      const url = `${base}?${qs.toString()}`;
      const dados = await sjFetchJSON(url);
      if (!dados || !Array.isArray(dados.dias))
        throw new Error("Payload inválido (dias).");

      const aligned = _alignSeries(
        dados.dias,
        dados.receitas,
        dados.despesas,
        dados.saldo
      );
      const [rec, des, sal] = aligned.series;
      montarGraficoEvolucao(aligned.labels, rec, des, sal);

      if (Array.isArray(dados.categorias) && Array.isArray(dados.valores)) {
        montarGraficoCategorias(dados.categorias, dados.valores);
      } else {
        montarGraficoCategorias([], []);
      }
    }

    // Primeira carga
    recarregar().catch((e) => console.error("Erro ao carregar gráficos:", e));

    // Eventos de filtro
    const fireReload = debounce(() => {
      recarregar().catch((e) => console.error(e));
    }, 300);

    [$ini, $fim].forEach((el) => {
      if (!el) return;
      el.addEventListener("change", fireReload);
      el.addEventListener("input", fireReload);
    });

    const $cat = document.getElementById("filtroCategoria");
    if ($cat) {
      $cat.addEventListener("change", fireReload);
      $cat.addEventListener("input", fireReload);
    }

    const btn =
      document.getElementById("btnAplicarFiltros") ||
      document.getElementById("filtrar-btn");
    if (btn) {
      btn.addEventListener("click", (ev) => {
        ev.preventDefault();
        recarregar().catch((e) => console.error(e));
      });
    }

    // expor helpers p/ console
    window.__SJ_DASH_DEV__ = Object.assign(window.__SJ_DASH_DEV__ || {}, {
      evol: (dias, receitas, despesas, saldo = []) =>
        montarGraficoEvolucao(dias, receitas, despesas, saldo),
      cat: (categorias, valores) =>
        montarGraficoCategorias(categorias, valores),
      reload: () => recarregar(),
    });
  });

  // ====================== IA: Dica Simples =====================
  document.addEventListener("DOMContentLoaded", () => {
    if (!FEATURES.SIMPLE_TIP_BUTTON) return;
    const btn = document.getElementById("btnGerarDica");
    const st = document.getElementById("statusDica");
    if (!btn) return;

    function getCsrfToken() {
      const m = document.querySelector('meta[name="csrf-token"]');
      if (m?.content) return m.content;
      const match = document.cookie.match(/(^|;\s*)csrftoken=([^;]+)/);
      return match ? decodeURIComponent(match[2]) : "";
    }

    btn.addEventListener("click", async () => {
      btn.disabled = true;
      if (st) st.textContent = "Gerando dica...";
      try {
        const r = await fetch("/financeiro/api/insights/criar-simples/", {
          method: "POST",
          headers: {
            "X-Requested-With": "XMLHttpRequest",
            "X-CSRFToken": getCsrfToken(),
            Accept: "application/json",
          },
          credentials: "same-origin",
        });
        const j = await r.json();
        if (j.ok) {
          if (st) st.textContent = "✅ Nova dica gerada!";
          // tenta atualizar histórico via módulo novo; se não, tenta botão manual
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

  // ====================== IA: Dica 30 dias =====================
  document.addEventListener("DOMContentLoaded", () => {
    if (!FEATURES.TURBO_BUTTON) return;
    const btn = document.getElementById("btnGerarDica30d");
    const st = document.getElementById("stDica30d");
    if (!btn) return;

    function getCookie(name) {
      const match = document.cookie.match(
        new RegExp("(^|;\\s*)" + name + "=([^;]+)")
      );
      return match ? decodeURIComponent(match[2]) : "";
    }

    btn.addEventListener("click", async () => {
      try {
        btn.disabled = true;
        if (st) st.textContent = "Gerando dica...";
        const resp = await fetch("/financeiro/ia/dica30d/", {
          method: "POST",
          headers: { "X-CSRFToken": getCookie("csrftoken") },
          credentials: "same-origin",
        });
        const data = await resp.json();
        if (data.ok) {
          if (st)
            st.textContent = `✅ ${String(data.tipo || "").toUpperCase()}: ${
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
  });

  // =================== HISTÓRICO: Modal Reload ==================
  document.addEventListener("DOMContentLoaded", () => {
    const btnModalReload = document.getElementById("btnReloadDicasModal");
    if (!btnModalReload) return;
    btnModalReload.addEventListener("click", (ev) => {
      if (!ev.isTrusted) return;
      try {
        if (
          window.__HistoricoIA &&
          typeof window.__HistoricoIA.recarregar === "function"
        ) {
          window.__HistoricoIA.recarregar();
        }
      } catch (err) {
        console.error("Erro ao recarregar histórico via modal:", err);
      }
    });
  });

  // =================== LEGACY Histórico (lista) =================
  document.addEventListener("DOMContentLoaded", () => {
    if (!FEATURES.LEGACY_HISTORICO_LIST) return;
    if (window.__HistoricoIA) return; // módulo novo existe; não usar legacy
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

    // botao "ver mais" (usa se existir, senão ignora)
    let btn = document.getElementById("btnVerMaisHistorico");

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
    function esc(s) {
      return String(s ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }
    function renderItems(items, append = true) {
      const arr = Array.isArray(items) ? items : [];
      const html = arr
        .map((i) => {
          const quando =
            i.created_at_br || i.created_at || i.criado_em || i.data || "";
          const cat = i.categoria || i.tipo || "Geral";
          const titulo = i.title || "Dica da IA";
          const texto = (i.texto || i.text || i.dica || "").toString();
          return `<div class="card border-success mb-3 shadow-sm">
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
      const prevLabel = btn ? btn.textContent : "";
      if (btn) {
        btn.disabled = true;
        btn.textContent = append ? "Carregando…" : "Atualizando…";
      }
      try {
        const url = `/financeiro/ia/historico/feed/v2/?${buildParams(
          nextPage
        )}`;
        const r = await fetch(url, {
          headers: { Accept: "application/json" },
          credentials: "same-origin",
        });
        const j = await r.json();
        const items = normItems(j);
        renderItems(items, append);
        page = j.page || nextPage;
        const hasNext = Boolean(j.has_next);
        if (btn) {
          if (!hasNext || !items.length) {
            btn.textContent = "Fim";
            btn.disabled = true;
          } else {
            btn.textContent = prevLabel || "Ver mais";
            btn.disabled = false;
          }
        }
      } catch (e) {
        console.error("Erro ao carregar histórico (LEGACY):", e);
        if (btn) {
          btn.textContent = "Tentar novamente";
          btn.disabled = false;
        }
      } finally {
        loading = false;
      }
    }

    // eventos
    if (btn) {
      btn.onclick = () => loadPage(page + 1, true);
    }
    const onFiltersChange = () => {
      page = 1;
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Ver mais";
      }
      loadPage(1, false);
    };
    if (elIni) elIni.addEventListener("change", onFiltersChange);
    if (elFim) elFim.addEventListener("change", onFiltersChange);
    if (elCat) elCat.addEventListener("change", onFiltersChange);

    // carga inicial
    loadPage(1, false).catch((e) => console.error(e));
  });

  // =================== SALVAR/RESTAURAR SCROLL =================
  document.addEventListener("DOMContentLoaded", () => {
    if (!FEATURES.SAVE_SCROLL_STATE) return;
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
    const _deb = (fn, ms = 150) => {
      let t;
      return () => {
        clearTimeout(t);
        t = setTimeout(fn, ms);
      };
    };
    const onScroll = _deb(save, 150);
    if (wrap) wrap.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("beforeunload", save);
    setTimeout(restore, 120);
  });
})();
