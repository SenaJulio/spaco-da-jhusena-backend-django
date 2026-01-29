/* global Chart */

function getPeriodoDias() {
  const elDias = document.getElementById("sj_periodo_dias");
  return Number(elDias ? JSON.parse(elDias.textContent) : 30) || 30;
}


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

  // 1) Campeões de venda (histórico) e risco de faltar
  const topVendidos = [...items].sort((a, b) => b.vendidos - a.vendidos);
  const maxVendidos = topVendidos[0]?.vendidos || 0;

  const campeoes = items.filter(
    (x) => maxVendidos > 0 && x.vendidos >= maxVendidos * 0.6
  );

  // risco de falta: saldo <= 5
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

  // 3) Produtos com bom giro (histórico)
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

/**
 * Ranking de ESTOQUE CRÍTICO (produto / mínimo / saldo)
 * - Mantém compatibilidade: aceita data.itens OU data.items
 */
async function carregarRankingEstoqueCritico() {
  const box = document.getElementById("rankingEstoque");
  if (!box) return;

  try {
    const res = await fetch("/estoque/api/ranking-critico/?top=10", {
      headers: { "X-Requested-With": "XMLHttpRequest" },
      credentials: "same-origin",
    });

    const contentType = res.headers.get("content-type") || "";
    const text = await res.text();

    let data = null;
    if (contentType.includes("application/json")) data = JSON.parse(text);

    if (!res.ok || !data?.ok) {
      box.innerHTML = "<div class='sj-muted'>Não foi possível carregar o ranking.</div>";
      return;
    }

    const arr = (data.itens || data.items || []);
    if (!Array.isArray(arr) || arr.length === 0) {
      box.innerHTML = "<div class='sj-muted'>Nenhum item crítico 🎉</div>";
      return;
    }

    box.innerHTML = arr.map((it) => {
      const status = String(it.status || "").toUpperCase();
      const isCritico = status === "CRITICO" || status === "ACAO_IMEDIATA" || it.prioridade === 0;

      const badge = isCritico ? "🚨 AÇÃO IMEDIATA" : "⚠️ ATENÇÃO";

      const nome = it.nome || it.produto || "Produto";
      const saldo = Number(it.saldo ?? 0);
      const minimo = Number(it.minimo ?? 0);

      return `
        <div style="
          display:flex;
          justify-content:space-between;
          align-items:center;
          padding:10px 8px;
          border-bottom:1px solid ${isCritico ? "rgba(255,77,77,.25)" : "rgba(255,255,255,.08)"};
          background: ${isCritico ? "rgba(255,77,77,.08)" : "rgba(255,255,255,.06)"};
          border-radius:10px;
        ">
          <div style="display:flex; flex-direction:column; gap:2px;">
            <strong style="color:#e8f0ff;">${nome}</strong>
            <span style="opacity:.75; font-size:.85rem;">
              Saldo: ${saldo} ${Number.isFinite(minimo) && minimo > 0 ? `| Mínimo: ${minimo}` : ""}
            </span>
          </div>
          <span style="
            font-weight:700;
            padding:6px 10px;
            border-radius:999px;
            border:1px solid rgba(255,255,255,.12);
            background: rgba(255,255,255,.06);
            color:${isCritico ? "#ff6b6b" : "#ffd166"};
            white-space:nowrap;
          ">
            ${badge}
          </span>
        </div>
      `;
    }).join("");

  } catch (e) {
    console.error("[rankingEstoque] erro", e);
    box.innerHTML = "<div class='sj-muted'>Erro ao carregar ranking.</div>";
  }
}


/**
 * Ranking de LOTES CRÍTICOS (validade + saldo)
 * - Espera data.items vindo do endpoint que você montou
 * - Pinta card inteiro se houver vencidos
 */
