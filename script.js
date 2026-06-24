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

function tratarValor(valor) {
    if (!valor) return 0;
    let s = valor.toString().replace(/["'\sR$]/g, '');
    if (s.startsWith('(') && s.endsWith(')')) s = '-' + s.slice(1, -1);
    const num = parseFloat(s.replace(',', '.'));
    return isNaN(num) ? 0 : num;
}

async function carregarDadosDoGitHub() {
    const url = "https://raw.githubusercontent.com/viniverk/dashboardtrade/refs/heads/main/BettingPandL.csv?t=" + new Date().getTime();
    
    try {
        const response = await fetch(url);
        const text = await response.text();
        const linhas = text.split('\n');
        if (linhas.length < 2) return;

        // Limpeza do cabeçalho
        const cabecalhos = linhas[0].toLowerCase().split(',').map(c => c.trim());
        
        // Localização precisa dos índices
        const idxMercado = cabecalhos.findIndex(c => c.includes('mercado'));
        const idxData = cabecalhos.findIndex(c => c.includes('aposta realizada'));
        const idxLucro = cabecalhos.findIndex(c => c.includes('lucro'));
        const idxResp = cabecalhos.findIndex(c => c.includes('responsabilidade'));

        console.log("Índices encontrados:", { idxMercado, idxData, idxLucro, idxResp });

        let agrupador = {};

        for (let i = 1; i < linhas.length; i++) {
            const linha = linhas[i].trim();
            if (!linha || linha.includes("Apostas correspondidas")) continue;

            const colunas = linha.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
            if (colunas.length < 3) continue;

            const mercado = colunas[idxMercado] ? colunas[idxMercado].replace(/["']/g, '').trim() : "Mercado Desconhecido";
            const dataHora = idxData !== -1 ? colunas[idxData].replace(/["']/g, '').trim() : "Data Indisponível";
            const lucro = tratarValor(colunas[idxLucro]);
            const resp = idxResp !== -1 ? tratarValor(colunas[idxResp]) : 0;

            const chave = `${mercado}|${dataHora}`;

            if (!agrupador[chave]) {
                agrupador[chave] = { mercado, data: dataHora, pnl: 0, resp: 0 };
            }
            agrupador[chave].pnl += lucro;
            agrupador[chave].resp = Math.max(agrupador[chave].resp, resp);
        }

        const dadosFinais = Object.values(agrupador);
        exibirDashboard(dadosFinais);
        
    } catch (error) { console.error("Erro ao carregar CSV:", error); }
}

function exibirDashboard(lista) {
    const lucroLiquido = lista.reduce((acc, op) => acc + op.pnl, 0);
    const comResp = lista.filter(op => op.resp > 0);
    const mediaResp = comResp.length > 0 ? (comResp.reduce((acc, op) => acc + op.resp, 0) / comResp.length) : 0;

    document.getElementById('lucro').innerText = `R$ ${lucroLiquido.toFixed(2)}`;
    document.getElementById('media-responsabilidade').innerText = `R$ ${mediaResp.toFixed(2)}`;

    const corpo = document.getElementById('corpo-tabela');
    corpo.innerHTML = "";
    lista.forEach(op => {
        const tr = document.createElement('tr');
        const cor = op.pnl >= 0 ? "green" : "red";
        tr.innerHTML = `
            <td style="padding:10px; font-size: 13px;">${op.mercado}</td>
            <td style="padding:10px; font-size: 13px;">${op.data}</td>
            <td style="padding:10px; font-size: 13px;">${op.resp > 0 ? 'R$ ' + op.resp.toFixed(2) : '-'}</td>
            <td style="padding:10px; font-size: 13px; color:${cor}; font-weight:bold;">R$ ${op.pnl.toFixed(2)}</td>
        `;
        corpo.appendChild(tr);
    });
}

document.getElementById('btn-login').addEventListener('click', () => {
    signInWithPopup(auth, provider).then(() => {
        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
        carregarDadosDoGitHub();
    });
});
