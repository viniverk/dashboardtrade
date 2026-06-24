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

// Função que busca e processa o CSV automaticamente
async function carregarDadosDoGitHub() {
    const url = "https://raw.githubusercontent.com/viniverk/dashboardtrade/refs/heads/main/BettingPandL.csv";
    try {
        const response = await fetch(url);
        const text = await response.text();
        
        let lucroMO = 0; // Match Odds
        let lucroLG = 0; // Lay Goleada
        const linhas = text.split('\n');

        for (let i = 1; i < linhas.length; i++) {
            let colunas = linhas[i].includes(';') ? linhas[i].split(';') : linhas[i].split(',');
            if (colunas.length < 4) continue;

            const mercado = colunas[1] ? colunas[1].toLowerCase() : "";
            const resultado = parseFloat(colunas[2].replace(',', '.'));

            if (mercado.includes("match odds")) lucroMO += resultado;
            else if (mercado.includes("lay goleada") || mercado.includes("correct score")) lucroLG += resultado;
        }

        document.getElementById('lucro').innerText = `R$ ${(lucroMO + lucroLG - 150).toFixed(2)}`;
        renderizarGrafico(lucroMO, lucroLG);
    } catch (error) { console.error("Erro ao carregar:", error); }
}

function renderizarGrafico(valA, valB) {
    const ctx = document.getElementById('meuGrafico').getContext('2d');
    if (chart) chart.destroy();
    chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Match Odds', 'Lay Goleada'],
            datasets: [{ label: 'Lucro (R$)', data: [valA, valB], backgroundColor: ['#36a2eb', '#ff6384'] }]
        }
    });
}

document.getElementById('btn-login').addEventListener('click', () => {
    signInWithPopup(auth, provider).then(() => {
        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
        carregarDadosDoGitHub(); // Carrega automaticamente após login
    });
});
