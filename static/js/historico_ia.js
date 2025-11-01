// ======================================================
// historico_ia.js — versão “clean”, single-flight + gate de filtro
// ======================================================
(function () {
  ("use strict");

  const __LOAD_TS__ = performance.now();

  // ---- Guardião: impede rodar duas vezes o mesmo script
  if (window.__IA_HIST_INIT_DONE__) {
    console.warn(
      "⚠️ historico_ia.js já inicializado — abortando segunda carga."
    );
    return;
  }
  window.__IA_HIST_INIT_DONE__ = true;

  console.log("🔍 historico_ia.js carregado");

  // ========= Helpers globais =========
  function formatarDataBR(s) {
    const d = parseStamp(s);
    if (!d) return "";
    return d.toLocaleString("pt-BR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function _normSnippet(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/\r?\n+/g, " ") // quebras de linha -> espaço
      .replace(/\s+/g, " ") // colapsa espaços
      .replace(/[.…]+$/g, "") // remove reticências/pontos no fim
      .trim();
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
  function fmtMoeda(x) {
    const n = Number(x) || 0;
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
  function fmt(v) {
    if (typeof v === "number") return v.toLocaleString("pt-BR");
    const n = Number(v);
    return Number.isFinite(n) ? n.toLocaleString("pt-BR") : String(v);
  }
  function labelize(k) {
    return String(k)
      .replaceAll("_", " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
  function normKind(v) {
    const s = String(v || "").toLowerCase();
    if (s.includes("posit")) return "positiva";
    if (s.includes("alert")) return "alerta";
    if (s.includes("neut")) return "neutra";
    return "geral";
  }
  // parse "dd/mm/yyyy HH:MM" ou ISO
  function parseStamp(s) {
    if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return new Date(s); // ISO
    const m = String(s).match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/
    );
    if (!m) return new Date(s);
    const [, d, mo, y, h, i] = m.map(Number);
    return new Date(y, mo - 1, d, h, i);
  }
  function _normalizeTipo(v) {
    if (!v) return null;
    const s = String(v).toLowerCase();
    if (["positivo", "positivos", "positiva", "positivas"].includes(s))
      return "positiva";
    if (["alerta", "alertas"].includes(s)) return "alerta";
    if (["neutro", "neutros", "neutra", "neutras"].includes(s)) return "neutra";
    if (["all", "tudo", "todas", "todos"].includes(s)) return null;
    return s;
  }
  function getCsrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    if (meta?.content) return meta.content;
    const match = document.cookie.match(/(^|;\s*)csrftoken=([^;]+)/);
    return match ? decodeURIComponent(match[2]) : "";
  }

  // ========= Constantes/Estado =========
  const PREVIEW_LIMIT = 5; // itens no preview
  const MORE_INCREMENT = 10; // incremento do "Ver mais"
  const KEY_LAST_SEEN = "iaHistoricoLastSeenAt";

  // Gate: permite chamadas filtradas só logo após clique humano
  let _allowFilteredUntil = 0;

  // Dedupe por URL e single-flight
  let lastHistUrl = "";
  let _lastIntent = { limit: null, tipo: "" };
  let _abortCtrl = null;
  let _pendingTimer = null;
  let _pendingArgs = null; // { limit, tipo }
  let _inFlight = false;

  // Estado geral
  let lastSeenAt = null;
  let allItems = [];
  let filtroCategoria = ""; // ""=todas | neutra | positiva | alerta
  let refreshTimer = null;
  let BUSY = false;
  let _limitAtual = PREVIEW_LIMIT;

  // Anti-rajada de cliques em filtros
  let filtroLock = false;

  // ========= Main =========
  document.addEventListener("DOMContentLoaded", () => {
    if (document.body.dataset.iaHistoricoInit === "1") return;
    document.body.dataset.iaHistoricoInit = "1";

    // Alvos (atual + futuros)
    const list =
      document.getElementById("listaHistorico") ||
      document.getElementById("listaHistoricoPreview") ||
      document.getElementById("listaHistoricoModal");

    if (!list) {
      console.warn(
        "⚠️ Nenhum container de histórico encontrado (#listaHistorico, #listaHistoricoPreview ou #listaHistoricoModal)."
      );
      return;
    }

    // FEED_URL (preferir data-feed-url). Força /v2/ se não estiver.
    let FEED_URL =
      (list.dataset.feedUrl && list.dataset.feedUrl.trim()) ||
      "/financeiro/ia/historico/feed/v2/";
    if (
      FEED_URL.includes("/financeiro/ia/historico/feed/") &&
      !FEED_URL.includes("/v2/")
    ) {
      FEED_URL = FEED_URL.replace(
        "/financeiro/ia/historico/feed/",
        "/financeiro/ia/historico/feed/v2/"
      );
    }
    console.log("[Historico] FEED_URL =", FEED_URL);

    // Elementos adicionais
    const modalEl = document.getElementById("modalHistoricoIA");
    const modalList = document.getElementById("listaHistoricoModal");
    const btnVerMaisDom = document.getElementById("btnVerMais");

    // Copia o preview para o modal ao abrir (se existir)
    if (modalEl && list && modalList) {
      modalEl.addEventListener("show.bs.modal", function () {
        modalList.innerHTML = list.innerHTML;
      });
    }

    // Garante botão Ver mais (fallback visual se não existir)
    (function ensureVerMaisButton() {
      let btn = btnVerMaisDom || document.getElementById("btnVerMais");
      if (!btn) {
        btn = document.createElement("button");
        btn.id = "btnVerMais";
        btn.className = "btn btn-outline-secondary btn-sm mt-2";
        btn.textContent = "Ver mais";
        list.insertAdjacentElement("afterend", btn);
      }
    })();

    // Badge/contadores/overlay
    const badge = document.getElementById("badgeNovasDicas");
    const badgeCount = null; // não usamos mais contador separado no HTML novo
    const btnReload =
      document.getElementById("btnReloadDicas") ||
      document.getElementById("btnReloadFeed");
    const btnMarcarLidas = document.getElementById("btnMarcarLidas");
    const btnHistoricoIA = document.getElementById("btnHistoricoIA");
    const elOvl = document.getElementById("ovlHistorico");

    const elCountAll = document.getElementById("countAll");
    const elCountPos = document.getElementById("countPos");
    const elCountAlerta = document.getElementById("countAlerta");
    const elCountNeutra = document.getElementById("countNeutra");

    // Filtros (botões com data-ia-filtro ou data-filter) + compat por ID
    const filterButtons = document.querySelectorAll(
      "[data-ia-filtro],[data-filter]"
    );
    const btnFiltroIDs = {
      todas: document.getElementById("btnTodas"),
      positivas: document.getElementById("btnPositivas"),
      alertas: document.getElementById("btnAlertas"),
      neutras: document.getElementById("btnNeutras"),
    };

    // Carrega lastSeen
    lastSeenAt = localStorage.getItem(KEY_LAST_SEEN) || null;

    // ===== fetch histórico (assinatura flexível) =====
    // ✅ Defina o endpoint v2 (se ainda não tiver)
    const FEED_URL = "/financeiro/ia/historico/feed/v2/";

    // ✅ Normaliza tipo vindo do backend (inclui fallback "geral"→"neutra")
    function normKindV2(v) {
      const k = String(v || "")
        .toLowerCase()
        .trim();
      if (k === "alerta" || k === "positiva" || k === "neutra") return k;
      if (k === "geral" || k === "" || k === "none" || k === "null")
        return "neutra";
      return "neutra";
    }

    // (se já existir, mantém) — converte vários formatos de data para Date
    function parseStamp(raw) {
      if (!raw) return null;
      // ISO direto
      const d1 = new Date(raw);
      if (!isNaN(d1.getTime())) return d1;
      // dd/mm/aaaa hh:mm
      const m = String(raw).match(
        /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?$/
      );
      if (m) {
        const [_, dd, mm, yyyy, hh = "00", mi = "00"] = m;
        const d2 = new Date(+yyyy, +mm - 1, +dd, +hh, +mi, 0);
        if (!isNaN(d2.getTime())) return d2;
      }
      return null;
    }

    // ✅ Mantém tua assinatura flexível e os gates que você já criou
      async function fetchHistorico(a = 20, b = "") {
        // aceita fetchHistorico(20, "positiva") OU fetchHistorico("positiva")
        let limit = 20;
        let tipo = "";

        if (typeof a === "number" && Number.isFinite(a)) limit = a;
        else if (typeof a === "string" && isNaN(Number(a))) tipo = a;

        if (typeof b === "number" && Number.isFinite(b)) limit = b;
        else if (typeof b === "string" && isNaN(Number(b))) tipo = b;

        if (!Number.isFinite(limit) || limit <= 0) limit = 20;

        const t = _normalizeTipo
          ? _normalizeTipo(tipo) || ""
          : String(tipo || "")
              .toLowerCase()
              .trim();

        // 🔒 Anti-prefetch inicial
        if (
          typeof performance !== "undefined" &&
          performance.now() - __LOAD_TS__ < 1500
        ) {
          if (t === "neutra" || t === "alerta" || t === "positiva") return [];
        }

        // 🔒 Gate duro pós-clique humano
        if (
          (t === "neutra" || t === "alerta" || t === "positiva") &&
          typeof performance !== "undefined" &&
          performance.now() > (window._allowFilteredUntil || 0)
        ) {
          return []; // silencioso
        }

        // 🧭 Honra somente a intenção mais recente (mantém tua lógica)
        if (
          window._lastIntent &&
          (_lastIntent.tipo !== t || _lastIntent.limit !== limit)
        )
          return [];

        const qs = new URLSearchParams();
        qs.set("limit", String(limit));
        if (t) qs.set("tipo", t);

        const finalUrl = `${FEED_URL}?${qs.toString()}`;

        // Dedupe por URL (mantém tua lógica)
        if (window.lastHistUrl === finalUrl) return [];
        window.lastHistUrl = finalUrl;

        // 🔪 Aborta requisição anterior
        if (window._abortCtrl) {
          try {
            _abortCtrl.abort();
          } catch {}
        }
        window._abortCtrl = new AbortController();
        const signal = _abortCtrl.signal;

        console.log("[Historico] GET", finalUrl);

        const r = await fetch(finalUrl, {
          headers: { Accept: "application/json" },
          credentials: "same-origin",
          signal,
        });
        if (!r.ok) throw new Error(`HTTP ${r.status} @ ${FEED_URL}`);
        const json = await r.json();

        // ✅ Atualiza contadores que o backend já manda (positiva/alerta/neutra/total)
        if (
          json &&
          json.count &&
          typeof window.setContadoresBackend === "function"
        ) {
          try {
            setContadoresBackend(json.count);
          } catch {}
        }

        // ✅ O backend v2 retorna "items"
        const arr = (json && (json.items || json.results || json.data)) || [];
        const items = (Array.isArray(arr) ? arr : []).map((x) => {
          const criadoRaw =
            x.criado_em || x.created_at || x.created_at_br || x.data || "";
          const stamp = parseStamp(criadoRaw)?.getTime() || 0;
          const k = normKindV2(
            x.tipo || x.categoria || x.categoria_dominante || x.kind || "geral"
          );
          const txt = (x.texto || x.text || x.dica || x.conteudo || "")
            .toString()
            .trim();
          const title =
            x.title ||
            x.titulo ||
            (txt
              ? txt.split("\n")[0].slice(0, 60) + (txt.length > 60 ? "…" : "")
              : "Dica da IA");
          return {
            id: x.id,
            criado_em: criadoRaw,
            _stamp: stamp,
            tipo: k, // "positiva" | "alerta" | "neutra"
            title,
            text: txt || "Sem conteúdo disponível.",
            criado_em_fmt: x.criado_em_fmt || "", // opcional para exibir no card
          };
        });

        // ordem decrescente por data
        items.sort((a, b) => b._stamp - a._stamp);

        return items;
      }

    // ===== Render =====
    function cardHTML(it) {
      const quando = escapeHtml(formatarDataBR(it.criado_em) || "");

      const _t = String(it.tipo || "geral")
        .trim()
        .toLowerCase();
      const tag = escapeHtml(_t.replace(/^./, (c) => c.toUpperCase())); // Positiva / Alerta / Neutra / Geral

      const isNew =
        lastSeenAt &&
        parseStamp(it.criado_em)?.getTime() > new Date(lastSeenAt).getTime();

      // usa _t normalizado para a cor
      const cor =
        _t === "positiva"
          ? "success"
          : _t === "alerta"
          ? "warning"
          : "secondary";

      // evita duplicar título e texto (quando o título é só o começo do parágrafo)
      let titulo = String(it.title || "").trim();
      const texto = String(it.text || "").trim();

      // normaliza para comparação (ignora reticências, pontuação final, quebras de linha)
      const tNorm = _normSnippet(titulo);
      const xHead = _normSnippet(texto.split("\n")[0] || "");

      // se o título for “quase” o começo do texto (>=80% do título bate), esconde
      let hideTitle = false;
      if (tNorm && xHead) {
        const n = Math.max(10, Math.floor(tNorm.length * 0.8)); // pelo menos 10 chars
        hideTitle = xHead.startsWith(tNorm.slice(0, n));
      }
      if (hideTitle) titulo = "";

      return `
    <div class="card border-${cor} mb-3 shadow-sm ia-card ${
        isNew ? "is-new" : ""
      }" data-kind="${escapeHtml(_t)}">
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <span class="badge bg-success-subtle text-success border border-success-subtle">${tag}</span>
          <small class="text-muted">${quando}</small>
        </div>
        ${
          titulo
            ? `<h6 class="card-title text-success mb-1">${escapeHtml(
                titulo
              )}</h6>`
            : ""
        }
        <p class="card-text mb-0" style="white-space: pre-wrap">${escapeHtml(
          texto
        )}</p>
      </div>
    </div>`;
    }

    function atualizarBadgeTotal() {
      if (!badge) return;

      const lastISO = lastSeenAt ? new Date(lastSeenAt).getTime() : 0;
      const base = Array.isArray(allItems) ? allItems : [];

      const cnt = lastISO
        ? base.filter((i) => {
            const ts = parseStamp(i.criado_em)?.getTime() || 0;
            return ts > lastISO;
          }).length
        : base.length || 0; // primeira visita: tudo é “novo”

      if (cnt > 0) {
        badge.textContent = `Novas dicas: ${cnt}`;
        badge.classList.remove("d-none");
      } else {
        badge.classList.add("d-none");
      }
    }

    function atualizarContadoresUI(itemsAll) {
      if (elCountAll) elCountAll.textContent = String(itemsAll.length);
      if (elCountPos)
        elCountPos.textContent = String(
          itemsAll.filter((i) => i.tipo === "positiva").length
        );
      if (elCountAlerta)
        elCountAlerta.textContent = String(
          itemsAll.filter((i) => i.tipo === "alerta").length
        );
      if (elCountNeutra)
        elCountNeutra.textContent = String(
          itemsAll.filter((i) => i.tipo === "neutra").length
        );
    }

    function setContadoresBackend(count) {
      if (!count || typeof count !== "object") return;
      const toInt = (v) => Number(v) || 0;
      const map = {
        countAll: toInt(count.total),
        countPos: toInt(count.positiva),
        countAlerta: toInt(count.alerta),
        countNeutra: toInt(count.neutra),
      };
      Object.entries(map).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = String(val);
      });
    }

    function toggleLoading(show) {
      if (!elOvl) return;
      elOvl.classList.toggle("d-none", !show);
    }

    function renderLista(items) {
      const filtered = filtroCategoria
        ? items.filter((i) => i.tipo === filtroCategoria)
        : items;
      if (!filtered.length) {
        list.innerHTML = `<div class="alert alert-secondary mb-2">Nenhuma dica encontrada.</div>`;
        // ❌ NÃO esconda o badge aqui — ele mostra o total de novas, independente do filtro
        // badge?.classList.add("d-none");  // <- REMOVER esta linha

        atualizarBadgeTotal(); // ✅ mantém a contagem global de novas
        atualizarContadoresUI(items); // ✅ mantém os contadores
        return;
      }

      list.innerHTML = filtered.map(cardHTML).join("");
      requestAnimationFrame(() => {
        list
          .querySelectorAll(".ia-card")
          .forEach((el) => el.classList.add("fade-in"));
      });
      atualizarBadgeTotal();
      atualizarContadoresUI(items);
    }

    // ===== API pública (coalescida) =====
    window.carregarHistorico = function carregarHistorico(
      limit = 20,
      tipo = null
    ) {
      let _tipoNorm = _normalizeTipo(tipo) || "";
      const _limit = Number.isFinite(limit) && limit > 0 ? limit : 20;

      // ⛔️ Bloqueia chamadas filtradas que NÃO vieram de clique humano recente
      if (
        (_tipoNorm === "positiva" ||
          _tipoNorm === "alerta" ||
          _tipoNorm === "neutra") &&
        performance.now() > _allowFilteredUntil
      ) {
        _tipoNorm = ""; // força "todas"
      }

      _pendingArgs = { limit: _limit, tipo: _tipoNorm };
      _lastIntent = { limit: _limit, tipo: _tipoNorm };

      if (_pendingTimer) clearTimeout(_pendingTimer);
      _pendingTimer = setTimeout(async () => {
        if (_inFlight) {
          // ainda em voo? re-agenda para a última intenção
          _pendingTimer = setTimeout(
            () =>
              window.carregarHistorico(_pendingArgs.limit, _pendingArgs.tipo),
            80
          );
          return;
        }

        const args = _pendingArgs;
        _pendingArgs = null;
        _pendingTimer = null;

        if (_lastIntent.tipo !== args.tipo || _lastIntent.limit !== args.limit)
          return;

        _inFlight = true;
        BUSY = true;
        try {
          toggleLoading(true);
          if (btnReload) btnReload.disabled = true;

          filtroCategoria = args.tipo;

          const items = await fetchHistorico(args.limit, filtroCategoria);
          if (items.length) allItems = items; // só troca se veio algo
          renderLista(allItems);

          // auto scroll p/ primeira "nova"
          if (lastSeenAt) {
            const firstNew = list.querySelector(".ia-card.is-new");
            if (firstNew)
              firstNew.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        } catch (e) {
          if (e?.name !== "AbortError") {
            console.error("Falha ao carregar histórico:", e);
            list.innerHTML = `<div class="alert alert-danger">Falha ao carregar histórico.</div>`;
          }
        } finally {
          if (btnReload) btnReload.disabled = false;
          toggleLoading(false);
          BUSY = false;
          _inFlight = false;

          // se chegou nova intenção enquanto rodava, executa a última agora
          if (_pendingArgs) {
            const next = _pendingArgs;
            _pendingArgs = null;
            window.carregarHistorico(next.limit, next.tipo);
          }
        }
      }, 80); // debounce curto para rajadas
    };

    // Objeto utilitário
    window.__HistoricoIA = {
      recarregar: () => window.carregarHistorico(_limitAtual, filtroCategoria),
      filtrar: (tipo) => {
        filtroCategoria = _normalizeTipo(tipo) || "";
        _limitAtual = PREVIEW_LIMIT;
        return window.carregarHistorico(_limitAtual, filtroCategoria);
      },
      get filtro() {
        return filtroCategoria;
      },
      set filtro(t) {
        filtroCategoria = _normalizeTipo(t) || "";
      },
    };

    // ===== Ações / eventos =====
    btnReload?.addEventListener("click", () =>
      window.__HistoricoIA.recarregar()
    );
    btnMarcarLidas?.addEventListener("click", () => {
      const newest = allItems[0]?.criado_em;
      if (newest) {
        localStorage.setItem(KEY_LAST_SEEN, parseStamp(newest).toISOString());
        lastSeenAt = localStorage.getItem(KEY_LAST_SEEN);
        renderLista(allItems);
      }
    });
    btnHistoricoIA?.addEventListener("click", async (ev) => {
      if (!ev.isTrusted) return; // evita aberturas programáticas
      await window.__HistoricoIA.recarregar();
      const newest = allItems[0]?.criado_em;
      if (newest) {
        localStorage.setItem(KEY_LAST_SEEN, parseStamp(newest).toISOString());
        lastSeenAt = localStorage.getItem(KEY_LAST_SEEN);
        badge?.classList.add("d-none");
      }
    });

    // Filtros por atributo (recomendado — mantém compat)
    if (filterButtons && filterButtons.length) {
      // remove handlers antigos (defensivo) e reata um único handler
      filterButtons.forEach((btn) => btn.replaceWith(btn.cloneNode(true)));
      document
        .querySelectorAll("[data-ia-filtro],[data-filter]")
        .forEach((btn) => {
          btn.addEventListener(
            "click",
            (ev) => {
              if (!ev.isTrusted) return; // 🛡️ só clique humano
              if (filtroLock) return;
              filtroLock = true;
              setTimeout(() => (filtroLock = false), 400);

              if (!btn.classList.contains("active")) {
                document
                  .querySelectorAll("[data-ia-filtro],[data-filter]")
                  .forEach((b) => b.classList.remove("active"));
                btn.classList.add("active");
              }

              // libera 1000ms para permitir o fetch filtrado
              _allowFilteredUntil = performance.now() + 1000;

              const f = _normalizeTipo(
                btn.getAttribute("data-ia-filtro") ||
                  btn.getAttribute("data-filter")
              );
              window.__HistoricoIA.filtrar(f || "");
            },
            { passive: true }
          );
        });
    }

    // Compat: botões por ID (se existirem) — também exigem clique humano
    btnFiltroIDs.todas?.addEventListener("click", (ev) => {
      if (!ev.isTrusted) return;
      _allowFilteredUntil = performance.now() + 1000;
      window.__HistoricoIA.filtrar(null);
    });
    btnFiltroIDs.positivas?.addEventListener("click", (ev) => {
      if (!ev.isTrusted) return;
      _allowFilteredUntil = performance.now() + 1000;
      window.__HistoricoIA.filtrar("positiva");
    });
    btnFiltroIDs.alertas?.addEventListener("click", (ev) => {
      if (!ev.isTrusted) return;
      _allowFilteredUntil = performance.now() + 1000;
      window.__HistoricoIA.filtrar("alerta");
    });
    btnFiltroIDs.neutras?.addEventListener("click", (ev) => {
      if (!ev.isTrusted) return;
      _allowFilteredUntil = performance.now() + 1000;
      window.__HistoricoIA.filtrar("neutra");
    });

    // Auto-refresh a cada 60s (pausa quando aba oculta)
    function startAutoRefresh() {
      stopAutoRefresh();
      refreshTimer = setInterval(() => {
        if (document.hidden) return;
        window.__HistoricoIA.recarregar();
      }, 60000);
    }
    function stopAutoRefresh() {
      if (refreshTimer) clearInterval(refreshTimer);
      refreshTimer = null;
    }

    // Init (uma chamada só)
    (async () => {
      await window.carregarHistorico(PREVIEW_LIMIT, null); // carga inicial SEM filtro
      startAutoRefresh();
    })();

    // “Ver mais” no preview (aumenta limit local)
    document
      .getElementById("btnVerMais")
      ?.addEventListener("click", async (ev) => {
        if (!ev.isTrusted) return;
        _limitAtual += MORE_INCREMENT;
        await window.carregarHistorico(_limitAtual, filtroCategoria);
      });

    // ========= Modo Turbo (Gerar Dica 30d) =========
    const btnTurbo = document.getElementById("btnTurbo");
    const st = document.getElementById("turboStatus");
    const box = document.getElementById("turboResult");
    const dica = document.getElementById("turboDica");

    if (btnTurbo && st && box && dica) {
      btnTurbo.onclick = async (ev) => {
        if (!ev.isTrusted) return;
        btnTurbo.disabled = true;
        st.textContent = "Analisando…";
        st.classList.remove("d-none");
        box.classList.add("d-none");

        try {
          const r = await fetch("/financeiro/ia/dica30d/", {
            method: "POST",
            headers: {
              "X-Requested-With": "XMLHttpRequest",
              "X-CSRFToken": getCsrfToken(),
              Accept: "application/json",
            },
            credentials: "same-origin",
          });
          const j = await r.json();
          console.log("✅ [Dica30d] resposta:", j);

          if (j && j.ok) {
            const titulo = j.title || "Dica dos últimos 30 dias";
            const texto = j.text || j.dica || "(sem texto)";
            const quando = j.created_at || new Date().toLocaleString("pt-BR");
            dica.textContent = `${titulo} — ${texto}\n(Insight • ${quando})`;
            box.classList.remove("d-none");
            st.textContent = "✅ Pronto! Nova dica gerada.";

            // métricas (opcional)
            const ul = document.getElementById("turboMetrics");
            const detailsEl = ul ? ul.closest("details") : null;
            if (ul) {
              const linhas = [];
              if (Array.isArray(j.metrics))
                for (const m of j.metrics) linhas.push(String(m));
              else if (j.metrics && typeof j.metrics === "object") {
                for (const [k, v] of Object.entries(j.metrics))
                  linhas.push(`${labelize(k)}: ${fmt(v)}`);
              }
              if (j.receitas != null)
                linhas.push(`Receitas (30d): ${fmtMoeda(j.receitas)}`);
              if (j.despesas != null)
                linhas.push(`Despesas (30d): ${fmtMoeda(j.despesas)}`);
              if (j.saldo != null)
                linhas.push(`Saldo (30d): ${fmtMoeda(j.saldo)}`);
              if (j.margem != null)
                linhas.push(`Margem: ${Number(j.margem).toFixed(1)}%`);
              if (j.periodo || j.range)
                linhas.push(`Período: ${j.periodo || j.range}`);

              if (linhas.length) {
                ul.innerHTML = linhas
                  .map((li) => `<li>${escapeHtml(li)}</li>`)
                  .join("");
                if (detailsEl) detailsEl.open = true;
              } else {
                ul.innerHTML = "";
                if (detailsEl) detailsEl.open = false;
              }
            }

            // recarrega lista pra já aparecer a dica nova (se a API salvar)
            window.carregarHistorico(PREVIEW_LIMIT, filtroCategoria);
          } else {
            st.textContent = "⚠️ Não consegui gerar a dica.";
          }
        } catch (e) {
          console.error("💥 [Dica30d] erro:", e);
          st.textContent = "Erro na solicitação.";
        } finally {
          btnTurbo.disabled = false;
          setTimeout(() => st.classList.add("d-none"), 2000);
        }
      };
    }

    // === PATCH: Diagnóstico e wire leve dos botões ===
    (function () {
      const req = {
        listaHistorico: !!document.getElementById("listaHistorico"),
        btnTurbo: !!document.getElementById("btnTurbo"),
        btnReloadDicas: !!document.getElementById("btnReloadDicas"),
        filtros: !!document.querySelectorAll("[data-ia-filtro],[data-filter]")
          .length,
      };
      console.log("🔎 Diagnóstico elementos:", req);

      const __BTN_VER_HIST__ = document.getElementById("btnHistoricoIA");
      if (__BTN_VER_HIST__) {
        __BTN_VER_HIST__.addEventListener("click", (ev) => {
          if (!ev.isTrusted) return;
          console.log("🧠 [Historico] abrir modal + carregar()");
          window.carregarHistorico(20, "");
        });
      }
    })();
  });
  // ---- Shims p/ integração com outros módulos (ex.: dashboard.js) ----
 window.__IA_HIST_BADGE_UPDATE = function () {
   try {
     atualizarBadgeTotal();
   } catch (e) {}
 };


  window.__IA_HIST_MARK_SEEN = function (items) {
    try {
      const stamps = (items || [])
        .map((x) => parseStamp(x.criado_em)?.getTime() || 0)
        .filter(Boolean)
        .sort((a, b) => b - a);
      const newest = stamps[0];
      if (newest) {
        localStorage.setItem(KEY_LAST_SEEN, new Date(newest).toISOString());
        lastSeenAt = localStorage.getItem(KEY_LAST_SEEN);
        if (badge) badge.classList.add("d-none");
      }
    } catch (e) {}
  };
})();

// ======================================================
// 🔄 Integração com botão "Atualizar" do modal (dashboard.html)
// ======================================================
document.addEventListener("DOMContentLoaded", () => {
  const btnModalReload = document.getElementById("btnReloadDicasModal");
  if (!btnModalReload) return;

  btnModalReload.addEventListener("click", (ev) => {
    if (!ev.isTrusted) return; // evita triggers automáticos
    console.log("🧠 [Historico] Recarregando via botão do modal...");
    try {
      if (window.__HistoricoIA && typeof window.__HistoricoIA.recarregar === "function") {
        window.__HistoricoIA.recarregar();
      } else {
        console.warn("⚠️ Módulo __HistoricoIA não encontrado — recarregar ignorado.");
      }
    } catch (err) {
      console.error("💥 Erro ao tentar recarregar histórico via modal:", err);
    }
  });
});



