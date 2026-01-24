/* eslint-disable no-undef */
console.log("DASHBOARD.JS CARREGADO ✅ - TESTE 2026-01-04");


/* eslint-disable no-unused-vars */
/* ==========================================================================
 * Spaço da Jhuséna — dashboard.js (versão estável, ES5)
 * ==========================================================================*/
/* global Chart */
let sjChartRankingIa = null;
let sjChartSerieIa = null;

// === Plugins visuais do donut "Por categoria" ===

// sombra interna leve no centro
const sjDonutInnerShadow = {
  id: "sjDonutInnerShadow",
  afterDatasetsDraw(chart, args, opts) {
    const meta = chart.getDatasetMeta(0);
    if (!meta || !meta.data || !meta.data.length) return;

    const { ctx } = chart;
    const arc = meta.data[0];
    const { x, y, innerRadius } = arc;

    ctx.save();
    const grad = ctx.createRadialGradient(
      x,
      y,
      innerRadius * 0.4,
      x,
      y,
      innerRadius * 1.1
    );
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,0.5)");

    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, innerRadius * 1.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },
};

// brilho suave no centro do donut
const sjDonutHighlight = {
  id: "sjDonutHighlight",
  afterDatasetsDraw(chart, args, opts) {
    const meta = chart.getDatasetMeta(0);
    if (!meta || !meta.data || !meta.data.length) return;

    const { ctx } = chart;
    const arc = meta.data[0];
    const { x, y, innerRadius } = arc;

    ctx.save();
    const grad = ctx.createRadialGradient(x, y, 0, x, y, innerRadius * 0.9);
    grad.addColorStop(0, "rgba(255,255,255,0.22)");
    grad.addColorStop(0.6, "rgba(255,255,255,0.05)");
    grad.addColorStop(1, "rgba(255,255,255,0)");

    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, innerRadius * 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },
};

// gradiente suave em cada fatia
const sjDonutGradient = {
  id: "sjDonutGradient",
  beforeDatasetsDraw(chart, args, opts) {
    const { ctx, chartArea } = chart;
    if (!chartArea) return;

    const dataset = chart.data.datasets[0];
    const baseColors = [
      { from: "#66bb6a", to: "rgba(102,187,106,0.65)" },
      { from: "#81c784", to: "rgba(129,199,132,0.65)" },
      { from: "#a5d6a7", to: "rgba(165,214,167,0.65)" },
      { from: "#c8e6c9", to: "rgba(200,230,201,0.65)" },
    ];

    dataset.backgroundColor = dataset.data.map((_, i) => {
      const b = baseColors[i % baseColors.length];
      const g = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
      g.addColorStop(0, b.from);
      g.addColorStop(1, b.to);
      return g;
    });
  },
};

// labels internas exibindo percentual
const sjDonutLabels = {
  id: "sjDonutLabels",
  afterDatasetsDraw(chart, args, opts) {
    const meta = chart.getDatasetMeta(0);
    const data = chart.data.datasets[0].data;
    const labels = chart.data.labels;
    const total = data.reduce((s, v) => s + Number(v), 0);

    const { ctx } = chart;
    ctx.save();
    ctx.fillStyle = "#e8f5e9";
    ctx.font = "11px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    meta.data.forEach((arc, idx) => {
      const raw = Number(data[idx]);
      if (raw <= 0) return;

      const percentage = ((raw / total) * 100).toFixed(0) + "%";

      const angle = (arc.startAngle + arc.endAngle) / 2;
      const radius = (arc.innerRadius + arc.outerRadius) / 2;

      const x = arc.x + Math.cos(angle) * radius;
      const y = arc.y + Math.sin(angle) * radius;

      ctx.fillText(percentage, x, y);
    });

    ctx.restore();
  },
};

