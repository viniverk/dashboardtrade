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
        mesStrNum: String(mesNum)
    };
}

async function carregarDadosDoGitHub() {
    const url = "https://raw.githubusercontent.com/viniverk/dashboardtrade/refs/heads/main/BettingPandL.csv?t=" + new Date().getTime();
    
    try {
        const response = await fetch(url);
        const text = await response.text();
        const linhas = text.split('\n');
        
        todasOperacoes = [];
        const operacoesProcessadas = new Set();

        for (let i = 1; i < linhas.length; i++) {
            const linhaLimpa = linhas[i].trim();
            if (!linhaLimpa) continue;

            let colunas = linhaLimpa.split(',');
            if (colunas.length < 4) continue;

            const resultadoTexto = colunas.pop().replace(/["']/g, ''); 
            const dataResolucao = colunas.pop().replace(/["']/g, '');  
            const horaInicio = colunas.pop().replace(/["']/g, '');     
            const mercadoOriginal = colunas.join(',').replace(/["']/g, ''); 
            
            const chaveUnica = `${mercadoOriginal}|${horaInicio}|${dataResolucao}|${resultadoTexto}`;

            if (operacoesProcessadas.has(chaveUnica)) {
                continue;
            }
            operacoesProcessadas.add(chaveUnica);

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

        todasOperacoes.sort((a, b) => a.dataObj - b.dataObj);
        
        preencherFiltrosDinamicos();
        aplicarFiltros();
        
    } catch (error) { 
        console.error("Erro ao carregar o arquivo CSV:", error); 
    }
}

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

    const lucroLiquido = filtradas.reduce((acc, op) => acc + op.pnl, 0);
    const lucroElem = document.getElementById('lucro');
    if (lucroElem) {
        lucroElem.innerText = `R$ ${lucroLiquido.toFixed(2)}`;
        lucroElem.style.color = lucroLiquido >= 0 ? 'green' : 'red';
    }

    atualizarTabela(filtradas.slice().reverse()); 
    renderizarGrafico(filtradas, fGrafico);
}

function renderizarGrafico(lista, tipoGrafico) {
    const ctx = document.getElementById('meuGrafico').getContext('2d');
    if (chart) chart.destroy();

    let lucroPorDia = {};
    lista.forEach(o => {
        if(!lucroPorDia[o.dataStr]) lucroPorDia[o.dataStr] = 0;
        lucroPorDia[o.dataStr] += o.pnl;
    });

    const labels = Object.keys(lucroPorDia); 
    const valoresIndividuais = Object.values(lucroPorDia);

    let saldoAcumulado = [];
    let somaAcumulada = 0;
    
    valoresIndividuais.forEach(valorDiario => {
        somaAcumulada += valorDiario;
        saldoAcumulado.push(parseFloat(somaAcumulada.toFixed(2)));
    });

    const isLine = tipoGrafico === 'line';
    const dadosFinais = isLine ? saldoAcumulado : valoresIndividuais;
    const nomeLabel = isLine ? 'Saldo Acumulado / Evolução da Banca (R$)' : 'Lucro/Prejuízo Diário (R$)';

    const bgColors = isLine ? 'rgba(54, 162, 235, 0.2)' : valoresIndividuais.map(v => v >= 0 ? '#4bc0c0' : '#ff6384');
    const bdColors = isLine ? '#36a2eb' : valoresIndividuais.map(v => v >= 0 ? '#4bc0c0' : '#ff6384');

    chart = new Chart(ctx, {
        type: tipoGrafico,
        data: {
            labels: labels,
            datasets: [{
                label: nomeLabel,
                data: dadosFinais,
                backgroundColor: bgColors,
                borderColor: bdColors,
                borderWidth: 2,
                fill: isLine,
                tension: 0.2
            }]
        },
        options: {
            responsive: true,
            scales: { 
                y: { 
                    beginAtZero: false 
                } 
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: R$ ${context.raw.toFixed(2)}`;
                        }
                    }
                }
            }
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

['filtro-estrategia', 'filtro-ano', 'filtro-mes', 'filtro-data', 'tipo-grafico'].forEach(id => {
    const elemento = document.getElementById(id);
    if(elemento) {
        elemento.addEventListener('change', aplicarFiltros);
    }
});

document.getElementById('btn-login').addEventListener('click', () => {
    signInWithPopup(auth, provider).then(() => {
        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
        carregarDadosDoGitHub();
    }).catch(error => console.error("Falha no login: ", error));
});
