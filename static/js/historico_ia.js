// ======================================================
// historico_ia.js — versão “clean”, single-flight + gate de filtro (corrigido)
// ======================================================
(function () {
  ("use strict");

  const __LOAD_TS__ = performance.now();

  // ---- Guardião: impede rodar duas vezes o mesmo script (fix)
  if (globalThis.__IA_HIST_INIT_DONE__) {
    console.warn(
      "⚠️ historico_ia.js já inicializado — abortando segunda carga."
    );
    return;
  }
  globalThis.__IA_HIST_INIT_DONE__ = true;

  console.log("🔍 historico_ia.js carregado");

  // ========= Helpers globais =========
  function parseStamp(s) {
    if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return new Date(s); // ISO
    const m = RegExp(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/
    ).exec(String(s));
    if (!m) return new Date(s);
    const [, d, mo, y, h, i] = m.map(Number);
    return new Date(y, mo - 1, d, h, i);
  }
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
      .replace(/\r?\n+/g, " ")
      .replace(/\s+/g, " ")
      .replace(/[.…]+$/g, "")
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
  const PREVIEW_LIMIT = 5;
  const MORE_INCREMENT = 10;
  const KEY_LAST_SEEN = "iaHistoricoLastSeenAt";

  let _allowFilteredUntil = 0;

  let lastHistUrl = "";
  let _lastIntent = { limit: null, tipo: "" };
  let _abortCtrl = null;
  let _pendingTimer = null;
  let _pendingArgs = null;
  let _inFlight = false;

  let lastSeenAt = null;
  let allItems = [];
  let filtroCategoria = "";
  let refreshTimer = null;
  let BUSY = false;
  let _limitAtual = PREVIEW_LIMIT;

  let filtroLock = false;

  // paginação por offset
  let _offsetAtual = 0;
  let _hasMoreAtual = false;

  document.addEventListener("DOMContentLoaded", () => {
    if (document.body.dataset.iaHistoricoInit === "1") return;
    document.body.dataset.iaHistoricoInit = "1";

    const list =
      document.getElementById("listaHistorico") ||
      document.getElementById("listaHistoricoPreview") ||
      document.getElementById("listaHistoricoModal");

    if (!list) {
      console.warn("⚠️ Nenhum container de histórico encontrado.");
      return;
    }

    // FEED_URL
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

    // Modal mirror
    const modalEl = document.getElementById("modalHistoricoIA");
    const modalList = document.getElementById("listaHistoricoModal");
    const btnVerMaisDom = document.getElementById("btnVerMaisHistorico");

    if (modalEl && list && modalList) {
      modalEl.addEventListener("show.bs.modal", function () {
        modalList.innerHTML = list.innerHTML;
      });
    }

    // Garante botão Ver mais
    (function ensureVerMaisButton() {
      let btn = btnVerMaisDom || document.getElementById("btnVerMaisHistorico");
      if (!btn) {
        btn = document.createElement("button");
        btn.id = "btnVerMaisHistorico";
        btn.className = "btn btn-outline-secondary btn-sm mt-2";
        btn.textContent = "Ver mais";
        list.insertAdjacentElement("afterend", btn);
      }
    })();

    // “Ver mais” principal
    document
      .getElementById("btnVerMaisHistorico")
      ?.addEventListener("click", async (ev) => {
        if (!ev.isTrusted) return;
        const btn = ev.currentTarget;
        btn.disabled = true;
        btn.textContent = "Carregando...";

        if (!_hasMoreAtual) {
          console.log("⚠️ Não há mais itens para carregar.");
          btn.textContent = "Sem mais registros";
          return;
        }

        await window.carregarHistorico(
          PREVIEW_LIMIT,
          filtroCategoria,
          true /* append */
        );

        if (!_hasMoreAtual) {
          btn.style.display = "none";
        } else {
          btn.disabled = false;
          btn.textContent = "Ver mais";
        }
      });

    // Badge/contadores/overlay
    const badge = document.getElementById("badgeNovasDicas");
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

    const filterButtons = document.querySelectorAll(
      "[data-ia-filtro],[data-filter]"
    );
    const btnFiltroIDs = {
      todas: document.getElementById("btnTodas"),
      positivas: document.getElementById("btnPositivas"),
      alertas: document.getElementById("btnAlertas"),
      neutras: document.getElementById("btnNeutras"),
    };

    lastSeenAt = localStorage.getItem(KEY_LAST_SEEN) || null;

    function cardHTML(it) {
      const quando = escapeHtml(formatarDataBR(it.criado_em) || "");
      const _t = String(it.tipo || "geral")
        .trim()
        .toLowerCase();
      const tag = escapeHtml(_t.replace(/^./, (c) => c.toUpperCase()));

      const isNew =
        lastSeenAt &&
        parseStamp(it.criado_em)?.getTime() > new Date(lastSeenAt).getTime();

      const cor =
        _t === "positiva"
          ? "success"
          : _t === "alerta"
            ? "warning"
            : "secondary";

      let titulo = String(it.title || "").trim();
      const texto = String(it.text || "").trim();

      const tNorm = _normSnippet(titulo);
      const xHead = _normSnippet(texto.split("\n")[0] || "");
      let hideTitle = false;
      if (tNorm && xHead) {
        const n = Math.max(10, Math.floor(tNorm.length * 0.8));
        hideTitle = xHead.startsWith(tNorm.slice(0, n));
      }
      if (hideTitle) titulo = "";

      return `
        <div class="card border-${cor} mb-3 shadow-sm ia-card ${isNew ? "is-new" : ""}" data-kind="${escapeHtml(_t)}">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <span class="badge bg-success-subtle text-success border border-success-subtle">${tag}</span>
              <small class="text-muted">${quando}</small>
            </div>
            ${titulo ? `<h6 class="card-title text-success mb-1">${escapeHtml(titulo)}</h6>` : ""}
            <p class="card-text mb-0" style="white-space: pre-wrap">${escapeHtml(texto)}</p>
          </div>
        </div>`;
    }

    function atualizarBadgeTotal() {
      const badge = document.getElementById("badgeNovasDicas");
      if (!badge) return;
      const lastISO = lastSeenAt ? new Date(lastSeenAt).getTime() : 0;
      const base = Array.isArray(allItems) ? allItems : [];
      const cnt = lastISO
        ? base.filter(
            (i) => (parseStamp(i.criado_em)?.getTime() || 0) > lastISO
          ).length
        : base.length || 0;
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
    window.setContadoresBackend = setContadoresBackend;

    function toggleLoading(show) {
      const elOvl = document.getElementById("ovlHistorico");
      if (!elOvl) return;
      elOvl.classList.toggle("d-none", !show);
    }

    function renderLista(items) {
      const list = document.getElementById("listaHistorico");
      if (!list) return;
      const filtered = filtroCategoria
        ? items.filter((i) => i.tipo === filtroCategoria)
        : items;
      if (!filtered.length) {
        list.innerHTML = `<div class="alert alert-secondary mb-2">Nenhuma dica encontrada.</div>`;
        atualizarBadgeTotal();
        atualizarContadoresUI(items);
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

    async function fetchHistorico(a = 20, b = "", opt = {}) {
      let limit = 20;
      let tipo = "";
      const append = !!opt.append;
      const offset =
        Number.isFinite(opt.offset) && opt.offset >= 0 ? opt.offset : 0;

      if (typeof a === "number" && Number.isFinite(a)) limit = a;
      else if (typeof a === "string" && isNaN(Number(a))) tipo = a;

      if (typeof b === "number" && Number.isFinite(b)) limit = b;
      else if (typeof b === "string" && isNaN(Number(b))) tipo = b;

      if (!Number.isFinite(limit) || limit <= 0) limit = 20;
      const t = _normalizeTipo(tipo) || "";

      if (
        typeof performance !== "undefined" &&
        performance.now() - __LOAD_TS__ < 1500
      ) {
        if (t === "neutra" || t === "alerta" || t === "positiva")
          return { items: [], hasMore: false, offset };
      }
      if (
        (t === "neutra" || t === "alerta" || t === "positiva") &&
        typeof performance !== "undefined" &&
        performance.now() > _allowFilteredUntil
      ) {
        return { items: [], hasMore: false, offset };
      }

      if (
        _lastIntent &&
        (_lastIntent.tipo !== t || _lastIntent.limit !== limit)
      )
        return { items: [], hasMore: false, offset };

      const qs = new URLSearchParams();
      qs.set("limit", String(limit));
      if (t) qs.set("tipo", t);
      if (append) qs.set("offset", String(offset));

      const finalUrl = `${FEED_URL}?${qs.toString()}`;
      if (!append && lastHistUrl === finalUrl)
        return { items: [], hasMore: false, offset };
      if (!append) lastHistUrl = finalUrl;

      if (_abortCtrl) {
        try {
          _abortCtrl.abort();
        } catch {/* */}
      }
      _abortCtrl = new AbortController();
      const signal = _abortCtrl.signal;

      console.log("[Historico] GET", finalUrl);
      const r = await fetch(finalUrl, {
        headers: { Accept: "application/json" },
        credentials: "same-origin",
        signal,
      });
      if (!r.ok) throw new Error(`HTTP ${r.status} @ ${FEED_URL}`);
      const json = await r.json();
      console.log("↩️ payload", json);
      const arr = (json && (json.items || json.results || json.data)) || [];
      const hasMore = !!(
        json &&
        (json.has_more === true || json.hasMore === true || json.has_more === 1)
      );
      console.log(
        "↩️ items:",
        Array.isArray(arr) ? arr.length : 0,
        "hasMore:",
        hasMore
      );

      if (json && json.count && typeof setContadoresBackend === "function") {
        try {
          setContadoresBackend(json.count);
        } catch {/* */}
      }

      const items = (Array.isArray(arr) ? arr : []).map((x) => {
        const criadoRaw =
          x.criado_em || x.created_at || x.created_at_br || x.data || "";
        const stamp = parseStamp(criadoRaw)?.getTime() || 0;
        const k = (
          x.tipo ||
          x.categoria ||
          x.categoria_dominante ||
          x.kind ||
          "geral"
        )
          .toString()
          .toLowerCase()
          .trim();
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
          tipo:
            k === "alerta" || k === "positiva" || k === "neutra" ? k : "neutra",
          title,
          text: txt || "Sem conteúdo disponível.",
          criado_em_fmt: x.criado_em_fmt || "",
        };
      });

      items.sort((a, b) => b._stamp - a._stamp);
      return { items, hasMore, offset };
    }

    window.carregarHistorico = function carregarHistorico(
      limit = 20,
      tipo = null,
      append = false
    ) {
      let _tipoNorm = _normalizeTipo(tipo) || "";
      const _limit = Number.isFinite(limit) && limit > 0 ? limit : 20;

      if (
        (_tipoNorm === "positiva" ||
          _tipoNorm === "alerta" ||
          _tipoNorm === "neutra") &&
        performance.now() > _allowFilteredUntil
      ) {
        _tipoNorm = "";
      }

      _pendingArgs = { limit: _limit, tipo: _tipoNorm, append };
      _lastIntent = { limit: _limit, tipo: _tipoNorm };

      if (_pendingTimer) clearTimeout(_pendingTimer);
      _pendingTimer = setTimeout(async () => {
        if (_inFlight) {
          _pendingTimer = setTimeout(
            () =>
              window.carregarHistorico(
                _pendingArgs.limit,
                _pendingArgs.tipo,
                _pendingArgs.append
              ),
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
          const btnReload = document.getElementById("btnReloadDicas");
          if (btnReload) btnReload.disabled = true;

          if (!args.append) {
            _offsetAtual = 0;
            allItems = [];
          }
          filtroCategoria = args.tipo;

          const { items, hasMore } = await fetchHistorico(
            args.limit,
            filtroCategoria,
            { append: !!args.append, offset: _offsetAtual }
          );

          if (items && items.length) {
            if (args.append) {
              allItems = allItems.concat(items);
              _offsetAtual += items.length;
            } else {
              allItems = items;
              _offsetAtual = items.length;
            }
          }

          _hasMoreAtual = !!hasMore;
          renderLista(allItems);

          if (lastSeenAt && !args.append) {
            const firstNew = document
              .getElementById("listaHistorico")
              ?.querySelector(".ia-card.is-new");
            if (firstNew)
              firstNew.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        } catch (e) {
          if (e?.name !== "AbortError") {
            console.error("Falha ao carregar histórico:", e);
            const list = document.getElementById("listaHistorico");
            if (list)
              list.innerHTML = `<div class="alert alert-danger">Falha ao carregar histórico.</div>`;
          }
        } finally {
          const btnReload = document.getElementById("btnReloadDicas");
          if (btnReload) btnReload.disabled = false;
          toggleLoading(false);
          BUSY = false;
          _inFlight = false;

          if (_pendingArgs) {
            const next = _pendingArgs;
            _pendingArgs = null;
            window.carregarHistorico(next.limit, next.tipo, next.append);
          }
        }
      }, 80);
    };

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

    document
      .getElementById("btnReloadDicas")
      ?.addEventListener("click", () => window.__HistoricoIA.recarregar());

    document.getElementById("btnMarcarLidas")?.addEventListener("click", () => {
      const newest = allItems[0]?.criado_em;
      if (newest) {
        localStorage.setItem(KEY_LAST_SEEN, parseStamp(newest).toISOString());
        lastSeenAt = localStorage.getItem(KEY_LAST_SEEN);
        const list = document.getElementById("listaHistorico");
        if (list)
          list
            .querySelectorAll(".ia-card.is-new")
            .forEach((el) => el.classList.remove("is-new"));
        const badge = document.getElementById("badgeNovasDicas");
        badge?.classList.add("d-none");
      }
    });

    document
      .getElementById("btnHistoricoIA")
      ?.addEventListener("click", async (ev) => {
        if (!ev.isTrusted) return;
        await window.__HistoricoIA.recarregar();
        const newest = allItems[0]?.criado_em;
        if (newest) {
          localStorage.setItem(KEY_LAST_SEEN, parseStamp(newest).toISOString());
          lastSeenAt = localStorage.getItem(KEY_LAST_SEEN);
          const badge = document.getElementById("badgeNovasDicas");
          badge?.classList.add("d-none");
        }
      });

    if (filterButtons && filterButtons.length) {
      filterButtons.forEach((btn) => btn.replaceWith(btn.cloneNode(true)));
      document
        .querySelectorAll("[data-ia-filtro],[data-filter]")
        .forEach((btn) => {
          btn.addEventListener(
            "click",
            (ev) => {
              if (!ev.isTrusted || filtroLock) return;
              filtroLock = true;
              setTimeout(() => (filtroLock = false), 400);

              if (!btn.classList.contains("active")) {
                document
                  .querySelectorAll("[data-ia-filtro],[data-filter]")
                  .forEach((b) => b.classList.remove("active"));
                btn.classList.add("active");
              }

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

    (async () => {
      await window.carregarHistorico(PREVIEW_LIMIT, null);
      startAutoRefresh();
    })();

    // Diagnóstico
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
  // ⚡ Gerar Nova Dica (30 dias) -> POST e recarrega o histórico
  (function () {
    const endpoints = [
      document.getElementById("btnGerarDica"),
      document.getElementById("btnGerarDica30d"),
      document.getElementById("btnGerarNovaDica"),
    ].filter(Boolean);

    if (!endpoints.length) return;

    async function gerarEDepoisRecarregar(btn) {
      if (!btn) return;
      if (btn.dataset.busy === "1") return;
      btn.dataset.busy = "1";
      const original = btn.textContent;
      btn.disabled = true;
      btn.textContent = "Gerando…";

      try {
        const r = await fetch("/financeiro/ia/gerar_dica_30d/", {
          method: "POST",
          headers: {
            "X-CSRFToken": getCsrfToken(),
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify({ modo: "30d" }),
        });

        if (!r.ok) throw new Error(`HTTP ${r.status}`);
       const json = await r.json();
       console.log("⚡ dica gerada:", json);
       lastHistUrl = ""; // <— adicione esta linha
       _allowFilteredUntil = performance.now() + 1000; // <— opcional, preserva filtro
       // Se o backend retornar a dica criada, beleza. Mesmo assim, garantimos:
        await window.__HistoricoIA.recarregar(); // mantém filtro atual
      } catch (e) {
        console.error("Falha ao gerar dica:", e);
        alert("Não consegui gerar a dica agora. Tente novamente em instantes.");
      } finally {
        btn.textContent = original;
        btn.disabled = false;
        btn.dataset.busy = "0";
      }
    }

    endpoints.forEach((btn) => {
      btn.addEventListener("click", (ev) => {
        if (!ev.isTrusted) return;
        gerarEDepoisRecarregar(btn);
      });
    });
  })();

  // 🔄 Botão "Atualizar" do modal
  document.addEventListener("DOMContentLoaded", () => {
    const btnModalReload = document.getElementById("btnReloadDicasModal");
    if (!btnModalReload) return;
    btnModalReload.addEventListener("click", (ev) => {
      if (!ev.isTrusted) return;
      console.log("🧠 [Historico] Recarregando via botão do modal...");
      try {
        if (
          window.__HistoricoIA &&
          typeof window.__HistoricoIA.recarregar === "function"
        ) {
          window.__HistoricoIA.recarregar();
        } else {
          console.warn(
            "⚠️ Módulo __HistoricoIA não encontrado — recarregar ignorado."
          );
        }
      } catch (err) {
        console.error("💥 Erro ao tentar recarregar histórico via modal:", err);
      }
    });
  });
})();