// === Plugins visuais para o gráfico de evolução diária ===
const glowPlugin = {
  id: "sjGlow",
  beforeDatasetsDraw(chart, args, opts) {
    const { ctx } = chart;
    const glowDatasets = chart.data.datasets || [];

    glowDatasets.forEach((dataset, datasetIndex) => {
      if (!dataset._glow) return;

      const meta = chart.getDatasetMeta(datasetIndex);
      if (!meta || !meta.data || !meta.data.length) return;

      ctx.save();
      ctx.shadowColor = dataset._glow.color || "rgba(102,187,106,0.7)";
      ctx.shadowBlur = dataset._glow.blur || 18;
      ctx.lineWidth = (dataset.borderWidth || 2) + 1;
      ctx.strokeStyle = dataset.borderColor;

      ctx.beginPath();
      meta.data.forEach((pt, i) => {
        if (!pt || typeof pt.x !== "number" || typeof pt.y !== "number") return;
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.stroke();
      ctx.restore();
    });
  },
};

const gradientFillPlugin = {
  id: "sjGradientFill",
  beforeDatasetsDraw(chart, args, opts) {
    const { ctx, chartArea } = chart;
    if (!chartArea) return;

    const { top, bottom } = chartArea;

    chart.data.datasets.forEach((dataset) => {
      if (!dataset._gradient) return;

      const gradient = ctx.createLinearGradient(0, top, 0, bottom);
      const stops = dataset._gradient.stops || [
        { offset: 0, color: "rgba(102,187,106,0.5)" },
        { offset: 1, color: "rgba(102,187,106,0.02)" },
      ];

      stops.forEach((s) => gradient.addColorStop(s.offset, s.color));
      dataset.backgroundColor = gradient;
    });
  },
};

(function () {
  "use strict";

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
        LineController,
        DoughnutController,
        LineElement,
        PointElement,
        ArcElement,
        CategoryScale,
        LinearScale,
        Title,
        Tooltip,
        Legend,
        Filler
      );
    } catch (_eReg) {
      /* registro Chart.js falhou; segue com defaults */
    }
  }

  // ======================= FEATURE FLAGS =======================
  var FEATURES = { HYDRATE_CATEGORY_SELECT: true };

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
  window.montarGraficoEvolucao = function montarGraficoEvolucao(
    dias,
    receitas,
    despesas,
    saldo
  ) {
    const canvas = document.getElementById("graficoEvolucao");
    const empty = document.getElementById("evolucaoEmpty");
    if (!canvas || !window.Chart) return;

    const hasLabels = Array.isArray(dias) && dias.length > 0;
    if (!hasLabels) {
      if (empty) {
        empty.hidden = false;
        empty.textContent = "Sem dados para o período escolhido.";
      }
      try {
        const old = Chart.getChart(canvas);
        old && old.destroy();
      } catch (_e) { }
      return;
    }
    if (empty) empty.hidden = true;

    const toNum = (v) => {
      if (typeof v === "number") return v;
      const n = Number(
        String(v == null ? "" : v)
          .replace(/\./g, "")
          .replace(",", ".")
      );
      return Number.isFinite(n) ? n : 0;
    };

    const R = (receitas || []).map(toNum);
    const D = (despesas || []).map(toNum);
    const L = dias.length;

    // ✅ Saldo acumulado (default)
    let S = [];
    let acc = 0;
    for (let i = 0; i < L; i++) {
      acc += (R[i] || 0) - (D[i] || 0);
      S.push(acc);
    }

    // ✅ Se backend já mandou saldo por dia, usa ele
    if (Array.isArray(saldo) && saldo.length === L) {
      S = saldo.map(toNum);
    }

    // ✅ Média móvel 7 dias da Receita
    const R_media7 = R.map((_, idx) => {
      if (idx < 6) return null;
      let soma = 0;
      for (let j = idx - 6; j <= idx; j++) soma += Number(R[j]) || 0;
      return +(soma / 7).toFixed(2);
    });

    // destrói gráfico anterior
    try {
      const old = Chart.getChart(canvas);
      old && old.destroy();
    } catch (_e) { }

    // ✅ plugins só se existirem (evita crash silencioso)
    const extraPlugins = [];
    if (typeof glowPlugin !== "undefined") extraPlugins.push(glowPlugin);
    if (typeof gradientFillPlugin !== "undefined") extraPlugins.push(gradientFillPlugin);

    new Chart(canvas, {
      type: "line",
      data: {
        labels: dias,
        datasets: [
          {
            label: "Receitas",
            data: R,
            borderColor: "#66bb6a",
            backgroundColor: "rgba(102,187,106,0.18)",
            borderWidth: 2,
            tension: 0.35,
            pointRadius: 0,
            pointHoverRadius: 4,
            fill: true,
            spanGaps: true,
          },
          {
            label: "Despesas",
            data: D,
            borderColor: "#ef5350",
            backgroundColor: "rgba(239,83,80,0.15)",
            borderWidth: 2,
            tension: 0.35,
            pointRadius: 0,
            pointHoverRadius: 4,
            fill: true,
            spanGaps: true,
          },
          {
            label: "Saldo",
            data: S,
            borderColor: "#ffca28",
            backgroundColor: "rgba(255,202,40,0.08)",
            borderWidth: 3,
            tension: 0.35,
            pointRadius: 0,
            pointHoverRadius: 4,
            fill: false,
            spanGaps: true,
          },
          {
            label: "Média móvel (7d)",
            data: R_media7,
            borderColor: "#80deea",
            backgroundColor: "rgba(128,222,234,0.05)",
            borderWidth: 2,
            borderDash: [6, 6],
            tension: 0.35,
            pointRadius: 0,
            pointHoverRadius: 0,
            fill: false,
            spanGaps: true,
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
            labels: { color: "#c8e6c9", font: { size: 13 } },
          },
          tooltip: {
            backgroundColor: "#fff",
            borderColor: "#a5d6a7",
            borderWidth: 1,
            titleColor: "#1b5e20",
            bodyColor: "#1b5e20",
            callbacks: {
              title(items) {
                return items?.[0]?.label || "";
              },
              label(ctx) {
                const label = ctx.dataset.label || "";
                const v = ctx.parsed.y;
                if (v == null) return null;

                const valor = Number(v).toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                });
                return `${label}: R$ ${valor}`;
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
            ticks: {
              color: "#1b5e20",
              callback: (v) => Number(v).toLocaleString("pt-BR"),
            },
          },
        },
        animation: {
          duration: 900,
          easing: "easeOutQuart",
        },
      },
      plugins: extraPlugins,
    });
  };


  // --------- Categorias (pizza)
  function toNumberBR(v) {
    if (typeof v === "number") return v;
    const n = Number(String(v ?? "").replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }

  function destroyChartByCanvas(canvas) {
    try {
      const old = Chart.getChart(canvas);
      old && old.destroy();
    } catch (_e) { }
  }

  function montarGraficoCategorias(categorias, valores) {
    const canvas = document.getElementById("graficoCategorias");
    const empty = document.getElementById("categoriasEmpty");

    if (!canvas) return console.log("❌ canvas #graficoCategorias não existe");
    if (typeof Chart === "undefined") return console.log("❌ Chart.js não carregou ainda");

    // 🔒 Normaliza e filtra > 0
    const pares = [];
    if (Array.isArray(categorias) && Array.isArray(valores)) {
      for (let i = 0; i < categorias.length; i++) {
        const v = Math.abs(toNumberBR(valores[i] || 0));
        if (v > 0) pares.push([categorias[i], v]);
      }
    }

    const cats = pares.map((p) => p[0]);
    const vals = pares.map((p) => p[1]);

    // ✅ Sem dados → mostra mensagem e destrói chart antigo
    if (!cats.length) {
      if (empty) {
        empty.hidden = false;
        empty.textContent = "Sem categorias neste período.";
      }
      destroyChartByCanvas(canvas);

      // garante que não ficou escondido por CSS antigo
      canvas.style.display = "block";
      canvas.style.height = "260px";
      canvas.style.width = "100%";
      return;
    }

    // ✅ Tem dados → mostra canvas
    if (empty) empty.hidden = true;
    canvas.style.display = "block";
    canvas.style.height = "260px";
    canvas.style.width = "100%";

    destroyChartByCanvas(canvas);

    const ctx = canvas.getContext("2d");

    // ✅ plugins só se existirem (evita quebrar render)
    const donutPlugins = [];
    if (typeof sjDonutInnerShadow !== "undefined") donutPlugins.push(sjDonutInnerShadow);
    if (typeof sjDonutGradient !== "undefined") donutPlugins.push(sjDonutGradient);
    if (typeof sjDonutLabels !== "undefined") donutPlugins.push(sjDonutLabels);
    if (typeof sjDonutHighlight !== "undefined") donutPlugins.push(sjDonutHighlight);

    new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: cats,
        datasets: [
          {
            label: "Total",
            data: vals,
            backgroundColor: [
              "#66bb6a", "#81c784", "#a5d6a7", "#c8e6c9",
              "#ef9a9a", "#ffcdd2", "#fff59d", "#fff176",
              "#80cbc4", "#4db6ac",
            ],
            borderColor: "#020b06",
            borderWidth: 3,
            hoverOffset: 12,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "65%",
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              color: "#c8e6c9",
              usePointStyle: true,
              padding: 18,
              font: { size: 12 },
            },
          },
          tooltip: {
            backgroundColor: "rgba(0,0,0,0.9)",
            borderColor: "#66bb6a",
            borderWidth: 1,
            titleColor: "#e8f5e9",
            bodyColor: "#e8f5e9",
            padding: 10,
            callbacks: {
              label(ctx2) {
                const label = ctx2.label || "";
                const v = Number(ctx2.parsed) || 0;

                const total = (ctx2.chart.data.datasets[0].data || []).reduce(
                  (a, b) => a + Number(b || 0),
                  0
                );

                const perc = total ? ((v / total) * 100).toFixed(1) : "0.0";
                const valor = v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

                return `${label}: R$ ${valor} (${perc}%)`;
              },
            },
          },
        },
        animation: {
          animateRotate: true,
          animateScale: true,
          duration: 900,
          easing: "easeOutQuart",
        },
      },
      plugins: donutPlugins,
    });
  }


  function sjCarregarPainelIaMensal() {
    var elCanvas = document.getElementById("graficoRankingServicosIa");
    var elMesLabel = document.getElementById("painelIaMesLabel");
    var elListaInsights = document.getElementById("listaInsightsIaMensal");

    if (!elCanvas || !elListaInsights) {
      return;
    }

    elListaInsights.innerHTML =
      '<li class="list-group-item text-muted">Carregando análise da IA...</li>';

    fetch("/financeiro/ranking/servicos_mensal/", {
      headers: {
        "X-Requested-With": "XMLHttpRequest",
        Accept: "application/json",
      },
      credentials: "same-origin",
    })
      .then(function (resp) {
        if (!resp.ok) {
          throw new Error("HTTP " + resp.status);
        }
        return resp.json();
      })
      .then(function (data) {
        if (!data || data.ok !== true) {
          throw new Error("Resposta inválida do backend IA.");
        }

        // Label do mês
        if (elMesLabel && data.mes_label) {
          elMesLabel.textContent = data.mes_label;
        }

        var servicos = data.servicos || [];

        if (!servicos.length) {
          // limpa gráfico
          var ctxClear = elCanvas.getContext("2d");
          ctxClear.clearRect(0, 0, elCanvas.width, elCanvas.height);

          elListaInsights.innerHTML =
            '<li class="list-group-item">Nenhum serviço com receita neste mês. 👀</li>' +
            '<li class="list-group-item small text-muted">Dica: registre vendas e serviços para a IA conseguir analisar seus resultados.</li>';
          return;
        }

        // Ordena desc só por garantia
        servicos.sort(function (a, b) {
          return (b.total || 0) - (a.total || 0);
        });

        // Ajusta nomes e valores
        var labels = servicos.map(function (s) {
          return s.nome || s.label || "Serviço";
        });
        var valores = servicos.map(function (s) {
          return s.total || 0;
        });

        // Destroi gráfico anterior pra evitar erro “Chart already exists”
        if (sjChartRankingIa) {
          sjChartRankingIa.destroy();
        }

        var ctx = elCanvas.getContext("2d");
        sjChartRankingIa = new Chart(ctx, {
          type: "bar",
          data: {
            labels: labels,
            datasets: [
              {
                label: "Receita por serviço (R$)",
                data: valores,
              },
            ],
          },
          options: {
            indexAxis: "y", // barras horizontais estilo ranking
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: function (context) {
                    var valor = context.parsed.x || 0;
                    return (
                      " R$ " +
                      valor.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })
                    );
                  },
                },
              },
            },
            scales: {
              x: {
                ticks: {
                  callback: function (value) {
                    return "R$ " + value.toLocaleString("pt-BR");
                  },
                },
              },
            },
          },
        });

        // ======================
        // Insights estilo Nubank
        // ======================
        var top1 = servicos[0];
        var top2 = servicos[1];
        var totalGeral = valores.reduce(function (acc, v) {
          return acc + v;
        }, 0);

        var html = "";

        if (top1) {
          var perc1 = totalGeral ? (top1.total / totalGeral) * 100 : 0;
          html +=
            '<li class="list-group-item">' +
            "💚 Serviço destaque: <strong>" +
            (top1.nome || "Serviço") +
            "</strong> gerou " +
            "R$ " +
            (top1.total || 0).toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }) +
            " (" +
            perc1.toFixed(1) +
            "% da receita do mês)." +
            "</li>";
        }

        if (top2) {
          html +=
            '<li class="list-group-item small">' +
            "⚖ Segundo lugar: " +
            (top2.nome || "Serviço") +
            " também teve boa participação na receita." +
            "</li>";
        }

        html +=
          '<li class="list-group-item small text-muted">' +
          "Sugestão da IA: fortaleça os serviços que mais trazem resultado e pense em combos ou pacotes com eles. 😉" +
          "</li>";

        elListaInsights.innerHTML = html;
      })
      .catch(function (err) {
        console.error("[Painel IA Mensal]", err);
        elListaInsights.innerHTML =
          '<li class="list-group-item text-danger">Não foi possível carregar o painel mensal da IA.</li>' +
          '<li class="list-group-item small text-muted">Verifique se a URL /financeiro/ia/resumo_mensal_series/ existe e está retornando ok=true.</li>';
      });
  }

  function sjCarregarAlertasIaMensal() {
    var elLista = document.getElementById("listaAlertasIaMensal");
    if (!elLista) return;

    elLista.innerHTML =
      '<li class="list-group-item text-muted">Carregando alertas da IA...</li>';

    fetch("/financeiro/ia/alertas_periodos_criticos/", {
      headers: {
        "X-Requested-With": "XMLHttpRequest",
        Accept: "application/json",
      },
      credentials: "same-origin",
    })
      .then(function (resp) {
        if (!resp.ok) {
          throw new Error("HTTP " + resp.status);
        }
        return resp.json();
      })
      .then(function (data) {
        if (!data || data.ok !== true) {
          throw new Error("Payload inválido em alertas_periodos_criticos");
        }

        var alertas = data.alertas || [];

        if (!alertas.length) {
          elLista.innerHTML =
            '<li class="list-group-item small text-muted">' +
            "Nenhum período crítico detectado pela IA no ano atual. 👌" +
            "</li>";
          return;
        }

        var html = alertas
          .map(function (a) {
            var tipo = (a.tipo || "").toLowerCase();
            var emoji = "🟢";
            if (tipo === "critico") emoji = "🔴";
            else if (tipo === "atencao") emoji = "⚠️";
            else if (tipo === "alerta") emoji = "🟡";

            return (
              '<li class="list-group-item small">' +
              "<strong>" +
              emoji +
              " " +
              (a.titulo || "Alerta") +
              " — " +
              (a.mes || "") +
              ":</strong><br>" +
              (a.texto || "") +
              "</li>"
            );
          })
          .join("");

        elLista.innerHTML = html;
      })
      .catch(function (err) {
        console.error("[IA Alertas Mensais]", err);
        elLista.innerHTML =
          '<li class="list-group-item text-danger">Não foi possível carregar os alertas de períodos críticos.</li>' +
          '<li class="list-group-item small text-muted">Verifique se a URL /financeiro/ia/alertas_periodos_criticos/ está acessível.</li>';
      });
  }

  function sjCarregarGraficoSerieMensalIa() {

    var elCanvas = document.getElementById("graficoSerieMensalIa");
    if (!elCanvas) return;

    fetch("/financeiro/ia/resumo_mensal_series/", {
      headers: {
        "X-Requested-With": "XMLHttpRequest",
        Accept: "application/json",
      },
      credentials: "same-origin",
    })
      .then(function (resp) {
        if (!resp.ok) {
          throw new Error("HTTP " + resp.status);
        }
        return resp.json();
      })
      .then(function (data) {
        if (!data || data.ok !== true || !Array.isArray(data.series)) {
          throw new Error("Payload inválido em ia_resumo_mensal_series");
        }

        var series = data.series;

        // 1) Se não tem nada: limpa e sai (e opcionalmente mostra msg de vazio)
        if (!series.length) {
          var ctxClear = elCanvas.getContext("2d");
          ctxClear.clearRect(0, 0, elCanvas.width, elCanvas.height);

          const msg = document.getElementById("msgGraficoMensalIA");
          if (msg) {
            msg.style.display = "block";
            msg.textContent = "Sem dados suficientes ainda. Registre receitas e despesas para a IA montar a evolução mensal.";
          }
          return;
        }

        // 2) Se tem 1 mês: mostra aviso de “preciso de 2”
        if (series.length < 2) {
          const msg = document.getElementById("msgGraficoMensalIA");
          if (msg) {
            msg.style.display = "block";
            msg.textContent =
              "Preciso de pelo menos 2 meses de dados pra mostrar a evolução. Por enquanto, exibi apenas o mês atual.";
          }
        } else {
          // se tiver 2+ meses, pode esconder a msg
          const msg = document.getElementById("msgGraficoMensalIA");
          if (msg) msg.style.display = "none";
        }

        function toNumberBR(v) {
          if (v === null || v === undefined) return 0;
          if (typeof v === "number") return Number.isFinite(v) ? v : 0;

          var s = String(v).trim();
          if (!s) return 0;

          // remove "R$", espaços, milhar e troca decimal
          s = s.replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".");
          var n = Number(s);
          return Number.isFinite(n) ? n : 0;
        }
        // ---------- Séries base ----------
        var receitas = series.map(function (s) {
          return toNumberBR(s.total_receitas);
        });
        var despesas = series.map(function (s) {
          return toNumberBR(s.total_despesas);
        });
        var saldos = series.map(function (s) {
          return toNumberBR(s.saldo);
        });


        var labels = series.map(function (s) {
          return (s && (s.label || s.mes_label || s.mes_ano || s.mes || "")) || "";
        });


        var lastSaldo = saldos[saldos.length - 1] || 0;
        var lastLabel = labels[labels.length - 1] || "";

        // ---------- Forecast (regressão linear) ----------
        var forecast = null; // próximo mês
        var nextLabel = null; // label do próximo mês
        var forecast2 = null; // +2 meses
        var forecast3 = null; // +3 meses
        var label2 = null;
        var label3 = null;
        var faixaMin = null;
        var faixaMax = null;

        if (saldos.length >= 2) {
          var n = saldos.length;
          var xs = [];
          for (var i = 0; i < n; i++) xs.push(i);

          var sumx = 0;
          var sumy = 0;
          var sumxy = 0;
          var sumx2 = 0;
          for (var j = 0; j < n; j++) {
            var x = xs[j];
            var y = saldos[j];
            sumx += x;
            sumy += y;
            sumxy += x * y;
            sumx2 += x * x;
          }
          var denom = n * sumx2 - sumx * sumx;
          if (denom === 0) denom = 1;

          var a = (n * sumxy - sumx * sumy) / denom;
          var b = (sumy - a * sumx) / n;

          // x base do último ponto real
          var lastX = n - 1;

          // previsão +1 mês
          var nextX = lastX + 1;
          forecast = a * nextX + b;

          // label do próximo mês (MM/AAAA)
          var last = series[series.length - 1];
          var ano = last.ano;
          var mes = last.mes;

          var proxMes1 = mes === 12 ? 1 : mes + 1;
          var proxAno1 = mes === 12 ? ano + 1 : ano;
          nextLabel =
            (proxMes1 < 10 ? "0" + proxMes1 : String(proxMes1)) +
            "/" +
            proxAno1;

          // previsão +2 meses
          var proxMes2 = proxMes1 === 12 ? 1 : proxMes1 + 1;
          var proxAno2 = proxMes1 === 12 ? proxAno1 + 1 : proxAno1;
          var x2 = lastX + 2;
          forecast2 = a * x2 + b;
          label2 =
            (proxMes2 < 10 ? "0" + proxMes2 : String(proxMes2)) +
            "/" +
            proxAno2;

          // previsão +3 meses
          var proxMes3 = proxMes2 === 12 ? 1 : proxMes2 + 1;
          var proxAno3 = proxMes2 === 12 ? proxAno2 + 1 : proxAno2;
          var x3 = lastX + 3;
          forecast3 = a * x3 + b;
          label3 =
            (proxMes3 < 10 ? "0" + proxMes3 : String(proxMes3)) +
            "/" +
            proxAno3;

          // faixa de incerteza em torno do horizonte mais distante
          var baseFaixa = forecast3 || forecast2 || forecast || 0;
          var margemErro = Math.abs(baseFaixa) * 0.15; // ~15% de "erro"
          faixaMin = baseFaixa - margemErro;
          faixaMax = baseFaixa + margemErro;
        }

        // ---------- Array da linha prevista ----------
        var forecastData = new Array(saldos.length).fill(null);
        var trendShadeData = new Array(saldos.length).fill(null);

        var delta = 0;
        var pct = null;

        if (forecast !== null && nextLabel) {
          // estende labels com o mês projetado
          labels.push(nextLabel);
          receitas.push(null);
          despesas.push(null);
          saldos.push(null);

          // forecast somente no último ponto
          forecastData = new Array(labels.length).fill(null);
          forecastData[forecastData.length - 1] = forecast;

          // área de tendência: último saldo + forecast
          trendShadeData = new Array(labels.length).fill(null);
          trendShadeData[trendShadeData.length - 2] =
            saldos[saldos.length - 2] || lastSaldo;
          trendShadeData[trendShadeData.length - 1] = forecast;

          delta = forecast - lastSaldo;
          if (lastSaldo !== 0) {
            pct = (delta / Math.abs(lastSaldo)) * 100;
          }
        }

        // ---------- Estilo dinâmico do ponto dourado ----------
        var forecastColor = "#ffcc33"; // padrão

        // textos que vão para o CARD
        var linhaResumo = "";
        var linhaInterp = "";
        var linhaHorizonte = "";
        var linhaRisco = "";

        // ---------- INSIGHT "Previsão da IA" + CARD ----------
        if (forecast !== null && nextLabel) {
          var ul2 = document.getElementById("listaInsightsIaMensal");
          if (ul2) {
            var li2 = document.getElementById("iaInsightForecast");
            if (!li2) {
              li2 = document.createElement("li");
              li2.id = "iaInsightForecast";
              li2.className = "list-group-item small";
              ul2.appendChild(li2);
            }

            var forecastFmt2 =
              "R$ " +
              forecast.toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              });

            var lastSaldoFmt2 =
              "R$ " +
              lastSaldo.toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              });

            var delta2 = forecast - lastSaldo;
            var pct2 = null;
            if (lastSaldo !== 0) {
              pct2 = (delta2 / Math.abs(lastSaldo)) * 100;
            }

            // -------- badge de tendência (paleta unificada) --------
            var badgeText2 = "Estável";
            var badgeClass2 =
              "bg-secondary-subtle text-secondary border border-secondary-subtle";
            var icon2 = "📊";

            if (lastSaldo < 0 && forecast >= 0) {
              badgeText2 = "Recuperação";
              badgeClass2 = "bg-success text-light border border-success";
              icon2 = "🟢";
            } else if (delta2 > 0 && pct2 !== null) {
              if (pct2 >= 30) {
                badgeText2 = "Alta forte";
                badgeClass2 = "bg-success text-light border border-success";
                icon2 = "📈";
              } else {
                badgeText2 = "Alta leve";
                badgeClass2 =
                  "bg-success-subtle text-success border border-success-subtle";
                icon2 = "📈";
              }
            } else if (delta2 < 0 && pct2 !== null) {
              if (pct2 <= -30) {
                badgeText2 = "Queda forte";
                badgeClass2 =
                  "bg-danger-subtle text-danger border border-danger-subtle";
                icon2 = "🔻";
              } else {
                badgeText2 = "Risco de queda";
                badgeClass2 =
                  "bg-warning-subtle text-warning border border-warning-subtle";
                icon2 = "⚠️";
              }
            } else {
              badgeText2 = "Estável";
              badgeClass2 =
                "bg-secondary-subtle text-secondary border border-secondary-subtle";
              icon2 = "⚖️";
            }

            // -------- textos principais --------
            linhaResumo =
              "Saldo projetado para " + nextLabel + ": " + forecastFmt2 + ".";

            if (pct2 !== null) {
              var sinalValor = delta2 >= 0 ? "+" : "-";
              var valorAbs = Math.abs(delta2).toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              });
              var sinalPct = pct2 >= 0 ? "+" : "-";
              var pctAbs = Math.abs(pct2).toFixed(1).replace(".", ",");

              linhaResumo +=
                " Variação esperada frente a " +
                lastLabel +
                ": " +
                sinalValor +
                "R$ " +
                valorAbs +
                " (" +
                sinalPct +
                pctAbs +
                "%).";
            }

            linhaInterp =
              "Leitura executiva: o modelo indica " +
              (delta2 > 0
                ? "movimento de melhora do caixa, com tendência de reforço do saldo."
                : delta2 < 0
                  ? "pressão adicional sobre o caixa, exigindo maior controle de despesas."
                  : "estabilidade no curto prazo, sem grandes oscilações de saldo.");

            // horizonte 3 meses + faixa de incerteza
            if (forecast3 !== null || forecast2 !== null) {
              var alvo = forecast3 !== null ? forecast3 : forecast2;
              var alvoLabel = label3 || label2 || nextLabel;
              var faixaMinFmt =
                "R$ " +
                (faixaMin || 0).toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                });
              var faixaMaxFmt =
                "R$ " +
                (faixaMax || 0).toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                });

              linhaHorizonte =
                "Cenário de 3 meses: para " +
                alvoLabel +
                ", a faixa projetada de saldo está entre " +
                faixaMinFmt +
                " e " +
                faixaMaxFmt +
                " (intervalo aproximado de confiança da IA).";
            }

            if (delta2 >= 0) {
              linhaRisco =
                "Risco & cuidado: ainda assim, vale monitorar despesas variáveis semanalmente para evitar reversão da tendência.";
            } else {
              linhaRisco =
                "Risco & cuidado: mantenha atenção especial em gastos recorrentes e decisões pontuais de compra para não comprometer o fluxo de caixa.";
            }

            li2.innerHTML =
              '<div class="d-flex justify-content-between align-items-start mb-1">' +
              "<div>" +
              "<strong>🔮 Previsão Financeira (IA) — próximo mês</strong><br>" +
              '<span class="badge bg-dark-subtle text-info border border-info-subtle mt-1">' +
              "Modelo: regressão linear • horizonte 3 meses" +
              "</span>" +
              "</div>" +
              '<span class="badge ' +
              badgeClass2 +
              '">' +
              badgeText2 +
              "</span>" +
              "</div>" +
              '<div class="mb-1"><strong>Saldo previsto:</strong> ' +
              forecastFmt2 +
              " (vs " +
              lastLabel +
              ": " +
              lastSaldoFmt2 +
              ")." +
              "</div>" +
              (pct2 !== null
                ? '<div class="mb-1"><strong>Sinal da IA:</strong> ' +
                (delta2 > 0
                  ? "tendência de melhora do caixa, com aumento do saldo."
                  : delta2 < 0
                    ? "pressão sobre o caixa, com risco de redução do saldo."
                    : "estabilidade no curto prazo, sem grandes oscilações.") +
                " Variação esperada: " +
                (delta2 >= 0 ? "+" : "-") +
                "R$ " +
                Math.abs(delta2).toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }) +
                " (" +
                (pct2 >= 0 ? "+" : "-") +
                Math.abs(pct2).toFixed(1).replace(".", ",") +
                "%)." +
                "</div>"
                : "") +
              '<div class="small text-muted mb-1"><strong>Ação prática:</strong> ' +
              (delta2 >= 0
                ? "reforçar a reserva e manter despesas variáveis sob vigilância para aproveitar a fase positiva."
                : "rever despesas não essenciais, segurar novas contratações e focar em serviços com melhor margem.") +
              "</div>" +
              '<div class="small text-muted">' +
              "<strong>Cenário & faixa:</strong> " +
              (linhaHorizonte ||
                "Modelo ainda com poucos pontos para projetar horizonte mais longo.") +
              "</div>";
          }

          // === Preenche também o CARD abaixo do gráfico ===
          var cardResumo = document.getElementById("sjPrevResumoLinha");
          var cardInterp = document.getElementById("sjPrevInterpLinha");
          var cardFaixa = document.getElementById("sjPrevFaixaLinha");
          var cardWrap = document.getElementById("cardPrevisaoMensal");

          if (cardResumo) cardResumo.textContent = linhaResumo;
          if (cardInterp) cardInterp.textContent = linhaInterp;
          if (cardFaixa)
            cardFaixa.textContent = (linhaHorizonte || "").trim() || linhaRisco;

          if (cardWrap) {
            cardWrap.classList.remove("d-none");
            cardWrap.classList.add("sj-previsao-card");
          }
        } else {
          var cardOff1 = document.getElementById("cardPrevisaoMensal");
          if (cardOff1) cardOff1.classList.add("d-none");
          var cardOff2 = document.getElementById("cardPrevisaoResumoIa");
          if (cardOff2) cardOff2.classList.add("d-none");
        }

        // ---------- Monta o gráfico ----------
        if (sjChartSerieIa) sjChartSerieIa.destroy();
        var existing = Chart.getChart(elCanvas);
        if (existing) existing.destroy();

        var ctx2 = elCanvas.getContext("2d");
        sjChartSerieIa = new Chart(ctx2, {
          type: "line",
          data: {
            labels: labels,
            datasets: [
              {
                label: "Receitas",
                data: receitas,
                tension: 0.3,
                borderColor: "#22c55e",
                backgroundColor: "rgba(34,197,94,.12)",
                borderWidth: 3,
                pointRadius: 5,
                pointHoverRadius: 8,
                pointBackgroundColor: "#22c55e",
              },
              {
                label: "Despesas",
                data: despesas,
                tension: 0.3,
                borderColor: "#ef4444",
                backgroundColor: "rgba(239,68,68,.10)",
                borderWidth: 3,
                pointRadius: 5,
                pointHoverRadius: 8,
                pointBackgroundColor: "#ef4444",
              },
              {
                label: "Saldo",
                data: saldos,
                tension: 0.3,
                borderColor: "#3b82f6",
                backgroundColor: "rgba(59,130,246,.10)",
                borderWidth: 3,
                pointRadius: 5,
                pointHoverRadius: 8,
                pointBackgroundColor: "#3b82f6",
              },

              {
                label: "_Tendência",
                data: trendShadeData,
                tension: 0.3,
                fill: "origin",
                borderWidth: 0,
                pointRadius: 0,
                pointHoverRadius: 0,
                backgroundColor: "rgba(255,204,51,0.10)",
              },
              {
                label: "Saldo (previsto)",
                data: forecastData,
                tension: 0.3,
                borderDash: [6, 4],
                spanGaps: true,
                borderColor: forecastColor,
                backgroundColor: forecastColor,
                pointBackgroundColor: forecastColor,
                pointBorderColor: "#00000088",
                pointRadius: function (ctx3) {
                  var w =
                    ctx3 && ctx3.chart && ctx3.chart.width
                      ? ctx3.chart.width
                      : 600;
                  return w < 480 ? 5 : 8;
                },
                pointHoverRadius: function (ctx3) {
                  var w =
                    ctx3 && ctx3.chart && ctx3.chart.width
                      ? ctx3.chart.width
                      : 600;
                  return w < 480 ? 8 : 12;
                },
                pointStyle: "circle",
                borderWidth: 2,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: "bottom",
                labels: {
                  color: "#e5e7eb", // ✅ legenda visível no dark
                  filter: function (item) {
                    return item.text && item.text.indexOf("_") !== 0;
                  },
                },
              },
              tooltip: {
                titleColor: "#e5e7eb",
                bodyColor: "#e5e7eb",
                callbacks: {
                  label: function (context) {
                    var dsLabel = context.dataset.label || "";
                    var v = context.parsed.y;
                    if (v == null) return null;

                    var valor = v.toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    });

                    if (dsLabel.indexOf("Saldo (previsto") === 0) {
                      var linhas = ["Saldo (previsto): R$ " + valor];

                      if (forecast !== null && pct !== null) {
                        var sinalValor = delta >= 0 ? "+" : "-";
                        var valorAbs = Math.abs(delta).toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        });
                        var sinalPct = pct >= 0 ? "+" : "-";
                        var pctAbs = Math.abs(pct).toFixed(1).replace(".", ",");

                        linhas.push(
                          "Diferença vs " +
                          lastLabel +
                          ": " +
                          sinalValor +
                          "R$ " +
                          valorAbs +
                          " (" +
                          sinalPct +
                          pctAbs +
                          "%)"
                        );
                      }

                      return linhas;
                    }

                    return dsLabel + ": R$ " + valor;
                  },
                },
              },
            },
            scales: {
              x: {
                ticks: { color: "#cbd5e1" },                 // ✅ eixo X visível
                grid: { color: "rgba(255,255,255,.08)" },    // ✅ grid X
              },
              y: {
                ticks: {
                  color: "#cbd5e1",                           // ✅ eixo Y visível
                  callback: function (value) {
                    return "R$ " + value.toLocaleString("pt-BR");
                  },
                },
                grid: { color: "rgba(255,255,255,.08)" },     // ✅ grid Y
              },
            },
          }

        });
      })
      .catch(function (err) {
        console.error("[IA Série Mensal]", err);
        var ctxClear2 = elCanvas.getContext("2d");
        ctxClear2.clearRect(0, 0, elCanvas.width, elCanvas.height);
      });
  }

  function sjCarregarComparacaoIaMensal() {
    var elLista = document.getElementById("listaComparacaoIaMensal");
    if (!elLista) return;

    elLista.innerHTML =
      '<li class="list-group-item text-muted">Carregando comparação da IA...</li>';

    fetch("/financeiro/ia/resumo_mensal_series/", {
      headers: {
        "X-Requested-With": "XMLHttpRequest",
        Accept: "application/json",
      },
      credentials: "same-origin",
    })
      .then(function (resp) {
        if (!resp.ok) {
          throw new Error("HTTP " + resp.status);
        }
        return resp.json();
      })
      .then(function (data) {
        if (!data || data.ok !== true || !Array.isArray(data.series)) {
          throw new Error("Payload inválido em ia_resumo_mensal_series");
        }

        var series = data.series;
        if (series.length < 2) {
          elLista.innerHTML =
            '<li class="list-group-item small text-muted">' +
            "Comparação mês a mês ficará disponível após o fechamento de pelo menos 2 meses completos. 📅" +
            "</li>";
          return;
        }


        var prev = series[series.length - 2];
        var cur = series[series.length - 1];

        var recPrev = prev.total_receitas || 0;
        var recCur = cur.total_receitas || 0;
        var depPrev = prev.total_despesas || 0;
        var depCur = cur.total_despesas || 0;
        var saldoPrev = prev.saldo || 0;
        var saldoCur = cur.saldo || 0;

        function fmtMoney(v) {
          return v.toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
        }

        function fmtPerc(v) {
          return (
            v.toLocaleString("pt-BR", {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            }) + "%"
          );
        }

        function varPerc(atual, anterior) {
          if (!anterior) return null;
          var diff = atual - anterior;
          return (diff / anterior) * 100;
        }

        var recVar = varPerc(recCur, recPrev);
        var depVar = varPerc(depCur, depPrev);
        var saldoVar = varPerc(saldoCur, saldoPrev);

        var margemPrev = recPrev > 0 ? (saldoPrev / recPrev) * 100 : 0;
        var margemCur = recCur > 0 ? (saldoCur / recCur) * 100 : 0;
        var margemVar = margemCur - margemPrev;

        var html = "";

        // 1) Receitas
        if (recPrev === 0 && recCur > 0) {
          html +=
            '<li class="list-group-item small">' +
            "📈 As receitas surgiram em " +
            cur.label +
            " (não havia receitas em " +
            prev.label +
            ")." +
            "</li>";
        } else if (recVar != null) {
          var recEmoji = recVar >= 0 ? "📈" : "📉";
          html +=
            '<li class="list-group-item small">' +
            recEmoji +
            " Receitas: de R$ " +
            fmtMoney(recPrev) +
            " em " +
            prev.label +
            " para R$ " +
            fmtMoney(recCur) +
            " em " +
            cur.label +
            " (" +
            fmtPerc(recVar) +
            ")." +
            "</li>";
        }

        // 2) Despesas
        if (depPrev === 0 && depCur > 0) {
          html +=
            '<li class="list-group-item small">' +
            "💸 Despesas apareceram em " +
            cur.label +
            " (não havia despesas em " +
            prev.label +
            ")." +
            "</li>";
        } else if (depVar != null) {
          var depEmoji = depVar >= 0 ? "💸" : "🧹";
          html +=
            '<li class="list-group-item small">' +
            depEmoji +
            " Despesas: de R$ " +
            fmtMoney(depPrev) +
            " em " +
            prev.label +
            " para R$ " +
            fmtMoney(depCur) +
            " em " +
            cur.label +
            " (" +
            fmtPerc(depVar) +
            ")." +
            "</li>";
        }

        // 3) Saldo
        if (saldoVar != null && saldoPrev !== 0) {
          var saldoEmoji = saldoVar >= 0 ? "💚" : "🔻";
          html +=
            '<li class="list-group-item small">' +
            saldoEmoji +
            " Saldo: de R$ " +
            fmtMoney(saldoPrev) +
            " em " +
            prev.label +
            " para R$ " +
            fmtMoney(saldoCur) +
            " em " +
            cur.label +
            " (" +
            fmtPerc(saldoVar) +
            ")." +
            "</li>";
        } else {
          html +=
            '<li class="list-group-item small">' +
            "ℹ Saldo atual em " +
            cur.label +
            " é de R$ " +
            fmtMoney(saldoCur) +
            " (referência limitada para comparação)." +
            "</li>";
        }

        // 4) Margem
        html +=
          '<li class="list-group-item small">' +
          "📊 Margem: de " +
          fmtPerc(margemPrev) +
          " em " +
          prev.label +
          " para " +
          fmtPerc(margemCur) +
          " em " +
          cur.label +
          " (variação de " +
          fmtPerc(margemVar) +
          ")." +
          "</li>";

        elLista.innerHTML = html;
      })
      .catch(function (err) {
        console.error("[IA Comparação Mensal]", err);
        elLista.innerHTML =
          '<li class="list-group-item text-danger">Não foi possível carregar a comparação mês a mês.</li>' +
          '<li class="list-group-item small text-muted">Verifique se a URL /financeiro/ia/resumo_mensal_series/ está acessível.</li>';
      });
  }

  // --------- Atualiza card resumo (reutilizável)
  function __updateCardResumo(origem) {
    var box = document.getElementById("boxResumoMensal");
    if (!box || !origem) return;

    var brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
    var toNum = function (v) { return Number(v || 0); };

    // monta label do mês se backend não mandar
    var meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    var mesNum = Number(origem.mes || 0);
    var anoNum = Number(origem.ano || 0);

    var mesLabel =
      origem.mes_label ||
      origem.label ||
      (mesNum >= 1 && mesNum <= 12 && anoNum
        ? (meses[mesNum - 1] + "/" + anoNum)
        : "");

    // cor do card pelo saldo
    box.classList.remove("d-none", "alert-info", "alert-success", "alert-danger");
    var cls = "alert-info";
    if (toNum(origem.saldo) > 0) cls = "alert-success";
    if (toNum(origem.saldo) < 0) cls = "alert-danger";
    box.classList.add(cls);

    // conteúdo
    var titulo = mesLabel ? ("📅 " + mesLabel) : "📅 Resumo do mês";
    var linhaResumo = origem.resumo
      ? String(origem.resumo)
      : (
        "Receitas: " + brl.format(toNum(origem.total_receitas)) +
        " | Despesas: " + brl.format(toNum(origem.total_despesas)) +
        " | Saldo: " + brl.format(toNum(origem.saldo))
      );

    var dica = origem.dica ? String(origem.dica) : "";

    box.innerHTML = [
      "<strong>", titulo, "</strong><br>",
      linhaResumo,
      dica ? ("<br>💡 " + dica) : ""
    ].join("");

    __sjApplyMoodFromSaldo(Number(origem.saldo || 0));
  }
  window.__updateCardResumo = __updateCardResumo;

  // ================== HUMOR DA IA (Badge + Tom dos KPIs) ==================
  function __sjApplyMoodFromSaldo(saldo) {
    var tipo = saldo > 0 ? "positiva" : saldo < 0 ? "alerta" : "neutra";

    var b = document.getElementById("a30_tipo_badge");
    if (b) {
      b.style.display = "inline-block";
      b.style.padding = "2px 10px";
      b.style.borderRadius = "999px";
      b.style.fontSize = "12px";
      b.style.fontWeight = "700";
      b.style.letterSpacing = "0.2px";
      if (tipo === "positiva") {
        b.textContent = "Positiva";
        b.style.backgroundColor = "rgba(46,125,50,0.18)";
        b.style.border = "1px solid rgba(76,175,80,0.45)";
        b.style.color = "#bde5c5";
      } else if (tipo === "alerta") {
        b.textContent = "Alerta";
        b.style.backgroundColor = "rgba(255,193,7,0.20)";
        b.style.border = "1px solid rgba(255,193,7,0.55)";
        b.style.color = "#ffe08a";
      } else {
        b.textContent = "Neutra";
        b.style.backgroundColor = "rgba(255,255,255,0.08)";
        b.style.border = "1px solid rgba(255,255,255,0.22)";
        b.style.color = "#d6d6d6";
      }
    }

    var cards = document.querySelectorAll("#analise30dKPIs .border");
    for (var i = 0; i < cards.length; i++) {
      var el = cards[i];
      if (tipo === "positiva") {
        el.style.borderColor = "rgba(76,175,80,0.55)";
        el.style.boxShadow = "0 0 4px rgba(76,175,80,0.33)";
      } else if (tipo === "alerta") {
        el.style.borderColor = "rgba(255,193,7,0.60)";
        el.style.boxShadow = "0 0 4px rgba(255,193,7,0.33)";
      } else {
        el.style.borderColor = "rgba(255,255,255,0.18)";
        el.style.boxShadow = "0 0 4px rgba(255,255,255,0.12)";
      }
    }

    document.body.setAttribute("data-analise-tipo", tipo);
  }

  // ========================= RECARREGAR ========================
  function __getBtn() {
    return document.querySelector(
      "#btnAplicarFiltros, #filtrar-btn, button[data-oldText]"
    );
  }

  async function recarregar() {
    if (window.__SJ_LOADING) return;
    window.__SJ_LOADING = true;

    var btn = __getBtn();
    if (btn) {
      btn.disabled = true;
      btn.dataset.oldText = btn.textContent;
      btn.textContent = "Atualizando…";
    }

    try {
      var cv = document.getElementById("graficoEvolucao");
      var cvCat = document.getElementById("graficoCategorias");
      var elCatEmpty = document.getElementById("categoriasEmpty");
      if (!cv || !window.Chart) throw new Error("SEM_CANVAS_OU_CHART");

      try {
        Chart.getChart(cv) && Chart.getChart(cv).destroy();
      } catch (_e0) {
        /* */
      }
      if (cvCat) {
        try {
          Chart.getChart(cvCat) && Chart.getChart(cvCat).destroy();
        } catch (_e1) {
          /* */
        }
      }

      var hoje = new Date();
      var ini =
        (document.getElementById("filtroInicio") || {}).value ||
        firstDayOfMonth(hoje);
      var fim =
        (document.getElementById("filtroFim") || {}).value || fmtYMD(hoje);

      var base =
        window.URL_DADOS_GRAFICO || "/financeiro/dados_grafico_filtrados/";
      var url =
        base +
        "?inicio=" +
        encodeURIComponent(ini) +
        "&fim=" +
        encodeURIComponent(fim);

      var r = await fetch(url, {
        headers: { Accept: "application/json" },
        credentials: "same-origin",
      });
      if (!r.ok) throw new Error("HTTP_" + r.status);
      var j = await r.json();
      console.log("[DADOS_GRAFICO] chaves:", Object.keys(j));
      console.log("[DADOS_GRAFICO] amostra:", j);
      console.log("[DADOS_GRAFICO] cats:", {
        labels: j.categorias_labels,
        valores: j.categorias_valores,
        categorias: j.categorias,
        valores2: j.valores,
      });

      var toNum = function (v) {
        return typeof v === "number"
          ? v
          : Number(String(v).replace(/\./g, "").replace(",", ".")) || 0;
      };

      var src =
        j.resumo_janela ||
        j.resumo_mes_corrente ||
        (function () {
          var totalR = (j.receitas || []).reduce(function (a, b) {
            return a + toNum(b);
          }, 0);
          var totalD = (j.despesas || []).reduce(function (a, b) {
            return a + toNum(b);
          }, 0);
          return {
            label: j.inicio && j.fim ? j.inicio + "–" + j.fim : "Janela atual",
            total_receitas: totalR,
            total_despesas: totalD,
            saldo: totalR - totalD,
          };
        })();

      // 1) aplica humor pelo saldo
      __sjApplyMoodFromSaldo(Number(src.saldo || 0));

      // 2) normaliza o payload pro card (mensal ou período)
      var payloadCard = {
        ano: src.ano ?? src.year ?? null,
        mes: src.mes ?? src.month ?? null,
        mes_label: src.mes_label ?? null,
        label: src.label ?? (src.inicio && src.fim ? (src.inicio + "–" + src.fim) : ""),
        total_receitas: src.total_receitas ?? src.receitas ?? 0,
        total_despesas: src.total_despesas ?? src.despesas ?? 0,
        saldo: src.saldo ?? 0,
        resumo: src.resumo ?? null,
        dica: src.dica ?? null,
      };

      // se não veio ano/mes, mas veio label de período, deixa como período mesmo
      window.__updateCardResumo?.(payloadCard);


      (function () {
        var brl = new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "BRL",
        });
        var kpis = document.getElementById("analise30dKPIs");
        var elR = document.getElementById("a30_receitas");
        var elD = document.getElementById("a30_despesas");
        var elS = document.getElementById("a30_saldo");
        if (elR) elR.textContent = brl.format(Number(src.total_receitas || 0));
        if (elD) elD.textContent = brl.format(Number(src.total_despesas || 0));
        if (elS) elS.textContent = brl.format(Number(src.saldo || 0));
        if (kpis) kpis.style.display = "";
      })();

      (function () {
        var elM = document.getElementById("a30_margem");
        if (!elM) return;

        var baseRef = j.resumo_mes_corrente || src;
        var rTot = Number(baseRef.total_receitas || 0);
        var sTot = Number(baseRef.saldo || 0);

        if (rTot > 0) {
          var pctM = (sTot / rTot) * 100;
          if (pctM >= 99.9) {
            elM.textContent = "100 % (saldo total)";
          } else {
            elM.textContent =
              pctM.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " %";
          }
        } else {
          elM.textContent = "—";
        }
      })();

      (function () {
        var vRec = document.getElementById("a30_var_rec");
        var vDes = document.getElementById("a30_var_des");
        if (!vRec && !vDes) return;

        var inicio = new Date(j.inicio);
        var fimDt = new Date(j.fim);
        var diffDias = Math.max(1, (fimDt - inicio) / (1000 * 60 * 60 * 24));

        var inicioAnt = new Date(inicio);
        inicioAnt.setDate(inicioAnt.getDate() - diffDias);
        var fimAnt = new Date(inicio);
        fimAnt.setDate(fimAnt.getDate() - 1);

        var _fmt = function (d) {
          return (
            d.getFullYear() +
            "-" +
            pad2(d.getMonth() + 1) +
            "-" +
            pad2(d.getDate())
          );
        };

        fetch(
          (window.URL_DADOS_GRAFICO || "/financeiro/dados_grafico_filtrados/") +
          "?inicio=" +
          _fmt(inicioAnt) +
          "&fim=" +
          _fmt(fimAnt),
          {
            headers: { Accept: "application/json" },
            credentials: "same-origin",
          }
        )
          .then(function (r2) {
            return r2.json();
          })
          .then(function (prev) {
            var num = function (v) {
              return Number(v || 0);
            };
            var totalR = (j.receitas || []).reduce(function (a, b) {
              return a + num(b);
            }, 0);
            var totalD = (j.despesas || []).reduce(function (a, b) {
              return a + num(b);
            }, 0);
            var prevR = (prev.receitas || []).reduce(function (a, b) {
              return a + num(b);
            }, 0);
            var prevD = (prev.despesas || []).reduce(function (a, b) {
              return a + num(b);
            }, 0);

            function decideVar(curr, prevVal) {
              if (prevVal > 0) {
                var pctV = ((curr - prevVal) / prevVal) * 100;
                return {
                  text: (pctV >= 0 ? "+" : "") + pctV.toFixed(1) + " %",
                  sign: Math.sign(pctV),
                };
              }
              if (curr > 0) return { text: "+100 % (vs 0)", sign: 1 };
              return { text: "0,0 %", sign: 0 };
            }

            var vr = decideVar(totalR, prevR),
              vd = decideVar(totalD, prevD);
            if (vRec) {
              vRec.textContent = vr.text;
              vRec.style.fontWeight = "600";
              vRec.style.color =
                vr.sign > 0 ? "#66bb6a" : vr.sign < 0 ? "#ef9a9a" : "";
            }
            if (vDes) {
              vDes.textContent = vd.text;
              vDes.style.fontWeight = "600";
              vDes.style.color =
                vd.sign > 0 ? "#ef9a9a" : vd.sign < 0 ? "#66bb6a" : "";
            }
          })
          .catch(function () {
            if (vRec) vRec.textContent = "—";
            if (vDes) vDes.textContent = "—";
          });
      })();

      var dias = Array.isArray(j.dias) ? j.dias : [];

      function __sjNormArray(arr) {
        if (!Array.isArray(arr)) return [];
        var out = [];
        for (var i = 0; i < arr.length; i++) {
          var v = arr[i];
          var n =
            typeof v === "number" && isFinite(v)
              ? v
              : Number(
                String(v || "0")
                  .replace(/\./g, "")
                  .replace(",", ".")
              );
          if (!isFinite(n)) n = 0;

          if (Math.abs(n) >= 1000 && Math.floor(n) === n) {
            n = n / 100;
          }
          out.push(n);
        }
        return out;
      }

      var R = __sjNormArray(j.receitas || []);
      var D = __sjNormArray(j.despesas || []);
      var S;

      if (Array.isArray(j.saldo) && j.saldo.length === dias.length) {
        S = __sjNormArray(j.saldo);
      } else {
        S = [];
        var acc = 0;
        for (var ii = 0; ii < dias.length; ii++) {
          acc += (R[ii] || 0) - (D[ii] || 0);
          S.push(acc);
        }
      }

      window.montarGraficoEvolucao(dias, R, D, S);

      if (cvCat) {
        try {
          cvCat.style.display = "block";

        } catch (_eCat0) {
          /* */
        }

        try {
          montarGraficoCategorias(

            j.categorias || [],
            j.valores || []

          );
        } catch (_eCat1) {
          console.warn("⚠️ Falha ao desenhar gráfico de categorias:", _eCat1);

          if (elCatEmpty) {
            elCatEmpty.hidden = false;
            elCatEmpty.textContent = "Sem categorias neste período.";
          }

          try {
            cvCat.removeAttribute("style");
            cvCat.style.display = "block";
          } catch (_eCat2) {
            /* */
          }

          try {
            Chart.getChart(cvCat) && Chart.getChart(cvCat).destroy();
          } catch (_eCat3) {
            /* */
          }
        }
      }
    } catch (e) {
      console.error("recarregar() falhou:", e);
    } finally {
      var btn2 = __getBtn();
      if (btn2) {
        btn2.disabled = false;
        btn2.textContent = btn2.dataset.oldText || "Aplicar";
        try {
          delete btn2.dataset.oldText;
        } catch (_e) {
          btn2.removeAttribute("data-oldText");
        }
      }
      window.__SJ_LOADING = false;
    }
  }

  // expõe para o console
  window.__SJ_DASH_DEV__ = Object.assign(window.__SJ_DASH_DEV__ || {}, {
    reload: recarregar,
    evol: window.montarGraficoEvolucao,
    cat: montarGraficoCategorias,
  });

  // ============================ BOOT ===========================
  document.addEventListener("DOMContentLoaded", function () {
    var elIni =
      document.querySelector("#filtroInicio") ||
      document.querySelector("#data_inicio");
    var elFim =
      document.querySelector("#filtroFim") ||
      document.querySelector("#data_fim");
    var hoje = new Date();
    if (elIni && !elIni.value) elIni.value = firstDayOfMonth(hoje);
    if (elFim && !elFim.value) elFim.value = fmtYMD(hoje);

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
          .then(function (r3) {
            return r3.json();
          })
          .then(function (j3) {
            if (
              !j3 ||
              !j3.ok ||
              !Array.isArray(j3.categorias) ||
              !j3.categorias.length
            ) {
              sel.dataset.hydrated = "1";
              return;
            }
            var sep = document.createElement("option");
            sep.disabled = true;
            sep.textContent = "──────────";
            sel.appendChild(sep);
            for (var k = 0; k < j3.categorias.length; k++) {
              var c = j3.categorias[k];
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

    var fireReload = debounce(function () {
      recarregar();
      sjCarregarPainelIaMensal();
      sjCarregarAlertasIaMensal();
      sjCarregarComparacaoIaMensal();
      sjCarregarGraficoSerieMensalIa();
    }, 300);

    ["#filtroInicio", "#filtroFim", "#filtroCategoria"].forEach(function (sel2) {
      var el = document.querySelector(sel2);
      if (!el) return;
      el.addEventListener("change", fireReload);
      el.addEventListener("input", fireReload);
    });

    var btn =
      document.getElementById("btnAplicarFiltros") ||
      document.getElementById("filtrar-btn");
    if (btn && btn.parentNode) {
      var fresh = btn.cloneNode(true);
      btn.parentNode.replaceChild(fresh, btn);
      fresh.addEventListener("click", function (ev) {
        ev.preventDefault();
        fireReload();
      });
    }

    recarregar();
    sjCarregarPainelIaMensal();
    sjCarregarAlertasIaMensal();
    sjCarregarComparacaoIaMensal();
    sjCarregarGraficoSerieMensalIa();
  });

  // === IA Avançada: Análise 30D ===
  (function () {
    "use strict";

    var byId = function (id) {
      return document.getElementById(id);
    };

    var DARK_TINTS = {
      positiva: {
        bg: "rgba(46,125,50,0.18)",
        borda: "rgba(76,175,80,0.45)",
        texto: "#e6f4ea",
        badgeBg: "rgba(76,175,80,0.2)",
        badgeBorda: "rgba(76,175,80,0.55)",
        badgeTxt: "#bde5c5",
      },
      alerta: {
        bg: "rgba(255,193,7,0.20)",
        borda: "rgba(255,193,7,0.55)",
        texto: "#fff2c6",
        badgeBg: "rgba(255,193,7,0.22)",
        badgeBorda: "rgba(255,193,7,0.60)",
        badgeTxt: "#ffe08a",
      },
      neutra: {
        bg: "rgba(255,255,255,0.08)",
        borda: "rgba(255,255,255,0.18)",
        texto: "#e0e0e0",
        badgeBg: "rgba(255,255,255,0.10)",
        badgeBorda: "rgba(255,255,255,0.22)",
        badgeTxt: "#d6d6d6",
      },
    };

    function setPlanoClass(el, tipo) {
      if (!el) return;
      var t = (tipo || "neutra").toLowerCase();
      var c = DARK_TINTS[t] || DARK_TINTS.neutra;
      el.className = "p-3 rounded-3 border";
      el.removeAttribute("style");
      el.style.setProperty("background-color", c.bg, "important");
      el.style.setProperty("border-color", c.borda, "important");
      el.style.setProperty("color", c.texto, "important");
      el.style.setProperty(
        "box-shadow",
        "inset 0 1px 0 rgba(255,255,255,0.03), 0 0 0 1px rgba(0,0,0,0.12)",
        "important"
      );
      el.style.setProperty("backdrop-filter", "saturate(120%)", "important");
    }

    function colorirKPIs(tipo) {
      var t = (tipo || "neutra").toLowerCase();
      var c = DARK_TINTS[t] || DARK_TINTS.neutra;
      var cards = document.querySelectorAll("#analise30dKPIs .border");
      for (var i = 0; i < cards.length; i++) {
        var el = cards[i];
        el.style.setProperty("border-color", c.borda, "important");
        el.style.setProperty(
          "box-shadow",
          "0 0 4px " + c.borda + "33",
          "important"
        );
      }
    }

    function setTipoBadge(el, tipo) {
      if (!el) return;
      var t = (tipo || "neutra").toLowerCase();
      var c = DARK_TINTS[t] || DARK_TINTS.neutra;
      el.textContent =
        t === "positiva" ? "Positiva" : t === "alerta" ? "Alerta" : "Neutra";
      el.style.display = "inline-block";
      el.style.padding = "2px 10px";
      el.style.borderRadius = "999px";
      el.style.fontSize = "12px";
      el.style.fontWeight = "700";
      el.style.letterSpacing = "0.2px";
      el.style.setProperty("background-color", c.badgeBg, "important");
      el.style.setProperty("border", "1px solid " + c.badgeBorda, "important");
      el.style.setProperty("color", c.badgeTxt, "important");
    }

    async function carregarAnalise30d() {
      var btn = byId("btnReloadAnalise30d");
      var status = byId("analise30dStatus");
      var kpis = byId("analise30dKPIs");
      var planoWrap = byId("analise30dPlanoWrap");
      var planoEl = byId("analise30dPlano");
      var periodoEl = byId("analise30dPeriodo");
      var tipoBadge = byId("a30_tipo_badge");

      try {
        if (btn) {
          btn.disabled = true;
          btn.textContent = "Carregando…";
        }
        if (status) {
          status.textContent = "Carregando análise…";
          status.style.display = "";
        }
        if (kpis) kpis.style.display = "none";
        if (planoWrap) planoWrap.style.display = "none";

        var r = await fetch("/financeiro/ia/analise/preview/", {
          headers: { Accept: "application/json" },
          credentials: "same-origin",
        });
        if (!r.ok) throw new Error("HTTP " + r.status);
        var json = await r.json();
        if (!json.ok || !json.analise)
          throw new Error(json.error || "Falha ao obter análise.");
        var a = json.analise;

        if (planoEl) {
          planoEl.textContent = a.plano_acao || "—";
          setPlanoClass(planoEl, (a.tipo || "neutra").toLowerCase());
          colorirKPIs(a.tipo);
          document.body.setAttribute(
            "data-analise-tipo",
            (a.tipo || "neutra").toLowerCase()
          );
        }
        if (tipoBadge) setTipoBadge(tipoBadge, a.tipo);
        if (periodoEl)
          periodoEl.textContent = "Período: " + a.inicio + " a " + a.fim;

        if (kpis) kpis.style.display = "";
        if (planoWrap) planoWrap.style.display = "";
        if (status) status.style.display = "none";
      } catch (e) {
        console.error("Análise 30d falhou:", e);
        document.body.setAttribute("data-analise-tipo", "neutra");
        if (status) {
          status.textContent = "Não foi possível carregar a análise agora.";
          status.classList.add("text-danger");
          status.style.display = "";
        }
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = "Atualizar";
        }
      }
    }

    document.addEventListener("DOMContentLoaded", function () {
      var btn = document.getElementById("btnReloadAnalise30d");
      if (btn) {
        btn.addEventListener("click", function (ev) {
          if (!ev.isTrusted) return;
          carregarAnalise30d();
        });
      }
      carregarAnalise30d();
    });
  })();

  // expõe função de humor para debug no console
  window.__sjApplyMoodFromSaldo = __sjApplyMoodFromSaldo;

  // === Botões "Gerar nova dica" (azul em cima + verdinho do histórico) ===
  document.addEventListener("DOMContentLoaded", function () {
    const btnTurbo = document.getElementById("btnGerarDica"); // botão azul (Mini-IA)
    const btnSimples = document.getElementById("btnGerarDicaSimples"); // botão verde (histórico)

    if (!btnTurbo && !btnSimples) return;

    async function getCsrfToken() {
      const meta = document.querySelector('meta[name="csrf-token"]');
      if (meta && meta.content) return meta.content;
      const match = document.cookie.match(/(^|;)\s*csrftoken=([^;]+)/);
      return match ? decodeURIComponent(match[2]) : "";
    }

    async function recarregarHistoricoComFiltroAtual() {
      if (typeof window.carregarHistorico !== "function") return;
      const filtroAtual =
        (window.__HistoricoIA && window.__HistoricoIA.filtro) || "todas";
      await window.carregarHistorico(20, filtroAtual, false);
    }
    window.recarregarHistoricoComFiltroAtual =
      recarregarHistoricoComFiltroAtual;

    async function gerarDica(path, origem, btn) {
      const oldLabel = btn.textContent;
      btn.disabled = true;
      btn.textContent = "Gerando…";

      try {
        const r = await fetch(path, {
          method: "POST",
          headers: {
            "X-CSRFToken": await getCsrfToken(),
            "X-Requested-With": "XMLHttpRequest",
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify({ origem: origem }),
        });

        if (!r.ok) {
          const text = await r.text();
          console.error("⚠️ Erro ao gerar dica:", r.status, text);
          throw new Error("HTTP " + r.status);
        }

        const j = await r.json();
        if (!j.ok) throw new Error("Falha ao salvar dica");

        const texto =
          (j.salvo && j.salvo.texto) ||
          j.texto ||
          j.dica ||
          "Nenhuma dica retornada.";

        const idRec = (j.salvo && j.salvo.id) || j.id || null;

        const box = document.getElementById("iaTurboTexto");
        if (box) box.textContent = texto;

        if (idRec != null) {
          window.__LAST_DICA_ID__ = idRec;
        }

        await recarregarHistoricoComFiltroAtual();
      } catch (e) {
        console.error("💥 Erro no processo de geração da dica:", e);
        alert("Não consegui gerar a dica agora. Tente novamente em instantes.");
      } finally {
        btn.disabled = false;
        btn.textContent = oldLabel;
      }
    }

    if (btnTurbo) {
      btnTurbo.addEventListener("click", function (ev) {
        if (!ev.isTrusted) return;
        gerarDica("/financeiro/ia/gerar_dica_30d/", btnTurbo.id, btnTurbo);
      });
    }

    if (btnSimples) {
      btnSimples.addEventListener("click", function (ev) {
        if (!ev.isTrusted) return;
        gerarDica(
          "/financeiro/ia/gerar_dica_sob_demanda/",
          btnSimples.id,
          btnSimples
        );
      });
    }
  });
})();

// ==========================================================
// 📈 Spaço da Jhuséna — Gráfico Mensal (Receitas x Despesas x Saldo)
// Fonte: /financeiro/ia/resumo-mensal/series/
// ==========================================================

let sjChartMensalIA = null;

function sjMostrarMsgGraficoMensal(msg, isErro) {
  var box = document.getElementById("msgGraficoMensalIA");
  if (!box) return;

  box.style.display = msg ? "block" : "none";
  box.textContent = msg || "";

  if (isErro) {
    box.classList.remove("text-muted");
    box.classList.add("text-danger");
  } else {
    box.classList.remove("text-danger");
    box.classList.add("text-muted");
  }
}

function carregarGraficoMensalIA() {
  var labels = [];
  var cv = document.getElementById("graficoSerieMensalIa");
  if (!cv) {
    console.warn("📈 graficoSerieMensalIa não encontrado no DOM.");
    return;
  }

  sjMostrarMsgGraficoMensal("Carregando resumo mensal...", false);

  fetch("/financeiro/ia/resumo-mensal/series/")
    .then(function (resp) {
      return resp.json();
    })
    .then(function (data) {
      if (!data || !data.ok) {
        sjMostrarMsgGraficoMensal(
          "Não foi possível carregar o resumo mensal.",
          true
        );
        return;
      }

      var series = data.series || [];
      if (!series.length) {
        sjMostrarMsgGraficoMensal(
          "Sem dados mensais suficientes para montar o gráfico.",
          false
        );
        if (sjChartMensalIA) {
          sjChartMensalIA.destroy();
          sjChartMensalIA = null;
        }
        return;
      }

      sjMostrarMsgGraficoMensal("", false);

      var labels = [];
      var receitas = [];
      var despesas = [];
      var saldos = [];

      for (var i = 0; i < series.length; i++) {
        var s = series[i];
        labels.push(s.label);
        receitas.push(s.total_receitas || 0);
        despesas.push(s.total_despesas || 0);
        saldos.push(s.saldo || 0);
      }

      // ==========================================
      // 🔮 PROJEÇÃO DO PRÓXIMO MÊS (Saldo)
      // ==========================================
      var saldoProj = [];
      if (series.length > 0) {
        var ultimo = series[series.length - 1];
        var proxMes = ultimo.mes + 1;
        var proxAno = ultimo.ano;
        if (proxMes > 12) {
          proxMes = 1;
          proxAno += 1;
        }

        var proxLabel =
          (proxMes < 10 ? "0" + proxMes : String(proxMes)) + "/" + proxAno;

        var projValor = saldos[saldos.length - 1] || 0;
        if (saldos.length >= 2) {
          var diff =
            (saldos[saldos.length - 1] || 0) - (saldos[saldos.length - 2] || 0);
          projValor = (saldos[saldos.length - 1] || 0) + diff;
        }
        if (projValor < 0) projValor = 0;

        labels.push(proxLabel);
        receitas.push(null);
        despesas.push(null);
        saldos.push(null);

        for (var j = 0; j < labels.length - 1; j++) {
          saldoProj.push(null);
        }
        saldoProj.push(projValor);
      }

      try {
        const prev = Chart.getChart(cv);
        if (prev) prev.destroy();

        if (sjChartMensalIA) {
          sjChartMensalIA.destroy();
          sjChartMensalIA = null;
        }

        sjChartMensalIA = new Chart(cv, {
          type: "line",
          data: {
            labels: labels,
            datasets: [
              {
                label: "Receitas",
                data: receitas,
                tension: 0.25,
                fill: false,
                borderWidth: 2,
                pointRadius: 3,
                borderColor: "#2e7d32",
              },
              {
                label: "Despesas",
                data: despesas,
                tension: 0.25,
                fill: false,
                borderWidth: 2,
                pointRadius: 3,
                borderColor: "#c62828",
              },
              {
                label: "Saldo",
                data: saldos,
                tension: 0.25,
                fill: false,
                borderWidth: 2,
                pointRadius: 3,
                borderColor: "#1565c0",
              },
              {
                label: "Saldo (proj.)",
                data: saldoProj,
                tension: 0.25,
                fill: false,
                borderWidth: 2,
                pointRadius: 3,
                borderColor: "#90caf9",
                borderDash: [6, 4],
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                display: true,
                position: "bottom",
              },
              tooltip: {
                mode: "index",
                intersect: false,
              },
            },
            interaction: {
              mode: "index",
              intersect: false,
            },
            scales: {
              y: {
                beginAtZero: true,
              },
            },
          },
        });
      } catch (e) {
        console.error("Erro ao montar gráfico mensal IA:", e);
        sjMostrarMsgGraficoMensal("Erro ao montar o gráfico mensal.", true);
      }
    })
    .catch(function (err) {
      console.error("Erro ao buscar resumo mensal IA:", err);
      sjMostrarMsgGraficoMensal("Falha ao carregar os dados mensais.", true);
    });
}

document.addEventListener("DOMContentLoaded", function () {
  try {
    carregarGraficoMensalIA();
  } catch (e) {
    console.error("Falha ao inicializar gráfico mensal IA:", e);
  }
});

// ==========================================================
// 💡 Spaço da Jhuséna — Análise Mensal IA (texto)
// ==========================================================

function sjSetIaAnaliseMsg(msg, isErro) {
  var box = document.getElementById("iaAnaliseMensalMsg");
  if (!box) return;
  if (!msg) {
    box.style.display = "none";
    box.textContent = "";
    return;
  }
  box.style.display = "block";
  box.textContent = msg;
  if (isErro) {
    box.classList.remove("text-muted");
    box.classList.add("text-danger");
  } else {
    box.classList.remove("text-danger");
    box.classList.add("text-muted");
  }
}

function carregarAnaliseMensalIA() {
  var elResumo = document.getElementById("iaAnaliseMensalResumo");
  var elDetalhe = document.getElementById("iaAnaliseMensalDetalhe");
  var elRecom = document.getElementById("iaAnaliseMensalRecomendacao");

  if (!elResumo || !elDetalhe || !elRecom) {
    console.warn("⚠ elementos da análise mensal IA não encontrados.");
    return;
  }

  sjSetIaAnaliseMsg("Gerando análise do mês com IA...", false);

  fetch("/financeiro/ia/analise-mensal/preview/")
    .then(function (resp) {
      return resp.json();
    })
    .then(function (data) {
      if (!data || !data.ok) {
        sjSetIaAnaliseMsg("Não foi possível gerar a análise mensal.", true);
        return;
      }

      sjSetIaAnaliseMsg("", false);

      elResumo.textContent = data.resumo || "—";
      elDetalhe.textContent = data.detalhe || "—";
      elRecom.textContent = data.recomendacao || "—";

      var tipo = data.tipo || "neutra";
      elResumo.classList.remove("text-success", "text-warning", "text-danger");
      if (tipo === "positiva") {
        elResumo.classList.add("text-success");
      } else if (tipo === "alerta") {
        elResumo.classList.add("text-danger");
      } else {
        elResumo.classList.add("text-warning");
      }
    })
    .catch(function (err) {
      console.error("Erro ao buscar análise mensal IA:", err);
      sjSetIaAnaliseMsg("Falha ao carregar a análise mensal.", true);
    });
}

document.addEventListener("DOMContentLoaded", function () {
  try {
    carregarAnaliseMensalIA();
  } catch (e) {
    console.error("Falha ao inicializar análise mensal IA:", e);
  }
});

// ==========================================================
// 🏆 Spaço da Jhuséna — Ranking de Categorias (Mensal)
// ==========================================================

function sjSetRankingMsg(msg, isErro) {
  var box = document.getElementById("rankingCategoriasMsg");
  if (!box) return;

  if (!msg) {
    box.style.display = "none";
    box.textContent = "";
    return;
  }

  box.style.display = "block";
  box.textContent = msg;

  if (isErro) {
    box.classList.remove("text-muted");
    box.classList.add("text-danger");
  } else {
    box.classList.remove("text-danger");
    box.classList.add("text-muted");
  }
}

function carregarRankingCategorias() {
  var ul = document.getElementById("rankingCategoriasLista");
  if (!ul) return;

  sjSetRankingMsg("Carregando ranking mensal...", false);

  fetch("/financeiro/metrics/ranking-categorias-mensal/")
    .then(function (resp) {
      return resp.json();
    })
    .then(function (data) {
      if (!data.ok) {
        sjSetRankingMsg("Falha ao carregar ranking.", true);
        return;
      }

      sjSetRankingMsg("", false);
      ul.innerHTML = "";

      var itens = data.categorias || [];
      if (!itens.length) {
        ul.innerHTML =
          "<li class='list-group-item small'>Sem dados neste mês.</li>";
        return;
      }

      itens.forEach(function (item, idx) {
        var li = document.createElement("li");
        li.className =
          "list-group-item d-flex justify-content-between align-items-center";

        li.innerHTML =
          "<span>" +
          (idx + 1) +
          ". " +
          item.categoria +
          "</span>" +
          "<span class='fw-semibold'>R$ " +
          Number(item.total || 0).toFixed(2).replace(".", ",") +
          "</span>";

        ul.appendChild(li);
      });
    })
    .catch(function (err) {
      console.error("Erro ranking categorias:", err);
      sjSetRankingMsg("Erro ao carregar ranking.", true);
    });
}

document.addEventListener("DOMContentLoaded", function () {
  try {
    carregarRankingCategorias();
  } catch (e) {
    console.error("Erro init ranking:", e);
  }
});

// ==========================================================
// 🧼 Spaço da Jhuséna — Ranking de Serviços / Produtos (Mensal)
// ==========================================================

function sjSetRankingServicosMsg(msg, isErro) {
  var box = document.getElementById("rankingServicosMsg");
  if (!box) return;

  if (!msg) {
    box.style.display = "none";
    box.textContent = "";
    return;
  }

  box.style.display = "block";
  box.textContent = msg;

  if (isErro) {
    box.classList.remove("text-muted");
    box.classList.add("text-danger");
  } else {
    box.classList.remove("text-danger");
    box.classList.add("text-muted");
  }
}

function carregarRankingServicos() {
  var ul = document.getElementById("rankingServicosLista");
  if (!ul) return;

  sjSetRankingServicosMsg("Carregando ranking de serviços...", false);

  fetch("/financeiro/metrics/ranking-servicos-mensal/")
    .then(function (resp) {
      return resp.json();
    })
    .then(function (data) {
      if (!data || !data.ok) {
        sjSetRankingServicosMsg("Falha ao carregar ranking de serviços.", true);
        return;
      }

      sjSetRankingServicosMsg("", false);
      ul.innerHTML = "";

      var itens = data.servicos || [];
      if (!itens.length) {
        ul.innerHTML =
          "<li class='list-group-item small'>Sem serviços/produtos registrados neste mês.</li>";
        return;
      }

      itens.forEach(function (item, idx) {
        var li = document.createElement("li");
        li.className =
          "list-group-item d-flex justify-content-between align-items-center";

        li.innerHTML =
          "<span>" +
          (idx + 1) +
          ". " +
          item.nome +
          "</span>" +
          "<span class='fw-semibold'>R$ " +
          Number(item.total || 0).toFixed(2).replace(".", ",") +
          "</span>";

        ul.appendChild(li);
      });
    })
    .catch(function (err) {
      console.error("Erro ranking serviços:", err);
      sjSetRankingServicosMsg("Erro ao carregar ranking de serviços.", true);
    });
}

document.addEventListener("DOMContentLoaded", function () {
  try {
    carregarRankingServicos();
  } catch (e) {
    console.error("Erro init ranking serviços:", e);
  }
});

// ==========================================================
// 📈 Categoria que mais cresceu — Analytics Turbo
// ==========================================================

function carregarCategoriaQueMaisCresceu() {
  fetch("/financeiro/metrics/crescimento-categoria/", {
    headers: { "X-Requested-With": "XMLHttpRequest", Accept: "application/json" },
    credentials: "same-origin",
  })
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(function (data) {
      const msg = document.getElementById("crescimentoCategoriaMsg");
      const titulo = document.getElementById("crescimentoCategoriaTitulo");
      const detalhe = document.getElementById("crescimentoCategoriaDetalhe");

      // segurança
      if (!msg || !titulo || !detalhe) return;

      // ✅ estado vazio (sem comparação suficiente)
      if (!data || data.ok !== true || !data.categoria) {
        msg.style.display = "block";
        msg.textContent = "Ainda não há base suficiente para comparar com o mês anterior.";
        titulo.textContent = "Sem base de comparação";
        detalhe.textContent =
          "Dica: registre movimentações em pelo menos 2 meses para ver a categoria que mais cresceu.";
        return;
      }

      // ✅ estado ok
      msg.style.display = "none";

      const cat = data.categoria;

      const variacaoNum = Number(data.variacao || 0);
      const varPct = isFinite(variacaoNum) ? variacaoNum.toFixed(1).replace(".", ",") : "0,0";

      const anteriorNum = Number(data.anterior || 0);
      const atualNum = Number(data.atual || 0);

      titulo.textContent = cat + " ↑ " + varPct + "%";

      detalhe.textContent =
        "De R$ " +
        (isFinite(anteriorNum) ? anteriorNum.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "0,00") +
        " para R$ " +
        (isFinite(atualNum) ? atualNum.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "0,00") +
        " (" +
        (data.mes_anterior || "mês anterior") +
        " → " +
        (data.mes_atual || "mês atual") +
        ").";
    })
    .catch(function (e) {
      console.error("Erro crescimento categoria:", e);

      const msg = document.getElementById("crescimentoCategoriaMsg");
      const titulo = document.getElementById("crescimentoCategoriaTitulo");
      const detalhe = document.getElementById("crescimentoCategoriaDetalhe");

      if (msg) {
        msg.style.display = "block";
        msg.textContent = "Não foi possível carregar o crescimento agora.";
      }
      if (titulo) titulo.textContent = "Falha ao carregar";
      if (detalhe) detalhe.textContent = "Verifique a rota /financeiro/metrics/crescimento-categoria/.";
    });
}

document.addEventListener("DOMContentLoaded", carregarCategoriaQueMaisCresceu);


// ==========================================================
// 🧩 Despesas Fixas vs Variáveis — Analytics Turbo
// ==========================================================

function sjSetFixasVarMsg(msg, isErro) {
  var box = document.getElementById("fixasVarMsg");
  if (!box) return;

  if (!msg) {
    box.style.display = "none";
    box.textContent = "";
    return;
  }
  box.style.display = "block";
  box.textContent = msg;

  if (isErro) {
    box.classList.remove("text-muted");
    box.classList.add("text-danger");
  } else {
    box.classList.remove("text-danger");
    box.classList.add("text-muted");
  }
}

function carregarDespesasFixasVariaveis() {
  var elFixasValor = document.getElementById("fixasValor");
  var elVarValor = document.getElementById("variaveisValor");
  var elFixasPct = document.getElementById("fixasPct");
  var elVarPct = document.getElementById("variaveisPct");
  var elResumo = document.getElementById("fixasVarResumo");

  if (!elFixasValor || !elVarValor || !elFixasPct || !elVarPct || !elResumo) {
    console.warn("⚠ elementos Fixas vs Variáveis não encontrados.");
    return;
  }

  sjSetFixasVarMsg("Calculando fixas vs variáveis...", false);

  fetch("/financeiro/metrics/despesas-fixas-variaveis/")
    .then(function (resp) {
      return resp.json();
    })
    .then(function (data) {
      if (!data || !data.ok) {
        sjSetFixasVarMsg("Não foi possível carregar fixas vs variáveis.", true);
        return;
      }

      sjSetFixasVarMsg("", false);

      var fixas = data.fixas || 0;
      var variaveis = data.variaveis || 0;
      var pctFixas = data.pct_fixas || 0;
      var pctVar = data.pct_variaveis || 0;

      var fmt = function (v) {
        return "R$ " + Number(v || 0).toFixed(2).replace(".", ",");
      };

      elFixasValor.textContent = fmt(fixas);
      elVarValor.textContent = fmt(variaveis);
      elFixasPct.textContent =
        "(" + Number(pctFixas || 0).toFixed(1).replace(".", ",") + "%)";
      elVarPct.textContent =
        "(" + Number(pctVar || 0).toFixed(1).replace(".", ",") + "%)";

      var resumo;
      if (fixas === 0 && variaveis === 0) {
        resumo = "Sem despesas registradas neste mês.";
      } else if (pctFixas >= 60) {
        resumo =
          "Boa parte das despesas são fixas. Se estiverem sob controle, isso traz previsibilidade para o caixa.";
      } else if (pctVar >= 60) {
        resumo =
          "Despesas variáveis altas. Vale revisar gastos fora do essencial e ajustar o padrão de consumo.";
      } else {
        resumo =
          "Equilíbrio saudável entre fixas e variáveis. Mantenha o controle e monitore mudanças bruscas.";
      }

      elResumo.textContent = resumo;
    })
    .catch(function (err) {
      console.error("Erro fixas vs variáveis:", err);
      sjSetFixasVarMsg("Erro ao carregar fixas vs variáveis.", true);
    });
}

document.addEventListener("DOMContentLoaded", function () {
  try {
    carregarDespesasFixasVariaveis();
  } catch (e) {
    console.error("Falha ao inicializar Fixas vs Variáveis:", e);
  }
});

// ----------------------------------------------
// IA (Nova dica 30d)
// ----------------------------------------------
(function () {
  const btn = document.getElementById("btnGerarDicaFiltro");
  if (!btn) return;

  function getCookie(name) {
    const value = "; " + document.cookie;
    const parts = value.split("; " + name + "=");
    if (parts.length === 2) return parts.pop().split(";").shift();
    return "";
  }

  // toast simples (usa Bootstrap se tiver, senão cai no alert)
  function toast(msg) {
    try {
      const toastEl = document.getElementById("sjToastVenda");
      const bodyEl = document.getElementById("sjToastBody");
      if (toastEl && bodyEl && typeof bootstrap !== "undefined") {
        bodyEl.innerHTML = `<div style="font-weight:800;">${escapeHtml(msg)}</div>`;
        bootstrap.Toast.getOrCreateInstance(toastEl, { delay: 4500 }).show();
        return;
      }
    } catch (_) { }
    alert(msg);
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function safeReadJson(resp) {
    const ct = resp.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      const txt = await resp.text();
      return { __not_json: true, __text: txt };
    }
    try {
      return await resp.json();
    } catch (_) {
      return null;
    }
  }

  btn.addEventListener("click", async () => {
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Gerando dica...";

    try {
      const resp = await fetch("/financeiro/ia/gerar_dica_30d/", {
        method: "POST",
        headers: {
          "X-Requested-With": "XMLHttpRequest",
          "X-CSRFToken": getCookie("csrftoken"),
        },
        credentials: "same-origin",
      });

      const data = await safeReadJson(resp);

      // ✅ DEMO: 403 é comportamento esperado
      if (resp.status === 403) {
        const msg =
          (data && (data.error || data.erro || data.detail || data.message)) ||
          "🧪 Ação desabilitada no MODO DEMO.";
        toast(msg);
        btn.textContent = originalText;
        return;
      }

      // Se não veio JSON, mostra erro claro
      if (data && data.__not_json) {
        console.error("Resposta não JSON:", resp.status, data.__text);
        throw new Error("Resposta inválida do servidor (não é JSON).");
      }

      // Erro HTTP ou ok=false
      if (!resp.ok || (data && data.ok === false)) {
        const msg =
          (data && (data.error || data.erro || data.detail || data.message)) ||
          `Falha ao gerar dica (HTTP ${resp.status}).`;
        throw new Error(msg);
      }

      const dica =
        (data?.salvo && (data.salvo.texto || data.salvo.text)) ||
        data?.dica ||
        "Dica gerada com sucesso!";

      console.log("[IA Nova dica]", dica);

      toast("✅ Dica gerada e salva no histórico!");
      btn.textContent = "Dica gerada!";
      setTimeout(() => {
        btn.textContent = originalText;
      }, 1200);

      // se existir histórico no front, tenta recarregar
      if (globalThis.__HistoricoIA?.recarregar) {
        globalThis.__HistoricoIA.recarregar();
      } else if (globalThis.__HistoricoIA?.reload) {
        globalThis.__HistoricoIA.reload();
      }
    } catch (e) {
      console.error(e);
      toast("❌ " + (e?.message || "Erro ao gerar dica."));
      btn.textContent = "Erro ao gerar";
      setTimeout(() => {
        btn.textContent = originalText;
      }, 1600);
    } finally {
      btn.disabled = false;
    }
  });
})();


(function () {
  "use strict";

  function getCsrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    if (meta && meta.content) return meta.content;
    const m = /(^|;\s*)csrftoken=([^;]+)/.exec(document.cookie);
    return m ? decodeURIComponent(m[2]) : "";
  }

  const btn = document.getElementById("btnCheckEstoqueIA");
  if (!btn) return;

  btn.addEventListener("click", async (ev) => {
    if (!ev.isTrusted) return;

    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Analisando estoque…";

    try {
      const resp = await fetch("/financeiro/ia/estoque-baixo/", {
        method: "POST",
        headers: {
          "X-CSRFToken": getCsrfToken(),
          Accept: "application/json",
        },
        credentials: "same-origin",
      });

      if (!resp.ok) throw new Error("HTTP " + resp.status);
      const json = await resp.json();
      console.log("IA estoque baixo:", json);

      alert(
        json.total_alertas_criados > 0
          ? `Foram gerados ${json.total_alertas_criados} alerta(s) de estoque baixo. Confira no histórico da IA.`
          : "Nenhum produto com estoque baixo no momento. Tudo sob controle! 🎉"
      );

      try {
        globalThis.__HistoricoIA && globalThis.__HistoricoIA.recarregar
          ? globalThis.__HistoricoIA.recarregar()
          : null;
      } catch (e) {
        console.warn("Não consegui recarregar histórico IA:", e);
      }
    } catch (e) {
      console.error("Falha ao chamar IA de estoque:", e);
      alert("Não consegui analisar o estoque agora. Tente novamente em instantes.");
    } finally {
      btn.disabled = false;
      btn.textContent = original;
    }
  });
})();

