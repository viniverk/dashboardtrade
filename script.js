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

// Registra o plugin de rótulos de dados
Chart.register(ChartDataLabels);

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
        
        const cabecalhos = linhas[0].toLowerCase().split(',');
        const idxMercado = cabecalhos.findIndex(c => c.includes('mercado'));
        const idxData = cabecalhos.findIndex(c => c.includes('realizada'));
        const idxLucro = cabecalhos.findIndex(c => c.includes('lucro'));
        const idxResp = cabecalhos.findIndex(c => c.includes('responsabilidade'));

        let agrupador = {};

        for (let i = 1; i < linhas.length; i++) {
            const linha = linhas[i].trim();
            if (!linha || linha.toLowerCase().includes("apostas correspondidas")) continue;

            const colunas = linha.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
            if (colunas.length <= Math.max(idxMercado, idxLucro)) continue;

            const mercado = colunas[idxMercado].replace(/["']/g, '').trim();
            const dataHora = colunas[idxData].replace(/["']/g, '').trim();
            const lucro = tratarValor(colunas[idxLucro]);
            const resp = idxResp !== -1 ? tratarValor(colunas[idxResp]) : 0;
            
            // Extração de dados da data
            let dataLimpa = dataHora;
            let ano = "Todos";
            let mes = "Todos";

            if (dataHora.includes('-')) {
                dataLimpa = dataHora.split(' ')[0]; // ex: "23-jun-26"
                const partesData = dataLimpa.split('-');
                if (partesData.length === 3) {
                    ano = "20" + partesData[2];
                    mes = partesData[1].toLowerCase();
                }
            }

            const chave = `${mercado}|${dataHora}`;

            if (!agrupador[chave]) {
                agrupador[chave] = { mercado, data: dataHora, dataLimpa, ano, mes, pnl: 0, resp: 0 };
            }
            agrupador[chave].pnl += lucro;
            agrupador[chave].resp = Math.max(agrupador[chave].resp, resp);
        }

        todasOperacoes = Object.values(agrupador);
        
        preencherFiltrosDinamicos();
        aplicarFiltros();
        
    } catch (error) { console.error("Erro no processamento:", error); }
}

function preencherFiltrosDinamicos() {
    const anos = [...new Set(todasOperacoes.map(o => o.ano))].filter(a => a !== "Todos").sort();
    const datas = [...new Set(todasOperacoes.map(o => o.dataLimpa))].filter(d => d !== "Sem Data").sort();
    
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

    // Traduz o número do HTML para o texto que vem no CSV da Betfair
    const mesesMap = {
        "0": "jan", "1": "fev", "2": "mar", "3": "abr", "4": "mai", "5": "jun",
        "6": "jul", "7": "ago", "8": "set", "9": "out", "10": "nov", "11": "dez"
    };
    const mesBuscado = mesesMap[fMes];

    const filtradas = todasOperacoes.filter(op => {
        const condEstrat = (fEstrat === 'TODAS' || (fEstrat === 'MO' && op.mercado.includes('Resultado')) || (fEstrat === 'LG' && op.mercado.includes('Placar')));
        const condAno = (fAno === 'TODOS' || op.ano === fAno);
        const condMes = (fMes === 'TODOS' || op.mes === mesBuscado);
        const condData = (fData === 'TODAS' || op.dataLimpa === fData);
        return condEstrat && condAno && condMes && condData;
    });

    // Atualiza KPIs
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

    // Agrupa por DATA (eixo X)
    let agrupadoPorData = {};
    lista.forEach(o => {
        if(!agrupadoPorData[o.dataLimpa]) agrupadoPorData[o.dataLimpa] = 0;
        agrupadoPorData[o.dataLimpa] += o.pnl;
    });

    const labels = Object.keys(agrupadoPorData).sort();
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
            layout: {
                padding: { top: 30 } // Empurra o gráfico para baixo, abrindo espaço no teto
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grace: '20%' // O SEGREDO: Dá 20% de espaço extra no topo da escala Y
                }
            },
            plugins: { 
                datalabels: { 
                    anchor: 'end', 
                    align: 'top', 
                    formatter: v => 'R$ ' + v.toFixed(2),
                    font: { weight: 'bold', size: 11 },
                    padding: { bottom: 10 } // Empurra o rótulo levemente para cima da barra
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
        tr.innerHTML = `<td style="padding:10px; font-size: 13px;">${op.mercado}</td><td style="padding:10px; font-size: 13px;">${op.data}</td><td style="padding:10px; font-size: 13px;">${op.resp > 0 ? 'R$ '+op.resp.toFixed(2) : '-'}</td><td style="padding:10px; font-size: 13px; color:${op.pnl >= 0 ? 'green':'red'}; font-weight:bold;">R$ ${op.pnl.toFixed(2)}</td>`;
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
