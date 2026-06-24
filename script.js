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

// Variável Global para guardar as operações e permitir filtragem rápida
let todasOperacoes = [];

// Função auxiliar para interpretar a data da Betfair (ex: "23-jun-26")
function parseDataBetfair(dataString) {
    const partes = dataString.split(' ')[0].split('-'); // Pega "23-jun-26" e separa
    if (partes.length !== 3) return { dataObj: new Date(0), dataStr: dataString, mesStr: dataString };
    
    const meses = { 'jan':0, 'fev':1, 'mar':2, 'abr':3, 'mai':4, 'jun':5, 'jul':6, 'ago':7, 'set':8, 'out':9, 'nov':10, 'dez':11 };
    const dia = parseInt(partes[0]);
    const mes = meses[partes[1].toLowerCase()] || 0;
    const ano = 2000 + parseInt(partes[2]);
    
    // Mes Formatado (ex: "Jun/2026")
    const mesNomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const mesStr = `${mesNomes[mes]}/${ano}`;

    return { dataObj: new Date(ano, mes, dia), dataStr: partes.join('-'), mesStr: mesStr };
}

async function carregarDadosDoGitHub() {
    const url = "https://raw.githubusercontent.com/viniverk/dashboardtrade/refs/heads/main/BettingPandL.csv?t=" + new Date().getTime();
    
    try {
        const response = await fetch(url);
        const text = await response.text();
        const linhas = text.split('\n');
        
        todasOperacoes = []; // Zera a lista antes de ler

        for (let i = 1; i < linhas.length; i++) {
            const linhaLimpa = linhas[i].trim();
            if (!linhaLimpa) continue;

            let colunas = linhaLimpa.split(',');
            if (colunas.length < 4) continue;

            const resultadoTexto = colunas.pop().replace(/["']/g, ''); 
            const dataResolucao = colunas.pop().replace(/["']/g, '');  
            const horaInicio = colunas.pop().replace(/["']/g, '');     
            const mercadoOriginal = colunas.join(',').replace(/["']/g, ''); 
            
            const mercadoLower = mercadoOriginal.toLowerCase();
            const resultado = parseFloat(resultadoTexto);

            if (isNaN(resultado)) continue;

            let categoriaEstrategia = "OUTROS";
            if (mercadoLower.includes("resultado da partida")) categoriaEstrategia = "MO";
            else if (mercadoLower.includes("placar correto")) categoriaEstrategia = "LG";

            const infoData = parseDataBetfair(horaInicio);

            todasOperacoes.push({
                mercado: mercadoOriginal,
                estrategia: categoriaEstrategia,
                inicio: horaInicio,
                fim: dataResolucao,
                pnl: resultado,
                dataObj: infoData.dataObj,
                dataStr: infoData.dataStr, // Data do dia
                mesStr: infoData.mesStr    // Mês Consolidado
            });
        }

        // Ordena as operações de forma cronológica (do mais antigo pro mais novo)
        todasOperacoes.sort((a, b) => a.dataObj - b.dataObj);
        
        // Aplica os filtros assim que carrega os dados
        aplicarFiltros();
        
    } catch (error) { 
        console.error("Erro ao carregar o arquivo CSV:", error); 
    }
}

// A CEREJA DO BOLO: Função que aplica as escolhas dos menus suspensos
function aplicarFiltros() {
    const filtroEstrat = document.getElementById('filtro-estrategia').value;
    const visaoGrafico = document.getElementById('visao-grafico').value;

    // 1. Filtra os dados com base na escolha de Estratégia
    let operacoesFiltradas = todasOperacoes.filter(op => {
        if (filtroEstrat === "TODAS") return true;
        return op.estrategia === filtroEstrat;
    });

    // 2. Calcula KPIs (Dinâmico de acordo com o filtro)
    const lucroLiquido = operacoesFiltradas.reduce((acc, op) => acc + op.pnl, 0);
    const displayLucro = document.getElementById('lucro');
    if (displayLucro) displayLucro.innerText = `R$ ${lucroLiquido.toFixed(2)}`;

    // 3. Atualiza Tabela (Revertemos para o mais novo aparecer em cima)
    atualizarTabela(operacoesFiltradas.slice().reverse());

    // 4. Desenha o Gráfico escolhido
    renderizarGrafico(operacoesFiltradas, visaoGrafico);
}

function renderizarGrafico(lista, visao) {
    const ctx = document.getElementById('meuGrafico').getContext('2d');
    if (chart) chart.destroy();

    let labels = [];
    let data = [];
    let tipoGrafico = 'bar';
    let coresFundo = [];
    let configDataset = {};

    if (visao === 'estrategia') {
        tipoGrafico = 'bar';
        let mo = lista.filter(o => o.estrategia === 'MO').reduce((acc, o) => acc + o.pnl, 0);
        let lg = lista.filter(o => o.estrategia === 'LG').reduce((acc, o) => acc + o.pnl, 0);
        labels = ['Match Odds', 'Lay Goleada'];
        data = [mo, lg];
        coresFundo = ['#36a2eb', '#ff6384'];
        configDataset = { backgroundColor: coresFundo };

    } else if (visao === 'data') {
        tipoGrafico = 'line';
        let agrupado = {};
        // Soma por Data (Dia a Dia)
        lista.forEach(o => {
            if(!agrupado[o.dataStr]) agrupado[o.dataStr] = 0;
            agrupado[o.dataStr] += o.pnl;
        });
        labels = Object.keys(agrupado);
        data = Object.values(agrupado);
        configDataset = {
            borderColor: '#36a2eb',
            backgroundColor: 'rgba(54, 162, 235, 0.2)',
            fill: true,
            tension: 0.1
        };

    } else if (visao === 'mes') {
        tipoGrafico = 'bar';
        let agrupado = {};
        // Soma por Mês Consolidado
        lista.forEach(o => {
            if(!agrupado[o.mesStr]) agrupado[o.mesStr] = 0;
            agrupado[o.mesStr] += o.pnl;
        });
        labels = Object.keys(agrupado);
        data = Object.values(agrupado);
        // Cores Dinâmicas: Verde pra Lucro no mês, Vermelho para Prejuízo no mês
        coresFundo = data.map(v => v >= 0 ? '#4bc0c0' : '#ff6384');
        configDataset = { backgroundColor: coresFundo };
    }

    chart = new Chart(ctx, {
        type: tipoGrafico,
        data: {
            labels: labels,
            datasets: [{
                label: `Lucro (R$) - ${visao.toUpperCase()}`,
                data: data,
                borderWidth: 1,
                ...configDataset
            }]
        },
        options: {
            responsive: true,
            scales: { y: { beginAtZero: true } }
        }
    });
}

function atualizarTabela(lista) {
    const corpoTabela = document.getElementById('corpo-tabela');
    if (!corpoTabela) return;
    corpoTabela.innerHTML = ""; 

    lista.forEach(op => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = "1px solid #eee";
        const corValor = op.pnl >= 0 ? "green" : "red";
        const sinal = op.pnl >= 0 ? "+" : "";
        tr.innerHTML = `
            <td style="padding: 10px; font-size: 14px;">${op.mercado}</td>
            <td style="padding: 10px; font-size: 14px; color: #555;">${op.inicio}</td>
            <td style="padding: 10px; font-size: 14px; color: #555;">${op.fim}</td>
            <td style="padding: 10px; font-size: 14px; font-weight: bold; color: ${corValor};">
                R$ ${sinal}${op.pnl.toFixed(2)}
            </td>
        `;
        corpoTabela.appendChild(tr);
    });
}

// Event Listeners dos Menus Suspensos para alterarem os dados na hora do clique
document.getElementById('filtro-estrategia').addEventListener('change', aplicarFiltros);
document.getElementById('visao-grafico').addEventListener('change', aplicarFiltros);

document.getElementById('btn-login').addEventListener('click', () => {
    signInWithPopup(auth, provider).then(() => {
        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
        carregarDadosDoGitHub();
    }).catch(error => console.error("Falha no login: ", error));
});