(function () {
  "use strict";

  const API_URL = "/estoque/api/ranking-critico/?dias=30&limit=5";

  function renderLotesCriticos(json) {
    const box = document.getElementById("lotesCriticosBox");
    const footer = document.getElementById("lotesCriticosFooter");
    const badgeNovo = document.getElementById("badgeNovoLotes");
    if (!box) return;

    const itens = json?.items || json?.itens || json?.results || [];
    const total = json?.total ?? json?.count ?? itens.length;

    // ===== Rearme inteligente do NOVO =====
    const KEY_VISTO = "lotesCriticosVisto";
    const KEY_HASH = "lotesCriticosHash";

    const assinatura = itens
      .filter(it => {
        const dias = Number(it.dias_para_vencer ?? it.dias_restantes ?? it.dias ?? 0);
        const saldo = Number(it.saldo ?? it.saldo_lote ?? 0);
        return dias < 0 && saldo > 0; // só AÇÃO IMEDIATA
      })
      .map(it => [
        it.id ?? it.lote_id ?? it.codigo ?? it.lote ?? "x",
        Number(it.dias_para_vencer ?? it.dias_restantes ?? it.dias ?? 0),
        Number(it.saldo ?? it.saldo_lote ?? 0),
      ].join("|"))
      .sort()
      .join("||");

    const hashAnterior = localStorage.getItem(KEY_HASH);
    const visto = localStorage.getItem(KEY_VISTO) === "1";

    if (assinatura && assinatura !== hashAnterior) {
      localStorage.setItem(KEY_HASH, assinatura);
      localStorage.removeItem(KEY_VISTO); // rearma NOVO
    }

    if (badgeNovo) {
      badgeNovo.style.display = (assinatura && !visto) ? "inline-block" : "none";
    }
    // ===== Fim do NOVO =====

    if (!itens.length) {
      box.innerHTML = "✅ Estoque em dia! Nenhum lote crítico.";
      if (footer) footer.innerHTML = "";
      return;
    }

    const top = itens.slice(0, 3);
    // ===== Impacto financeiro =====
    const impacto = itens.reduce((acc, it) => {
      const dias = Number(it.dias_para_vencer ?? it.dias_restantes ?? it.dias ?? 0);
      const saldo = Number(it.saldo ?? it.saldo_lote ?? 0);
      const preco = Number(it.preco_unit ?? it.preco ?? 0);

      if (dias < 0 && saldo > 0) {
        acc.itens += saldo;
        acc.valor += saldo * preco;
      }
      return acc;
    }, { itens: 0, valor: 0 });

    box.innerHTML = top.map((it) => {
      const nome = it.produto_nome || it.produto || "Produto";
      const saldo = Number(it.saldo ?? 0);
      const dias = Number(it.dias_para_vencer ?? it.dias ?? 0);

      const vencido = dias < 0;
      const critico = vencido && saldo > 0;

      const badge = critico
        ? `<span class="badge bg-danger"
                data-bs-toggle="tooltip"
                data-bs-placement="top"
                title="Lote vencido com saldo em estoque. Ação necessária para evitar prejuízo.">
           AÇÃO IMEDIATA
         </span>`
        : vencido
          ? "<span class='badge bg-danger'>VENCIDO</span>"
          : "<span class='badge bg-warning text-dark'>MONITORAR</span>";

      return `
      <div class="d-flex justify-content-between align-items-center py-2 border-bottom">
        <div>
          <div class="fw-semibold">${nome}</div>
          <div class="small text-muted">Saldo: ${saldo} • ${dias} dia(s)</div>
        </div>
        ${badge}
      </div>
    `;
    }).join("");

    if (footer) {
      footer.innerHTML = impacto.valor > 0
        ? `💸 Risco estimado: <strong style="color: rgba(255,255,255,.95)">R$ ${impacto.valor.toFixed(2)}</strong> 
      <span style="color: rgba(255,255,255,.72)">(${impacto.itens} itens)</span>`
        : `<span style="color: rgba(255,255,255,.72)">Sem impacto financeiro no momento.</span>`;
    }
  }


  async function atualizarLotesCriticos() {
    try {
      const resp = await fetch(API_URL, {
        headers: { "X-Requested-With": "XMLHttpRequest" },
        credentials: "same-origin",
      });

      if (!resp.ok) throw new Error("HTTP " + resp.status);

      const json = await resp.json();
      console.log("[lotes-criticos]", json);

      renderLotesCriticos(json);

    } catch (e) {
      const box = document.getElementById("lotesCriticosBox");
      if (box) box.innerHTML = "⚠️ Erro ao carregar lotes críticos.";
      console.error(e);
    }
  }

  // carregar ao abrir
  document.addEventListener("DOMContentLoaded", atualizarLotesCriticos);

  // botão atualizar
  document
    .getElementById("btnAtualizarLotesCriticos")
    ?.addEventListener("click", () => {
      localStorage.setItem("lotesCriticosVisto", "1");
      atualizarLotesCriticos();
    });
})();




