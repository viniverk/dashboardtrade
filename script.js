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

        const linhas = text.split('\n');
        
        // Começa em 1 para pular a linha de cabeçalho
        for (let i = 1; i < linhas.length; i++) {
            if (!linhas[i].trim()) continue; // Pula linhas em branco

            const colunas = linhas[i].split(',');
            if (colunas.length < 4) continue; // Pula se a linha estiver incompleta

            // Extrai as colunas com base na sua planilha exata
            const mercado = colunas[0].toLowerCase();
            const resultado = parseFloat(colunas[3]);

            if (isNaN(resultado)) continue;

            // Filtra os lucros exatamente como a Betfair escreve
            if (mercado.includes("resultado da partida")) {
                lucroMO += resultado;
            } else if (mercado.includes("placar correto")) {
                lucroLG += resultado;
            }
        }

        // Calcula o lucro líquido descontando o streaming (R$ 150,00)
        const lucroTotalLiquido = (lucroMO + lucroLG) - 150.00;
        
        // Atualiza o texto de Lucro Líquido no Dashboard
        const displayLucro = document.getElementById('lucro');
        if (displayLucro) displayLucro.innerText = `R$ ${lucroTotalLiquido.toFixed(2)}`;
        
        // Atualiza o Status de Risco baseado na stake
        const riscoStatus = document.getElementById('risco-status');
        if (riscoStatus) {
            riscoStatus.innerText = "Monitoramento Ativo";
            riscoStatus.style.color = "green";
        }

        // Renderiza o Gráfico
        const canvas = document.getElementById('meuGrafico');
        if (canvas) renderizarGrafico(lucroMO, lucroLG);
        
    } catch (error) { 
        console.error("Erro ao carregar o arquivo CSV:", error); 
    }
}

function renderizarGrafico(valMO, valLG) {
    const ctx = document.getElementById('meuGrafico').getContext('2d');
    if (chart) chart.destroy(); // Apaga o gráfico antigo se existir
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
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Configuração do botão de Login
document.getElementById('btn-login').addEventListener('click', () => {
    signInWithPopup(auth, provider).then(() => {
        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
        carregarDadosDoGitHub();
    }).catch(error => console.error("Falha no login: ", error));
});
