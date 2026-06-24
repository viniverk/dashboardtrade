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

// Função que trata números e parênteses da Betfair: (12.29) vira -12.29
function parseBetfairNumber(str) {
    if (!str) return 0;
    str = str.replace(/["'\sR$]/g, '');
    if (str.startsWith('(') && str.endsWith(')')) {
        str = '-' + str.slice(1, -1);
    }
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
}

// Converte a data da Betfair ("23-jun-26") para objeto Date
function parseDataBetfair(dataString) {
    if (!dataString) return new Date(0);
    const partes = dataString.split(' ')[0].split('-');
    if (partes.length !== 3) return new Date(0);
    const meses = { 'jan':0, 'fev':1, 'mar':2, 'abr':3, 'mai':4, 'jun':5, 'jul':6, 'ago':7, 'set':8, 'out':9, 'nov':10, 'dez':11 };
    const dia = parseInt(partes[0]);
    const mesNum = meses[partes[1].toLowerCase()] || 0;
    const ano = 2000 + parseInt(partes[2]);
    return new Date(ano, mesNum, dia);
}

async function carregarDadosDoGitHub() {
    const url = "https://raw.githubusercontent.com/viniverk/dashboardtrade/refs/heads/main/BettingPandL.csv?t=" + new Date().getTime();
    
    try {
        const response = await fetch(url);
        const text = await response.text();
        const linhas = text.split('\n');
        
        let agrupador = {}; // Chave: Mercado + Hora, Valor: { pnl, resp, etc }

        for (let i = 1; i < linhas.length; i++) {
            let linha = linhas[i].trim();
            if (!linha || linha.includes("Mercado") || linha.includes("Todas as apostas")) continue;

            const colunas = linha.split(',');
            if (colunas.length < 4) continue;

            const mercado = colunas[0].trim();
            const hora = colunas[1].trim();
            const dataResolucao = colunas[2].trim();
            const pnl = parseBetfairNumber(colunas[3]);

            const chave = `${mercado}|${hora}`;

            if (!agrupador[chave]) {
                agrupador[chave] = {
                    mercado: mercado,
                    hora: hora,
                    data: dataResolucao,
                    pnl: 0,
                    dataObj: parseDataBetfair(hora)
                };
            }
            // Soma o resultado (Back + Lay do mesmo mercado resultam no PnL final)
            agrupador[chave].pnl += pnl;
        }

        todasOperacoes = Object.values(agrupador);
        todasOperacoes.sort((a, b) => a.dataObj - b.dataObj);
        
        preencherFiltrosDinamicos();
        aplicarFiltros();
    } catch (error) { 
        console.error("Erro ao carregar CSV:", error); 
    }
}

function preencherFiltrosDinamicos() {
    const selectAno = document.getElementById('filtro-ano');
    const selectData = document.getElementById('filtro-data');
    
    // Extrai anos únicos das datas
    const anosUnicos = [...new Set(todasOperacoes.map(o => o.dataObj.getFullYear().toString()))].sort();
    const datasUnicas = [...new Set(todasOperacoes.map(o => o.data.split(' ')[0]))];

    selectAno.innerHTML = '<option value="TODOS">Todos</option>';
    anosUnicos.forEach(ano => selectAno.innerHTML += `<option value="${ano}">${ano}</option>`);

    selectData.innerHTML = '<option value="TODAS">Todas as Datas</option>';
    datasUnicas.forEach(data => selectData.innerHTML += `<option value="${data}">${data}</option>`);
}

function aplicarFiltros() {
    const fEstrat = document.getElementById('filtro-estrategia').value;
    const fAno = document.getElementById('filtro-ano').value;
    const fMes = document.getElementById('filtro-mes').value;
    const fData = document.getElementById('filtro-data').value;
    const fGrafico = document.getElementById('tipo-grafico').value;

    let filtradas = todasOperacoes.filter(op => {
        const opAno = op.dataObj.getFullYear().toString();
        const opMes = op.dataObj.getMonth().toString();
        const opDataStr = op.data.split(' ')[0];
        
        let condEstrat = (fEstrat === 'TODAS' || 
                         (fEstrat === 'MO' && op.mercado.includes('Resultado')) || 
                         (fEstrat === 'LG' && op.mercado.includes('Placar')));
        let condAno = (fAno === 'TODOS' || opAno === fAno);
        let condMes = (fMes === 'TODOS' || opMes === fMes);
        let condData = (fData === 'TODAS' || opDataStr === fData);
        return condEstrat && condAno && condMes && condData;
    });

    // Calcula Lucro Líquido
    const lucroLiquido = filtradas.reduce((acc, op) => acc + op.pnl, 0);
    document.getElementById('lucro').innerText = `R$ ${lucroLiquido.toFixed(2)}`;
    document.getElementById('lucro').style.color = lucroLiquido >= 0 ? 'green' : 'red';

    atualizarTabela(filtradas.slice().reverse());
    renderizarGrafico(filtradas, fGrafico);
}

function renderizarGrafico(lista, tipoGrafico) {
    const ctx = document.getElementById('meuGrafico').getContext('2d');
    if (chart) chart.destroy();

    let lucroPorDia = {};
    lista.forEach(o => {
        const dia = o.data.split(' ')[0];
        if(!lucroPorDia[dia]) lucroPorDia[dia] = 0;
        lucroPorDia[dia] += o.pnl;
    });

    const labels = Object.keys(lucroPorDia); 
    const valoresIndividuais = Object.values(lucroPorDia);

    let saldoAcumulado = [];
    let somaAcumulada = 0;
    valoresIndividuais.forEach(v => {
        somaAcumulada += v;
        saldoAcumulado.push(parseFloat(somaAcumulada.toFixed(2)));
    });

    const isLine = tipoGrafico === 'line';
    const dadosFinais = isLine ? saldoAcumulado : valoresIndividuais;
    const nomeLabel = isLine ? 'Saldo Acumulado (R$)' : 'Lucro/Prejuízo Diário (R$)';

    chart = new Chart(ctx, {
        type: tipoGrafico,
        plugins: [ChartDataLabels],
        data: {
            labels: labels,
            datasets: [{
                label: nomeLabel,
                data: dadosFinais,
                backgroundColor: isLine ? 'rgba(54, 162, 235, 0.2)' : valoresIndividuais.map(v => v >= 0 ? '#4bc0c0' : '#ff6384'),
                borderColor: isLine ? '#36a2eb' : valoresIndividuais.map(v => v >= 0 ? '#4bc0c0' : '#ff6384'),
                borderWidth: 2,
                fill: isLine,
                tension: 0.2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { top: 25 } },
            plugins: {
                datalabels: {
                    align: 'top',
                    anchor: 'end',
                    font: { weight: 'bold', size: 10 },
                    formatter: (value) => 'R$ ' + value.toFixed(2)
                }
            }
        }
    });
}

function atualizarTabela(lista) {
    const corpoTabela = document.getElementById('corpo-tabela');
    corpoTabela.innerHTML = ""; 
    lista.forEach(op => {
        const tr = document.createElement('tr');
        const corValor = op.pnl >= 0 ? "green" : "red";
        tr.innerHTML = `
            <td style="padding: 10px; font-size: 13px;">${op.mercado}</td>
            <td style="padding: 10px; font-size: 13px;">${op.data}</td>
            <td style="padding: 10px; font-size: 13px;">-</td>
            <td style="padding: 10px; font-size: 13px; color: ${corValor}; font-weight: bold;">R$ ${op.pnl.toFixed(2)}</td>
        `;
        corpoTabela.appendChild(tr);
    });
}

['filtro-estrategia', 'filtro-ano', 'filtro-mes', 'filtro-data', 'tipo-grafico'].forEach(id => {
    document.getElementById(id).addEventListener('change', aplicarFiltros);
});

document.getElementById('btn-login').addEventListener('click', () => {
    signInWithPopup(auth, provider).then(() => {
        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
        carregarDadosDoGitHub();
    });
});