async function carregarRankingLotesCriticos() {
  const msg = document.getElementById("rankingLotesMsg");
  const lista = document.getElementById("rankingLotesLista");
  const badge = document.getElementById("badgeCriticos");
  const card = document.getElementById("cardRankingLotes");

  if (!msg || !lista || !badge) return;

  try {
    msg.textContent = "Carregando...";
    lista.innerHTML = "";
    lista.style.display = "none";
    badge.textContent = "0";
    badge.className = "badge bg-danger";

    const resp = await fetch("/estoque/api/lotes-prestes-vencer/?dias=30&limit=10", {
      headers: { "X-Requested-With": "XMLHttpRequest" },
      credentials: "same-origin",
    });

    const data = await resp.json();

    if (!data.ok) {
      msg.textContent = data.erro || "Falha ao carregar ranking.";
      return;
    }

    const items = Array.isArray(data.items) ? data.items : [];

    if (items.length === 0) {
      msg.textContent = "Nenhum lote crítico com saldo no momento ✅";
      badge.textContent = "0";
      badge.className = "badge bg-success";
      card?.classList.remove("sj-critico-vencido");
      return;
    }

    const vencidos = items.filter((x) => x.tipo === "vencido").length;
    const criticos = vencidos;


    badge.textContent = String(criticos);
    badge.className = "badge bg-danger";

    if (vencidos > 0) {
      badge.className = "badge bg-danger";
      card?.classList.add("sj-critico-vencido");
      msg.innerHTML = `<div class="text-danger fw-semibold">🚨 EXISTE LOTE VENCIDO COM SALDO — AÇÃO IMEDIATA</div>`;
    } else if (criticos > 0) {
      badge.className = "badge bg-danger";
      card?.classList.remove("sj-critico-vencido");
      msg.textContent = "";
    } else {
      badge.className = "badge bg-warning text-dark";
      card?.classList.remove("sj-critico-vencido");
      msg.textContent = "";
    }

    lista.style.display = "block";

    items.slice(0, 5).forEach((it) => {
      const dias = Number(it.dias_restantes);

      const isVencido = it.tipo === "vencido";
      const isPrestes = it.tipo === "prestes_vencer";

      let pillClass = "bg-success";
      let pillText = "OK";

      if (isVencido) {
        pillClass = "bg-danger";
        pillText = "AÇÃO IMEDIATA — VENCIDO";
      } else if (isPrestes) {
        pillClass = "bg-warning text-dark";
        pillText = "ATENÇÃO";
      }

      let subt = "";
      if (dias < 0) subt = `VENCIDO há ${Math.abs(dias)} dia(s)`;
      else subt = `Vence em ${dias} dia(s)`;

      const el = document.createElement("div");
      el.className = "list-group-item d-flex justify-content-between align-items-start";

      el.innerHTML = `
    <div class="me-3">
      <div class="fw-semibold">${it.produto_nome}</div>
      <div class="text-muted small">
        Lote ${it.lote_codigo} • ${subt} • saldo: ${Number(it.saldo_atual || 0)}
      </div>
    </div>
    <span class="badge ${pillClass} align-self-center">${pillText}</span>
  `;

      lista.appendChild(el);
    });

  } catch (e) {
    console.error("[RankingLotes] erro", e);
    msg.textContent = "Erro ao carregar ranking (veja o console).";
  }
}

// ===============================
// 📊 Top produtos (por vendas)
// ===============================
async function carregarTopProdutosVendidos() {
  const dias = getPeriodoDias();
  try {
    const res = await fetch(`/estoque/api/top-produtos-vendidos/?dias=${dias}&top=10`, {
      headers: { "X-Requested-With": "XMLHttpRequest" },
      credentials: "same-origin",
    });

    const json = await res.json();
    if (!res.ok || !json?.ok) return;

    // 1) Atualiza o gráfico
    if (window.chartTopProdutos) {
      window.chartTopProdutos.data.labels = json.labels || [];

      const vendidos = (json.data || []).map(n => Number(n) || 0);

      if (window.chartTopProdutos.data.datasets[1]) {
        window.chartTopProdutos.data.datasets[1].data = vendidos;
      } else {
        window.chartTopProdutos.data.datasets[0].data = vendidos;
      }

      window.chartTopProdutos.update();
    }

    // 2) Gera insight (DEPOIS do json estar disponível)
    const elInsight = document.getElementById("insightTopProdutos");
    if (!elInsight) return;

    const labels = json.labels || [];
    const vals = (json.data || []).map(n => Number(n) || 0);
    const total = vals.reduce((a, b) => a + b, 0);

    if (!labels.length || total <= 0) {
      elInsight.textContent = "Sem vendas no período selecionado.";
      return;
    }

    let idxMax = 0;
    for (let i = 1; i < vals.length; i++) {
      if (vals[i] > vals[idxMax]) idxMax = i;
    }

    const nome = labels[idxMax] || "Produto";
    const qtd = vals[idxMax];
    const pct = Math.round((qtd / total) * 100);
    const emoji = pct >= 70 ? "🔥" : pct >= 40 ? "📈" : "📊";
    const faixa =
    pct >= 70 ? "sj-faixa-forte" :
    pct >= 40 ? "sj-faixa-media" :
    "sj-faixa-neutra";

    elInsight.innerHTML =
      `<span class="${faixa}">
        ${emoji} Top do período (${dias} dias): ${nome} — ${qtd} venda(s) (${pct}%)
      </span>`;

  } catch (e) {
    console.error("[topProdutos] erro", e);
  }
}

function badgeProduto(pct) {
  if (pct >= 60) return { emoji: "🔥", titulo: "Produto líder absoluto no período" };
  if (pct >= 40) return { emoji: "📈", titulo: "Produto líder no período" };
  return { emoji: "📊", titulo: "Vendas bem distribuídas" };
}

