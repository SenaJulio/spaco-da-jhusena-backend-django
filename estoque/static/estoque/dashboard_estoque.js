/* global Chart */



function readJsonScript(id, fallback = []) {
  const el = document.getElementById(id);
  if (!el) return fallback;
  try {
    return JSON.parse(el.textContent);
  } catch (e) {
    console.error("Erro ao ler JSON:", id, e);
    return fallback;
  }
}

function aggregateByLabel(labels, seriesList) {
  const map = new Map();

  labels.forEach((rawLabel, idx) => {
    const label = String(rawLabel || "")
      .normalize("NFKC")
      .trim()
      .toLowerCase();

    if (!map.has(label)) {
      map.set(
        label,
        seriesList.map(() => 0)
      );
    }

    const acc = map.get(label);
    seriesList.forEach((arr, s) => {
      const v = Number(arr?.[idx] ?? 0);
      acc[s] += Number.isFinite(v) ? v : 0;
    });
  });

  const outLabels = [];
  const outSeries = seriesList.map(() => []);

  for (const [label, sums] of map.entries()) {
    outLabels.push(label);
    sums.forEach((v, i) => outSeries[i].push(v));
  }

  return { labels: outLabels, series: outSeries };
}

function buildInsights(labels, saldoArr, vendidosArr) {
  const items = labels.map((nome, i) => ({
    nome,
    saldo: Number(saldoArr[i] || 0),
    vendidos: Number(vendidosArr[i] || 0), // desde sempre
  }));

  const insights = [];

  // 0) Se tem alerta de vencido na página, grita primeiro
  const alertText =
    document.querySelector(".sj-alerts")?.innerText?.toLowerCase() || "";
  if (alertText.includes("vencido")) {
    insights.push(
      "🚨 Existem lotes VENCIDOS com saldo. Prioridade máxima: tratar/baixar/descartar conforme regra."
    );
  }

  // 1) Encontrar campeões de venda (histórico) e risco de faltar (saldo baixo)
  const topVendidos = [...items].sort((a, b) => b.vendidos - a.vendidos);
  const maxVendidos = topVendidos[0]?.vendidos || 0;

  // define "campeão" como >= 60% do top
  const campeoes = items.filter(
    (x) => maxVendidos > 0 && x.vendidos >= maxVendidos * 0.6
  );

  // risco de falta: saldo <= 5 (ajuste se quiser)
  campeoes
    .filter((x) => x.saldo <= 5 && x.vendidos > 0)
    .sort((a, b) => a.saldo - b.saldo)
    .slice(0, 3)
    .forEach((p) => {
      insights.push(
        `🚨 Repor AGORA: ${p.nome} (saldo ${p.saldo}) — produto com alto histórico de vendas (${p.vendidos}).`
      );
    });

  // 2) Produtos parados: saldo alto e vendidos muito baixos
  items
    .filter((x) => x.saldo >= 10 && x.vendidos <= 2)
    .sort((a, b) => b.saldo - a.saldo)
    .slice(0, 3)
    .forEach((p) => {
      insights.push(
        `⚠️ ${p.nome}: PARADO (saldo ${p.saldo}, vendidos ${p.vendidos}). Sugestão: promoção/kit/baixar compra.`
      );
    });

  // 3) Produtos com bom giro (histórico) — só se não tiver alerta de reposição
  if (!insights.some((t) => t.includes("Repor AGORA"))) {
    topVendidos
      .filter((x) => x.vendidos >= 5)
      .slice(0, 3)
      .forEach((p) => {
        insights.push(
          `✅ ${p.nome}: bom giro (histórico ${p.vendidos}). Mantenha reposição saudável.`
        );
      });
  }

  if (!insights.length) {
    insights.push("✅ Estoque equilibrado, nenhum padrão crítico detectado.");
  }

  return insights;
}



function renderInsights(list) {
  const box = document.getElementById("estoqueInsights");
  if (!box) return;

  box.innerHTML = `
    <ul style="margin:0;padding-left:18px">
      ${list.map((i) => `<li>${i}</li>`).join("")}
    </ul>
  `;
}

document.addEventListener("DOMContentLoaded", function () {
  console.log("📦 DOM pronto");

  const c1 = document.getElementById("chartTopProdutos");
  const c2 = document.getElementById("chartEntradasSaidas");

  if (!c1 || !c2 || typeof Chart === "undefined") {
    console.error("Canvas ou Chart.js ausente");
    return;
  }

  const labelsProdutos = readJsonScript("sj_labels_produtos");
  const dadosSaldo = readJsonScript("sj_dados_saldo");
  const dadosVendidos = readJsonScript("sj_dados_vendidos");

  const labelsMeses = readJsonScript("sj_labels_meses");
  const dadosEntradas = readJsonScript("sj_dados_entradas");
  const dadosSaidas = readJsonScript("sj_dados_saidas");

  // ✅ agrega antes de usar
  const agg = aggregateByLabel(labelsProdutos, [dadosSaldo, dadosVendidos]);

  // limpa charts antigos
  Chart.getChart(c1)?.destroy();
  Chart.getChart(c2)?.destroy();

  // gráfico 1
  new Chart(c1, {
    type: "bar",
    data: {
      labels: agg.labels,
      datasets: [
        { label: "Saldo atual", data: agg.series[0] },
        { label: "Quantidade vendida", data: agg.series[1] },
      ],
    },
    options: { responsive: true, maintainAspectRatio: false },
  });

  // gráfico 2
  new Chart(c2, {
    type: "line",
    data: {
      labels: labelsMeses,
      datasets: [
        { label: "Entradas", data: dadosEntradas },
        { label: "Saídas", data: dadosSaidas },
      ],
    },
    options: { responsive: true, maintainAspectRatio: false },
  });

  // ✅ insights (uma vez só)
  const insights = buildInsights(agg.labels, agg.series[0], agg.series[1]);
  renderInsights(insights);

  
});
