/* global Chart */

document.addEventListener("DOMContentLoaded", function () {
  console.log(
    "[Estoque] dashboard_estoque.js carregado. typeof Chart =",
    typeof Chart
  );

  // Se Chart.js não tiver carregado, não tenta desenhar nada
  if (typeof Chart === "undefined") {
    console.error(
      "[Estoque] Chart.js NÃO foi carregado. Confira a <script> do CDN no template."
    );
    return;
  }

  const canvasRank = document.getElementById("chartRankingEstoque");
  const canvasSerie = document.getElementById("chartSerieEstoque");

  if (!canvasRank || !canvasSerie) {
    console.warn("[Estoque] canvases de gráfico não encontrados na página.");
    return;
  }

  const ctxRank = canvasRank.getContext("2d");
  const ctxSerie = canvasSerie.getContext("2d");

  // Busca os dados do backend
  fetch("/estoque/dashboard/dados/")
    .then(function (resp) {
      if (!resp.ok) {
        throw new Error("HTTP " + resp.status);
      }
      return resp.json();
    })
    .then(function (data) {
      console.log("[Estoque] payload do dashboard:", data);

      if (!data.ok) {
        throw new Error("Backend retornou ok = false");
      }

      var top = Array.isArray(data.top_produtos) ? data.top_produtos : [];
      var mov = Array.isArray(data.movimento_mensal)
        ? data.movimento_mensal
        : [];

      desenharRanking(ctxRank, top);
      desenharSerie(ctxSerie, mov);
    })
    .catch(function (err) {
      console.error("[Estoque] erro ao carregar dados do dashboard:", err);
    });
});

function desenharRanking(ctx, items) {
  if (!items.length) {
    console.warn("[Estoque] sem dados para o ranking de produtos.");
    return;
  }

  var labels = items.map(function (i) {
    return i.produto;
  });
  var saldos = items.map(function (i) {
    return i.saldo || 0;
  });
  var vendidos = items.map(function (i) {
    return i.vendido || 0;
  });

  new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Saldo atual",
          data: saldos,
        },
        {
          label: "Quantidade vendida",
          data: vendidos,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: "top" },
      },
    },
  });
}

function desenharSerie(ctx, items) {
  if (!items.length) {
    console.warn("[Estoque] sem dados para série mensal de entradas/saídas.");
    return;
  }

  var labels = items.map(function (i) {
    return i.mes;
  });
  var entradas = items.map(function (i) {
    return i.entradas || 0;
  });
  var saidas = items.map(function (i) {
    return i.saidas || 0;
  });

  new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Entradas",
          data: entradas,
          tension: 0.3,
        },
        {
          label: "Saídas",
          data: saidas,
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: "top" },
      },
    },
  });
}

/* global  */

document.addEventListener("DOMContentLoaded", function () {
  carregarAlertasLotes();
});

function carregarAlertasLotes() {
  var url = "/estoque/api/lotes-prestes-vencer/?dias_aviso=30";
  var ul = document.getElementById("listaAlertasLotes");
  var msgSem = document.getElementById("msgSemAlertasLotes");

  if (!ul || !msgSem) {
    return;
  }

  fetch(url)
    .then(function (resp) { return resp.json(); })
    .then(function (data) {
      ul.innerHTML = "";

      if (!data.ok || !data.items || data.items.length === 0) {
        msgSem.classList.remove("d-none");
        return;
      }

      msgSem.classList.add("d-none");

      data.items.forEach(function (item) {
        var li = document.createElement("li");
        li.textContent = item.texto;
        if (item.tipo === "vencido") {
          li.classList.add("text-danger", "fw-bold");
        } else {
          li.classList.add("text-warning");
        }
        ul.appendChild(li);
      });
    })
    .catch(function () {
      ul.innerHTML = "";
      msgSem.textContent = "Não foi possível carregar os alertas de lotes.";
      msgSem.classList.remove("d-none");
    });
}
