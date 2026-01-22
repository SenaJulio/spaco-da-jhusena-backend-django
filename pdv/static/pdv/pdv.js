(() => {
  // ========= Helpers =========
  const fmtBRL = (n) =>
    (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const $ = (sel) => document.querySelector(sel);

  function getCsrfToken() {
    const cookies = document.cookie.split(";").map((c) => c.trim());
    for (const c of cookies) {
      if (c.startsWith("csrftoken=")) return c.split("=")[1];
    }
    return "";
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getApiErrorMessage(data, fallback = "Falha ao finalizar.") {
    if (!data) return fallback;
    if (typeof data === "string") return data;
    return data.error || data.erro || data.detail || data.message || fallback;
  }

  // ========= DOM =========
  const listaProdutos = $("#listaProdutos");
  const buscaProduto = $("#buscaProduto");
  const cartItemsEl = $("#cartItems");
  const cartTotalEl = $("#cartTotal");
  const btnFinalizar = $("#btnFinalizar");

  if (!listaProdutos || !buscaProduto || !cartItemsEl || !cartTotalEl || !btnFinalizar) {
    console.warn("[PDV] Elementos não encontrados. Confere IDs no HTML.");
    return;
  }

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;

    const tag = document.activeElement?.tagName?.toLowerCase();

    // se estiver digitando em textarea ou outro input que não seja a busca, ignora
    if (tag === "textarea") return;
    if (tag === "input" && document.activeElement !== buscaProduto) return;

    if (calcTotal() <= 0) return;

    e.preventDefault();
    btnFinalizar.click();
  });

  // ========= Estado =========
  // cart = { [id]: { id, nome, preco, qtd, estoque } }
  const cart = {};

  // ========= Toasts =========
  function toastHtml(titulo, msg, tipo = "info") {
    const map = {
      success: { badge: "✅", border: "rgba(47,191,113,.45)", bg: "rgba(47,191,113,.12)", color: "#bff5d6" },
      warning: { badge: "⚠️", border: "rgba(255,193,7,.45)", bg: "rgba(255,193,7,.12)", color: "#ffe08a" },
      danger: { badge: "⛔", border: "rgba(255,99,99,.45)", bg: "rgba(255,99,99,.12)", color: "#ffb3b3" },
      info: { badge: "ℹ️", border: "rgba(255,255,255,.14)", bg: "rgba(255,255,255,.06)", color: "#e8f0ff" },
    };
    const s = map[tipo] || map.info;

    return `
      <div style="display:flex; flex-direction:column; gap:6px;">
        <div style="font-weight:900;">${s.badge} ${escapeHtml(titulo)}</div>
        <div style="opacity:.92;">${escapeHtml(msg)}</div>
      </div>
      <div style="
        margin-top:8px;
        display:inline-flex;
        align-items:center;
        gap:8px;
        padding:8px 10px;
        border-radius:12px;
        border:1px solid ${s.border};
        background:${s.bg};
        color:${s.color};
        font-weight:700;
        width:fit-content;
      ">
        <span>${escapeHtml(tipo.toUpperCase())}</span>
      </div>
    `;
  }

  function sjToast(html, tipo = "info") {
    const toastEl = document.getElementById("sjToastVenda");
    const bodyEl = document.getElementById("sjToastBody");

    // ✅ fallback: cria toast simples sem Bootstrap (sem alert)
    if (!toastEl || !bodyEl || typeof bootstrap === "undefined") {
      simpleToast(String(html).replace(/<[^>]*>/g, ""), tipo);
      return;
    }

    bodyEl.innerHTML = html;

    const t = bootstrap.Toast.getOrCreateInstance(toastEl, { delay: 4500 });
    t.show();
  }

  // fallback sem bootstrap: toast minimalista no canto
  function simpleToast(text, tipo = "info") {
    const id = "sjToastSimple";
    let box = document.getElementById(id);

    if (!box) {
      box = document.createElement("div");
      box.id = id;
      box.style.position = "fixed";
      box.style.right = "16px";
      box.style.bottom = "16px";
      box.style.zIndex = "99999";
      box.style.maxWidth = "360px";
      box.style.padding = "12px 12px";
      box.style.borderRadius = "14px";
      box.style.boxShadow = "0 18px 36px rgba(0,0,0,.45)";
      box.style.border = "1px solid rgba(255,255,255,.14)";
      box.style.background = "rgba(10,16,28,.92)";
      box.style.color = "#e8f0ff";
      box.style.fontWeight = "700";
      box.style.fontSize = "0.95rem";
      box.style.opacity = "0";
      box.style.transform = "translateY(6px)";
      box.style.transition = "all .18s ease";
      document.body.appendChild(box);
    }

    const prefix =
      tipo === "success" ? "✅ " :
      tipo === "warning" ? "⚠️ " :
      tipo === "danger" ? "⛔ " : "ℹ️ ";

    box.textContent = prefix + text;

    requestAnimationFrame(() => {
      box.style.opacity = "1";
      box.style.transform = "translateY(0)";
    });

    window.clearTimeout(simpleToast._t);
    simpleToast._t = window.setTimeout(() => {
      box.style.opacity = "0";
      box.style.transform = "translateY(6px)";
    }, 3800);
  }

  function toastInfo(titulo, msg) { sjToast(toastHtml(titulo, msg, "info"), "info"); }
  function toastWarn(titulo, msg) { sjToast(toastHtml(titulo, msg, "warning"), "warning"); }
  function toastOk(titulo, msg) { sjToast(toastHtml(titulo, msg, "success"), "success"); }
  function toastErr(titulo, msg) { sjToast(toastHtml(titulo, msg, "danger"), "danger"); }

  // ========= Produtos (clique) =========
  listaProdutos.addEventListener("click", (ev) => {
    const li = ev.target.closest(".produto");
    if (!li) return;

    const estoque = Number(li.dataset.estoque ?? 0);
    const isDesativado = li.classList.contains("desativado") || estoque <= 0;
    if (isDesativado) return;

    const id = String(li.dataset.id || "");
    const nome = String(li.dataset.nome || li.querySelector(".nome")?.textContent || "").trim();
    const preco = Number(String(li.dataset.preco ?? "0").replace(",", "."));

    if (!id || !nome) return;
    if (!(preco > 0)) {
      toastWarn("Sem preço cadastrado", "Ajuste o preço do produto no admin para vender.");
      return;
    }

    addToCart({ id, nome, preco, estoque });
  });

  // ========= Checagem lote vencido (carrinho) =========
  async function checarLoteVencidoCarrinho(carrinhoItens) {
    for (const it of carrinhoItens) {
      const form = new FormData();
      form.append("produto_id", it.produto_id);
      form.append("qtd", it.qtd);

      const resp = await fetch("/pdv/api/check-lote-vencido/", {
        method: "POST",
        headers: {
          "X-Requested-With": "XMLHttpRequest",
          "X-CSRFToken": getCsrfToken(),
        },
        credentials: "same-origin",
        body: form,
      });

      let data = null;
      try {
        data = await resp.json();
      } catch (e) {
        data = null;
      }

      if (!resp.ok || !data?.ok) {
        const detalhe = getApiErrorMessage(data, "Falha na checagem de lote.");
        return { ok: false, error: detalhe };
      }

      // ✅ se o backend detectou lote vencido, ele devolve motivo/politica/detalhes
      if (data?.motivo === "LOTE_VENCIDO") return data;
    }

    return { ok: true, motivo: null, bloquear: false, avisar: false, politica: null, detalhes: [] };
  }

  // ========= Busca =========
  buscaProduto.addEventListener("input", () => {
    const q = buscaProduto.value.trim().toLowerCase();
    const itens = listaProdutos.querySelectorAll(".produto");

    itens.forEach((li) => {
      const nome = String(li.dataset.nome || li.querySelector(".nome")?.textContent || "")
        .toLowerCase()
        .trim();
      li.style.display = nome.includes(q) ? "" : "none";
    });
  });

  // ========= Carrinho (delegação de eventos) =========
  cartItemsEl.addEventListener("click", (ev) => {
    const btn = ev.target.closest("button[data-action]");
    if (!btn) return;

    const action = btn.dataset.action;
    const id = btn.dataset.id;
    if (!id || !cart[id]) return;

    if (action === "inc") incItem(id);
    if (action === "dec") decItem(id);
    if (action === "rm") removeItem(id);
  });

  // ========= Finalizar (BACKEND REAL) =========
  let finalizando = false;

  btnFinalizar.addEventListener("click", async () => {
    if (finalizando) return; // evita clique duplo
    const total = calcTotal();
    if (total <= 0) {
      toastInfo("Carrinho vazio", "Adicione pelo menos 1 item antes de finalizar.");
      return;
    }

    // monta itens uma vez (vai usar no check e no finalizar)
    const itens = Object.values(cart).map((it) => ({
      produto_id: Number(it.id),
      qtd: Number(it.qtd),
    }));

    // ✅ 1) checa lote vencido antes do confirm
    let justificativaLote = "";

    const check = await checarLoteVencidoCarrinho(itens);

    if (check?.ok === false) {
      toastWarn("Falha na checagem de lote", check?.error || "Não foi possível checar o lote.");
      return;
    }

    // Só entra se achou lote vencido
    if (check?.motivo === "LOTE_VENCIDO") {
      // 1) LIVRE: só avisa e segue
      if (check.politica === "livre") {
        toastWarn("Aviso", "Existe lote vencido com saldo. Venda permitida pela política da empresa.");
      }
      // 2) BLOQUEAR: trava e não deixa vender
      else if (check.politica === "bloquear") {
        sjToast(`
          <div style="display:flex; flex-direction:column; gap:6px;">
            <div style="font-weight:900;">⛔ Venda BLOQUEADA</div>
            <div style="opacity:.9;">
              Lote vencido detectado. Política da empresa: <b>bloquear</b>.
            </div>
          </div>
          <div style="
            margin-top:8px;
            display:inline-flex;
            align-items:center;
            gap:8px;
            padding:8px 10px;
            border-radius:12px;
            border:1px solid rgba(255,99,99,.45);
            background: rgba(255,99,99,.12);
            color:#ffb3b3;
            font-weight:700;
            width:fit-content;
          ">
            <span>AÇÃO IMEDIATA</span>
            <span style="font-weight:500; opacity:.9;">
              Retire o produto do carrinho ou ajuste o estoque/lote.
            </span>
          </div>
        `, "danger");
        return;
      }
      // 3) JUSTIFICAR: modal obrigatório
      else if (check.politica === "justificar" && check.exige_justificativa) {
        const modalEl = document.getElementById("modalLoteVencido");
        if (!modalEl) {
          toastErr("Erro de layout", "Lote vencido detectado, mas o modal não existe no HTML.");
          return;
        }

        const det = (check.detalhes || [])
          .map((d) => `• ${escapeHtml(d.lote)} (val: ${escapeHtml(d.validade)}) — qtd aprox: ${escapeHtml(d.qtd)}`)
          .join("<br>");

        const detEl = document.getElementById("mvDetalhes");
        if (detEl) detEl.innerHTML = det ? `<div class="text-danger">${det}</div>` : "";

        const txt = document.getElementById("justificativaLote");
        if (txt) txt.value = "";

        const modal = new bootstrap.Modal(modalEl);
        modal.show();

        const continuar = await new Promise((resolve) => {
          const btn = document.getElementById("btnContinuarComJustificativa");
          if (!btn) {
            toastErr("Erro de layout", "Botão do modal não encontrado.");
            resolve(false);
            return;
          }

          btn.onclick = () => {
            const j = (document.getElementById("justificativaLote")?.value || "").trim();
            if (!j) {
              toastWarn("Justificativa obrigatória", "Informe a justificativa para continuar.");
              return;
            }
            justificativaLote = j;
            modal.hide();
            resolve(true);
          };

          modalEl.addEventListener("hidden.bs.modal", () => resolve(false), { once: true });
        });

        if (!continuar) return; // cancelou/fechou
      } else {
        // fallback: política desconhecida → segurança
        toastErr("Política inválida", "Política de lote vencido inválida. Por segurança, venda bloqueada.");
        return;
      }
    }

    // ✅ 2) confirmação normal (mantém confirm)
    const ok = confirm(`Confirmar venda no valor de ${fmtBRL(total)}?`);
    if (!ok) return;

    finalizando = true;

    // UI: trava botão + muda texto
    const txtOriginal = btnFinalizar.textContent;
    btnFinalizar.disabled = true;
    btnFinalizar.textContent = "FINALIZANDO...";

    try {
      const res = await fetch("/pdv/api/finalizar/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
          "X-CSRFToken": getCsrfToken(),
        },
        credentials: "same-origin",
        body: JSON.stringify({
          itens,
          forma_pagamento: "pix",
          observacao: "",
          justificativa_lote: justificativaLote || "",
        }),
      });

      // lê JSON (se vier)
      let data = null;
      try {
        data = await res.json();
      } catch (e) {
        data = null;
      }

      // 1) erro HTTP (ex: DEMO 403)
      if (!res.ok) {
        const msg = getApiErrorMessage(data, `HTTP ${res.status}`);
        toastWarn("Ação bloqueada", msg);
        return;
      }

      // 2) erro de negócio (HTTP ok mas ok=false)
      if (!data?.ok) {
        // ✅ Auto-correção de carrinho quando backend sinaliza estoque insuficiente
        if (data?.produto_id != null && data?.max_qtd != null) {
          const pid = String(data.produto_id);
          const max = Math.max(0, Math.floor(Number(data.max_qtd)));

          if (cart[pid]) {
            if (max <= 0) {
              delete cart[pid];
            } else {
              cart[pid].qtd = Math.min(cart[pid].qtd, max);
              if (cart[pid].qtd <= 0) delete cart[pid];
            }
            renderCart();

            if (buscaProduto) {
              buscaProduto.value = "";
              buscaProduto.focus();
            }
          }

          toastWarn(
            "Estoque mudou",
            "Ajustei seu carrinho automaticamente. " + (data.erro || data.error || "")
          );
          return;
        }

        const detalhe = getApiErrorMessage(data, "Falha ao finalizar.");
        toastErr("Falha ao finalizar", detalhe);
        return;
      }

      // ✅ sucesso: limpa carrinho e re-render
      Object.keys(cart).forEach((k) => delete cart[k]);
      renderCart();

      if (buscaProduto) {
        buscaProduto.value = "";
        buscaProduto.focus();
      }

      // ✅ sucesso: toast profissional com badge quando houver override
      const teveOverride =
        Boolean(justificativaLote && justificativaLote.trim()) ||
        Boolean(data?.justificativa_lote && String(data.justificativa_lote).trim()) ||
        Boolean(data?.override_lote === true);

      let html = `
        <div style="display:flex; flex-direction:column; gap:6px;">
          <div style="font-weight:900;">✅ Venda #${escapeHtml(data.venda_id)} registrada!</div>
          <div style="opacity:.9;">Total: ${fmtBRL(Number(data.total))}</div>
        </div>
      `;

      if (teveOverride) {
        html += `
          <div style="
            margin-top:8px;
            display:inline-flex;
            align-items:center;
            gap:8px;
            padding:8px 10px;
            border-radius:12px;
            border:1px solid rgba(255,193,7,.45);
            background: rgba(255,193,7,.12);
            color:#ffe08a;
            font-weight:700;
            width:fit-content;
          ">
            <span>⚠ Override de Lote</span>
            <span style="font-weight:500; opacity:.9;">
              Venda realizada com lote vencido conforme política da empresa.
            </span>
          </div>
        `;
      }

      sjToast(html, "success");
    } catch (err) {
      toastErr("Falha ao finalizar", err?.message || String(err));
    } finally {
      // UI volta ao normal
      finalizando = false;
      btnFinalizar.disabled = false;
      btnFinalizar.textContent = txtOriginal;
    }
  });

  // ========= Funções =========
  function addToCart(prod) {
    const cur = cart[prod.id];
    const novaQtd = (cur?.qtd || 0) + 1;

    if (novaQtd > prod.estoque) {
      toastWarn("Sem estoque suficiente", `Disponível: ${prod.estoque}`);
      return;
    }

    cart[prod.id] = {
      id: prod.id,
      nome: prod.nome,
      preco: prod.preco,
      estoque: prod.estoque,
      qtd: novaQtd,
    };

    renderCart();
  }

  function incItem(id) {
    const item = cart[id];
    if (!item) return;

    if (item.qtd + 1 > item.estoque) {
      toastWarn("Sem estoque suficiente", `Disponível: ${item.estoque}`);
      return;
    }
    item.qtd += 1;
    renderCart();
  }

  function decItem(id) {
    const item = cart[id];
    if (!item) return;

    item.qtd -= 1;
    if (item.qtd <= 0) delete cart[id];
    renderCart();
  }

  function removeItem(id) {
    delete cart[id];
    renderCart();
  }

  function calcTotal() {
    return Object.values(cart).reduce((acc, it) => acc + it.preco * it.qtd, 0);
  }

  function renderCart() {
    const items = Object.values(cart);

    if (items.length === 0) {
      cartItemsEl.innerHTML = `
        <div style="opacity:.7; padding:8px 2px;">
          Nenhum item no carrinho.
        </div>
      `;
      cartTotalEl.textContent = fmtBRL(0);
      return;
    }

    cartItemsEl.innerHTML = items
      .map((it) => {
        const subtotal = it.preco * it.qtd;
        return `
          <div class="item">
            <span class="item-nome">${escapeHtml(it.nome)}</span>

            <div class="item-controles">
              <button type="button" data-action="dec" data-id="${it.id}">-</button>
              <span>${it.qtd}</span>
              <button type="button" data-action="inc" data-id="${it.id}">+</button>
            </div>

            <span class="item-preco">${fmtBRL(subtotal)}</span>

            <button type="button" data-action="rm" data-id="${it.id}"
              title="Remover"
              style="margin-left:8px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.10);color:#e8f0ff;border-radius:10px;padding:6px 10px;cursor:pointer;">
              ✕
            </button>
          </div>
        `;
      })
      .join("");

    cartTotalEl.textContent = fmtBRL(calcTotal());
  }

  // Render inicial
  renderCart();
})();
