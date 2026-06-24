import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAvWlAUn5hzr-rWAaTZDAkVsPOJhlkzDC4",
  authDomain: "tradeesportivodashboard.firebaseapp.com",
  projectId: "tradeesportivodashboard",
  storageBucket: "tradeesportivodashboard.firebasestorage.app",
  messagingSenderId: "911731188311",
  appId: "1:911731188311:web:fcdc39a0557d471fb8f912"
};

initializeApp(firebaseConfig);
const auth = getAuth();
const provider = new GoogleAuthProvider();
let chart;

async function carregarDadosDoGitHub() {
    const url = "https://raw.githubusercontent.com/viniverk/dashboardtrade/refs/heads/main/BettingPandL.csv";
    try {
        const response = await fetch(url);
        const text = await response.text();
        
        let lucroMO = 0; // Resultado da partida
        let lucroLG = 0; // Placar correto
        let operacoesLista = []; // Guarda as apostas estruturadas para a tabela

        const linhas = text.split('\n');
        
        for (let i = 1; i < linhas.length; i++) {
            if (!linhas[i].trim()) continue;

            const colunas = linhas[i].split(',');
            if (colunas.length < 4) continue;

            const mercadoOriginal = colunas[0];
            const mercadoLower = mercadoOriginal.toLowerCase();
            const horaInicio = colunas[1];
            const dataResolucao = colunas[2];
            const resultado = parseFloat(colunas[3]);

            if (isNaN(resultado)) continue;

            // Filtra e acumula os valores por mercado para o gráfico
            if (mercadoLower.includes("resultado da partida")) {
                lucroMO += resultado;
            } else if (mercadoLower.includes("placar correto")) {
                lucroLG += resultado;
            }

            // Salva na lista para montar a tabela de operações
            operacoesLista.push({
                mercado: mercadoOriginal,
                inicio: horaInicio,
                fim: dataResolucao,
                pnl: resultado
            });
        }

        // Calcula o lucro líquido descontando o streaming (R$ 150,00)
        const lucroTotalLiquido = (lucroMO + lucroLG) - 150.00;
        
        // Atualiza os KPIs na interface
        const displayLucro = document.getElementById('lucro');
        if (displayLucro) displayLucro.innerText = `R$ ${lucroTotalLiquido.toFixed(2)}`;
        
        const riscoStatus = document.getElementById('risco-status');
        if (riscoStatus) {
            riscoStatus.innerText = "Monitoramento Ativo";
            riscoStatus.style.color = "green";
        }

        // Renderiza o Gráfico e monta a tabela de apostas
        const canvas = document.getElementById('meuGrafico');
        if (canvas) renderizarGrafico(lucroMO, lucroLG);
        
        atualizarTabela(operacoesLista);
        
    } catch (error) { 
        console.error("Erro ao carregar o arquivo CSV:", error); 
    }
}

function renderizarGrafico(valMO, valLG) {
    const ctx = document.getElementById('meuGrafico').getContext('2d');
    if (chart) chart.destroy();
    chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Match Odds (Resultado)', 'Lay Goleada (Placar)'],
            datasets: [{ 
                label: 'Lucro Bruto por Estratégia (R$)', 
                data: [valMO, valLG], 
                backgroundColor: ['#36a2eb', '#ff6384'],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: { y: { beginAtZero: true } }
        }
    });
}

// NOVO: Função que desenha as apostas na tabela do HTML
function atualizarTabela(lista) {
    const corpoTabela = document.getElementById('corpo-tabela');
    if (!corpoTabela) return;

    corpoTabela.innerHTML = ""; // Limpa a tabela antes de preencher

    lista.forEach(op => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = "1px solid #eee";

        // Define a cor com base no resultado (Green ou Red)
        const corValor = op.pnl >= 0 ? "green" : "red";
        const sinal = op.pnl >= 0 ? "+" : "";

        tr.innerHTML = `
            <td style="padding: 10px; font-size: 14px;">${op.mercado}</td>
            <td style="padding: 10px; font-size: 14px; color: #555;">${op.inicio}</td>
            <td style="padding: 10px; font-size: 14px; color: #555;">${op.fim}</td>
            <td style="padding: 10px; font-size: 14px; font-weight: bold; color: ${corValor};">
                R$ ${sinal}${op.pnl.toFixed(2)}
            </td>
        `;
        corpoTabela.appendChild(tr);
    });
}

// Configuração do botão de Login com Google
document.getElementById('btn-login').addEventListener('click', () => {
    signInWithPopup(auth, provider).then(() => {
        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
        carregarDadosDoGitHub();
    }).catch(error => console.error("Falha no login: ", error));
});
