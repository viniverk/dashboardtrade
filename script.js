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

// Converte valores da Betfair: (12.29) vira -12.29 e 17.86 vira 17.86
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
        const operacoesProcessadas = new Set();

        // Regex para separar vírgulas ignorando as que estão dentro de aspas
        const regexCSV = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;

        for (let i = 1; i < linhas.length; i++) {
            const linhaLimpa = linhas[i].trim();
            if (!linhaLimpa) continue;

            const colunas = linhaLimpa.split(regexCSV).map(c => c.trim().replace(/["']/g, ''));
            
            // O seu CSV novo tem colunas específicas. Ajuste os índices conforme a ordem do seu arquivo:
            // Exemplo: Mercado=0, Data=2, Responsabilidade=7, Lucro=8
            const mercado = colunas[0];
            const dataAposta = colunas[2];
            const responsabilidade = parseBetfairNumber(colunas[7]);
            const lucro = parseBetfairNumber(colunas[8]);

            if (isNaN(lucro) || !mercado) continue;

            // Escudo Anti-Duplicidade
            const chaveUnica = `${mercado}|${dataAposta}|${lucro}`;
            if (operacoesProcessadas.has(chaveUnica)) continue;
            operacoesProcessadas.add(chaveUnica);

            todasOperacoes.push({
                mercado: mercado,
                data: dataAposta,
                pnl: lucro,
                resp: isNaN(responsabilidade) ? 0 : responsabilidade
            });
        }

        aplicarFiltros();
    } catch (error) { 
        console.error("Erro ao carregar CSV:", error); 
    }
}

function aplicarFiltros() {
    // Calcula Lucro Líquido (Soma direta dos lucros)
    const lucroLiquido = todasOperacoes.reduce((acc, op) => acc + op.pnl, 0);
    
    // Calcula Média de Responsabilidade (Apenas apostas com responsabilidade > 0)
    const comResp = todasOperacoes.filter(op => op.resp > 0);
    const mediaResp = comResp.length > 0 ? (comResp.reduce((acc, op) => acc + op.resp, 0) / comResp.length) : 0;

    document.getElementById('lucro').innerText = `R$ ${lucroLiquido.toFixed(2)}`;
    document.getElementById('media-responsabilidade').innerText = `R$ ${mediaResp.toFixed(2)}`;

    atualizarTabela(todasOperacoes.slice().reverse());
}

function atualizarTabela(lista) {
    const corpoTabela = document.getElementById('corpo-tabela');
    if (!corpoTabela) return;
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
