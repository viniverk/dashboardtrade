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

Chart.register(ChartDataLabels);

// Trata os valores exportados pelo Traderline (remove espaços e trata o "--")
function tratarValor(valor) {
    if (!valor) return 0;
    let s = valor.toString().replace(/["'\sR$]/g, '');
    if (s === '--' || s === '-') return 0;
    if (s.startsWith('(') && s.endsWith(')')) s = '-' + s.slice(1, -1);
    const num = parseFloat(s.replace(',', '.'));
    return isNaN(num) ? 0 : num;
}

// Mapa global de meses
const monthOrder = {
    "jan": 0, "feb": 1, "fev": 1, "mar": 2, "apr": 3, "abr": 3, "may": 4, "mai": 4,
    "jun": 5, "jul": 6, "aug": 7, "ago": 7, "sep": 8, "set": 8, "oct": 9, "out": 9,
    "nov": 10, "dec": 11, "dez": 11
};

async function carregarDadosDoGitHub() {
    const url = "https://raw.githubusercontent.com/viniverk/dashboardtrade/refs/heads/main/BettingPandL.csv?t=" + new Date().getTime();
    
    try {
        const response = await fetch(url);
        const text = await response.text();
        const linhas = text.split('\n');
        
        // Remove caracteres especiais como \r
        const cabecalhos = linhas[0].toLowerCase().replace(/\r/g, '').split(',');
        
        // Índices baseados na estrutura do Traderline
        const idxData = cabecalhos.findIndex(c => c.includes('realizada'));
        const idxDesc = cabecalhos.findIndex(c => c.includes('descri')); // "Descrição"
        const idxOdd = cabecalhos.findIndex(c => c.includes('cota')); // "Cotações"
        const idxResp = cabecalhos.findIndex(c => c.includes('risco')); // "Risco (R$)"
        const idxLucro = cabecalhos.findIndex(c => c.includes('lucro')); // "Lucro/Perda"

        let agrupador = {};

        for (let i = 1; i < linhas.length; i++) {
            const linha = linhas[i].trim().replace(/\r/g, '');
            if (!linha || linha.toLowerCase().includes("status")) continue;

            const colunas = linha.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
            if (colunas.length <= Math.max(idxDesc, idxLucro)) continue;

            // Extrai o nome limpo do Mercado (Tudo que vem antes da barra "|" no Traderline)
            let mercadoNome = "Desconhecido";
            if (idxDesc !== -1 && colunas[idxDesc]) {
                mercadoNome = colunas[idxDesc].replace(/["']/g, '').split('|')[0].trim();
            }

            const dataHoraCompleta = idxData !== -1 && colunas[idxData] ? colunas[idxData].replace(/["']/g, '').trim() : "Sem data";
            const lucro = idxLucro !== -1 ? tratarValor(colunas[idxLucro]) : 0;
            const resp = idxResp !== -1 ? tratarValor(colunas[idxResp]) : 0;
            const odd = idxOdd !== -1 ? tratarValor(colunas[idxOdd]) : 0;
            
            let dataLimpa = dataHoraCompleta;
            let ano = "Todos";
            let mes = "Todos";

            if (dataHoraCompleta.includes('-')) {
                dataLimpa = dataHoraCompleta.split(' ')[0]; // Pega apenas a data "23-jun-26"
                const partesData = dataLimpa.split('-');
                if (partesData.length === 3) {
                    ano = "20" + partesData[2];
                    mes = partesData[1].toLowerCase();
                }
            }

            // A chave de agrupamento agora é o Mercado + Data (Ignoramos as horas para consolidar tudo num único resultado daquele dia)
            const chave = `${mercadoNome}|${dataLimpa}`;

            if (!agrupador[chave]) {
                agrupador[chave] = { mercado: mercadoNome, data: dataLimpa, dataLimpa, ano, mes, pnl: 0, resp: 0, odd: 0 };
            }
            
            // Soma os ganhos e perdas de todas as entradas e saídas
            agrupador[chave].pnl += lucro;
            
            // Guarda o risco máximo que você teve na operação e a cotação mais alta que você pegou
            agrupador[chave].resp = Math.max(agrupador[chave].resp, resp);
            agrupador[chave].odd = Math.max(agrupador[chave].odd, odd);
        }

        todasOperacoes = Object.values(agrupador);
        
        preencherFiltrosDinamicos();
        aplicarFiltros();
        
    } catch (error) { console.error("Erro no processamento:", error); }
}

function preencherFiltrosDinamicos() {
    const anos = [...new Set(todasOperacoes.map(o => o.ano))].filter(a => a !== "Todos").sort();
    const datas = [...new Set(todasOperacoes.map(o => o.dataLimpa))].filter(d => d !== "Sem data").sort();
    
    const selAno = document.getElementById('filtro-ano');
    const selData = document.getElementById('filtro-data');
    
    selAno.innerHTML = '<option value="TODOS">Todos</option>';
    anos.forEach(a => selAno.innerHTML += `<option value="${a}">${a}</option>`);

    selData.innerHTML = '<option value="TODAS">Todas as Datas</option>';
    datas.forEach(d => selData.innerHTML += `<option value="${d}">${d}</option>`);
}

function aplicarFiltros() {
    const fEstrat = document.getElementById('filtro-estrategia').value;
    const fAno = document.getElementById('filtro-ano').value;
    const fMes = document.getElementById('filtro-mes').value; 
    const fData = document.getElementById('filtro-data').value;
    const fGrafico = document.getElementById('tipo-grafico').value;

    const mesesPT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
    const mesesEN = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    
    const mesBuscadoPT = mesesPT[fMes];
    const mesBuscadoEN = mesesEN[fMes];

    const filtradas = todasOperacoes.filter(op => {
        const mercLower = op.mercado.toLowerCase();
        
        // Match Odds costuma vir como "probabilidades" ou "resultado" no Traderline, Lay Goleada como "placar"
        const condEstrat = (fEstrat === 'TODAS' || 
                           (fEstrat === 'MO' && (mercLower.includes('resultado') || mercLower.includes('probabilidades'))) || 
                           (fEstrat === 'LG' && (mercLower.includes('placar') || mercLower.includes('correct score'))));
                           
        const condAno = (fAno === 'TODOS' || op.ano === fAno);
        const condMes = (fMes === 'TODOS' || op.mes === mesBuscadoPT || op.mes === mesBuscadoEN);
        const condData = (fData === 'TODAS' || op.dataLimpa === fData);
        
        return condEstrat && condAno && condMes && condData;
    });

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
    const canvas = document.getElementById('meuGrafico');
    if (!canvas) return; 
    const ctx = canvas.getContext('2d');
    
    if (chart) chart.destroy();

    let agrupadoPorData = {};
    lista.forEach(o => {
        if(!agrupadoPorData[o.dataLimpa]) agrupadoPorData[o.dataLimpa] = 0;
        agrupadoPorData[o.dataLimpa] += o.pnl;
    });

    const labels = Object.keys(agrupadoPorData).sort((a, b) => {
        const numMesA = monthOrder[a.split('-')[1].toLowerCase()];
        const numMesB = monthOrder[b.split('-')[1].toLowerCase()];
        const valA = new Date("20" + a.split('-')[2], numMesA, a.split('-')[0]);
        const valB = new Date("20" + b.split('-')[2], numMesB, b.split('-')[0]);
        return valA - valB;
    });
    
    const valoresDiarios = labels.map(l => agrupadoPorData[l]);

    let dadosParaGrafico = valoresDiarios;
    if (tipoGrafico === 'line') {
        let saldo = 0;
        dadosParaGrafico = valoresDiarios.map(v => {
            saldo += v;
            return saldo;
        });
    }

    chart = new Chart(ctx, {
        type: tipoGrafico,
        data: {
            labels: labels,
            datasets: [{
                label: tipoGrafico === 'line' ? 'Evolução da Banca (R$)' : 'Lucro Diário (R$)',
                data: dadosParaGrafico, 
                backgroundColor: tipoGrafico === 'bar' ? valoresDiarios.map(v => v >= 0 ? '#4bc0c0' : '#ff6384') : 'rgba(54, 162, 235, 0.2)',
                borderColor: tipoGrafico === 'bar' ? valoresDiarios.map(v => v >= 0 ? '#4bc0c0' : '#ff6384') : '#36a2eb',
                borderWidth: 2,
                fill: tipoGrafico === 'line',
                tension: 0.2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { top: 30 } },
            scales: { y: { beginAtZero: true, grace: '20%' } },
            plugins: { 
                datalabels: { 
                    anchor: 'end', 
                    align: 'top', 
                    formatter: v => 'R$ ' + v.toFixed(2),
                    font: { weight: 'bold', size: 11 },
                    padding: { bottom: 10 }
                } 
            }
        }
    });
}

function atualizarTabela(lista) {
    const corpo = document.getElementById('corpo-tabela');
    if(!corpo) return;
    corpo.innerHTML = "";
    lista.slice().reverse().forEach(op => {
        const tr = document.createElement('tr');
        
        const oddFormatada = op.odd > 0 ? op.odd.toFixed(2) : '-';
        const respFormatada = op.resp > 0 ? 'R$ ' + op.resp.toFixed(2) : '-';
        const corLucro = op.pnl >= 0 ? 'green' : 'red';
        
        tr.innerHTML = `
            <td style="padding:10px; font-size: 13px;">${op.mercado}</td>
            <td style="padding:10px; font-size: 13px;">${op.data}</td>
            <td style="padding:10px; font-size: 13px; font-weight: bold; color: #1e40af;">${oddFormatada}</td>
            <td style="padding:10px; font-size: 13px;">${respFormatada}</td>
            <td style="padding:10px; font-size: 13px; color:${corLucro}; font-weight:bold;">R$ ${op.pnl.toFixed(2)}</td>
        `;
        corpo.appendChild(tr);
    });
}

['filtro-estrategia', 'filtro-ano', 'filtro-mes', 'filtro-data', 'tipo-grafico'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.addEventListener('change', aplicarFiltros);
});

document.getElementById('btn-login').addEventListener('click', () => {
    signInWithPopup(auth, provider).then(() => {
        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
        carregarDadosDoGitHub();
    }).catch(error => console.error("Erro no login:", error));
});
