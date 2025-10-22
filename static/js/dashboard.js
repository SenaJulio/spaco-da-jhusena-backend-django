// 🔥 Teste Spaço da Jhuséna – Mensagem de boas-vindas
console.log("🐶 Spaço da Jhuséna Dev ativo — Painel carregado com sucesso!");
// 🧪 Badge Dev: mostra horário de carregamento do painel
document.addEventListener("DOMContentLoaded", () => {
  const elBadge = document.getElementById("devBadge");
  const elText = document.getElementById("devBadgeText");
  if (elBadge && elText) {
    const ts = new Date().toLocaleString(); // horário local
    elText.textContent = `Painel carregado em ${ts}`;
    elBadge.style.display = "inline-flex";
  }
});


// static/js/dashboard.js — Spaço da Jhuséna (versão consolidada e corrigida)
(function () {
  "use strict";

  // === Evita rodar 2x se o arquivo for incluído de novo ===
  if (window.__SJ_DASH_ONCE__) {
    console.debug("Dashboard já inicializado — evitando duplicidade.");
    return;
  }
  window.__SJ_DASH_ONCE__ = true;

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

  // Data local -> 'YYYY-MM-DD' (evita bug de fuso do toISOString)
  function ymdLocal(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, "0");
    const d = String(dateObj.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  // Helpers para cards/HTML
  function firstLine(s, max = 60) {
    if (!s) return "";
    const str = String(s).trim().split(/\r?\n/)[0];
    return str.length > max ? str.slice(0, max - 1) + "…" : str;
  }
  function capitalize(s) {
    const t = String(s || "");
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // Datas padrão (para inputs)
  function pad2(n) {
    return String(n).padStart(2, "0");
  }
  function fmtYMD(d) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }
  function firstDayOfMonth(d) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-01`;
  }

  // --- Fetch JSON com erro detalhado ---
  async function sjFetchJSON(url) {
    const r = await fetch(url, {
      headers: {
        "X-Requested-With": "XMLHttpRequest",
        Accept: "application/json",
      },
      credentials: "same-origin",
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      throw new Error(`HTTP ${r.status} @ ${url}: ${txt.slice(0, 300)}`);
    }
    return r.json();
  }

  // =============== Charts Helpers ===============
  // Cache de instâncias (chave lógica)
  const sjCharts = {};

  // Garante criação/atualização única por canvas + chave
  function getOrCreateChart(ctx, key, config) {
    if (sjCharts[key]) {
      sjCharts[key].data = config.data;
      sjCharts[key].options = config.options || {};
      sjCharts[key].update();
      return sjCharts[key];
    }
    // 🔧 destrói qualquer Chart já preso a ESTE canvas
    const prev = Chart.getChart(ctx.canvas);
    if (prev) prev.destroy();

    const ch = new Chart(ctx, config);
    sjCharts[key] = ch;
    queueMicrotask(() => {
      try {
        ch.resize();
      } catch {}
    });
    return ch;
  }

  // =============== Gráficos ===============
  function montarGraficoEvolucao(
    dias = [],
    receitas = [],
    despesas = [],
    saldo = []
  ) {
    const el = document.getElementById("graficoEvolucao");
    const empty = document.getElementById("evolucaoEmpty");
    if (!el) return;

    const hasData = Array.isArray(dias) && dias.length > 0;
    if (!hasData) {
      if (empty) empty.hidden = false;
      el.style.display = "none";
      const inst = Chart.getChart(el);
      if (inst) inst.destroy();
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
        parsing: false,
        interaction: { mode: "index", intersect: false },
        plugins: { legend: { position: "bottom" } },
        scales: {
          x: { ticks: { maxRotation: 0, autoSkip: true } },
          y: { beginAtZero: true },
        },
      },
    });
  }

  function montarGraficoCategorias(categorias = [], valores = []) {
    const el = document.getElementById("graficoCategorias");
    const empty = document.getElementById("categoriasEmpty");
    if (!el) return;

    const hasData = Array.isArray(categorias) && categorias.length > 0;
    if (!hasData) {
      if (empty) empty.hidden = false;
      el.style.display = "none";
      const inst = Chart.getChart(el);
      if (inst) inst.destroy();
      return;
    }
    if (empty) empty.hidden = true;
    el.style.display = "";

    const ctx = el.getContext("2d");
    return getOrCreateChart(ctx, "sj-categorias", {
      type: "doughnut", // mude para "bar" se preferir
      data: {
        labels: categorias,
        datasets: [{ label: "Total", data: valores, borderWidth: 1 }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        parsing: false,
        plugins: { legend: { position: "bottom" } },
      },
    });
  }

  // Atualiza dashboard quando já tiver os dados carregados em memória
  function atualizarDashboard(dados) {
    if (!dados) return;
    let L = Array.isArray(dados.dias) ? dados.dias : [];
    let R = garantirArray(dados.receitas, L.length).map(_toNumber);
    let D = garantirArray(dados.despesas, L.length).map(_toNumber);
    let S = garantirArray(dados.saldo, L.length).map(_toNumber);

    const minLen = Math.min(L.length, R.length, D.length, S.length);
    if (!minLen) {
      montarGraficoEvolucao([], [], [], []);
      return;
    }

    L = L.slice(0, minLen);
    R = R.slice(0, minLen);
    D = D.slice(0, minLen);
    S = S.slice(0, minLen);

    montarGraficoEvolucao(L, R, D, S);

    if (Array.isArray(dados.categorias) && Array.isArray(dados.valores)) {
      montarGraficoCategorias(dados.categorias, dados.valores);
    }
  }

  // =============== Inicialização e filtros ===============
  document.addEventListener("DOMContentLoaded", async function () {
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

    let inicio = $ini && $ini.value ? $ini.value : iniDefault;
    let fim = $fim && $fim.value ? $fim.value : fimDefault;

    async function recarregar() {
      try {
        const base =
          window.URL_DADOS_GRAFICO || "/financeiro/dashboard/dados-filtrados/";
        const url = `${base}?inicio=${encodeURIComponent(
          inicio
        )}&fim=${encodeURIComponent(fim)}`;
        const dados = await sjFetchJSON(url);

        if (!dados || !Array.isArray(dados.dias)) {
          throw new Error(
            "Payload inválido: esperado {dias, receitas, despesas, saldo}"
          );
        }

        montarGraficoEvolucao(
          dados.dias,
          dados.receitas,
          dados.despesas,
          dados.saldo
        );

        if (Array.isArray(dados.categorias) && Array.isArray(dados.valores)) {
          montarGraficoCategorias(dados.categorias, dados.valores);
        } else {
          montarGraficoCategorias([], []);
        }
      } catch (err) {
        console.error("❌ Erro ao carregar/desenhar gráficos:", err);
        alert("Erro ao carregar os gráficos. Veja o console para detalhes.");
      }
    }

    await recarregar();

    [$ini, $fim].forEach((el) => {
      if (!el) return;
      el.addEventListener("change", () => {
        inicio = $ini && $ini.value ? $ini.value : iniDefault;
        fim = $fim && $fim.value ? $fim.value : fimDefault;
        recarregar();
      });
    });

    const btnAplicar =
      document.getElementById("btnAplicarFiltros") ||
      document.getElementById("filtrar-btn");
    if (btnAplicar) {
      btnAplicar.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const st = document.getElementById("statusFiltros");
        btnAplicar.disabled = true;
        if (st) st.textContent = "⏳ Aplicando filtros...";
        try {
          if ($ini?.value) inicio = $ini.value;
          if ($fim?.value) fim = $fim.value;
          await recarregar();
          if (st) st.textContent = "✅ Filtros aplicados!";
        } catch (e) {
          console.error("Erro ao aplicar filtros:", e);
          if (st) st.textContent = "Erro ao aplicar filtros.";
        } finally {
          btnAplicar.disabled = false;
          setTimeout(() => {
            if (st) st.textContent = "";
          }, 2000);
        }
      });
    }
  });

  // =============== Botão "Gerar nova dica" ===============
  {
    const btn = document.getElementById("btnGerarDica");
    const st = document.getElementById("statusDica");
    const csrf = typeof getCsrfToken === "function" ? getCsrfToken : () => "";

    if (btn) {
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        if (st) st.textContent = "Gerando dica...";

        try {
          const r = await fetch("/financeiro/api/insights/criar-simples/", {
            method: "POST",
            headers: {
              "X-Requested-With": "XMLHttpRequest",
              "X-CSRFToken": csrf(),
              Accept: "application/json",
            },
            credentials: "same-origin",
          });
          const j = await r.json();

          if (j.ok) {
            if (st) st.textContent = "✅ Nova dica gerada!";

            const box =
              document.getElementById("cardsInsight") ||
              document.getElementById("listaHistorico");
            if (box) {
              const data = j.created_at || new Date().toLocaleString("pt-BR");
              const titulo = j.title || "Nova dica";
              const texto = j.text || j.dica || "";

              const card = document.createElement("div");
              card.className = "card border-success mt-3";
              card.innerHTML = `
                <div class="card-body">
                  <div class="small text-muted">Insight • ${escapeHtml(
                    String(data)
                  )}</div>
                  <h5 class="card-title mb-1">${escapeHtml(String(titulo))}</h5>
                  <p class="mb-0" style="white-space:pre-wrap">${escapeHtml(
                    String(texto)
                  )}</p>
                </div>`;

              const placeholder = document.getElementById(
                "placeholderInsightCard"
              );
              if (placeholder) placeholder.replaceWith(card);
              else box.prepend(card);
            }
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
    }
  }

  // =============== Ocultar botões duplicados "Gerar nova dica" ===============
  document.addEventListener("DOMContentLoaded", () => {
    const main = document.getElementById("btnGerarDica");
    if (!main) return;
    const all = Array.from(document.querySelectorAll("button")).filter(
      (b) =>
        b !== main && b.textContent.trim().toLowerCase() === "gerar nova dica"
    );
    for (const b of all) {
      b.classList.add("d-none");
      b.disabled = true;
      b.setAttribute("data-duplicado", "true");
    }
  });
})();
