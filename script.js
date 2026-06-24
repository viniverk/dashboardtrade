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

// Transforma a data da Betfair ("23-jun-26") em dados estruturados
function parseDataBetfair(dataString) {
    const partes = dataString.split(' ')[0].split('-');
    if (partes.length !== 3) return null;
    
    const meses = { 'jan':0, 'fev':1, 'mar':2, 'abr':3, 'mai':4, 'jun':5, 'jul':6, 'ago':7, 'set':8, 'out':9, 'nov':10, 'dez':11 };
    
    const dia = partes[0].padStart(2, '0');
    const mesNum = meses[partes[1].toLowerCase()] || 0;
    const ano = "20" + partes[2];
    
    return { 
        dataObj: new Date(ano, mesNum, dia), 
        dataStr: `${dia}/${String(mesNum+1).padStart(2, '0')}/${ano}`, 
        ano: ano,
        mesStrNum: String(mesNum) // '0' para Jan, '5' para Jun
    };
}

async function carregarDadosDoGitHub() {
    const url = "https://raw.githubusercontent.com/viniverk/dashboardtrade/refs/heads/main/BettingPandL.csv?t=" + new Date().getTime();
    
    try {
        const response = await fetch(url);
        const text = await response.text();
        const linhas = text.split('\n');
        
        todasOperacoes = [];

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
            if (!infoData) continue;

            todasOperacoes.push({
                mercado: mercadoOriginal,
                estrategia: categoriaEstrategia,
                inicio: horaInicio,
                fim: dataResolucao,
                pnl: resultado,
                dataObj: infoData.dataObj,
                dataStr: infoData.dataStr,
                ano: infoData.ano,
                mes: infoData.mesStrNum
            });
        }

        // Ordena tudo de forma cronológica
        todasOperacoes.sort((a, b) => a.dataObj - b.dataObj);
        
        preencherFiltrosDinamicos();
        aplicarFiltros();
        
    } catch (error) { 
        console.error("Erro ao carregar CSV:", error); 
    }
}

// Preenche os menus "Ano" e "Data" automaticamente baseado no arquivo CSV
function preencherFiltrosDinamicos() {
    const selectAno = document.getElementById('filtro-ano');
    const selectData = document.getElementById('filtro-data');
    
    const anosUnicos = [...new Set(todasOperacoes.map(o => o.ano))].sort();
    const datasUnicas = [...new Set(todasOperacoes.map(o => o.dataStr))];

    selectAno.innerHTML = '<option value="TODOS">Todos</option>';
    anosUnicos.forEach(ano => selectAno.innerHTML += `<option value="${ano}">${ano}</option>`);

    selectData.innerHTML = '<option value="TODAS">Todas as Datas</option>';
    datasUnicas.forEach(data => selectData.innerHTML += `<option value="${data}">${data}</option>`);
}

// O Núcleo do Filtro: Cruza todos os campos selecionados e atualiza a tela
function aplicarFiltros() {
    const fEstrat = document.getElementById('filtro-estrategia').value;
    const fAno = document.getElementById('filtro-ano').value;
    const fMes = document.getElementById('filtro-mes').value;
    const fData = document.getElementById('filtro-data').value;
    const fGrafico = document.getElementById('tipo-grafico').value;

    let filtradas = todasOperacoes.filter(op => {
        let condEstrat = (fEstrat === 'TODAS' || op.estrategia === fEstrat);
        let condAno = (fAno === 'TODOS' || op.ano === fAno);
        let condMes = (fMes === 'TODOS' || op.mes === fMes);
        let condData = (fData === 'TODAS' || op.dataStr === fData);
        return condEstrat && condAno && condMes && condData;
    });

    // 1. Atualiza o KPI de Lucro Líquido
    const lucroLiquido = filtradas.reduce((acc, op) => acc + op.pnl, 0);
    document.getElementById('lucro').innerText = `R$ ${lucroLiquido.toFixed(2)}`;
    document.getElementById('lucro').style.color = lucroLiquido >= 0 ? 'green' : 'red';

    // 2. Atualiza a Tabela
    atualizarTabela(filtradas.slice().reverse()); // Reverte para a mais recente em cima

    // 3. Atualiza o Gráfico (Agrupando pela Data)
    renderizarGrafico(filtradas, fGrafico);
}

// Renderiza o gráfico somando os valores de cada dia filtrado
function renderizarGrafico(lista, tipoGrafico) {
    const ctx = document.getElementById('meuGrafico').getContext('2d');
    if (chart) chart.destroy();

    // Agrupa os lucros pelo Dia
    let agrupado = {};
    lista.forEach(o => {
        if(!agrupado[o.dataStr]) agrupado[o.dataStr] = 0;
        agrupado[o.dataStr] += o.pnl;
    });

    const labels = Object.keys(agrupado);
    const data = Object.values(agrupado);

    // Se for Barra, pinta lucro de verde e red de vermelho
    // Se for linha, usa a linha azul de evolução com preenchimento
    const isBar = tipoGrafico === 'bar';
    const bgColors = isBar ? data.map(v => v >= 0 ? '#4bc0c0' : '#ff6384') : 'rgba(54, 162, 235, 0.2)';
    const bdColors = isBar ? data.map(v => v >= 0 ? '#4bc0c0' : '#ff6384') : '#36a2eb';

    chart = new Chart(ctx, {
        type: tipoGrafico, // 'bar' ou 'line'
        data: {
            labels: labels,
            datasets: [{
                label: 'Lucro Consolidado (R$)',
                data: data,
                backgroundColor: bgColors,
                borderColor: bdColors,
                borderWidth: 2,
                fill: !isBar, // Preenchimento abaixo da linha
                tension: 0.2  // Curva leve na linha
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

// Configura os gatilhos: Qualquer mudança em qualquer caixa recarrega os dados
['filtro-estrategia', 'filtro-ano', 'filtro-mes', 'filtro-data', 'tipo-grafico'].forEach(id => {
    document.getElementById(id).addEventListener('change', aplicarFiltros);
});

document.getElementById('btn-login').addEventListener('click', () => {
    signInWithPopup(auth, provider).then(() => {
        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
        carregarDadosDoGitHub();
    }).catch(error => console.error("Falha no login: ", error));
});
