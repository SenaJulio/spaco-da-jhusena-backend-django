// ======================================================
// historico_ia.js — Histórico IA v1 (com chips coloridas)
// ======================================================
(() => {
  "use strict";

  // ---------- Guards / Config ----------
  if (globalThis.__HIST_IA_INIT__) return;
  globalThis.__HIST_IA_INIT__ = true;

  // AppUtils opcional (apenas para formatação, se existir)
  const { fmtDate } = globalThis.AppUtils || {};

  // ---------- Constantes ----------
  const DEBUG = false;
  const log = DEBUG ? console.log.bind(console, "[Historico]") : () => {};
  const warn = DEBUG ? console.warn.bind(console, "[Historico]") : () => {};
  const err = console.error.bind(console, "[Historico]");

  const AWAIT_RETRY_MS = 80;
  const FILTER_GRACE_MS = 1000;
  const AUTOREFRESH_MS = 60000;
  const PREVIEW_LIMIT = 5;
  const INITIAL_LIMIT = 20;
  const TITLE_MAX = 60;
  const KEY_LAST_SEEN = "iaHistoricoLastSeenAt";
  const LOAD_TS = typeof performance === "undefined" ? 0 : performance.now();

  // ---------- Estado ----------
  let FEED_URL = "/financeiro/ia/historico/feed/v2/";
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
  let _limitAtual = PREVIEW_LIMIT;

  let _offsetAtual = 0;
  let _hasMoreAtual = false;
  let refreshTimer = null;

  // ---------- Utils ----------
  function parseStamp(s) {
    if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return new Date(s);

    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/.exec(
      String(s)
    );
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

  function normalizeTipo(v) {
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
    const m = /(^|;\s*)csrftoken=([^;]+)/.exec(document.cookie);
    return m ? decodeURIComponent(m[2]) : "";
  }

  function textNode(txt) {
    return document.createTextNode(String(txt ?? ""));
  }

  // ---------- Render seguro ----------
  function createChip(tipo) {
    const span = document.createElement("span");
    span.className = "chip";
    span.title = "Categoria";
    span.classList.add(
      tipo === "positiva"
        ? "chip-success"
        : tipo === "alerta"
          ? "chip-warning"
          : "chip-neutral"
    );
    span.appendChild(textNode(tipo.replace(/^./, (c) => c.toUpperCase())));
    return span;
  }

  function buildCard(it) {
    const tipo = String(it.tipo || it.kind || "neutra").toLowerCase();
    const raw = it.criado_em || it.created_at || "";
    let quando = raw;

    if (typeof formatarDataBR === "function") {
      quando = formatarDataBR(raw);
    } else if (typeof fmtDate === "function") {
      quando = fmtDate(raw);
    }

    const titulo = String(it.title || "Dica da IA").trim();
    const texto = String(
      it.text || it.texto || it.dica || "Sem conteúdo disponível."
    ).trim();

    const card = document.createElement("div");
    card.className = `card ia-card${it.isNew ? " is-new" : ""}`;
    if (it.id != null) card.dataset.id = String(it.id);
    card.dataset.kind = tipo;

    const body = document.createElement("div");
    body.className = "card-body";

    const header = document.createElement("div");
    header.className = "d-flex align-items-center justify-content-between";

    const titleEl = document.createElement("div");
    titleEl.className = "fw-semibold";
    titleEl.appendChild(textNode(titulo));
    header.appendChild(titleEl);
    header.appendChild(createChip(tipo));

    const p = document.createElement("p");
    p.className = "mt-2 mb-2";
    p.style.whiteSpace = "pre-wrap";

    // 🌈 cor da frase por tipo
    if (tipo === "positiva") {
      p.classList.add("ia-text-positiva");
    } else if (tipo === "alerta") {
      p.classList.add("ia-text-alerta");
    } else {
      p.classList.add("ia-text-neutra");
    }

    p.appendChild(textNode(texto));


    const foot = document.createElement("div");
    foot.className = "text-muted small";
    foot.appendChild(textNode(`Criada em: ${quando}`));

    body.appendChild(header);
    body.appendChild(p);
    body.appendChild(foot);
    card.appendChild(body);
    return card;
  }

  function renderListaSafe(container, items) {
    const frag = document.createDocumentFragment();
    for (const it of items) frag.appendChild(buildCard(it));
    container.replaceChildren(frag);
  }

  // ---------- UI helpers ----------
  function atualizarBadgeTotal(badgeEl) {
    if (!badgeEl) return;
    const lastISO = lastSeenAt ? new Date(lastSeenAt).getTime() : 0;
    const base = Array.isArray(allItems) ? allItems : [];
    const cnt = lastISO
      ? base.filter((i) => (parseStamp(i.criado_em)?.getTime() || 0) > lastISO)
          .length
      : base.length || 0;

    if (cnt > 0) {
      badgeEl.textContent = `Novas dicas: ${cnt}`;
      badgeEl.classList.remove("d-none");
    } else {
      badgeEl.classList.add("d-none");
    }
  }

  function atualizarContadoresUI(
    { elCountAll, elCountPos, elCountAlerta, elCountNeutra },
    itemsAll
  ) {
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
    for (const [id, val] of Object.entries(map)) {
      const el = document.getElementById(id);
      if (el) el.textContent = String(val);
    }
  }
  globalThis.setContadoresBackend = setContadoresBackend;

  function toggleLoading(overlayEl, show) {
    overlayEl?.classList.toggle("d-none", !show);
  }

  function renderLista(container, countersEls, badgeEl) {
    if (!container) return;
    const filtered = filtroCategoria
      ? allItems.filter((i) => i.tipo === filtroCategoria)
      : allItems;

    if (!filtered.length) {
      container.replaceChildren();
      const alertDiv = document.createElement("div");
      alertDiv.className = "alert alert-secondary mb-2 text-center fst-italic";

      const msg = filtroCategoria
        ? "Nenhuma dica encontrada para este filtro ainda. Gere uma nova dica ou ajuste o período."
        : "Nenhuma dica encontrada ainda. Gere uma nova dica no botão acima.";

      alertDiv.appendChild(textNode(msg));
      container.appendChild(alertDiv);
      atualizarBadgeTotal(badgeEl);
      atualizarContadoresUI(countersEls, allItems);
      return;
    }


    renderListaSafe(container, filtered);

    const lastId = globalThis.__LAST_DICA_ID__ ?? null;
    if (lastId) {
      const el = container.querySelector(`.ia-card[data-id="${lastId}"]`);
      if (el) {
        el.classList.add("just-added");
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => {
          el.classList.remove("just-added");
          if (globalThis.__LAST_DICA_ID__ === lastId) {
            globalThis.__LAST_DICA_ID__ = null;
          }
        }, 1400);
      }
    }

    requestAnimationFrame(() => {
      for (const el of container.querySelectorAll(".ia-card")) {
        el.classList.add("fade-in");
      }
    });

    atualizarBadgeTotal(badgeEl);
    atualizarContadoresUI(countersEls, allItems);
  }

  // ---------- Auto refresh ----------
  function stopAutoRefresh() {
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = null;
  }

  function startAutoRefresh() {
    stopAutoRefresh();
    refreshTimer = setInterval(() => {
      if (!document.hidden) globalThis.__HistoricoIA?.recarregar?.();
    }, AUTOREFRESH_MS);
  }

  // ---------- Fetch / Orquestração ----------
  function shouldGateFilter(t) {
    if (typeof performance === "undefined") return false;
    const elapsed = performance.now() - LOAD_TS;

    // Evita filtros logo no comecinho do load
    if (
      elapsed < 1500 &&
      (t === "neutra" || t === "alerta" || t === "positiva")
    ) {
      return true;
    }
    return false;
  }

  function buildQuery(limit, t, append, offset) {
    const qs = new URLSearchParams();
    qs.set("limit", String(limit));
    if (t) qs.set("tipo", t);
    if (append) qs.set("offset", String(offset));
    return `${FEED_URL}?${qs.toString()}`;
  }

  function normalizeItems(jsonArr) {
    const arr = Array.isArray(jsonArr) ? jsonArr : [];
    const out = arr.map((x) => {
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

      let title = x.title || x.titulo || "";
      if (!title) {
        if (txt) {
          const head = txt.split("\n")[0];
          title =
            head.slice(0, TITLE_MAX) + (head.length > TITLE_MAX ? "…" : "");
        } else {
          title = "Dica da IA";
        }
      }

      const tipo =
        k === "alerta" || k === "positiva" || k === "neutra" ? k : "neutra";

      return {
        id: x.id,
        criado_em: criadoRaw,
        _stamp: stamp,
        tipo,
        title,
        text: txt || "Sem conteúdo disponível.",
        criado_em_fmt: x.criado_em_fmt || "",
      };
    });

    out.sort((a, b) => b._stamp - a._stamp);
    return out;
  }

  async function fetchHistorico(a = INITIAL_LIMIT, b = "", opt = {}) {
    let limit = INITIAL_LIMIT;
    let tipo = "";

    const append = !!opt.append;
    const offset =
      Number.isFinite(opt.offset) && opt.offset >= 0 ? opt.offset : 0;

    if (typeof a === "number" && Number.isFinite(a)) limit = a;
    else if (typeof a === "string" && Number.isNaN(Number(a))) tipo = a;

    if (typeof b === "number" && Number.isFinite(b)) limit = b;
    else if (typeof b === "string" && Number.isNaN(Number(b))) tipo = b;

    if (!Number.isFinite(limit) || limit <= 0) limit = INITIAL_LIMIT;
    const t = normalizeTipo(tipo) || "";

    if (shouldGateFilter(t)) return { items: [], hasMore: false, offset };
    if (_lastIntent && (_lastIntent.tipo !== t || _lastIntent.limit !== limit))
      return { items: [], hasMore: false, offset };

    const finalUrl = buildQuery(limit, t, append, offset);
    if (!append && lastHistUrl === finalUrl)
      return { items: [], hasMore: false, offset };
    if (!append) lastHistUrl = finalUrl;

    if (_abortCtrl) {
      try {
        _abortCtrl.abort();
      } catch {
        /* ignore */
      }
    }
    _abortCtrl = new AbortController();

    log("GET", finalUrl);
    const r = await fetch(finalUrl, {
      headers: { Accept: "application/json" },
      credentials: "same-origin",
      signal: _abortCtrl.signal,
    });
    if (!r.ok) throw new Error(`HTTP ${r.status} @ ${FEED_URL}`);
    const json = await r.json();
    log("payload", json);

    const raw = (json && (json.items || json.results || json.data)) || [];
    const items = normalizeItems(raw);
    const hasMore = !!(
      json &&
      (json.has_more === true || json.hasMore === true || json.has_more === 1)
    );

    if (json?.count && typeof setContadoresBackend === "function") {
      try {
        setContadoresBackend(json.count);
      } catch {
        /* ignore */
      }
    }

    return { items, hasMore, offset };
  }

  function updateStateAfterFetch(result, args) {
    const { items, hasMore } = result;

    const prevItems = allItems;
    const prevOffset = _offsetAtual;

    filtroCategoria = args.tipo;

    if (items && items.length) {
      if (args.append) {
        allItems = prevItems.concat(items);
        _offsetAtual = prevOffset + items.length;
      } else {
        allItems = items.slice();
        _offsetAtual = items.length;
      }
    } else if (!args.append) {
      allItems = prevItems; // preserva
      _offsetAtual = prevOffset;
    }

    _hasMoreAtual = !!hasMore;
  }

  function maybeScrollToNew() {
    if (!lastSeenAt) return;
    const firstNew = document
      .getElementById("listaHistorico")
      ?.querySelector(".ia-card.is-new");
    if (firstNew) {
      firstNew.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  // ---------- API global ----------
  globalThis.carregarHistorico = function carregarHistorico(
    limit = INITIAL_LIMIT,
    tipo = null,
    append = false
  ) {
    let _tipoNorm = normalizeTipo(tipo) || "";
    const _limit = Number.isFinite(limit) && limit > 0 ? limit : INITIAL_LIMIT;

    if (
      (_tipoNorm === "positiva" ||
        _tipoNorm === "alerta" ||
        _tipoNorm === "neutra") &&
      typeof performance !== "undefined" &&
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
            globalThis.carregarHistorico(
              _pendingArgs.limit,
              _pendingArgs.tipo,
              _pendingArgs.append
            ),
          AWAIT_RETRY_MS
        );
        return;
      }

      const args = _pendingArgs;
      _pendingArgs = null;
      _pendingTimer = null;

      if (_lastIntent.tipo !== args.tipo || _lastIntent.limit !== args.limit)
        return;

      _inFlight = true;
      try {
        const overlayEl = document.getElementById("ovlHistorico");
        const btnReload =
          document.getElementById("btnReloadDicas") ||
          document.getElementById("btnReloadFeed");
        toggleLoading(overlayEl, true);
        if (btnReload) btnReload.disabled = true;

        const result = await fetchHistorico(args.limit, args.tipo, {
          append: !!args.append,
          offset: _offsetAtual,
        });
        updateStateAfterFetch(result, args);

        const cont = document.getElementById("listaHistorico");
        const countersEls = {
          elCountAll: document.getElementById("countAll"),
          elCountPos: document.getElementById("countPos"),
          elCountAlerta: document.getElementById("countAlerta"),
          elCountNeutra: document.getElementById("countNeutra"),
        };
        const badgeEl = document.getElementById("badgeNovasDicas");
        renderLista(cont, countersEls, badgeEl);

        if (!args.append) maybeScrollToNew();
      } catch (e) {
        if (e?.name !== "AbortError") {
          err("Falha ao carregar histórico:", e);
          const cont = document.getElementById("listaHistorico");
          if (cont) {
            cont.replaceChildren();
            const alertDiv = document.createElement("div");
            alertDiv.className = "alert alert-danger";
            alertDiv.appendChild(textNode("Falha ao carregar histórico."));
            cont.appendChild(alertDiv);
          }
        }
      } finally {
        const overlayEl = document.getElementById("ovlHistorico");
        const btnReload =
          document.getElementById("btnReloadDicas") ||
          document.getElementById("btnReloadFeed");
        if (btnReload) btnReload.disabled = false;
        toggleLoading(overlayEl, false);
        _inFlight = false;
        _pendingArgs = null;
      }
    }, AWAIT_RETRY_MS);
  };

  globalThis.__HistoricoIA = {
    recarregar: () =>
      globalThis.carregarHistorico(_limitAtual, filtroCategoria),
    filtrar: (t) => {
      filtroCategoria = normalizeTipo(t) || "";
      _limitAtual = PREVIEW_LIMIT;
      return globalThis.carregarHistorico(_limitAtual, filtroCategoria);
    },
    get filtro() {
      return filtroCategoria;
    },
    set filtro(t) {
      filtroCategoria = normalizeTipo(t) || "";
    },
  };

  // ---------- Handlers isolados ----------
  function onVerMaisClick(btn) {
    if (!btn) return;
    btn.addEventListener(
      "click",
      async (ev) => {
        if (!ev.isTrusted) return;
        btn.disabled = true;
        btn.textContent = "Carregando...";
        if (!_hasMoreAtual) {
          log("Sem mais itens");
          btn.textContent = "Sem mais registros";
          return;
        }
        await globalThis.carregarHistorico(
          PREVIEW_LIMIT,
          filtroCategoria,
          true
        );
        if (_hasMoreAtual) {
          btn.disabled = false;
          btn.textContent = "Ver mais";
        } else {
          btn.style.display = "none";
        }
      },
      { passive: true }
    );
  }

  function onMarcarLidasClick(btn, badgeEl) {
    btn?.addEventListener("click", () => {
      const newest = allItems[0]?.criado_em;
      if (!newest) return;
      localStorage.setItem(KEY_LAST_SEEN, parseStamp(newest).toISOString());
      lastSeenAt = localStorage.getItem(KEY_LAST_SEEN);

      const cont = document.getElementById("listaHistorico");
      if (cont) {
        for (const el of cont.querySelectorAll(".ia-card.is-new")) {
          el.classList.remove("is-new");
        }
      }
      badgeEl?.classList.add("d-none");
    });
  }

  function onHistoricoBtnClick(btn, badgeEl) {
    btn?.addEventListener("click", async (ev) => {
      if (!ev.isTrusted) return;
      await globalThis.__HistoricoIA.recarregar();
      const newest = allItems[0]?.criado_em;
      if (newest) {
        localStorage.setItem(KEY_LAST_SEEN, parseStamp(newest).toISOString());
        lastSeenAt = localStorage.getItem(KEY_LAST_SEEN);
        badgeEl?.classList.add("d-none");
      }
    });
  }

  function bindFilterToolbar() {
    const buttons = document.querySelectorAll("[data-ia-filtro],[data-filter]");
    if ((buttons?.length ?? 0) <= 0) return;

    // Remove listeners antigos duplicados
    const clones = [];
    for (const btn of buttons) clones.push(btn.cloneNode(true));
    let idx = 0;
    for (const oldBtn of document.querySelectorAll(
      "[data-ia-filtro],[data-filter]"
    )) {
      oldBtn.replaceWith(clones[idx++]);
    }

    for (const btn of document.querySelectorAll(
      "[data-ia-filtro],[data-filter]"
    )) {
      btn.addEventListener(
        "click",
        (ev) => {
          if (!ev.isTrusted) return;

          for (const b of document.querySelectorAll(
            "[data-ia-filtro],[data-filter]"
          )) {
            b.classList.remove("active");
          }
          btn.classList.add("active");

          _allowFilteredUntil = (performance?.now?.() ?? 0) + FILTER_GRACE_MS;
          const f = normalizeTipo(btn.dataset.iaFiltro || btn.dataset.filter);
          globalThis.__HistoricoIA.filtrar(f || "");
        },
        { passive: true }
      );
    }
  }

  function bindQuickFilter(btn, tipo) {
    btn?.addEventListener("click", (ev) => {
      if (!ev.isTrusted) return;
      _allowFilteredUntil = (performance?.now?.() ?? 0) + FILTER_GRACE_MS;
      globalThis.__HistoricoIA.filtrar(tipo);
    });
  }

  function bindGerarDica() {
    const endpoints = [
      document.getElementById("btnTurbo"),
      document.getElementById("btnGerarDica"),
      document.getElementById("btnGerarDica30d"),
      document.getElementById("btnGerarNovaDica"),
    ].filter(Boolean);

    if (!endpoints.length) return;

    async function gerarEDepois(btn) {
      if (!btn || btn.dataset.busy === "1") return;
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
        log("⚡ dica gerada:", json);
        lastHistUrl = "";
        _allowFilteredUntil = (performance?.now?.() ?? 0) + FILTER_GRACE_MS;
        await globalThis.__HistoricoIA.recarregar();
      } catch (e) {
        err("Falha ao gerar dica:", e);
        alert("Não consegui gerar a dica agora. Tente novamente em instantes.");
      } finally {
        btn.textContent = original;
        btn.disabled = false;
        btn.dataset.busy = "0";
      }
    }

    for (const btn of endpoints) {
      btn.addEventListener("click", (ev) => {
        if (!ev.isTrusted) return;
        gerarEDepois(btn);
      });
    }
  }

  function bindModalReload() {
    const btn = document.getElementById("btnReloadDicasModal");
    btn?.addEventListener("click", (ev) => {
      if (!ev.isTrusted) return;
      log("Recarregando via botão do modal...");
      try {
        globalThis.__HistoricoIA?.recarregar?.();
      } catch (e) {
        err("Erro ao recarregar via modal:", e);
      }
    });
  }

  function bindModalMirror(listEl) {
    const modalEl = document.getElementById("modalHistoricoIA");
    const modalList = document.getElementById("listaHistoricoModal");
    if (!modalEl || !modalList || !listEl) return;
    modalEl.addEventListener("show.bs.modal", () => {
      modalList.innerHTML = listEl.innerHTML;
    });
  }

  function ensureVerMaisButton(nextToEl) {
    let btn = document.getElementById("btnVerMaisHistorico");
    if (!btn) {
      btn = document.createElement("button");
      btn.id = "btnVerMaisHistorico";
      btn.className = "btn btn-outline-secondary btn-sm mt-2";
      btn.textContent = "Ver mais";
      nextToEl.after(btn);
    }
    return btn;
  }

  // ---------- Boot ----------
  document.addEventListener("DOMContentLoaded", () => {
    if (document.body.dataset.iaHistoricoInit === "1") return;
    document.body.dataset.iaHistoricoInit = "1";

    const list =
      document.getElementById("listaHistorico") ||
      document.getElementById("listaHistoricoPreview") ||
      document.getElementById("listaHistoricoModal");

    if (!list) {
      warn("Nenhum container de histórico encontrado.");
      return;
    }

    // FEED_URL dinâmico
    let fromData =
      (list.dataset.feedUrl && list.dataset.feedUrl.trim()) ||
      "/financeiro/ia/historico/feed/v2/";
    if (
      fromData.includes("/financeiro/ia/historico/feed/") &&
      !fromData.includes("/v2/")
    ) {
      fromData = fromData.replace(
        "/financeiro/ia/historico/feed/",
        "/financeiro/ia/historico/feed/v2/"
      );
    }
    FEED_URL = fromData;
    log("FEED_URL =", FEED_URL);

    // elementos de UI
    const badgeEl = document.getElementById("badgeNovasDicas");
    const btnReload =
      document.getElementById("btnReloadDicas") ||
      document.getElementById("btnReloadFeed");
    const btnLidas = document.getElementById("btnMarcarLidas");
    const btnHist = document.getElementById("btnHistoricoIA");

    const countersEls = {
      elCountAll: document.getElementById("countAll"),
      elCountPos: document.getElementById("countPos"),
      elCountAlerta: document.getElementById("countAlerta"),
      elCountNeutra: document.getElementById("countNeutra"),
    };

    lastSeenAt = localStorage.getItem(KEY_LAST_SEEN) || null;

    // binds isolados
    bindModalMirror(list);
    const btnVerMais = ensureVerMaisButton(list);
    onVerMaisClick(btnVerMais);
    onMarcarLidasClick(btnLidas, badgeEl);
    onHistoricoBtnClick(btnHist, badgeEl);
    bindFilterToolbar();
    bindGerarDica();
    bindModalReload();

    // botões de filtro rápidos (compat com HTML atual)
    const quick = {
      todas: document.getElementById("btnTodas"),
      positivas: document.getElementById("btnPositivas"),
      alertas: document.getElementById("btnAlertas"),
      neutras: document.getElementById("btnNeutras"),
    };
    bindQuickFilter(quick.todas, null);
    bindQuickFilter(quick.positivas, "positiva");
    bindQuickFilter(quick.alertas, "alerta");
    bindQuickFilter(quick.neutras, "neutra");

    // ações dos botões principais
    btnReload?.addEventListener("click", () =>
      globalThis.__HistoricoIA.recarregar()
    );

    // boot inicial
    (async () => {
      await globalThis.carregarHistorico(PREVIEW_LIMIT, null);
      startAutoRefresh();
      const cont = document.getElementById("listaHistorico");
      renderLista(cont, countersEls, badgeEl);
    })();

    // diagnóstico simples
    (function diag() {
      const req = {
        listaHistorico: !!document.getElementById("listaHistorico"),
        btnTurbo: !!document.getElementById("btnTurbo"),
        btnReloadDicas: !!document.getElementById("btnReloadDicas"),
        filtros: !!document.querySelectorAll("[data-ia-filtro],[data-filter]")
          .length,
      };
      log("🔎 Diagnóstico:", req);

      const btn = document.getElementById("btnHistoricoIA");
      btn?.addEventListener("click", (ev) => {
        if (!ev.isTrusted) return;
        log("abrir modal + carregar()");
        globalThis.carregarHistorico(INITIAL_LIMIT, "");
      });
    })();
  });
})();