async function carregarInsightProdutoLiderPDV() {
  const el = document.getElementById("insightProdutoLiderPDV");
  if (!el) return;

  el.textContent = "Carregando insight…";

  try {
    const dias = getPeriodoDias();

    const resp = await fetch(`/financeiro/api/insights/produto-lider-pdv/?dias=${dias}`, {
      headers: { Accept: "application/json" },
      credentials: "same-origin",
    });


    if (!resp.ok) throw new Error("HTTP " + resp.status);

    const data = await resp.json();
    if (!data.ok) throw new Error(data.erro || "Resposta inválida");

    if (!data.tem_dados || !data.lider) {
      el.innerHTML = `
        <div class="insight-box">
          <strong>📊 Sem dados</strong>
          <div style="opacity:.85; margin-top:4px;">
            Não há itens vendidos nos últimos ${dias} dias.
          </div>
        </div>
      `;
      return;
    }

    const pct = Number(data.lider.percentual || 0);
    const destaque = pct >= 70 ? "sj-insight-destaque" : "";
    const faixa =
    pct >= 70 ? "sj-faixa-forte" :
    pct >= 40 ? "sj-faixa-media" :
    "sj-faixa-neutra";
    const { emoji, titulo } = badgeProduto(pct);

    const liderNome = data.lider.nome;
    const liderValor = Number(data.lider.valor || 0).toLocaleString("pt-BR");

    let secondLine = "";
    if (data.segundo && data.segundo.nome) {
      const segPct = Number(data.segundo.percentual || 0);
      const segNome = data.segundo.nome;
      const segValor = Number(data.segundo.valor || 0).toLocaleString("pt-BR");

      secondLine = `
        <div style="margin-top:6px; opacity:.85;">
          ⚠️ 2º lugar: <strong>${segNome}</strong> — ${segValor} (${segPct}%)
        </div>
      `;
    }

    el.innerHTML = `
      <div class="insight-box ${destaque}">
        <div style="display:flex; gap:10px; align-items:flex-start;">
          <div style="font-size:1.4rem; line-height:1;">${emoji}</div>
          <div style="flex:1;">
            <div style="font-weight:800;">${titulo}</div>
            <div style="margin-top:4px; opacity:.9;">
            <span class="${faixa}">
              ${emoji} Produto mais vendido nos últimos <strong>${dias} dias</strong>:
              <strong>${liderNome}</strong> — ${liderValor} (${pct}%).
              </span>
            </div>
            ${secondLine}
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    console.error("❌ ERRO NO INSIGHT:", err);
    el.innerHTML = `
      <div class="insight-box">
        <strong>⚠️ Falha ao carregar insight</strong>
        <div style="opacity:.85; margin-top:4px;">${String(err?.message || err)}</div>
      </div>
    `;
  }
}

// (opcional) console
window.carregarInsightProdutoLiderPDV = carregarInsightProdutoLiderPDV;


/* === ÚNICO DOMContentLoaded (sem duplicação) === */
document.addEventListener("DOMContentLoaded", async function () {


  // Rankings
  carregarRankingEstoqueCritico();
  carregarRankingLotesCriticos();

  // Charts
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

  const agg = aggregateByLabel(labelsProdutos, [dadosSaldo, dadosVendidos]);

  Chart.getChart(c1)?.destroy();
  Chart.getChart(c2)?.destroy();

  window.chartTopProdutos = new Chart(c1, {
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


  // UX: saldo discreto, vendas em destaque
  const dsSaldo = window.chartTopProdutos.data.datasets[0];   // Saldo atual
  const dsVend = window.chartTopProdutos.data.datasets[1];    // Quantidade vendida

  if (dsSaldo) {
    dsSaldo.borderWidth = 0;
    dsSaldo.borderSkipped = false;
    dsSaldo.barPercentage = 0.9;
    dsSaldo.categoryPercentage = 0.8;

    // deixa “apagado” sem escolher cor manual
    dsSaldo.backgroundColor = "rgba(255,255,255,.18)";
  }

  if (dsVend) {
    dsVend.borderWidth = 0;
    dsVend.borderSkipped = false;
    dsVend.barPercentage = 0.9;
    dsVend.categoryPercentage = 0.8;

    // destaque sem brigar com o tema (puxa um verdinho do seu branding)
    dsVend.backgroundColor = "rgba(47,191,113,.55)";
  }

  window.chartTopProdutos.update();

  const tg = document.getElementById("toggleSaldo");
  if (tg) {
    tg.addEventListener("change", () => {
      const dsSaldo = window.chartTopProdutos.data.datasets[0];
      if (dsSaldo) dsSaldo.hidden = !tg.checked;
      window.chartTopProdutos.update();
    });
  }


  // ✅ AQUI (depois que o chart existe)
  await carregarTopProdutosVendidos();

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

  const insights = buildInsights(agg.labels, agg.series[0], agg.series[1]);
  renderInsights(insights);


  if (typeof window.carregarInsightCategoriaLider === "function") {
    window.carregarInsightCategoriaLider(30);
  }

  if (typeof window.carregarInsightProdutoLiderPDV === "function") {
    window.carregarInsightProdutoLiderPDV();
  }

});


