/* global Chart */

// ================== GRÁFICO FAKE ==================
const ctx = document.getElementById("chartDemo");

if (ctx && typeof Chart !== "undefined") {
  new Chart(ctx, {
    type: "line",
    data: {
      labels: ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"],
      datasets: [
        {
          label: "Saldo semanal",
          data: [120, 200, 180, 260, 310, 420, 380],
          borderWidth: 3,
          borderColor: "rgba(46,125,50,0.9)",
          backgroundColor: "rgba(46,125,50,0.15)",
          tension: 0.3,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
    },
  });
}

// ================== DICA RÁPIDA (ALERT) ==================
const dicasRapidas = [
  "Ótimo desempenho! Saldo crescente ao longo da semana.",
  "Considere fortalecer a reserva com +5% de aporte.",
  "Despesas abaixo da média — continue assim!",
  "Bom momento para renegociar fornecedores.",
];

const btnGerarFake = document.getElementById("btnGerarFake");
if (btnGerarFake) {
  btnGerarFake.addEventListener("click", () => {
    const dica = dicasRapidas[Math.floor(Math.random() * dicasRapidas.length)];
    alert("💡 Dica da IA:\n\n" + dica);
  });
}

// ================== LISTA DE DICAS NA TELA ==================
const listaDicas = document.getElementById("listaDicas");
const btnNovaDica = document.getElementById("btnNovaDica");

// Dicas iniciais que já aparecem na tela
const dicasBase = [
  {
    tipo: "positiva",
    texto:
      "Receitas acima das despesas nos últimos dias. Bom momento para reforçar a reserva financeira.",
  },
  {
    tipo: "alerta",
    texto:
      "Gastos fixos representam uma parte relevante das saídas. Revise contratos e assinaturas recorrentes.",
  },
  {
    tipo: "neutra",
    texto:
      "Serviços de Banho & Tosa lideram o faturamento. Considere criar combos para aumentar o ticket médio.",
  },
];

// Dicas extras para o botão “Gerar nova dica”
const dicasExtras = [
  {
    tipo: "positiva",
    texto:
      "Seu fluxo de caixa está saudável nesta simulação. Mantenha o controle e evite misturar contas pessoais.",
  },
  {
    tipo: "alerta",
    texto:
      "Alguns dias têm movimento mais fraco. Promoções em horários de pouca procura podem ajudar a equilibrar.",
  },
  {
    tipo: "neutra",
    texto:
      "Produtos representam boa parte das receitas. Experimente destacar kits especiais no balcão do pet shop.",
  },
];

// Função para criar item na lista
function addDicaNaLista(texto, tipo) {
  if (!listaDicas) return;

  const li = document.createElement("li");
  li.className = "ia-item";

  const spanTexto = document.createElement("div");
  spanTexto.className = "ia-item-texto";
  spanTexto.textContent = texto;

  const badge = document.createElement("span");
  badge.classList.add("badge");

  if (tipo === "positiva") {
    badge.classList.add("badge-positiva");
    badge.textContent = "Positiva";
  } else if (tipo === "alerta") {
    badge.classList.add("badge-alerta");
    badge.textContent = "Alerta";
  } else {
    badge.classList.add("badge-neutra");
    badge.textContent = "Neutra";
  }

  li.appendChild(spanTexto);
  li.appendChild(badge);
  listaDicas.appendChild(li);
}

// Carrega dicas iniciais ao abrir a página
if (listaDicas) {
  dicasBase.forEach((d) => addDicaNaLista(d.texto, d.tipo));
}

// Configura botão de nova dica
if (btnNovaDica) {
  btnNovaDica.addEventListener("click", () => {
    const dica = dicasExtras[Math.floor(Math.random() * dicasExtras.length)];
    addDicaNaLista(dica.texto, dica.tipo);

    // feedbackzinho
    const original = btnNovaDica.textContent;
    btnNovaDica.disabled = true;
    btnNovaDica.textContent = "Dica gerada!";
    setTimeout(() => {
      btnNovaDica.disabled = false;
      btnNovaDica.textContent = original;
    }, 1000);
  });
}
