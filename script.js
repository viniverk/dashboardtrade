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
        
        let lucroMO = 0;
        let lucroLG = 0;
        const linhas = text.split('\n');
        
        if (linhas.length < 2) return;

        // Descobre se o arquivo usa vírgula ou ponto-e-vírgula e lê os cabeçalhos
        const separador = linhas[0].includes(';') ? ';' : ',';
        const cabecalhos = linhas[0].split(separador).map(h => h.trim().toLowerCase().replace(/["']/g, ''));
        
        // Encontra onde estão as colunas independentemente da ordem
        const idxMercado = cabecalhos.findIndex(h => h.includes('mercado') || h.includes('market'));
        const idxLucro = cabecalhos.findIndex(h => h.includes('lucro') || h.includes('profit') || h.includes('p&l'));

        // Se não encontrar as colunas, avisa no console
        if (idxMercado === -1 || idxLucro === -1) {
            console.error("Colunas de Mercado ou Lucro não encontradas no CSV.");
            return;
        }

        for (let i = 1; i < linhas.length; i++) {
            if (!linhas[i].trim()) continue; // Pula linhas em branco

            let colunas = linhas[i].split(separador);
            
            const mercado = (colunas[idxMercado] || "").toLowerCase().replace(/["']/g, '');
            
            // Limpa o valor (tira aspas, R$, espaços) e troca vírgula por ponto
            let valorTexto = (colunas[idxLucro] || "0").replace(/["' R$]/g, '').replace(',', '.');
            const resultado = parseFloat(valorTexto);

            if (isNaN(resultado)) continue;

            // Filtra e soma pelas estratégias
            if (mercado.includes("match odds") || mercado.includes("probabilidades")) {
                lucroMO += resultado;
            } else if (mercado.includes("lay goleada") || mercado.includes("correct score") || mercado.includes("resultado exato")) {
                lucroLG += resultado;
            }
        }

        // Atualiza a tela
        const displayLucro = document.getElementById('lucro');
        if (displayLucro) displayLucro.innerText = `R$ ${(lucroMO + lucroLG - 150).toFixed(2)}`;
        
        const canvas = document.getElementById('meuGrafico');
        if (canvas) renderizarGrafico(lucroMO, lucroLG);
        
    } catch (error) { 
        console.error("Erro ao carregar o arquivo CSV:", error); 
    }
}

function renderizarGrafico(valA, valB) {
    const ctx = document.getElementById('meuGrafico').getContext('2d');
    if (chart) chart.destroy();
    chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Match Odds', 'Lay Goleada'],
            datasets: [{ 
                label: 'Lucro Líquido (R$)', 
                data: [valA, valB], 
                backgroundColor: ['#36a2eb', '#ff6384'] 
            }]
        }
    });
}

// Botão de Login
document.getElementById('btn-login').addEventListener('click', () => {
    signInWithPopup(auth, provider).then(() => {
        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
        carregarDadosDoGitHub();
    }).catch(error => console.error("Falha no login: ", error));
});
