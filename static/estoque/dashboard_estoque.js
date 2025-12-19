/* global Chart */
console.log("✅ dashboard_estoque.js carregou");

(function () {
  function byId(id) {
    return document.getElementById(id);
  }

  // pega dados do bloco window.SJ_ESTOQUE (ou adapte se você usa json_script)
  function getData() {
    if (window.SJ_ESTOQUE) return window.SJ_ESTOQUE;

    // fallback: tenta ler json_script se você estiver usando
    function readJSON(id) {
      const el = byId(id);
      if (!el) return null;
      try {
        return JSON.parse(el.textContent);
      } catch {
        return null;
      }
    }
    return {
      labelsProdutos: readJSON("sj_labels_produtos") || [],
      dadosSaldo: readJSON("sj_dados_saldo") || [],
      dadosVendidos: readJSON("sj_dados_vendidos") || [],
      labelsMeses: readJSON("sj_labels_meses") || [],
      dadosEntradas: readJSON("sj_dados_entradas") || [],
      dadosSaidas: readJSON("sj_dados_saidas") || [],
    };
  }

  function destroyIfExists(canvas) {
    const old = Chart.getChart(canvas);
    if (old) old.destroy();
  }

  function boot() {
    const c1 = byId("chartTopProdutos");
    const c2 = byId("chartEntradasSaidas");

    if (!c1 || !c2) return console.warn("❌ canvas não encontrado");
    if (typeof Chart === "undefined")
      return console.warn("❌ Chart.js não carregou");

    const d = getData();

    console.log("📦 dados estoque:", {
      produtos: (d.labelsProdutos || []).length,
      meses: (d.labelsMeses || []).length,
    });

    destroyIfExists(c1);
    destroyIfExists(c2);

    new Chart(c1.getContext("2d"), {
      type: "bar",
      data: {
        labels: d.labelsProdutos || [],
        datasets: [
          { label: "Saldo atual", data: d.dadosSaldo || [] },
          { label: "Quantidade vendida", data: d.dadosVendidos || [] },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "top" } },
        scales: { y: { beginAtZero: true } },
      },
    });

    new Chart(c2.getContext("2d"), {
      type: "line",
      data: {
        labels: d.labelsMeses || [],
        datasets: [
          { label: "Entradas", data: d.dadosEntradas || [], tension: 0.35 },
          { label: "Saídas", data: d.dadosSaidas || [], tension: 0.35 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "top" } },
        scales: { y: { beginAtZero: true } },
      },
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
