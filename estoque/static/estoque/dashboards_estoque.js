/* global Chart */
console.log("🚀 dashboard_estoque.js EXECUTANDO");

document.addEventListener("DOMContentLoaded", function () {
  console.log("📦 DOM pronto");

  const c1 = document.getElementById("chartTopProdutos");
  const c2 = document.getElementById("chartEntradasSaidas");

  if (!c1 || !c2) {
    console.error("❌ Canvas não encontrados");
    return;
  }

  if (typeof Chart === "undefined") {
    console.error("❌ Chart NÃO está definido");
    return;
  }

  const labelsProdutos = JSON.parse(
    document.getElementById("sj_labels_produtos").textContent
  );
  const dadosSaldo = JSON.parse(
    document.getElementById("sj_dados_saldo").textContent
  );
  const dadosVendidos = JSON.parse(
    document.getElementById("sj_dados_vendidos").textContent
  );

  const labelsMeses = JSON.parse(
    document.getElementById("sj_labels_meses").textContent
  );
  const dadosEntradas = JSON.parse(
    document.getElementById("sj_dados_entradas").textContent
  );
  const dadosSaidas = JSON.parse(
    document.getElementById("sj_dados_saidas").textContent
  );

  console.log("✅ Dados carregados", {
    produtos: labelsProdutos.length,
    meses: labelsMeses.length,
  });

  // DESTROI QUALQUER RESÍDUO
  Chart.getChart(c1)?.destroy();
  Chart.getChart(c2)?.destroy();

  // === GRÁFICO 1 ===
  new Chart(c1, {
    type: "bar",
    data: {
      labels: labelsProdutos,
      datasets: [
        { label: "Saldo atual", data: dadosSaldo },
        { label: "Quantidade vendida", data: dadosVendidos },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: true } },
    },
  });

  // === GRÁFICO 2 ===
  new Chart(c2, {
    type: "line",
    data: {
      labels: labelsMeses,
      datasets: [
        { label: "Entradas", data: dadosEntradas, tension: 0.3 },
        { label: "Saídas", data: dadosSaidas, tension: 0.3 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: true } },
    },
  });

  console.log("🎯 GRÁFICOS CRIADOS COM SUCESSO");
});
