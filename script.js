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
let chart;

// Função para tratar valores (converte "(12.29)" em "-12.29")
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

        // Identifica cabeçalhos e encontra índices dinamicamente
        const cabecalhos = linhas[0].toLowerCase().split(',');
        const idxMercado = cabecalhos.findIndex(c => c.includes('mercado'));
        const idxData = cabecalhos.findIndex(c => c.includes('realizada'));
        const idxLucro = cabecalhos.findIndex(c => c.includes('lucro'));
        const idxResp = cabecalhos.findIndex(c => c.includes('responsabilidade'));

        let agrupador = {};

        for (let i = 1; i < linhas.length; i++) {
            const linha = linhas[i].trim();
            // Ignora linhas que são apenas avisos ou vazias
            if (!linha || linha.toLowerCase().includes("apostas correspondidas") || linha.toLowerCase().includes("uk")) continue;

            const colunas = linha.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
            if (colunas.length <= Math.max(idxMercado, idxLucro)) continue;

            const mercado = colunas[idxMercado] ? colunas[idxMercado].replace(/["']/g, '').trim() : "Desconhecido";
            const dataHora = idxData !== -1 ? colunas[idxData].replace(/["']/g, '').trim() : "Sem data";
            const lucro = tratarValor(colunas[idxLucro]);
            const resp = idxResp !== -1 ? tratarValor(colunas[idxResp]) : 0;

            // Agrupa pelo nome do mercado para somar Back + Lay
            if (!agrupador[mercado]) {
                agrupador[mercado] = { mercado, data: dataHora, pnl: 0, resp: 0 };
            }
            agrupador[mercado].pnl += lucro;
            // A responsabilidade é o maior valor de risco registrado no mercado
            agrupador[mercado].resp = Math.max(agrupador[mercado].resp, resp);
        }

        todasOperacoes = Object.values(agrupador);
        aplicarFiltros();
        
    } catch (error) { console.error("Erro no processamento:", error); }
}

function aplicarFiltros() {
    const fEstrat = document.getElementById('filtro-estrategia').value;
    const fGrafico = document.getElementById('tipo-grafico').value;

    let filtradas = todasOperacoes.filter(op => {
        let condEstrat = (fEstrat === 'TODAS' || 
                         (fEstrat === 'MO' && op.mercado.includes('Resultado')) || 
                         (fEstrat === 'LG' && op.mercado.includes('Placar')));
        return condEstrat;
    });

    // Calcula Totais
    const lucroLiquido = filtradas.reduce((acc, op) => acc + op.pnl, 0);
    document.getElementById('lucro').innerText = `R$ ${lucroLiquido.toFixed(2)}`;
    document.getElementById('lucro').style.color = lucroLiquido >= 0 ? 'green' : 'red';

    const comResp = filtradas.filter(op => op.resp > 0);
    const mediaResp = comResp.length > 0 ? (comResp.reduce((acc, op) => acc + op.resp, 0) / comResp.length) : 0;
    document.getElementById('media-responsabilidade').innerText = `R$ ${mediaResp.toFixed(2)}`;

    atualizarTabela(filtradas);
    renderizarGrafico(filtradas, fGrafico);
}

function renderizarGrafico(lista, tipoGrafico) {
    const ctx = document.getElementById('meuGrafico').getContext('2d');
    if (chart) chart.destroy();

    const labels = lista.map(o => o.mercado.substring(0, 15) + '...');
    const valores = lista.map(o => o.pnl);

    chart = new Chart(ctx, {
        type: tipoGrafico,
        plugins: [ChartDataLabels],
        data: {
            labels: labels,
            datasets: [{
                label: 'Lucro/Prejuízo (R$)',
                data: valores,
                backgroundColor: valores.map(v => v >= 0 ? '#4bc0c0' : '#ff6384'),
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                datalabels: { anchor: 'end', align: 'top', formatter: (v) => v.toFixed(2) }
            }
        }
    });
}

function atualizarTabela(lista) {
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
