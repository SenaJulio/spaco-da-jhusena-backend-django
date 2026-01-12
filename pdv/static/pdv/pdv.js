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
      alert("Produto sem preço cadastrado. Ajuste no admin 🙂");
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
  let finalizando = false;

  btnFinalizar.addEventListener("click", async () => {
    if (finalizando) return; // evita clique duplo
    const total = calcTotal();
    if (total <= 0) {
      alert("Carrinho vazio 🙂");
      return;
    }

    const ok = confirm(`Confirmar venda no valor de ${fmtBRL(total)}?`);
    if (!ok) return;

    finalizando = true;

    // UI: trava botão + muda texto
    const txtOriginal = btnFinalizar.textContent;
    btnFinalizar.disabled = true;
    btnFinalizar.textContent = "FINALIZANDO...";

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

      // ✅ lê resposta com segurança (JSON ou HTML)
      const contentType = res.headers.get("content-type") || "";
      const text = await res.text();
      let data = null;
      if (contentType.includes("application/json")) {
        try { data = JSON.parse(text); } catch (_e) { }
      }

      if (!res.ok || !data?.ok) {
        // ✅ Auto-correção de carrinho quando backend sinaliza estoque insuficiente
        if (data?.produto_id != null && data?.max_qtd != null) {
          const pid = String(data.produto_id);
          const max = Math.max(0, Math.floor(Number(data.max_qtd)));

          if (cart[pid]) {
            if (max <= 0) {
              delete cart[pid]; // remove se não tem mais estoque
            } else {
              cart[pid].qtd = Math.min(cart[pid].qtd, max); // limita a qtd ao máximo permitido
              if (cart[pid].qtd <= 0) delete cart[pid];
            }
            renderCart();

            // volta o foco pra busca (fluxo de balcão)
            if (buscaProduto) {
              buscaProduto.value = "";
              buscaProduto.focus();
            }
          }

          alert("⚠️ Estoque mudou. Ajustei seu carrinho automaticamente.\n\n" + (data.erro || ""));
          return; // não dispara throw
        }

        const detalhe = data?.erro || text.slice(0, 200) || ("HTTP " + res.status);
        throw new Error(detalhe);
      }


      // ✅ sucesso: limpa carrinho e re-render
      Object.keys(cart).forEach((k) => delete cart[k]);
      renderCart();
      const busca = document.getElementById("buscaProduto");
      if (busca) {
        busca.value = "";
        busca.focus();
      }


      alert(`✅ Venda #${data.venda_id} registrada! Total: ${fmtBRL(Number(data.total))}`);
    } catch (err) {
      alert("❌ Falha ao finalizar: " + (err?.message || err));
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