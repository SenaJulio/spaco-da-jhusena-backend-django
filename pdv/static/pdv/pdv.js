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

  // ========= Estado =========
  // cart = { [id]: { id, nome, preco, qtd, estoque } }
  const cart = {};

  // ========= Produtos (clique) =========
  listaProdutos.addEventListener("click", (ev) => {
    const li = ev.target.closest(".produto");
    if (!li) return;

    const estoque = Number(li.dataset.estoque ?? 0);
    const isDesativado = li.classList.contains("desativado") || estoque <= 0;
    if (isDesativado) return;

    const id = String(li.dataset.id || "");
    const nome = String(li.dataset.nome || li.querySelector(".nome")?.textContent || "").trim();
    const preco = Number(li.dataset.preco ?? 0);

    if (!id || !nome || !preco) {
      console.warn("[PDV] Produto sem data-id/data-nome/data-preco:", li);
      return;
    }

    addToCart({ id, nome, preco, estoque });
  });

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
  btnFinalizar.addEventListener("click", async () => {
    const total = calcTotal();
    if (total <= 0) {
      alert("Carrinho vazio 🙂");
      return;
    }

    const ok = confirm(`Confirmar venda no valor de ${fmtBRL(total)}?`);
    if (!ok) return;

    try {
      const itens = Object.values(cart).map((it) => ({
        produto_id: Number(it.id),
        qtd: Number(it.qtd),
      }));

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
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.erro || ("HTTP " + res.status));
      }

      // limpa carrinho após sucesso REAL
      Object.keys(cart).forEach((k) => delete cart[k]);
      renderCart();

      alert(`✅ Venda #${data.venda_id} registrada! Total: ${fmtBRL(Number(data.total))}`);
    } catch (err) {
      alert("❌ Falha ao finalizar: " + err.message);
    }
  });

  // ========= Funções =========
  function addToCart(prod) {
    const cur = cart[prod.id];
    const novaQtd = (cur?.qtd || 0) + 1;

    if (novaQtd > prod.estoque) {
      alert(`Sem estoque suficiente. Disponível: ${prod.estoque}`);
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
      alert(`Sem estoque suficiente. Disponível: ${item.estoque}`);
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

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // Render inicial
  renderCart();
})();
