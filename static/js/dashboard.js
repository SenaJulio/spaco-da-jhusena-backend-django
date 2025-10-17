document.addEventListener("DOMContentLoaded", function () {
  ("use strict");

  // =============== Utils ===============
  function _toNumber(v) {
    if (typeof v === "number") return Number.isFinite(v) ? v : 0;
    if (typeof v === "string")
      return Number(v.replace(/\./g, "").replace(",", ".")) || 0;
    return 0;
  }

  // Converte valor único em série (se necessário) e ajusta tamanho
  function garantirArray(valor, tamanho) {
    if (Array.isArray(valor)) return valor;
    if (typeof valor === "number" && tamanho > 0) {
      return new Array(tamanho).fill(valor / tamanho);
    }
    return tamanho ? new Array(tamanho).fill(0) : [];
  }

  // Hash simples de séries (evita re-render desnecessário)
  function _hashSerie(dias, r, d, s) {
    return JSON.stringify([dias, r, d, s]);
  }

  // Data local -> 'YYYY-MM-DD' (evita bug de fuso do toISOString)
  function ymdLocal(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, "0");
    const d = String(dateObj.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  // =============== Gráfico de CATEGORIAS (barra) ===============
  function montarGraficoCategorias(categorias, valores) {
    const el = document.getElementById("graficoCategorias");
    if (!el || !window.Chart) return null;

    const major =
      (window.Chart && parseInt((Chart.version || "3").split(".")[0], 10)) || 3;

    const optionsV3 = {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: true } },
    };

    const optionsV2 = {
      responsive: true,
      maintainAspectRatio: false,
      scales: { yAxes: [{ ticks: { beginAtZero: true } }] },
    };

    return new Chart(el, {
      type: "bar",
      data: {
        labels: categorias || [],
        datasets: [
          {
            label: "Média diária por categoria",
            data: (valores || []).map(_toNumber),
            backgroundColor: "rgba(255, 99, 132, 0.5)",
          },
        ],
      },
      options: major >= 3 ? optionsV3 : optionsV2,
    });
  }

  // =============== Gráfico de EVOLUÇÃO (linha) ===============
  window._graficoEvolucao = null;
  window._graficoEvolucaoLastHash = "";

  // Evita recriar várias vezes (anti re-render)
  const _charts = {};

  function _getOrCreateChart(ctx, key, config) {
    if (_charts[key]) {
      _charts[key].data = config.data;
      _charts[key].options = config.options || {};
      _charts[key].update();
      return _charts[key];
    }
    const ch = new Chart(ctx, config);
    _charts[key] = ch;
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
    if (!canvas) return;

    const hasData = Array.isArray(dias) && dias.length > 0;
    empty && (empty.hidden = hasData);
    canvas.style.display = hasData ? "" : "none";
    if (!hasData) return;

    const ctx = canvas.getContext("2d");
    return _getOrCreateChart(ctx, "evolucao", {
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
        interaction: { mode: "index", intersect: false },
        plugins: { legend: { position: "bottom" } },
        parsing: false, // v3/v4-safe
        scales: {
          x: { ticks: { maxRotation: 0, autoSkip: true } },
          y: { beginAtZero: true },
        },
      },
    });
  }

  function montarGraficoCategorias(categorias = [], valores = []) {
    const canvas = document.getElementById("graficoCategorias");
    const empty = document.getElementById("categoriasEmpty");
    if (!canvas) return;

    const hasData = Array.isArray(categorias) && categorias.length > 0;
    empty && (empty.hidden = hasData);
    canvas.style.display = hasData ? "" : "none";
    if (!hasData) return;

    const ctx = canvas.getContext("2d");
    return _getOrCreateChart(ctx, "categorias", {
      type: "doughnut", // troque para "bar" se preferir
      data: {
        labels: categorias,
        datasets: [{ label: "Total", data: valores, borderWidth: 1 }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom" } },
        parsing: false,
      },
    });
  }

  // Atualiza dashboard com objeto { dias, receitas, despesas, saldo }
  function atualizarDashboard(dados) {
    if (!dados) return;
    let L = Array.isArray(dados.dias) ? dados.dias : [];
    let R = garantirArray(dados.receitas, L.length).map(_toNumber);
    let D = garantirArray(dados.despesas, L.length).map(_toNumber);
    let S = garantirArray(dados.saldo, L.length).map(_toNumber);

    const minLen = Math.min(L.length, R.length, D.length, S.length);
    if (!minLen) return; // nada pra renderizar

    L = L.slice(0, minLen);
    R = R.slice(0, minLen);
    D = D.slice(0, minLen);
    S = S.slice(0, minLen);

    if (document.getElementById("graficoEvolucao")) {
      montarGraficoEvolucao(L, R, D, S);
    }
  }

  // =============== Dados iniciais vindos do template ===============
  const data = window.financeiroData || {};

  const categorias = Array.isArray(data.categorias) ? data.categorias : [];
  const valores = Array.isArray(data.valores) ? data.valores : [];

  const dias = Array.isArray(data.dias) ? data.dias : [];
  const receitas = garantirArray(data.receitas, dias.length);
  const despesas = garantirArray(data.despesas, dias.length);
  const saldo = garantirArray(data.saldo, dias.length);

  // Se tudo vazio, buscar dados do mês atual
  if (
    dias.length === 0 &&
    receitas.length === 0 &&
    despesas.length === 0 &&
    saldo.length === 0
  ) {
    const hoje = new Date();
    const inicio = ymdLocal(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
    const fim = ymdLocal(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0));
  }

  const elInicio = document.getElementById("filtroInicio");
  const elFim = document.getElementById("filtroFim");
  const inicio = elInicio?.value || "2025-10-01";
  const fim = elFim?.value || "2025-10-31";

  if (!inicio || !fim) {
    console.warn("⚠️ Faltando datas para gerar o gráfico.");
    return;
  }

 


  // =============== Filtro (fetch) ===============
  const botaoFiltrar = document.getElementById("filtrar-btn");
  if (botaoFiltrar) {
    botaoFiltrar.addEventListener("click", function (event) {
      event.preventDefault();

      const inicio = document.getElementById("data_inicio")?.value || "";
      const fim = document.getElementById("data_fim")?.value || "";

      if (!inicio || !fim) {
        console.warn("Datas inválidas no filtro:", { inicio, fim });
        return;
      }

      console.log("📅 Filtro acionado! Início:", inicio, "Fim:", fim);

      // endpoint alinhado com urls.py
      const base = "/financeiro/dashboard/dados-filtrados/";
      fetch(
        `${base}?inicio=${encodeURIComponent(inicio)}&fim=${encodeURIComponent(
          fim
        )}`,
        {
          headers: { "X-Requested-With": "XMLHttpRequest" },
          credentials: "same-origin",
        }
      )
        .then((response) =>
          response.ok ? response.json() : Promise.reject(response.status)
        )
        .then((respData) => {
          console.log("🚀 Dados recebidos:", respData);
          atualizarDashboard(respData);
        })
        .catch((error) => console.error("❌ Erro na requisição:", error));
    });
  }
});
/* ===== Spaço da Jhuséna – bloco seguro (colar no FINAL do arquivo) ===== */
(function () {
  "use strict";

  // Evita rodar duas vezes se o arquivo for incluído mais de uma vez
  if (window.__sjChartsInit) return;
  window.__sjChartsInit = true;

  // --- Utilidades de data ---
  function pad2(n) { return String(n).padStart(2, "0"); }
  function fmtYMD(d) { return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }
  function firstDayOfMonth(d) { return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-01`; }

  // --- Fetch JSON com erro detalhado ---
  async function sjFetchJSON(url) {
    const r = await fetch(url, {
      headers: { "X-Requested-With": "XMLHttpRequest" },
      credentials: "same-origin",
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      throw new Error(`HTTP ${r.status} @ ${url}: ${txt.slice(0, 200)}`);
    }
    return r.json();
  }

  // --- Cache de instâncias Chart (anti re-render) ---
  const sjCharts = {};
  function getOrCreateChart(ctx, key, config) {
    if (sjCharts[key]) {
      sjCharts[key].data = config.data;
      sjCharts[key].options = config.options || {};
      sjCharts[key].update();
      return sjCharts[key];
    }
    const ch = new Chart(ctx, config);
    sjCharts[key] = ch;
    // garante layout correto após paint
    queueMicrotask(() => ch.resize());
    return ch;
  }

  // --- Funções de montagem: só define se não existir ---
  if (typeof window.montarGraficoEvolucao !== "function") {
    window.montarGraficoEvolucao = function montarGraficoEvolucao(dias = [], receitas = [], despesas = [], saldo = []) {
      const el = document.getElementById("graficoEvolucao");
      const empty = document.getElementById("evolucaoEmpty");
      if (!el) return;

      const hasData = Array.isArray(dias) && dias.length > 0;
      if (!hasData) {
        if (empty) empty.hidden = false;
        el.style.display = "none";
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
            { label: "Receitas", data: receitas, borderWidth: 2, fill: false, tension: 0.2 },
            { label: "Despesas", data: despesas, borderWidth: 2, fill: false, tension: 0.2 },
            { label: "Saldo",    data: saldo,    borderWidth: 2, fill: false, tension: 0.2 },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          parsing: false, // compat Chart.js v3/v4
          interaction: { mode: "index", intersect: false },
          plugins: { legend: { position: "bottom" } },
          scales: { x: { ticks: { maxRotation: 0, autoSkip: true } }, y: { beginAtZero: true } }
        }
      });
    };
  }

  if (typeof window.montarGraficoCategorias !== "function") {
    window.montarGraficoCategorias = function montarGraficoCategorias(categorias = [], valores = []) {
      const el = document.getElementById("graficoCategorias");
      const empty = document.getElementById("categoriasEmpty");
      if (!el) return;

      const hasData = Array.isArray(categorias) && categorias.length > 0;
      if (!hasData) {
        if (empty) empty.hidden = false;
        el.style.display = "none";
        return;
      }
      if (empty) empty.hidden = true;
      el.style.display = "";

      const ctx = el.getContext("2d");
      return getOrCreateChart(ctx, "sj-categorias", {
        type: "doughnut", // mude para "bar" se preferir
        data: { labels: categorias, datasets: [{ label: "Total", data: valores, borderWidth: 1 }] },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          parsing: false,
          plugins: { legend: { position: "bottom" } },
        }
      });
    };
  }

  // --- Inicialização: resolve datas, busca e desenha ---
  document.addEventListener("DOMContentLoaded", async function () {
    // Ajuste os seletores se seus inputs tiverem outros IDs
    const $ini = document.querySelector("#filtroInicio");
    const $fim = document.querySelector("#filtroFim");

    const hoje = new Date();
    const iniDefault = firstDayOfMonth(hoje);
    const fimDefault = fmtYMD(hoje);

    // Preenche se inputs existem e estão vazios
    if ($ini && !$ini.value) $ini.value = iniDefault;
    if ($fim && !$fim.value) $fim.value = fimDefault;

    // Usa valores dos inputs, ou padrões
    let inicio = ($ini && $ini.value) ? $ini.value : iniDefault;
    let fim    = ($fim && $fim.value) ? $fim.value : fimDefault;

    async function recarregar() {
      try {
        const url = `/financeiro/dashboard/dados-filtrados/?inicio=${encodeURIComponent(inicio)}&fim=${encodeURIComponent(fim)}`;
        const dados = await sjFetchJSON(url);

        if (!dados || !Array.isArray(dados.dias)) {
          throw new Error("Payload inválido: esperado {dias, receitas, despesas, saldo}");
        }

        // Evolução
        window.montarGraficoEvolucao(dados.dias, dados.receitas, dados.despesas, dados.saldo);

        // Categorias (só se vier no mesmo endpoint; senão, faça outro fetch)
        if (Array.isArray(dados.categorias) && Array.isArray(dados.valores)) {
          window.montarGraficoCategorias(dados.categorias, dados.valores);
        } else {
          const catCanvas = document.getElementById("graficoCategorias");
          const catEmpty = document.getElementById("categoriasEmpty");
          if (catEmpty) catEmpty.hidden = false;
          if (catCanvas) catCanvas.style.display = "none";
        }

        

      } catch (err) {
        console.error("❌ Erro ao carregar/desenhar gráficos:", err);
        alert("Erro ao carregar os gráficos. Veja o console para detalhes.");
      }
    }

    // Primeira renderização
    await recarregar();

    // Reagir às mudanças de data (se os inputs existirem)
    [$ini, $fim].forEach((el) => {
      if (!el) return;
      el.addEventListener("change", () => {
        inicio = ($ini && $ini.value) ? $ini.value : iniDefault;
        fim    = ($fim && $fim.value) ? $fim.value : fimDefault;
        recarregar();
      });
    });
  });
})();
/* ===== FIM do bloco seguro ===== */
// static/js/dashboard.js
(function () {
  const elLin = document.getElementById("graficoEvolucao");
  const elPie = document.getElementById("graficoCategorias");
  const msgLin = document.getElementById("evolucaoEmpty");
  const msgPie = document.getElementById("categoriasEmpty");

  const elInicio = document.getElementById("filtroInicio");
  const elFim = document.getElementById("filtroFim");
  const btnAplicar = document.getElementById("btnAplicarFiltros");

  function mountChart(ctx, type, data, options) {
    const canvas = ctx.canvas;
    // destrói qualquer instância pendurada nesse canvas
    const old = Chart.getChart(canvas);
    if (old) old.destroy();
    if (canvas.__chart) {
      try {
        canvas.__chart.destroy();
      } catch {}
    }

    const chart = new Chart(canvas, { type, data, options });
    canvas.__chart = chart; // marca no próprio canvas
  }


  async function fetchJSON(url) {
    const r = await fetch(url, {
      headers: { "X-Requested-With": "XMLHttpRequest", Accept: "application/json" },
      credentials: "same-origin",
    });
    if (!r.ok) throw new Error(`HTTP ${r.status} @ ${url}`);
    return r.json();
  }

  async function loadEvolucao() {
    // garante que não exista gráfico pendurado nesse canvas
    const _old = Chart.getChart("graficoEvolucao");
    if (_old) _old.destroy();
    const base = window.URL_DADOS_GRAFICO || "/financeiro/dados_grafico_filtrados/";
    const qs = new URLSearchParams();
    if (elInicio?.value) qs.set("inicio", elInicio.value);
    if (elFim?.value) qs.set("fim", elFim.value);

    const url = qs.toString() ? `${base}?${qs}` : base;
    const d = await fetchJSON(url);

    const dias = d?.dias ?? [];
    const receitas = d?.receitas ?? [];
    const despesas = d?.despesas ?? [];
    const saldo = d?.saldo ?? [];

    if (!dias.length) {
      if (msgLin) msgLin.hidden = false;
      if (elLin?.getContext) {
        const ctx = elLin.getContext("2d");
        if (ctx?.__chart) ctx.__chart.destroy();
      }
      return;
    }
    if (msgLin) msgLin.hidden = true;

    mountChart(
      elLin.getContext("2d"),
      "line",
      {
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
            label: "Saldo acumulado",
            data: saldo,
            borderWidth: 2,
            fill: false,
            tension: 0.2,
          },
        ],
      },
      {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom" } },
        scales: { y: { beginAtZero: true } },
      }
    );
  }

  async function loadCategorias() {
    const urlCat = window.URL_CATEGORIAS; // defina no template quando tiver o endpoint real
    if (!urlCat) {
      // Sem endpoint real ainda — mostra placeholder
      if (msgPie) msgPie.hidden = false;
      const ctx = elPie?.getContext && elPie.getContext("2d");
      if (ctx?.__chart) ctx.__chart.destroy();
      return;
    }

    const d = await fetchJSON(urlCat);
    const labels = d?.labels ?? [];
    const valores = d?.valores ?? [];

    if (!labels.length || !valores.some((x) => x > 0)) {
      if (msgPie) msgPie.hidden = false;
      const ctx = elPie?.getContext && elPie.getContext("2d");
      if (ctx?.__chart) ctx.__chart.destroy();
      return;
    }
    if (msgPie) msgPie.hidden = true;

    mountChart(elPie.getContext("2d"), "doughnut", {
      labels,
      datasets: [{ label: "Despesas", data: valores }],
    }, {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom" } },
    });
  }

  async function loadCharts() {
    try {
      await loadEvolucao();
    } catch (e) {
      console.error("Erro no gráfico de evolução:", e);
      if (msgLin) msgLin.hidden = false;
    }

    try {
      await loadCategorias();
    } catch (e) {
      console.error("Erro no gráfico de categorias:", e);
      if (msgPie) msgPie.hidden = false;
    }
  }

  document.addEventListener("DOMContentLoaded", loadCharts);
  btnAplicar?.addEventListener("click", (ev) => {
    ev.preventDefault();
    loadCharts();
  });
})();
