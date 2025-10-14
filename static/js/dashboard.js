document.addEventListener("DOMContentLoaded", function () {
  // ==== Utils ====
  function _toNumber(v) {
    if (typeof v === "number") return Number.isFinite(v) ? v : 0;
    if (typeof v === "string")
      return Number(v.replace(/\./g, "").replace(",", ".")) || 0;
    return 0;
  }

  // Converte valor único em série, se necessário
  function garantirArray(valor, tamanho) {
    if (Array.isArray(valor)) return valor;
    if (typeof valor === "number" && tamanho > 0) {
      return new Array(tamanho).fill(valor / tamanho);
    }
    return [];
  }

  // Hash simples de séries (evita re-render desnecessário)
  function _hashSerie(dias, r, d, s) {
    return JSON.stringify([dias, r, d, s]);
  }

  // ==== Gráfico de CATEGORIAS (barra) ====
  function montarGraficoCategorias(categorias, valores) {
    const el = document.getElementById("graficoCategorias");
    if (!el) return null;

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

  // ==== Gráfico de EVOLUÇÃO (linha) ====
  window._graficoEvolucao = null;
  window._graficoEvolucaoLastHash = "";

  function montarGraficoEvolucao(dias, receitas, despesas, saldo) {
    const canvas = document.getElementById("graficoEvolucao");
    if (!canvas) {
      console.warn("[grafico] #graficoEvolucao não encontrado");
      return null;
    }

    // Altura visível mínima
    if (!canvas.style.height) canvas.style.height = "280px";

    // Normalização + alinhamento dos arrays
    let L = Array.isArray(dias) ? dias : [];
    let R = (Array.isArray(receitas) ? receitas : []).map(_toNumber);
    let D = (Array.isArray(despesas) ? despesas : []).map(_toNumber);
    let S = (Array.isArray(saldo) ? saldo : []).map(_toNumber);

    const minLen = Math.min(L.length, R.length, D.length, S.length);
    if (!minLen) {
      // fallback visual
      L = ["01", "02", "03"];
      R = [70, 0, 0];
      D = [30, 0, 0];
      S = [40, 0, 0];
    } else {
      L = L.slice(0, minLen);
      R = R.slice(0, minLen);
      D = D.slice(0, minLen);
      S = S.slice(0, minLen);
    }

    const newHash = _hashSerie(L, R, D, S);
    if (
      window._graficoEvolucao &&
      window._graficoEvolucaoLastHash === newHash
    ) {
      return window._graficoEvolucao; // nada mudou
    }
    window._graficoEvolucaoLastHash = newHash;

    // Atualiza instância existente
    if (window._graficoEvolucao) {
      const ch = window._graficoEvolucao;
      ch.data.labels = L;
      ch.data.datasets[0].data = R;
      ch.data.datasets[1].data = D;
      ch.data.datasets[2].data = S;
      ch.update("none"); // sem animação
      return ch;
    }

    const major =
      (window.Chart && parseInt((Chart.version || "0").split(".")[0], 10)) || 3;
    const ctx = canvas.getContext("2d");

    const data = {
      labels: L,
      datasets: [
        {
          label: "Receitas",
          data: R,
          borderColor: "green",
          fill: false,
          tension: 0.3,
          borderWidth: 2,
          pointRadius: 2,
          spanGaps: true,
        },
        {
          label: "Despesas",
          data: D,
          borderColor: "red",
          fill: false,
          tension: 0.3,
          borderWidth: 2,
          pointRadius: 2,
          spanGaps: true,
        },
        {
          label: "Saldo Acumulado",
          data: S,
          borderColor: "blue",
          fill: false,
          tension: 0.3,
          borderWidth: 2,
          pointRadius: 2,
          spanGaps: true,
        },
      ],
    };

    const optionsV3 = {
      responsive: true,
      maintainAspectRatio: false,
      parsing: false,
      normalized: true,
      animation: false,
      plugins: {
        legend: { position: "top" },
        title: { display: true, text: "Evolução Financeira do Mês 🐾" },
      },
      scales: { y: { beginAtZero: true } },
    };

    const optionsV2 = {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 0 },
      title: { display: true, text: "Evolução Financeira do Mês 🐾" },
      legend: { position: "top" },
      scales: { yAxes: [{ ticks: { beginAtZero: true } }], xAxes: [{}] },
    };

    window._graficoEvolucao = new Chart(ctx, {
      type: "line",
      data,
      options: major >= 3 ? optionsV3 : optionsV2,
    });

    return window._graficoEvolucao;
  }

  // Atualiza dashboard com objeto { dias, receitas, despesas, saldo }
  function atualizarDashboard(dados) {
    if (!dados) return;
    let L = Array.isArray(dados.dias) ? dados.dias : [];
    let R = garantirArray(dados.receitas, L.length).map(_toNumber);
    let D = garantirArray(dados.despesas, L.length).map(_toNumber);
    let S = garantirArray(dados.saldo, L.length).map(_toNumber);
    const minLen = Math.min(L.length, R.length, D.length, S.length);
    L = L.slice(0, minLen);
    R = R.slice(0, minLen);
    D = D.slice(0, minLen);
    S = S.slice(0, minLen);
    montarGraficoEvolucao(L, R, D, S);
  }

  // ==== Dados iniciais vindos do template ====
  const data = window.financeiroData || {};

  const categorias = Array.isArray(data.categorias) ? data.categorias : [];
  const valores = Array.isArray(data.valores) ? data.valores : [];

  const dias = Array.isArray(data.dias) ? data.dias : [];
  const receitas = garantirArray(data.receitas, dias.length);
  const despesas = garantirArray(data.despesas, dias.length);
  const saldo = garantirArray(data.saldo, dias.length);

  // Se tudo veio vazio, buscar no endpoint de dados filtrados do mês atual
  if (
    dias.length === 0 &&
    receitas.length === 0 &&
    despesas.length === 0 &&
    saldo.length === 0
  ) {
    const hoje = new Date();
    const y = hoje.getFullYear();
    const m = hoje.getMonth(); // 0-11
    const inicio = new Date(y, m, 1).toISOString().slice(0, 10);
    const fim = new Date(y, m + 1, 0).toISOString().slice(0, 10);

    fetch(
      `/financeiro/dashboard/dados-filtrados/?inicio=${inicio}&fim=${fim}`,
      {
        headers: { "X-Requested-With": "XMLHttpRequest" },
        credentials: "same-origin",
      }
    )
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((dados) => {
        // usa sua função já definida
        atualizarDashboard(dados);
      })
      .catch((err) => console.error("fallback gráfico falhou:", err));
  }

  // Render inicial
  if (document.getElementById("graficoCategorias")) {
    montarGraficoCategorias(categorias, valores);
  }
  montarGraficoEvolucao(dias, receitas, despesas, saldo);

  console.log(
    "[debug gráfico] dias/rec/dep/saldo lens =",
    dias.length,
    receitas.length,
    despesas.length,
    saldo.length
  );

  // ==== Filtro (fetch) ====
  const botaoFiltrar = document.getElementById("filtrar-btn");
  if (botaoFiltrar) {
    botaoFiltrar.addEventListener("click", function (event) {
      event.preventDefault();

      const inicio = document.getElementById("data_inicio").value;
      const fim = document.getElementById("data_fim").value;

      console.log("📅 Filtro acionado! Início:", inicio, "Fim:", fim);


      const base =
        window.URL_DADOS_GRAFICO || "/financeiro/dados_grafico_filtrados/";
      fetch(`${base}?inicio=${inicio}&fim=${fim}`)
      
        .then((response) => response.json())
        .then((respData) => {
          console.log("🚀 Dados recebidos:", respData);
          atualizarDashboard(respData);
        })
        .catch((error) => console.error("❌ Erro na requisição:", error));
    });
  }
});
