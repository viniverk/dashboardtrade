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

async function carregarDadosDoGitHub() {
    const url = "https://raw.githubusercontent.com/viniverk/dashboardtrade/refs/heads/main/BettingPandL.csv?t=" + new Date().getTime();
    
    try {
        const response = await fetch(url);
        const text = await response.text();
        
        let lucroMO = 0; 
        let lucroLG = 0; 
        let operacoesLista = []; 

        const linhas = text.split('\n');
        
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

            if (mercadoLower.includes("resultado da partida")) {
                lucroMO += resultado;
            } else if (mercadoLower.includes("placar correto")) {
                lucroLG += resultado;
            }

            operacoesLista.push({
                mercado: mercadoOriginal,
                inicio: horaInicio,
                fim: dataResolucao,
                pnl: resultado
            });
        }

        // 1. Lucro Bruto (Apenas a soma das estratégias)
        const lucroBrutoTotal = lucroMO + lucroLG;
        
        // 2. Lucro Líquido (Bruto menos o custo das transmissões)
        const lucroTotalLiquido = lucroBrutoTotal - 150.00;
        
        // Atualiza o card de Lucro Bruto
        const displayBruto = document.getElementById('lucro-bruto');
        if (displayBruto) displayBruto.innerText = `R$ ${lucroBrutoTotal.toFixed(2)}`;

        // Atualiza o card de Custo Fixo (caso queira garantir dinamicamente)
        const displayCusto = document.getElementById('custo-fixo');
        if (displayCusto) displayCusto.innerText = `R$ 150,00`;

        // Atualiza o card de Lucro Líquido
        const displayLucro = document.getElementById('lucro');
        if (displayLucro) displayLucro.innerText = `R$ ${lucroTotalLiquido.toFixed(2)}`;
        
        // Atualiza o Status de Risco
        const riscoStatus = document.getElementById('risco-status');
        if (riscoStatus) {
            riscoStatus.innerText = "Monitoramento Ativo";
            riscoStatus.style.color = "green";
        }

        const canvas = document.getElementById('meuGrafico');
        if (canvas) renderizarGrafico(lucroMO, lucroLG);
        
        atualizarTabela(operacoesLista);
        
    } catch (error) { 
        console.error("Erro ao carregar o arquivo CSV:", error); 
    }
}

function renderizarGrafico(valMO, valLG) {
    const ctx = document.getElementById('meuGrafico').getContext('2d');
    if (chart) chart.destroy();
    chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Match Odds (Resultado)', 'Lay Goleada (Placar)'],
            datasets: [{ 
                label: 'Lucro Bruto por Estratégia (R$)', 
                data: [valMO, valLG], 
                backgroundColor: ['#36a2eb', '#ff6384'],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: { y: { beginAtZero: true } }
        }
    });
}

function actualizarTabela(lista) {
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

document.getElementById('btn-login').addEventListener('click', () => {
    signInWithPopup(auth, provider).then(() => {
        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
        carregarDadosDoGitHub();
    }).catch(error => console.error("Falha no login: ", error));
});
