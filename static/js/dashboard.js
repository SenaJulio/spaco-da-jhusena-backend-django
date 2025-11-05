/* eslint-disable no-unused-vars */
/* ==========================================================================
 * Spaço da Jhuséna — dashboard.js (versão estável, ES5)
 * Data: 2025-11-05
 * ==========================================================================*/
/* global Chart */

(function () {
  ("use strict");

  // ================== REGISTRO Chart.js v4 (global) ==================
  // ================== REGISTRO Chart.js v4 (global) ==================
  if (window.Chart && Chart.register) {
    try {
      var LineController = Chart.LineController;
      var DoughnutController = Chart.DoughnutController;

      var LineElement = Chart.LineElement;
      var PointElement = Chart.PointElement;
      var ArcElement = Chart.ArcElement;

      var CategoryScale = Chart.CategoryScale;
      var LinearScale = Chart.LinearScale;

      var Title = Chart.Title;
      var Tooltip = Chart.Tooltip;
      var Legend = Chart.Legend;
      var Filler = Chart.Filler;

      Chart.register(
        // controllers
        LineController,
        DoughnutController,
        // elements
        LineElement,
        PointElement,
        ArcElement,
        // scales
        CategoryScale,
        LinearScale,
        // plugins
        Title,
        Tooltip,
        Legend,
        Filler
      );
    } catch (_eReg) {
      console.warn("Falha ao registrar elementos Chart.js:", _eReg);
    }
  }

  // ======================= FEATURE FLAGS =======================
  var FEATURES = {
    HYDRATE_CATEGORY_SELECT: true,
  };

  // ======================= TEMA / CORES ========================
  function cssVar(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name);
    v = v ? v.trim() : "";
    return v || fallback;
  }

  var COLORS = {
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
      Chart.defaults.font.family =
        "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
      Chart.defaults.color = COLORS.text;
      Chart.defaults.plugins.legend.labels.boxWidth = 14;
      Chart.defaults.plugins.legend.labels.boxHeight = 14;
    } catch (_e) {
      /* noop */
    }
  }
  if (window.Chart) applyChartDefaults();
  document.addEventListener("DOMContentLoaded", applyChartDefaults);

  // ========================== HELPERS ==========================
  function pad2(n) {
    return String(n).padStart(2, "0");
  }
  function fmtYMD(d) {
    return (
      d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate())
    );
  }
  function firstDayOfMonth(d) {
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-01";
  }

  function toNumberBR(x) {
    if (x == null) return 0;
    if (typeof x === "number" && isFinite(x)) return x;
    var s = String(x)
      .replace(/\s+/g, "")
      .replace(/\.(?=\d{3}(?:\D|$))/g, "")
      .replace(",", ".")
      .replace(/[^\d.+-Ee]/g, "");
    var n = Number(s);
    return isFinite(n) ? n : 0;
  }

  function debounce(fn, ms) {
    if (ms == null) ms = 300;
    var t;
    return function () {
      var args = arguments;
      clearTimeout(t);
      t = setTimeout(function () {
        fn.apply(null, args);
      }, ms);
    };
  }

  // ====================== FETCH COM ABORT ======================
  var __lastCtrl = null;
  function sjFetchJSON(url) {
    return new Promise(function (resolve, reject) {
      if (__lastCtrl) {
        try {
          __lastCtrl.abort();
        } catch (_e) {
          /* noop */
        }
      }
      __lastCtrl = new AbortController();
      var signal = __lastCtrl.signal;

      fetch(url, {
        headers: {
          "X-Requested-With": "XMLHttpRequest",
          Accept: "application/json",
        },
        credentials: "same-origin",
        signal: signal,
      })
        .then(function (r) {
          if (!r.ok)
            return r.text().then(function (txt) {
              throw new Error(
                "HTTP " +
                  r.status +
                  " @ " +
                  url +
                  ": " +
                  (txt || "").slice(0, 300)
              );
            });
          return r.json();
        })
        .then(resolve)
        .catch(function (e) {
          if (e && e.name === "AbortError") {
            var err = new Error("ABORTED");
            err.__aborted = true;
            reject(err);
            return;
          }
          reject(e);
        });
    });
  }

  // ========================== CHARTS ===========================
  function destroyChartByCanvas(canvas) {
    try {
      if (Chart.getChart) {
        var inst = Chart.getChart(canvas);
        if (inst) inst.destroy();
      }
    } catch (_e) {
      /* noop */
    }
  }

  // --------- Evolução diária (linhas)
  function montarGraficoEvolucao(dias, receitas, despesas, saldo) {
    var canvas = document.getElementById("graficoEvolucao");
    var empty = document.getElementById("evolucaoEmpty");
    if (!canvas || !window.Chart) return;

    // 1) valida labels
    var hasLabels = Array.isArray(dias) && dias.length > 0;
    if (!hasLabels) {
      if (empty) {
        empty.hidden = false;
        empty.textContent = "Sem dados para o período escolhido.";
      }
      try {
        destroyChartByCanvas(canvas);
      } catch (_e0) {
        /* */
      }
      canvas.style.display = "none";
      return;
    }
    if (empty) empty.hidden = true;
    canvas.style.display = "";

    // 2) normaliza números e alinha com os dias
    function toNum(v) {
      if (typeof v === "number") return v;
      var s = String(v == null ? "" : v)
        .replace(/\./g, "")
        .replace(",", ".");
      var n = Number(s);
      return isFinite(n) ? n : 0;
    }

    var L = dias.length;
    var R = new Array(L);
    var D = new Array(L);
    var S;
    var i;

    for (i = 0; i < L; i++) {
      R[i] = toNum((receitas || [])[i]);
    }
    for (i = 0; i < L; i++) {
      D[i] = toNum((despesas || [])[i]);
    }

    if (Array.isArray(saldo) && saldo.length === L) {
      S = new Array(L);
      for (i = 0; i < L; i++) {
        S[i] = toNum(saldo[i]);
      }
    } else {
      var acc = 0;
      S = new Array(L);
      for (i = 0; i < L; i++) {
        acc += (R[i] || 0) - (D[i] || 0);
        S[i] = acc;
      }
    }

    // 3) tudo zero?
    function sumAbs(arr) {
      var t = 0,
        j;
      for (j = 0; j < arr.length; j++) t += Math.abs(arr[j] || 0);
      return t;
    }
    if (sumAbs(R) + sumAbs(D) + sumAbs(S) <= 0.0001) {
      if (empty) {
        empty.hidden = false;
        empty.textContent = "Sem dados para o período escolhido.";
      }
      try {
        destroyChartByCanvas(canvas);
      } catch (_e1) {
        /* */
      }
      return;
    }

    // 4) destrói anterior e cria novo
    var ctx = canvas.getContext("2d");
    try {
      destroyChartByCanvas(canvas);
    } catch (_e2) {
      /* */
    }

    new Chart(ctx, {
      type: "line",
      data: {
        labels: dias,
        datasets: [
          {
            label: "Receitas",
            data: R,
            borderColor: "#2e7d32",
            backgroundColor: "#2e7d3233",
            borderWidth: 2,
            fill: true,
            tension: 0.35,
            pointRadius: 2,
            pointBackgroundColor: "#2e7d32",
          },
          {
            label: "Despesas",
            data: D,
            borderColor: "#d32f2f",
            backgroundColor: "#d32f2f22",
            borderWidth: 2,
            fill: true,
            tension: 0.35,
            pointRadius: 2,
            pointBackgroundColor: "#d32f2f",
          },
          {
            label: "Saldo",
            data: S,
            borderColor: "#f9a825",
            backgroundColor: "#f9a82522",
            borderWidth: 2,
            fill: false,
            tension: 0.3,
            pointRadius: 2,
            pointBackgroundColor: "#f9a825",
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
            labels: { color: "#1b5e20", font: { size: 13 } },
          },
          tooltip: {
            backgroundColor: "#fff",
            borderColor: "#a5d6a7",
            borderWidth: 1,
            titleColor: "#1b5e20",
            bodyColor: "#1b5e20",
            callbacks: {
              label: function (ctx) {
                var v = Number((ctx.parsed && ctx.parsed.y) || 0);
                return (
                  (ctx.dataset && ctx.dataset.label ? ctx.dataset.label : "") +
                  ": R$ " +
                  v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })
                );
              },
            },
          },
        },
        scales: {
          x: {
            grid: { color: "rgba(0,0,0,0.08)" },
            ticks: { maxRotation: 0, autoSkip: true, color: "#1b5e20" },
          },
          y: {
            beginAtZero: true,
            grid: { color: "rgba(0,0,0,0.08)" },
            ticks: {
              color: "#1b5e20",
              callback: function (v) {
                return Number(v).toLocaleString("pt-BR");
              },
            },
          },
        },
      },
    });
  }

  // --------- Categorias (pizza)
  function montarGraficoCategorias(categorias, valores) {
    var canvas = document.getElementById("graficoCategorias");
    var empty = document.getElementById("categoriasEmpty");
    if (!canvas || !window.Chart) return;

    var hasData = Array.isArray(categorias) && categorias.length > 0;
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

    var ctx = canvas.getContext("2d");
    destroyChartByCanvas(canvas);

    var dataVals = Array.isArray(valores) ? valores.map(toNumberBR) : [];

    new Chart(ctx, {
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
        plugins: { legend: { position: "bottom" } },
      },
    });
  }

  // ========================= RECARREGAR ========================
  // --- recarregar (versão mínima e estável) ---
  // --- recarregar (linhas + pizza) ---
  async function recarregar() {
    const cv = document.getElementById("graficoEvolucao");
    const cvCat = document.getElementById("graficoCategorias");
    const elCatEmpty = document.getElementById("categoriasEmpty");

    if (!cv || !window.Chart) {
      console.warn("sem canvas ou Chart");
      return;
    }

    // destrói gráficos anteriores
    try {
      Chart.getChart(cv)?.destroy();
    } catch {/* */}
    if (cvCat) {
      try {
        Chart.getChart(cvCat)?.destroy();
      } catch {/* */}
    }

    // datas (fallback mês atual)
    const pad2 = (n) => String(n).padStart(2, "0");
    const hoje = new Date();
    const ini =
      document.getElementById("filtroInicio")?.value ||
      `${hoje.getFullYear()}-${pad2(hoje.getMonth() + 1)}-01`;
    const fim =
      document.getElementById("filtroFim")?.value ||
      `${hoje.getFullYear()}-${pad2(hoje.getMonth() + 1)}-${pad2(hoje.getDate())}`;

    // endpoint
    const base =
      window.URL_DADOS_GRAFICO || "/financeiro/dados_grafico_filtrados/";
    const url = `${base}?inicio=${encodeURIComponent(ini)}&fim=${encodeURIComponent(fim)}`;
    console.log("[recarregar] GET", url);

    // fetch
    const r = await fetch(url, {
      headers: { Accept: "application/json" },
      credentials: "same-origin",
    });
    if (!r.ok) {
      console.error("HTTP", r.status, "ao buscar dados");
      return;
    }
    const j = await r.json();
    console.log("[recarregar] payload", j);

    // ----- gráfico de linhas (evolução) -----
    const dias = Array.isArray(j.dias) ? j.dias : [];
    const toNum = (v) =>
      typeof v === "number"
        ? v
        : Number(String(v).replace(/\./g, "").replace(",", ".")) || 0;
    const R = dias.map((_, i) => toNum(j.receitas?.[i]));
    const D = dias.map((_, i) => toNum(j.despesas?.[i]));
    let S =
      Array.isArray(j.saldo) && j.saldo.length === dias.length
        ? j.saldo.map(toNum)
        : (() => {
            let acc = 0;
            return dias.map((_, i) => (acc += (R[i] || 0) - (D[i] || 0)));
          })();

    new Chart(cv.getContext("2d"), {
      type: "line",
      data: {
        labels: dias,
        datasets: [
          {
            label: "Receitas",
            data: R,
            borderColor: "#2e7d32",
            backgroundColor: "#2e7d3233",
            borderWidth: 2,
            tension: 0.35,
            pointRadius: 2,
            fill: true,
          },
          {
            label: "Despesas",
            data: D,
            borderColor: "#d32f2f",
            backgroundColor: "#d32f2f22",
            borderWidth: 2,
            tension: 0.35,
            pointRadius: 2,
            fill: true,
          },
          {
            label: "Saldo",
            data: S,
            borderColor: "#f9a825",
            backgroundColor: "#f9a82522",
            borderWidth: 2,
            tension: 0.3,
            pointRadius: 2,
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: {
            position: "bottom",
            labels: { color: "#1b5e20", font: { size: 13 } },
          },
          tooltip: {
            backgroundColor: "#fff",
            borderColor: "#a5d6a7",
            borderWidth: 1,
            titleColor: "#1b5e20",
            bodyColor: "#1b5e20",
            callbacks: {
              label: (ctx) => {
                const v = Number(ctx.parsed?.y ?? 0);
                return `${ctx.dataset?.label || ""}: R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { color: "rgba(0,0,0,0.08)" },
            ticks: { color: "#1b5e20", maxRotation: 0, autoSkip: true },
          },
          y: {
            beginAtZero: true,
            grid: { color: "rgba(0,0,0,0.08)" },
            ticks: { color: "#1b5e20" },
          },
        },
      },
    });

    // ----- gráfico de pizza (categorias) -----
    if (cvCat) {
      const hasCats =
        Array.isArray(j.categorias) &&
        Array.isArray(j.valores) &&
        j.categorias.length > 0;
      if (hasCats) {
        cvCat.style.display = "";
        if (elCatEmpty) elCatEmpty.hidden = true;

        const vals = j.valores.map(toNum);
        new Chart(cvCat.getContext("2d"), {
          type: "doughnut",
          data: {
            labels: j.categorias,
            datasets: [
              {
                label: "Total",
                data: vals,
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
              legend: { position: "bottom", labels: { color: "#1b5e20" } },
            },
          },
        });
      } else {
        // sem categorias: mostra aviso e esconde canvas
        if (elCatEmpty) {
          elCatEmpty.hidden = false;
          elCatEmpty.textContent = "Sem categorias neste período.";
        }
        cvCat.style.display = "none";
        try {
          Chart.getChart(cvCat)?.destroy();
        } catch {/* */}
      }
    }

    // log
    const ch = Chart.getChart(cv);
    console.log(
      "✅ linhas ok | pontos:",
      R.length,
      D.length,
      S.length,
      "| y-range:",
      ch.scales.y.min,
      ch.scales.y.max
    );
  }

  // expõe para o console (mantém seu atalho)
  window.__SJ_DASH_DEV__ = Object.assign(window.__SJ_DASH_DEV__ || {}, {
    reload: recarregar,
  });

  // ============================ BOOT ===========================
  document.addEventListener("DOMContentLoaded", function () {
    // datas padrão
    var elIni =
      document.querySelector("#filtroInicio") ||
      document.querySelector("#data_inicio");
    var elFim =
      document.querySelector("#filtroFim") ||
      document.querySelector("#data_fim");
    var hoje = new Date();
    if (elIni && !elIni.value) elIni.value = firstDayOfMonth(hoje);
    if (elFim && !elFim.value) elFim.value = fmtYMD(hoje);

    // hidratar categorias (se houver select)
    if (FEATURES.HYDRATE_CATEGORY_SELECT) {
      var sel = document.getElementById("filtroCategoria");
      if (sel && sel.dataset.hydrated !== "1") {
        var url = window.URL_CATEGORIAS || "/financeiro/dashboard/categorias/";
        fetch(url, {
          headers: {
            "X-Requested-With": "XMLHttpRequest",
            Accept: "application/json",
          },
          credentials: "same-origin",
        })
          .then(function (r) {
            return r.json();
          })
          .then(function (j) {
            if (
              !j ||
              !j.ok ||
              !Array.isArray(j.categorias) ||
              !j.categorias.length
            ) {
              sel.dataset.hydrated = "1";
              return;
            }
            var sep = document.createElement("option");
            sep.disabled = true;
            sep.textContent = "──────────";
            sel.appendChild(sep);
            for (var k = 0; k < j.categorias.length; k++) {
              var c = j.categorias[k];
              var opt = document.createElement("option");
              opt.value = c;
              opt.textContent = c;
              sel.appendChild(opt);
            }
            sel.dataset.hydrated = "1";
          })
          .catch(function () {
            sel.dataset.hydrated = "1";
          });
      }
    }

    // eventos de filtro
    var fireReload = debounce(function () {
      recarregar();
    }, 250);
    if (elIni) {
      elIni.addEventListener("change", fireReload);
      elIni.addEventListener("input", fireReload);
    }
    if (elFim) {
      elFim.addEventListener("change", fireReload);
      elFim.addEventListener("input", fireReload);
    }

    var elCat = document.getElementById("filtroCategoria");
    if (elCat) {
      elCat.addEventListener("change", fireReload);
      elCat.addEventListener("input", fireReload);
    }

    // botão aplicar
    var btn =
      document.getElementById("btnAplicarFiltros") ||
      document.getElementById("filtrar-btn");
    if (btn && btn.parentNode) {
      var fresh = btn.cloneNode(true);
      btn.parentNode.replaceChild(fresh, btn);
      fresh.addEventListener("click", function (ev) {
        ev.preventDefault();
        fresh.disabled = true;
        var label = fresh.textContent;
        fresh.textContent = "Atualizando…";
        Promise.resolve()
          .then(function () {
            recarregar();
          })
          .finally(function () {
            fresh.textContent = label;
            fresh.disabled = false;
          });
      });
    }

    // primeira carga
    recarregar();
  });

  // util p/ console
  window.__SJ_DASH_DEV__ = {
    reload: recarregar,
    evol: montarGraficoEvolucao,
    cat: montarGraficoCategorias,
  };
})();
