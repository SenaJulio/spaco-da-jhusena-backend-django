/* eslint-disable no-unused-vars */
/* ==========================================================================
 * Spaço da Jhuséna — dashboard.js (versão estável, ES5)
 * Data: 2025-11-06
 * ==========================================================================*/
/* global Chart */

(function () {
  ("use strict");

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
      console.warn("Falha ao registrar elementos Chart.js:", _eReg);
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
  // EXPÕE NO GLOBAL:
  // (cole exatamente isso no lugar da sua função atual)
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
        Chart.getChart(canvas)?.destroy();
      } catch {/* */}
      return;
    }
    if (empty) empty.hidden = true;

    const toNum = (v) => {
      if (typeof v === "number") return v;
      const n = Number(
        String(v ?? "")
          .replace(/\./g, "")
          .replace(",", ".")
      );
      return isFinite(n) ? n : 0;
    };

    const R = (receitas || []).map(toNum);
    const D = (despesas || []).map(toNum);
    const L = dias.length;
    let S = [];

    if (Array.isArray(saldo) && saldo.length === L) {
      S = saldo.map(toNum);
    } else {
      let acc = 0;
      for (let i = 0; i < L; i++) {
        acc += (R[i] || 0) - (D[i] || 0);
        S.push(acc);
      }
    }

    // destrói gráfico anterior
    try {
      Chart.getChart(canvas)?.destroy();
    } catch {
      /* */
    }

    // cria novo gráfico
    new Chart(canvas, {
      type: "line",
      data: {
        labels: dias,
        datasets: [
          {
            label: "Receitas",
            data: R,
            borderColor: "#2e7d32",
            backgroundColor: "rgba(46,125,50,0.15)",
            borderWidth: 3,
            tension: 0.3,
            pointRadius: 3,
            pointBackgroundColor: "#2e7d32",
            fill: false,
          },
          {
            label: "Despesas",
            data: D,
            borderColor: "#d32f2f",
            backgroundColor: "rgba(211,47,47,0.15)",
            borderWidth: 3,
            tension: 0.3,
            pointRadius: 3,
            pointBackgroundColor: "#d32f2f",
            fill: false,
          },
          {
            label: "Saldo",
            data: S,
            borderColor: "#f9a825",
            backgroundColor: "rgba(249,168,37,0.15)",
            borderWidth: 3,
            tension: 0.3,
            pointRadius: 3,
            pointBackgroundColor: "#f9a825",
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
                const v = Number(ctx.parsed.y || 0);
                return `${ctx.dataset.label}: R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
              },
            },
          },
        },
        elements: {
          line: { borderWidth: 3, fill: false },
          point: { radius: 3 },
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
      },
    });
  };

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

  // --------- Atualiza card resumo (reutilizável)
  function __updateCardResumo(origem) {
    var box = document.getElementById("cardResumoMes");
    if (!box || !origem) return;

    var brl = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
    var toNum = function (v) {
      return Number(v || 0);
    };

    box.classList.remove(
      "d-none",
      "alert-info",
      "alert-success",
      "alert-danger"
    );
    var cls = "alert-info";
    if (toNum(origem.saldo) > 0) cls = "alert-success";
    if (toNum(origem.saldo) < 0) cls = "alert-danger";
    box.classList.add(cls);

    var titulo = origem.mes_label
      ? "📅 " + origem.mes_label
      : "📅 " + (origem.label || "");
    box.innerHTML = [
      "<strong>",
      titulo,
      "</strong><br>",
      "Receitas: ",
      brl.format(toNum(origem.total_receitas)),
      " | ",
      "Despesas: ",
      brl.format(toNum(origem.total_despesas)),
      " | ",
      "Saldo: ",
      brl.format(toNum(origem.saldo)),
    ].join("");

    __sjApplyMoodFromSaldo(Number(origem.saldo || 0));
  }

  // ================== HUMOR DA IA (Badge + Tom dos KPIs) ==================
  function __sjApplyMoodFromSaldo(saldo) {
    var tipo = saldo > 0 ? "positiva" : saldo < 0 ? "alerta" : "neutra";

    // Badge dinâmica
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

    // Bordas dos KPIs
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
      console.log("[recarregar] GET", url);

      var r = await fetch(url, {
        headers: { Accept: "application/json" },
        credentials: "same-origin",
      });
      if (!r.ok) throw new Error("HTTP_" + r.status);
      var j = await r.json();
      console.log("[recarregar] payload", j);
      console.log("🍕 categorias/valores:", j.categorias, j.valores);

      // --------- resumo (src) + mood + card + KPIs ---------
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

      __sjApplyMoodFromSaldo(Number(src.saldo || 0));
      __updateCardResumo(src);

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

      // Margem (preferir mês corrente se houver) — com UX para 100% (saldo total)
      (function () {
        var elM = document.getElementById("a30_margem");
        if (!elM) return;

        var baseRef = j.resumo_mes_corrente || src;
        var rTot = Number(baseRef.total_receitas || 0);
        var sTot = Number(baseRef.saldo || 0);

        if (rTot > 0) {
          var pct = (sTot / rTot) * 100;
          // Se saldo == receitas (sem despesas), mostrar “100 % (saldo total)”
          if (pct >= 99.9) {
            elM.textContent = "100 % (saldo total)";
          } else {
            elM.textContent =
              pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " %";
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
          .then(function (r) {
            return r.json();
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
                var pct = ((curr - prevVal) / prevVal) * 100;
                return {
                  text: (pct >= 0 ? "+" : "") + pct.toFixed(1) + " %",
                  sign: Math.sign(pct),
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

      // ----- gráfico de linhas (normalizado em Reais) -----
      var dias = Array.isArray(j.dias) ? j.dias : [];

      // normaliza array numérico vindo do backend (corrige centavos)
      function __sjNormArray(arr) {
        if (!Array.isArray(arr)) return [];
        var out = [];
        for (var i = 0; i < arr.length; i++) {
          var v = arr[i];
          // parse seguro
          var n =
            typeof v === "number" && isFinite(v)
              ? v
              : Number(
                  String(v || "0")
                    .replace(/\./g, "")
                    .replace(",", ".")
                );
          if (!isFinite(n)) n = 0;

          // Heurística de centavos:
          // se é inteiro e grande (>= 1000), assume que veio em centavos e divide por 100
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

      // se o backend já mandar saldo diário, normaliza; senão calcula acumulado (R-D)
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

      // ----- gráfico de pizza -----
      if (cvCat) {
        var hasCats =
          Array.isArray(j.categorias) &&
          Array.isArray(j.valores) &&
          j.categorias.length > 0;
        if (hasCats) {
          cvCat.style.display = "";
          if (elCatEmpty) elCatEmpty.hidden = true;
          montarGraficoCategorias(j.categorias, j.valores);
        } else {
          if (elCatEmpty) {
            elCatEmpty.hidden = false;
            elCatEmpty.textContent = "Sem categorias neste período.";
          }
          cvCat.style.display = "none";
          try {
            Chart.getChart(cvCat) && Chart.getChart(cvCat).destroy();
          } catch (_e2) {
            /* */
          }
        }
      }

      var ch = Chart.getChart(document.getElementById("graficoEvolucao"));
      console.log(
        "✅ linhas ok | pontos:",
        R.length,
        D.length,
        S.length,
        "| y-range:",
        ch && ch.scales.y.min,
        ch && ch.scales.y.max
      );
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

  // expõe para o console (mantém seu atalho)
  window.__SJ_DASH_DEV__ = Object.assign(window.__SJ_DASH_DEV__ || {}, {
    reload: recarregar,
    evol: window.montarGraficoEvolucao,
    cat: montarGraficoCategorias,
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

    // eventos de filtro — sincroniza card + gráficos automaticamente
    var fireReload = debounce(function () {
      console.log("⚙️ Filtros alterados — recarregando dashboard completo...");
      recarregar();
    }, 300);

    ["#filtroInicio", "#filtroFim", "#filtroCategoria"].forEach(function (sel) {
      var el = document.querySelector(sel);
      if (!el) return;
      el.addEventListener("change", fireReload);
      el.addEventListener("input", fireReload);
    });

    // botão aplicar
    var btn =
      document.getElementById("btnAplicarFiltros") ||
      document.getElementById("filtrar-btn");
    if (btn && btn.parentNode) {
      var fresh = btn.cloneNode(true);
      btn.parentNode.replaceChild(fresh, btn);
      fresh.addEventListener("click", function (ev) {
        ev.preventDefault();
        recarregar();
      });
    }

    // primeira carga
    recarregar();
  });

  // === IA Avançada: Análise 30D ===
  (function () {
    "use strict";

    var byId = function (id) {
      return document.getElementById(id);
    };
    var fmtBRL = function (v) {
      return (Number(v) || 0).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });
    };
    var fmtPct = function (v) {
      return (Number(v) || 0).toLocaleString("pt-BR") + " %";
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

  document
    .getElementById("btnGerarDica")
    ?.addEventListener("click", async () => {
      try {
        // função auxiliar para pegar o token CSRF
        async function getCsrfToken() {
          const meta = document.querySelector('meta[name="csrf-token"]');
          if (meta) return meta.content;
          const match = document.cookie.match(/(^|;)\s*csrftoken=([^;]+)/);
          return match ? decodeURIComponent(match[2]) : "";
        }

        // faz o POST para gerar a análise 30d com o token CSRF correto
        const r = await fetch("/financeiro/ia/analise/gerar/", {
          method: "POST",
          headers: {
            "X-CSRFToken": await getCsrfToken(),
            "X-Requested-With": "XMLHttpRequest",
          },
          credentials: "same-origin",
        });

        if (!r.ok) {
          const text = await r.text();
          console.error("⚠️ Erro ao gerar análise:", r.status, text);
          throw new Error(`HTTP ${r.status}`);
        }

        const j = await r.json();
        if (!j.ok) throw new Error("Falha ao salvar dica");
        console.log("💾 Dica salva:", j.salvo);

        // recarregar o histórico atual mantendo o filtro escolhido
        if (window.carregarHistorico) {
          await window.carregarHistorico(
            20,
            window.__FILTRO_HISTORICO_ATUAL || "todas",
            false
          );
        }

        // opcional: toast ou feedback visual
        // showToast("✅ Dica gerada e salva no histórico!");
      } catch (e) {
        console.error("💥 Erro no processo de geração da dica:", e);
        // showToast("❌ Erro ao gerar dica");
      }
    });
})();
