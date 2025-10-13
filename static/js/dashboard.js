document.addEventListener('DOMContentLoaded', function () {
  // Função para montar gráfico de categorias (barra)
  function montarGraficoCategorias(categorias, valores) {
    const ctxCategorias = document.getElementById('graficoCategorias');
    if (!ctxCategorias) return null;

    return new Chart(ctxCategorias, {
      type: 'bar',
      data: {
        labels: categorias,
        datasets: [{
          label: 'Média diária por categoria',
          data: valores,
          backgroundColor: 'rgba(255, 99, 132, 0.5)',
        }]
      },
      options: {
        responsive: true,
        scales: { y: { beginAtZero: true } }
      }
    });
  }

  // Função para montar gráfico de evolução financeira (linha)
  function montarGraficoEvolucao(dias, receitas, despesas, saldo) {
    const ctxEvolucao = document.getElementById('graficoEvolucao');
    if (!ctxEvolucao) return null;

    return new Chart(ctxEvolucao, {
      type: 'line',
      data: {
        labels: dias,
        datasets: [
          { label: 'Receitas', data: receitas, borderColor: 'green', fill: false, tension: 0.3 },
          { label: 'Despesas', data: despesas, borderColor: 'red', fill: false, tension: 0.3 },
          { label: 'Saldo Acumulado', data: saldo, borderColor: 'blue', fill: false, tension: 0.3 },
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'top' },
          title: { display: true, text: 'Evolução Financeira do Mês 🐾' },
        },
        scales: { y: { beginAtZero: true } }
      }
    });
  }

  // Helper para garantir que valores sejam arrays para os gráficos
  function garantirArray(valor, tamanho) {
    if (Array.isArray(valor)) return valor;
    if (typeof valor === 'number' && tamanho > 0) {
      // Distribui o valor uniformemente ao longo do período
      return new Array(tamanho).fill(valor / tamanho);
    }
    return [];
  }

  // Pega os dados globais do objeto window.financeiroData que o template deve passar
  const data = window.financeiroData || {};

  const categorias = Array.isArray(data.categorias) ? data.categorias : [];
  const valores = Array.isArray(data.valores) ? data.valores : [];

  const dias = Array.isArray(data.dias) ? data.dias : [];

  const receitas = garantirArray(data.receitas, dias.length);
  const despesas = garantirArray(data.despesas, dias.length);
  const saldo = garantirArray(data.saldo, dias.length);

  // Inicializa gráficos
  let graficoCategorias = montarGraficoCategorias(categorias, valores);
  let graficoEvolucao = montarGraficoEvolucao(dias, receitas, despesas, saldo);

  // Função para atualizar dashboard dinamicamente
  function atualizarDashboard(dados) {
    const elReceitas = document.getElementById('valor-receitas');
    const elDespesas = document.getElementById('valor-despesas');
    const elSaldo = document.getElementById('valor-saldo');

    if (elReceitas) elReceitas.textContent = `R$ ${parseFloat(dados.total_receitas).toFixed(2)}`;
    if (elDespesas) elDespesas.textContent = `R$ ${parseFloat(dados.total_despesas).toFixed(2)}`;
    if (elSaldo) elSaldo.textContent = `R$ ${parseFloat(dados.saldo).toFixed(2)}`;

    if (graficoCategorias && dados.categorias && dados.valores) {
      graficoCategorias.data.labels = dados.categorias;
      graficoCategorias.data.datasets[0].data = dados.valores;
      graficoCategorias.update();
    }

    if (graficoEvolucao && dados.dias && dados.receitas && dados.despesas && dados.saldo) {
      graficoEvolucao.data.labels = dados.dias;
      graficoEvolucao.data.datasets[0].data = garantirArray(dados.receitas, dados.dias.length);
      graficoEvolucao.data.datasets[1].data = garantirArray(dados.despesas, dados.dias.length);
      graficoEvolucao.data.datasets[2].data = garantirArray(dados.saldo, dados.dias.length);
      graficoEvolucao.update();
    }
  }

  // Listener do botão filtrar - faz fetch dos dados filtrados e atualiza
  const botaoFiltrar = document.getElementById('filtrar-btn');
  if (botaoFiltrar) {
    botaoFiltrar.addEventListener('click', function (event) {
      event.preventDefault();

      const inicio = document.getElementById('data_inicio').value;
      const fim = document.getElementById('data_fim').value;

      console.log("📅 Filtro acionado! Início:", inicio, "Fim:", fim);

      fetch(`/financeiro/dashboard/dados-filtrados/?inicio=${inicio}&fim=${fim}`)
        .then(response => response.json())
        .then(data => {
          console.log("🚀 Dados recebidos:", data);
          atualizarDashboard(data);
        })
        .catch(error => console.error("❌ Erro na requisição:", error));
    });
  }
});
