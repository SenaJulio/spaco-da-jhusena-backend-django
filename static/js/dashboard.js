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

// 🔗 Chamada mínima ao feed do histórico (diagnóstico)
// objetivo: somente disparar a requisição e logar no console
// 🔗 Histórico IA — busca + render simples (substitui o bloco de diagnóstico)
document.addEventListener("DOMContentLoaded", () => {
  fetch("/financeiro/ia/historico/feed/?limit=5")
    .then((r) => r.json())
    .then((data) => {
      // ✅ Se o histórico completo já existe no template, não cria o card simples
      if (document.getElementById("listaHistorico")) {
        console.log(
          "🧠 Histórico completo detectado — preview simples desativado."
        );
        return;
      }

      console.log("🧠 Historico IA (render):", data);

      const items = data && Array.isArray(data.items) ? data.items : [];

      // garante um container sem depender do template
      let host = document.getElementById("historicoSimples");
      if (!host) {
        host = document.createElement("div");
        host.id = "historicoSimples";
        host.className = "card mb-3";
        host.innerHTML = `
      <div class="card-body">
        <h5 class="card-title mb-2">🧠 Histórico (últimas)</h5>
        <div id="historicoSimplesList"></div>
      </div>
    `;

        // tenta ancorar logo após o badge Dev; senão após o <h1>; senão no fim do body
        const anchor =
          document.getElementById("devBadge") || document.querySelector("h1");

        if (anchor && anchor.parentNode) {
          anchor.parentNode.insertBefore(host, anchor.nextSibling);
        } else {
          document.body.appendChild(host);
        }
      }

      const wrap = host.querySelector("#historicoSimplesList") || host;
      if (!items.length) {
        wrap.innerHTML = `<div class="text-muted">Sem dicas ainda.</div>`;
        return;
      }

      wrap.innerHTML = items
        .map((i) => {
          const quando = i.created_at_br || i.created_at || "";
          const cat = i.categoria || "Geral";
          const txt = (i.texto || i.text || "").replace(/\n/g, "<br>");
          return `
      <div class="border-bottom py-2">
        <small class="text-muted">${quando} • ${cat}</small>
        <div>${txt}</div>
      </div>
    `;
        })
        .join("");
    })

    .catch((err) => {
      console.error("Falha ao buscar/renderizar histórico IA:", err);
    });
});