// ===============================
// Resumo Mensal IA (R x D x Saldo)
// canvas: #graficoMensalIA
// msg:    #msgGraficoMensalIA
// endpoint OK: /financeiro/ia/resumo-mensal/series/
// ===============================

(function () {
  let sjChartMensalIA = null;

  function sjShowMsgMensalIA(texto) {
    const el = document.getElementById("msgGraficoMensalIA");
    if (!el) return;
    el.style.display = "block";
    el.textContent = texto || "";
  }

  function sjHideMsgMensalIA() {
    const el = document.getElementById("msgGraficoMensalIA");
    if (!el) return;
    el.style.display = "none";
    el.textContent = "";
  }

  function toNum(v) {
    if (typeof v === "number") return v;
    const n = Number(String(v ?? "").replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }

  function sjMontarGraficoMensalIA(payload) {
    const canvas = document.getElementById("graficoMensalIA");
    if (!canvas) return;
    if (typeof Chart === "undefined") {
      sjShowMsgMensalIA("Chart.js não carregou. Verifique o <script> do Chart.");
      return;
    }

    const series = payload?.series || [];
    if (!Array.isArray(series) || series.length === 0) {
      if (sjChartMensalIA) {
        try { sjChartMensalIA.destroy(); } catch (_e) { }
        sjChartMensalIA = null;
      }
      sjShowMsgMensalIA("Sem dados no período para montar o Resumo Mensal.");
      return;
    }

    // esperamos algo tipo:
    // series: [{ mes: '2026-01', receitas: 123, despesas: 45, saldo: 78, label: 'Jan/2026' }, ...]
    const labels = series.map((s, i) => s.label || s.mes || `Mês ${i + 1}`);
    const receitas = series.map((s) => toNum(s.receitas ?? s.r ?? 0));
    const despesas = series.map((s) => toNum(s.despesas ?? s.d ?? 0));
    // saldo acumulado vindo do backend
    const saldo = series.map(s => toNum(s.saldo ?? 0));

    sjHideMsgMensalIA();

    // destrói anterior
    if (sjChartMensalIA) {
      try { sjChartMensalIA.destroy(); } catch (_e) { }
      sjChartMensalIA = null;
    } else {
      // segurança extra: se existir chart preso no canvas
      try {
        const old = Chart.getChart(canvas);
        old && old.destroy();
      } catch (_e) { }
    }

    sjChartMensalIA = new Chart(canvas, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Receitas",
            data: receitas,
            borderWidth: 1,
          },
          {
            label: "Despesas",
            data: despesas,
            borderWidth: 1,
          },
          {
            label: "Saldo acumulado",
            data: saldo,
            type: "line",
            tension: 0.35,
            borderWidth: 3,
            pointRadius: 6,
            pointHoverRadius: 8,
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
            labels: { color: "#c8e6c9" },
          },
          tooltip: {
            callbacks: {
              label(ctx) {
                const label = ctx.dataset.label;
                const v = ctx.parsed.y;
                return label === "Saldo acumulado"
                  ? `Saldo atual: R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                  : `${label}: R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
              },
            },
          },
        },
        scales: {
          x: { ticks: { color: "#c8e6c9" }, grid: { color: "rgba(255,255,255,0.06)" } },
          y: {
            ticks: { color: "#c8e6c9" },
            grid: { color: "rgba(255,255,255,0.06)" },
          },
        },
      },
    });
  }

  async function sjCarregarResumoMensalIA() {
    const canvas = document.getElementById("graficoMensalIA");
    if (!canvas) return;

    try {
      const resp = await fetch("/financeiro/ia/resumo-mensal/series/", {
        headers: { "X-Requested-With": "XMLHttpRequest", Accept: "application/json" },
        credentials: "same-origin",
      });
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      const data = await resp.json();

      if (!data || data.ok !== true) {
        sjShowMsgMensalIA("Não foi possível carregar o Resumo Mensal (payload inválido).");
        return;
      }
      sjMontarGraficoMensalIA(data);
    } catch (err) {
      console.error("[Resumo Mensal IA]", err);
      sjShowMsgMensalIA("Falha ao carregar o Resumo Mensal. Verifique a API/console.");
    }
  }

  // expõe (se você quiser chamar manualmente)
  window.sjCarregarResumoMensalIA = sjCarregarResumoMensalIA;

  // auto-load quando a página terminar de carregar
  document.addEventListener("DOMContentLoaded", function () {
    sjCarregarResumoMensalIA();
    document.addEventListener("DOMContentLoaded", () => {
      const tooltipTriggerList = [].slice.call(
        document.querySelectorAll('[data-bs-toggle="tooltip"]')
      );
      tooltipTriggerList.forEach((el) => {
        new bootstrap.Tooltip(el);
      });
    })
  });
})();

