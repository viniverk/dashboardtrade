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
let todasOperacoes = [];

// Função que trata números e parênteses da Betfair
function parseBetfairNumber(str) {
    if (!str) return NaN;
    str = str.replace(/["'\sR$]/g, '');
    if (str.startsWith('(') && str.endsWith(')')) {
        str = '-' + str.slice(1, -1);
    }
    return parseFloat(str);
}

async function carregarDadosDoGitHub() {
    const url = "https://raw.githubusercontent.com/viniverk/dashboardtrade/refs/heads/main/BettingPandL.csv?t=" + new Date().getTime();
    
    try {
        const response = await fetch(url);
        const text = await response.text();
        const linhas = text.split('\n');
        
        todasOperacoes = [];

        // Ignoramos as linhas que contêm avisos da Betfair
        for (let i = 1; i < linhas.length; i++) {
            let linha = linhas[i].trim();
            if (!linha || linha.includes("Todas as apostas") || linha.includes("Todas as horas")) continue;

            const colunas = linha.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
            if (colunas.length < 9) continue; // Garante que a linha tem dados suficientes

            const mercado = colunas[0].replace(/["']/g, '');
            const dataHora = colunas[4]; // Ajuste conforme a coluna de data/hora
            const responsabilidade = parseBetfairNumber(colunas[7]);
            const pnl = parseBetfairNumber(colunas[8]);

            // Se o PnL for 0, é apenas uma entrada ou ajuste, não somamos como lucro ainda
            // Somamos apenas linhas que indicam movimentação de resultado
            if (isNaN(pnl)) continue;

            todasOperacoes.push({
                mercado: mercado,
                data: dataHora,
                pnl: pnl,
                resp: isNaN(responsabilidade) ? 0 : responsabilidade
            });
        }

        aplicarFiltros();
    } catch (error) { 
        console.error("Erro ao carregar CSV:", error); 
    }
}

function aplicarFiltros() {
    // Lucro Líquido é a soma de todos os PnLs do arquivo
    const lucroLiquido = todasOperacoes.reduce((acc, op) => acc + op.pnl, 0);
    
    // Média de Responsabilidade (Considerando apenas operações de Lay)
    const comResp = todasOperacoes.filter(op => op.resp > 0);
    const mediaResp = comResp.length > 0 ? (comResp.reduce((acc, op) => acc + op.resp, 0) / comResp.length) : 0;

    document.getElementById('lucro').innerText = `R$ ${lucroLiquido.toFixed(2)}`;
    document.getElementById('media-responsabilidade').innerText = `R$ ${mediaResp.toFixed(2)}`;
    
    atualizarTabela(todasOperacoes);
}

function atualizarTabela(lista) {
    const corpoTabela = document.getElementById('corpo-tabela');
    corpoTabela.innerHTML = ""; 
    lista.forEach(op => {
        const tr = document.createElement('tr');
        const corValor = op.pnl >= 0 ? "green" : "red";
        tr.innerHTML = `
            <td style="padding: 10px;">${op.mercado}</td>
            <td style="padding: 10px;">${op.data}</td>
            <td style="padding: 10px;">${op.resp > 0 ? 'R$ ' + op.resp.toFixed(2) : '-'}</td>
            <td style="padding: 10px; color: ${corValor}; font-weight: bold;">R$ ${op.pnl.toFixed(2)}</td>
        `;
        corpoTabela.appendChild(tr);
    });
}

document.getElementById('btn-login').addEventListener('click', () => {
    signInWithPopup(auth, provider).then(() => {
        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
        carregarDadosDoGitHub();
    });
});