// static/js/dashboard.js — Spaço da Jhuséna (versão consolidada e corrigida)
(function () {
  ("use strict");

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
  // 🧠 Histórico de Dicas da IA — Botão "Ver mais" com paginação
  // 🧠 Histórico — Período (Início/Fim) + "Ver mais" em um bloco único
  document.addEventListener("DOMContentLoaded", () => {
    const wrap = document.getElementById("listaHistorico");
    if (!wrap || !wrap.parentNode) return;

    // tenta achar campos de período já existentes no template
    const elIni =
      document.getElementById("filtroInicio") ||
      document.querySelector('input[name="inicio"]') ||
      document.querySelector('input[data-role="inicio"]');

    const elFim =
      document.getElementById("filtroFim") ||
      document.querySelector('input[name="fim"]') ||
      document.querySelector('input[data-role="fim"]');

    const PER_PAGE = 10;
    let page = 1;
    let loading = false;

    // remove botão antigo se existir (evita duplicação ao trocar filtros)
    const oldBtn = document.getElementById("btnVerMaisHistorico");
    if (oldBtn) oldBtn.remove();

    // cria (ou recria) o botão "Ver mais"
    let btn = document.createElement("button");
    btn.id = "btnVerMaisHistorico";
    btn.className = "btn btn-outline-secondary btn-sm mt-2";
    btn.textContent = "Ver mais";
    wrap.parentNode.appendChild(btn);

    // render simples dos itens
    function renderItems(items, append = true) {
      const html = items
        .map((i) => {
          const quando = i.created_at_br || i.created_at || "";
          const cat = i.categoria || "Geral";
          const titulo = i.title || "Dica da IA";
          const txt = (i.texto || i.text || "").replace(/\n/g, "<br>");
          return `
        <div class="mt-3">
          <div class="text-muted small mb-1">${cat}</div>
          <div class="fw-semibold">${quando}</div>
          <div class="fw-semibold">${titulo}</div>
          <div>${txt}</div>
        </div>
      `;
        })
        .join("");

      if (append) {
        wrap.insertAdjacentHTML("beforeend", html);
      } else {
        wrap.innerHTML = html;
      }
    }

    function buildParams(nextPage) {
      const params = new URLSearchParams({
        page: String(nextPage),
        per_page: String(PER_PAGE),
      });
      const vIni = elIni && elIni.value ? elIni.value.trim() : "";
      const vFim = elFim && elFim.value ? elFim.value.trim() : "";
      if (vIni) params.set("inicio", vIni);
      if (vFim) params.set("fim", vFim);
      return params.toString();
    }

    async function loadPage(nextPage, append) {
      if (loading) return;
      loading = true;

      // cria/mostra um loader simples dentro da lista
      let loader = document.getElementById("historicoLoadingRow");
      if (!loader) {
        loader = document.createElement("div");
        loader.id = "historicoLoadingRow";
        loader.className = "text-muted small mt-3";
        loader.innerHTML = "Carregando…";
      }
      if (append) {
        // aparece no fim da lista quando estiver paginando
        wrap.appendChild(loader);
      } else {
        // aparece logo acima da lista quando estiver recarregando filtro/período
        if (wrap.parentNode) wrap.parentNode.insertBefore(loader, wrap);
      }

      const prevLabel = btn.textContent;
      btn.disabled = true;
      if (append) btn.textContent = "Carregando…";
      else btn.textContent = "Atualizando…";

      try {
        const url = `/financeiro/ia/historico/feed/?${buildParams(nextPage)}`;
        const r = await fetch(url);
        const j = await r.json();

        const items = Array.isArray(j.items) ? j.items : [];
        console.log("[Histórico] Resposta:", {
          status: r.status,
          page: j.page,
          has_next: j.has_next,
          items: items.length,
        });

        renderItems(items, append);
        // 🔎 Destaque visual do último bloco adicionado + rolagem
        try {
          // pega o último elemento visível da lista após o append
          const last = wrap.lastElementChild;
          if (last) {
            // aplica um destaque rápido
            last.style.outline = "1px dashed #999";
            last.style.background = "rgba(0,0,0,.03)";
            setTimeout(() => {
              last.style.outline = "";
              last.style.background = "";
            }, 1200);

            // rola até o final da lista para você ver o que entrou
            last.scrollIntoView({ behavior: "smooth", block: "end" });
          }
        } catch (_) {}

        page = j.page || nextPage;

        if (!j.has_next || !items.length) {
          btn.textContent = "Fim";
          btn.disabled = true;

          // mostra mensagem de que acabou (uma vez só)
          let endMsg = document.getElementById("historicoEndMsg");
          if (!endMsg) {
            endMsg = document.createElement("div");
            endMsg.id = "historicoEndMsg";
            endMsg.className = "text-muted small mt-2";
            endMsg.textContent = "Não há mais registros para carregar.";
            btn.parentNode.insertBefore(endMsg, btn);
          }
        } else {
          btn.textContent = prevLabel; // "Ver mais"
          btn.disabled = false;
        }
      } catch (e) {
        console.error("Erro ao carregar histórico:", e);
        btn.textContent = "Tentar novamente";
        btn.disabled = false;
      } finally {
        // some com o loader
        if (loader && loader.parentNode) loader.parentNode.removeChild(loader);
        loading = false;
      }
    }

    // clique em "Ver mais" -> loga e carrega próxima página
    btn.onclick = () => {
      const url = `/financeiro/ia/historico/feed/?${buildParams(page + 1)}`;
      console.log("[Histórico] Ver mais clicado:", {
        currentPage: page,
        nextPage: page + 1,
        url,
      });
      loadPage(page + 1, /*append*/ true);
    };

    // quando mudar Início/Fim -> recarrega a página 1 (substitui a lista e reseta o botão)
    async function onPeriodoChange() {
      page = 1;
      // reabilita botão se estava no "Fim"
      btn.disabled = false;
      btn.textContent = "Ver mais";
      await loadPage(1, /*append*/ false);
    }

    if (elIni) elIni.addEventListener("change", onPeriodoChange);
    if (elFim) elFim.addEventListener("change", onPeriodoChange);
  });

  // 🧠 Histórico — Filtro por categoria (reinicia lista e paginação)
  document.addEventListener("DOMContentLoaded", () => {
    const wrap = document.getElementById("listaHistorico");
    if (!wrap) return;

    // Tenta encontrar o campo de categoria já existente no template
    const catInput =
      document.getElementById("filtroCategoria") ||
      document.querySelector('select[name="categoria"]') ||
      document.querySelector('input[name="categoria"]');

    if (!catInput) return;

    const PER_PAGE = 10;
    let page = 1;
    let btn = null;

    // util: monta HTML de itens
    const renderItems = (items) => {
      const html = items
        .map((i) => {
          const quando = i.created_at_br || i.created_at || "";
          const cat = i.categoria || "Geral";
          const titulo = i.title || "Dica da IA";
          const txt = (i.texto || i.text || "").replace(/\n/g, "<br>");
          return `
        <div class="mt-3">
          <div class="text-muted small mb-1">${cat}</div>
          <div class="fw-semibold">${quando}</div>
          <div class="fw-semibold">${titulo}</div>
          <div>${txt}</div>
        </div>
      `;
        })
        .join("");
      wrap.insertAdjacentHTML("beforeend", html);
    };

    // cria (ou recria) o botão "Ver mais"
    const ensureButton = (categoriaAtual) => {
      if (btn && btn.remove) btn.remove();
      btn = document.createElement("button");
      btn.id = "btnVerMaisHistorico";
      btn.className = "btn btn-outline-secondary btn-sm mt-2";
      btn.textContent = "Ver mais";
      wrap.parentNode.appendChild(btn);

      const carregarMais = async () => {
        btn.disabled = true;
        btn.textContent = "Carregando…";
        try {
          const params = new URLSearchParams({
            page: String(page + 1),
            per_page: String(PER_PAGE),
          });
          const catVal = (categoriaAtual || "").trim();
          if (catVal && catVal.toLowerCase() !== "todas") {
            params.set("categoria", catVal);
          }
          const r = await fetch(
            `/financeiro/ia/historico/feed/?${params.toString()}`
          );
          const j = await r.json();

          const items = Array.isArray(j.items) ? j.items : [];
          if (!items.length) {
            btn.remove();
            return;
          }

          renderItems(items);
          page = j.page || page + 1;

          if (!j.has_next) {
            btn.remove();
          } else {
            btn.disabled = false;
            btn.textContent = "Ver mais";
          }
        } catch (e) {
          console.error("Erro ao carregar mais histórico:", e);
          btn.disabled = false;
          btn.textContent = "Ver mais";
        }
      };

      // 👇 Este bloco vem DEPOIS de definir `const carregarMais = async () => { ... }`

      // cria (ou reaproveita) o botão "Ver mais" sem duplicar e com handler correto
      let btn = document.getElementById("btnVerMaisHistorico");
      if (!btn) {
        btn = document.createElement("button");
        btn.id = "btnVerMaisHistorico";
        btn.className = "btn btn-outline-secondary btn-sm mt-2";
        btn.textContent = "Ver mais";
        if (wrap && wrap.parentNode) {
          wrap.parentNode.appendChild(btn);
        }
      }

      // sempre restaurar estado e re-vincular o mesmo handler
      btn.disabled = false;
      btn.textContent = "Ver mais";
      btn.removeEventListener("click", carregarMais); // evita handlers acumulados
      btn.addEventListener("click", carregarMais);
    };

    // carrega a página 1 com a categoria atual
    const reloadFromStart = async () => {
      // limpa lista e reinicia paginação
      wrap.innerHTML = "";
      page = 1;

      const categoria = (catInput.value || "").trim();
      const params = new URLSearchParams({
        page: "1",
        per_page: String(PER_PAGE),
      });
      if (categoria && categoria.toLowerCase() !== "todas") {
        params.set("categoria", categoria);
      }

      try {
        const r = await fetch(
          `/financeiro/ia/historico/feed/?${params.toString()}`
        );
        const j = await r.json();
        const items = Array.isArray(j.items) ? j.items : [];
        renderItems(items);

        // (re)cria o botão conforme has_next
        if (btn && btn.remove) btn.remove();
        if (j.has_next) {
          ensureButton(categoria);
        }
      } catch (e) {
        console.error("Erro ao recarregar histórico (filtro):", e);
      }
    };

    // dispara quando a categoria mudar
    catInput.addEventListener("change", reloadFromStart);
  });
  // 🧠 Histórico — Badge "Novas" (conta itens desde a última visita)
  // Armazena no localStorage o momento da última visualização do histórico.
  document.addEventListener("DOMContentLoaded", () => {
    const LIST_SEL = "listaHistorico";
    const wrap = document.getElementById(LIST_SEL);
    if (!wrap) return; // só ativa na página que tem o histórico completo

    const KEY_LAST_SEEN = "iaHistoricoLastSeenAt"; // ISO string
    const PER_PAGE_CHECK = 50; // limite máximo para contagem rápida (ajuste se quiser)

    // cria (ou reaproveita) o badge e um botão "Marcar como visto"
    function ensureBadgeUI() {
      let holder = document.getElementById("historicoBadgeHolder");
      if (!holder) {
        holder = document.createElement("div");
        holder.id = "historicoBadgeHolder";
        holder.className = "d-flex align-items-center gap-2 mb-2";

        // posiciona acima da lista
        const wrap = document.getElementById("listaHistorico");
        if (wrap && wrap.parentNode) {
          wrap.parentNode.insertBefore(holder, wrap);
        }

        // título
        const title = document.createElement("span");
        title.className = "fw-semibold";
        title.textContent = "🧠 Histórico de Dicas — novidades";
        holder.appendChild(title);

        // badge de novas
        const badge = document.createElement("span");
        badge.id = "badgeNovasIA";
        badge.className = "badge text-bg-success";
        badge.style.display = "none"; // inicia oculto
        holder.appendChild(badge);

        // botão marcar como visto
        const btnSeen = document.createElement("button");
        btnSeen.id = "btnMarcarVistoIA";
        btnSeen.className = "btn btn-link btn-sm text-decoration-none";
        btnSeen.type = "button"; // <-- evita submit em forms
        btnSeen.textContent = "Marcar como visto";
        holder.appendChild(btnSeen);

        // handler do clique
        btnSeen.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          try {
            localStorage.setItem(
              "iaHistoricoLastSeenAt",
              new Date().toISOString()
            );
          } catch (_) {}
          // esconde o badge imediatamente
          badge.style.display = "none";
          console.log("✅ Marcado como visto (badge ocultado).");
        });
      }
      return holder;
    }

    // calcula quantas são mais novas que lastSeen
    function countNew(items, lastSeenIso) {
      if (!lastSeenIso) return items.length; // primeira visita: tudo é "novo" (até PER_PAGE_CHECK)
      const last = Date.parse(lastSeenIso);
      let n = 0;
      for (const it of items) {
        const iso = it.created_at || it.data || "";
        if (!iso) continue;
        const t = Date.parse(iso);
        if (!Number.isNaN(t) && t > last) n++;
      }
      return n;
    }

    async function updateBadge() {
      ensureBadgeUI();

      // pega última visualização
      let lastSeen = null;
      try {
        lastSeen = localStorage.getItem(KEY_LAST_SEEN) || null;
      } catch (e) {}

      // busca até PER_PAGE_CHECK itens mais recentes (página 1)
      try {
        const url = `/financeiro/ia/historico/feed/?page=1&per_page=${PER_PAGE_CHECK}`;
        const r = await fetch(url);
        const j = await r.json();
        const items = Array.isArray(j.items) ? j.items : [];
        const qtd = countNew(items, lastSeen);

        const badge = document.getElementById("badgeNovasIA");
        if (!badge) return;

        if (qtd > 0) {
          badge.textContent =
            qtd >= PER_PAGE_CHECK ? `+${PER_PAGE_CHECK}` : `${qtd} novas`;
          badge.style.display = "inline-block";
        } else {
          badge.style.display = "none";
        }
      } catch (e) {
        console.error("Badge Novas IA — falha ao atualizar:", e);
      }
    }

    // Define uma convenção: quando o usuário rolar até o histórico, marcamos como visto
    // (opcional; o botão "Marcar como visto" já resolve)
    const obs = new IntersectionObserver(
      (entries) => {
        const v = entries.some((en) => en.isIntersecting);
        if (v) {
          // não marcamos automaticamente como visto para não sumir sem o usuário querer.
          // Se quiser marcar automático, descomente:
          // localStorage.setItem(KEY_LAST_SEEN, new Date().toISOString());
        }
      },
      { threshold: 0.1 }
    );
    obs.observe(wrap);

    // quando clicar no "Ver mais", depois do carregamento, atualiza o badge
    const btnMore = document.getElementById("btnVerMaisHistorico");
    if (btnMore) {
      btnMore.addEventListener("click", () => {
        // pequeno atraso para deixar carregar
        setTimeout(updateBadge, 800);
      });
    }

    // atualiza badge ao abrir a página
    updateBadge();
  });
  // 🧠 Histórico — salvar e restaurar posição de rolagem
  document.addEventListener("DOMContentLoaded", () => {
    const wrap = document.getElementById("listaHistorico"); // contêiner do histórico
    const KEY = "iaHistoricoScroll:" + location.pathname;

    // restaura posição
    function restore() {
      try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return;
        const s = JSON.parse(raw);
        if (wrap && typeof s.wrap === "number") {
          wrap.scrollTop = s.wrap;
        } else if (typeof s.win === "number") {
          window.scrollTo(0, s.win);
        }
      } catch (_) {}
    }

    // salva posição (debounced)
    const save = () => {
      try {
        const data = {
          ts: Date.now(),
          wrap: wrap ? wrap.scrollTop : null,
          win: window.scrollY,
        };
        localStorage.setItem(KEY, JSON.stringify(data));
      } catch (_) {}
    };
    const debounce = (fn, ms = 150) => {
      let t;
      return () => {
        clearTimeout(t);
        t = setTimeout(fn, ms);
      };
    };
    const onScroll = debounce(save, 150);

    // listeners
    if (wrap) wrap.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("beforeunload", save);

    // pequena espera para garantir que a lista já foi montada
    setTimeout(restore, 120);
  });
})();
