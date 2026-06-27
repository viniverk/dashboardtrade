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
let sortDirection = 1;

Chart.register(ChartDataLabels);

function tratarValor(valor) {
    if (!valor) return 0;
    let s = valor.toString().replace(/["'\sR$]/g, '');
    if (s === '--' || s === '-') return 0;
    if (s.startsWith('(') && s.endsWith(')')) s = '-' + s.slice(1, -1);
    const num = parseFloat(s.replace(',', '.'));
    return isNaN(num) ? 0 : num;
}

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
        
        const cabecalhos = linhas[0].toLowerCase().replace(/\r/g, '').split(',');
        
        const idxData = cabecalhos.findIndex(c => c.includes('resolvida'));
        const idxDesc = cabecalhos.findIndex(c => c.includes('descri'));
        const idxOdd = cabecalhos.findIndex(c => c.includes('cota'));
        const idxResp = cabecalhos.findIndex(c => c.includes('risco'));
        const idxLucro = cabecalhos.findIndex(c => c.includes('lucro'));
        const idxStake = cabecalhos.findIndex(c => c.includes('valor apostado') || c.includes('stake')); // Captura a Stake

        let agrupador = {};

        for (let i = 1; i < linhas.length; i++) {
            const linha = linhas[i].trim().replace(/\r/g, '');
            if (!linha || linha.toLowerCase().includes("status")) continue;

            const colunas = linha.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
            if (colunas.length <= Math.max(idxDesc, idxLucro)) continue;

            let mercadoNome = colunas[idxDesc] ? colunas[idxDesc].replace(/["']/g, '').split('|')[0].trim() : "Desconhecido";
            const dataHoraCompleta = colunas[idxData] ? colunas[idxData].replace(/["']/g, '').trim() : "Sem data";
            const lucro = tratarValor(colunas[idxLucro]);
            const resp = tratarValor(colunas[idxResp]);
            const odd = tratarValor(colunas[idxOdd]);
            const stake = idxStake !== -1 ? tratarValor(colunas[idxStake]) : 0;
            
            const dataLimpa = dataHoraCompleta.split(' ')[0];
            const partesData = dataLimpa.split('-');
            const ano = partesData.length === 3 ? "20" + partesData[2] : "Todos";
            const mes = partesData.length === 3 ? partesData[1].toLowerCase() : "Todos";

            const chave = `${mercadoNome}|${dataLimpa}`;

            if (!agrupador[chave]) {
                agrupador[chave] = { mercado: mercadoNome, data: dataHoraCompleta, dataLimpa, ano, mes, pnl: 0, resp: 0, odd: 0, stake: 0 };
            }
            
            agrupador[chave].pnl += lucro;
            agrupador[chave].resp = Math.max(agrupador[chave].resp, resp);
            agrupador[chave].odd = Math.max(agrupador[chave].odd, odd);
            agrupador[chave].stake = Math.max(agrupador[chave].stake, stake);
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
    
    const filtroPesquisaElem = document.getElementById('filtro-texto-mercado');
    const fTexto = filtroPesquisaElem ? filtroPesquisaElem.value.toLowerCase() : "";

    const mesesMap = {
        "0": "jan", "1": "fev", "2": "mar", "3": "abr", "4": "mai", "5": "jun",
        "6": "jul", "7": "ago", "8": "set", "9": "out", "10": "nov", "11": "dez"
    };
    const mesBuscado = mesesMap[fMes];

    const filtradas = todasOperacoes.filter(op => {
        const mercLower = op.mercado.toLowerCase();
        const condEstrat = (fEstrat === 'TODAS' || 
                           (fEstrat === 'MO' && (mercLower.includes('resultado') || mercLower.includes('probabilidades'))) || 
                           (fEstrat === 'LG' && (mercLower.includes('placar') || mercLower.includes('correct score'))));
                           
        const condTexto = mercLower.includes(fTexto);
        const condAno = (fAno === 'TODOS' || op.ano === fAno);
        const condMes = (fMes === 'TODOS' || op.mes === mesBuscado);
        const condData = (fData === 'TODAS' || op.dataLimpa === fData);
        
        return condEstrat && condTexto && condAno && condMes && condData;
    });

    const lucroLiquido = filtradas.reduce((acc, op) => acc + op.pnl, 0);
    document.getElementById('lucro').innerText = `R$ ${lucroLiquido.toFixed(2)}`;
    document.getElementById('lucro').style.color = lucroLiquido >= 0 ? 'green' : 'red';

    const comResp = filtradas.filter(op => op.resp > 0);
    const totalResp = comResp.reduce((acc, op) => acc + op.resp, 0);
    const mediaResp = comResp.length > 0 ? (totalResp / comResp.length) : 0;
    document.getElementById('media-responsabilidade').innerText = `R$ ${mediaResp.toFixed(2)}`;

    const pctLucro = totalResp > 0 ? (lucroLiquido / totalResp) * 100 : 0;
    const elPctLucro = document.getElementById('pct-lucro');
    if (elPctLucro) {
        elPctLucro.innerText = `${pctLucro.toFixed(2)}%`;
        elPctLucro.style.color = pctLucro >= 0 ? 'green' : 'red';
    }

    const roiStake = mediaResp > 0 ? (lucroLiquido / mediaResp) * 100 : 0;
    const unidades = mediaResp > 0 ? (lucroLiquido / mediaResp).toFixed(2) : 0;
    const elRoiStake = document.getElementById('roi-stake');
    if (elRoiStake) {
        const roiDisplay = Math.min(Math.abs(roiStake), 9999); 
        const sinal = roiStake > 0 ? '+' : (roiStake < 0 ? '-' : '');
        elRoiStake.innerText = `${sinal}${roiDisplay.toFixed(2)}% (${sinal}${Math.abs(unidades)} und)`;
        elRoiStake.style.color = roiStake >= 0 ? 'green' : 'red';
    }

    atualizarTabela(filtradas);
    renderizarGrafico(filtradas, fGrafico);
    atualizarRanking(filtradas); // Atualiza os recordes do Ranking
}

// ----- NOVA FUNÇÃO DE RANKING -----
function atualizarRanking(lista) {
    if (!lista || lista.length === 0) {
        ['green', 'red', 'resp', 'odd', 'stake'].forEach(id => {
            const el = document.getElementById(`rank-${id}`);
            const elDesc = document.getElementById(`rank-${id}-desc`);
            if(el) el.innerText = id === 'odd' ? '0.00' : 'R$ 0,00';
            if(elDesc) elDesc.innerText = '-';
        });
        return;
    }

    let maxGreen = lista[0], maxRed = lista[0];
    let maxResp = lista[0], maxOdd = lista[0], maxStake = lista[0];

    lista.forEach(op => {
        if (op.pnl > maxGreen.pnl) maxGreen = op;
        if (op.pnl < maxRed.pnl) maxRed = op;
        if (op.resp > maxResp.resp) maxResp = op;
        if (op.odd > maxOdd.odd) maxOdd = op;
        if (op.stake > maxStake.stake) maxStake = op;
    });

    const formatDesc = (op) => {
        let m = op.mercado;
        m = m.replace(/Resultado da partida/ig, "Match Odds").replace(/Resultado/ig, "Match Odds").replace(/Placar correto/ig, "Lay Goleada").replace(/Placar/ig, "Lay Goleada");
        return `${m}\nData: ${op.dataLimpa}`;
    };

    document.getElementById('rank-green').innerText = `R$ ${maxGreen.pnl.toFixed(2)}`;
    document.getElementById('rank-green-desc').innerText = formatDesc(maxGreen);

    document.getElementById('rank-red').innerText = `R$ ${maxRed.pnl.toFixed(2)}`;
    document.getElementById('rank-red-desc').innerText = formatDesc(maxRed);

    document.getElementById('rank-resp').innerText = `R$ ${maxResp.resp.toFixed(2)}`;
    document.getElementById('rank-resp-desc').innerText = formatDesc(maxResp);

    document.getElementById('rank-odd').innerText = maxOdd.odd.toFixed(2);
    document.getElementById('rank-odd-desc').innerText = formatDesc(maxOdd);

    document.getElementById('rank-stake').innerText = `R$ ${maxStake.stake.toFixed(2)}`;
    document.getElementById('rank-stake-desc').innerText = formatDesc(maxStake);
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
    let dadosParaGrafico = tipoGrafico === 'line' ? valoresDiarios.map((v, i, arr) => arr.slice(0, i + 1).reduce((a, b) => a + b, 0)) : valoresDiarios;

    chart = new Chart(ctx, {
        type: tipoGrafico,
        data: {
            labels: labels,
            datasets: [{
                label: tipoGrafico === 'line' ? 'Evolução da Banca (R$)' : 'Lucro Diário (R$)',
                data: dadosParaGrafico, 
                backgroundColor: tipoGrafico === 'bar' ? valoresDiarios.map(v => v >= 0 ? '#4bc0c0' : '#ff6384') : 'rgba(54, 162, 235, 0.2)',
                borderColor: '#36a2eb',
                borderWidth: 2,
                fill: tipoGrafico === 'line',
                tension: 0.2
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            layout: { padding: { top: 30 } },
            scales: { y: { beginAtZero: true, grace: '20%' } },
            plugins: { datalabels: { anchor: 'end', align: 'top', formatter: v => 'R$ ' + v.toFixed(2) } }
        }
    });
}

function atualizarTabela(lista) {
    const corpo = document.getElementById('corpo-tabela');
    if(!corpo) return;
    corpo.innerHTML = "";
    
    lista.forEach(op => {
        const tr = document.createElement('tr');
        
        let displayMercado = op.mercado;
        displayMercado = displayMercado.replace(/Resultado da partida/ig, "Match Odds")
                                       .replace(/Resultado/ig, "Match Odds")
                                       .replace(/Placar correto/ig, "Lay Goleada")
                                       .replace(/Placar/ig, "Lay Goleada");

        tr.innerHTML = `
            <td style="padding:10px; font-size: 13px;">${displayMercado}</td>
            <td style="padding:10px; font-size: 13px;">${op.data}</td>
            <td style="padding:10px; font-size: 13px; font-weight: bold; color: #1e40af;">${op.odd > 0 ? op.odd.toFixed(2) : '-'}</td>
            <td style="padding:10px; font-size: 13px;">${op.resp > 0 ? 'R$ ' + op.resp.toFixed(2) : '-'}</td>
            <td style="padding:10px; font-size: 13px; color:${op.pnl >= 0 ? 'green':'red'}; font-weight:bold;">R$ ${op.pnl.toFixed(2)}</td>
        `;
        corpo.appendChild(tr);
    });
}

window.ordenarTabela = (coluna) => {
    sortDirection *= -1; 
    
    todasOperacoes.sort((a, b) => {
        let valA = a[coluna];
        let valB = b[coluna];
        
        if (coluna === 'data') {
            const getTimestamp = (dStr) => {
                if (!dStr || dStr === 'Sem data') return 0;
                const parts = dStr.split(/[\s-:]+/);
                if (parts.length < 3) return 0;
                const dia = parseInt(parts[0]);
                const mes = monthOrder[parts[1].toLowerCase()] || 0;
                const ano = parseInt(parts[2]) + 2000;
                const hr = parts[3] ? parseInt(parts[3]) : 0;
                const min = parts[4] ? parseInt(parts[4]) : 0;
                const sec = parts[5] ? parseInt(parts[5]) : 0;
                return new Date(ano, mes, dia, hr, min, sec).getTime();
            };
            valA = getTimestamp(valA);
            valB = getTimestamp(valB);
        }

        if (typeof valA === 'string' && typeof valB === 'string') {
            return valA.localeCompare(valB) * sortDirection;
        }
        
        return (valA - valB) * sortDirection;
    });
    
    aplicarFiltros(); 
};

// ----- LÓGICA DAS ABAS (TABS) -----
const btnDash = document.getElementById('btn-aba-dashboard');
const btnRank = document.getElementById('btn-aba-ranking');
const conteDash = document.getElementById('conteudo-dashboard');
const conteRank = document.getElementById('conteudo-ranking');

if(btnDash && btnRank) {
    btnDash.addEventListener('click', () => {
        conteDash.style.display = 'block';
        conteRank.style.display = 'none';
        btnDash.style.background = '#1e40af';
        btnDash.style.color = 'white';
        btnRank.style.background = '#e5e7eb';
        btnRank.style.color = '#374151';
    });
    btnRank.addEventListener('click', () => {
        conteDash.style.display = 'none';
        conteRank.style.display = 'block';
        btnRank.style.background = '#1e40af';
        btnRank.style.color = 'white';
        btnDash.style.background = '#e5e7eb';
        btnDash.style.color = '#374151';
    });
}

['filtro-estrategia', 'filtro-ano', 'filtro-mes', 'filtro-data', 'tipo-grafico'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.addEventListener('change', aplicarFiltros);
});

const buscaMercado = document.getElementById('filtro-texto-mercado');
if(buscaMercado) buscaMercado.addEventListener('input', aplicarFiltros);

document.getElementById('btn-login').addEventListener('click', () => {
    signInWithPopup(auth, provider).then(() => {
        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
        carregarDadosDoGitHub();
    }).catch(error => console.error("Erro no login:", error));
});
