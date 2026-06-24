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

let todasOperacoes = [];
let chartInstance = null;

// Carrega dados do GitHub
async function carregarDados() {
    const url = "https://raw.githubusercontent.com/viniverk/dashboardtrade/refs/heads/main/BettingPandL.csv?t=" + new Date().getTime();
    const response = await fetch(url);
    const text = await response.text();
    const linhas = text.split('\n');
    const cabecalhos = linhas[0].toLowerCase().split(',');
    
    let agrupador = {};
    for (let i = 1; i < linhas.length; i++) {
        const colunas = linhas[i].split(',');
        if (colunas.length < 4) continue;
        
        const mercado = colunas[0].replace(/["']/g, '').trim();
        const data = colunas[2].replace(/["']/g, '').trim();
        const pnl = parseFloat(colunas[3].replace(/[^0-9.-]/g, '')) || 0;
        
        const chave = `${mercado}|${data}`;
        if (!agrupador[chave]) agrupador[chave] = { mercado, data, pnl: 0 };
        agrupador[chave].pnl += pnl;
    }
    todasOperacoes = Object.values(agrupador);
    renderizarDashboard();
}

function renderizarDashboard() {
    const lucroLiquido = todasOperacoes.reduce((acc, o) => acc + o.pnl, 0);
    document.getElementById('lucro').innerText = `R$ ${lucroLiquido.toFixed(2)}`;
    
    // Gráfico
    const ctx = document.getElementById('meuGrafico');
    if (!ctx) return; // Segurança contra gráfico nulo

    if (chartInstance) chartInstance.destroy();
    
    chartInstance = new Chart(ctx, {
        type: document.getElementById('tipo-grafico').value,
        data: {
            labels: todasOperacoes.map(o => o.data),
            datasets: [{ label: 'Lucro (R$)', data: todasOperacoes.map(o => o.pnl), backgroundColor: '#4bc0c0' }]
        }
    });
}

document.getElementById('btn-login').addEventListener('click', () => {
    signInWithPopup(auth, provider).then(() => {
        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
        carregarDados();
    });
});
