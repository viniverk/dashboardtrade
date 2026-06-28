import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAvWlAUn5hzr-rWAaTZDAkVsPOJhlkzDC4",
    authDomain: "tradeesportivodashboard.firebaseapp.com",
    projectId: "tradeesportivodashboard",
    storageBucket: "tradeesportivodashboard.firebasestorage.app",
    messagingSenderId: "911731188311",
    appId: "1:911731188311:web:fcdc39a0557d471fb8f912"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth();
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

let todasOperacoes = [];
let chart;
let sortDirection = 1;
let usuarioAtual = null;

let bancaNuvem = 1000.00; 
let bancaInicialNuvem = 750.00; 

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

function atualizarLucroLiquidoReal() {
    const lucroLiquidoReal = bancaNuvem - bancaInicialNuvem;
    const elLucroLiq = document.getElementById('lucro-liquido');
    if (elLucroLiq) {
        elLucroLiq.innerText = `R$ ${lucroLiquidoReal.toFixed(2)}`;
        elLucroLiq.style.color = lucroLiquidoReal >= 0 ? 'green' : 'red';
    }
}

async function puxarBancaDoFirebase(user) {
    if (!user) return;
    try {
        const docRef = doc(db, "configuracoes_banca", user.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            bancaNuvem = parseFloat(docSnap.data().valorBanca || 1000);
            bancaInicialNuvem = parseFloat(docSnap.data().valorBancaInicial || 750);
        }
        
        document.getElementById('input-banca-usuario').value = bancaNuvem.toFixed(2);
        document.getElementById('input-banca-inicial').value = bancaInicialNuvem.toFixed(2);
        document.getElementById('texto-banca-superior').innerText = `R$ ${bancaNuvem.toLocaleString('pt-PT', {minimumFractionDigits: 2})}`;
        
        atualizarLucroLiquidoReal();
        aplicarFiltros();
    } catch (e) { console.error("Erro ao ler banca:", e); }
}

async function salvarConfiguracoesNoFirebase() {
    if (!usuarioAtual) return;
    
    bancaNuvem = parseFloat(document.getElementById('input-banca-usuario').value) || 0;
    bancaInicialNuvem = parseFloat(document.getElementById('input-banca-inicial').value) || 0;
    
    try {
        const docRef = doc(db, "configuracoes_banca", usuarioAtual.uid);
        await setDoc(docRef, { valorBanca: bancaNuvem, valorBancaInicial: bancaInicialNuvem }, { merge: true });
        
        document.getElementById('texto-banca-superior').innerText = `R$ ${bancaNuvem.toLocaleString('pt-PT', {minimumFractionDigits: 2})}`;
        atualizarLucroLiquidoReal();
        aplicarFiltros();
        alert("Configurações salvas!");
    } catch (e) { console.error("Erro ao salvar:", e); }
}

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
        const idxStake = cabecalhos.findIndex(c => c.includes('valor apostado') || c.includes('stake'));

        let agrupador = {};

        for (let i = 1; i < linhas.length; i++) {
            const lineClean = linhas[i].trim().replace(/\r/g, '');
            if (!lineClean || lineClean.toLowerCase().includes("status")) continue;

            const colunas = lineClean.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
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
    if(selAno) { selAno.innerHTML = '<option value="TODOS">Todos</option>'; anos.forEach(a => selAno.innerHTML += `<option value="${a}">${a}</option>`); }
    if(selData) { selData.innerHTML = '<option value="TODAS">Todas as Datas</option>'; datas.forEach(d => selData.innerHTML += `<option value="${d}">${d}</option>`); }
}

function aplicarFiltros() {
    const fEstrat = document.getElementById('filtro-estrategia').value;
    const fAno = document.getElementById('filtro-ano').value;
    const fMes = document.getElementById('filtro-mes').value; 
    const fData = document.getElementById('filtro-data').value;
    const fGrafico = document.getElementById('tipo-grafico').value;

    const mesesMap = { "0": "jan", "1": "fev", "2": "mar", "3": "abr", "4": "mai", "5": "jun", "6": "jul", "7": "ago", "8": "set", "9": "out", "10": "nov", "11": "dez" };
    const mesBuscado = mesesMap[fMes];

    const filtradas = todasOperacoes.filter(op => {
        const mercLower = op.mercado.toLowerCase();
        const condEstrat = (fEstrat === 'TODAS' || (fEstrat === 'MO' && (mercLower.includes('resultado') || mercLower.includes('probabilidades'))) || (fEstrat === 'LG' && (mercLower.includes('placar') || mercLower.includes('correct score'))));
        const condAno = (fAno === 'TODOS' || op.ano === fAno);
        const condMes = (fMes === 'TODOS' || op.mes === mesBuscado);
        const condData = (fData === 'TODAS' || op.dataLimpa === fData);
        return condEstrat && condAno && condMes && condData;
    });

    const lucroBruto = filtradas.reduce((acc, op) => acc + op.pnl, 0);
    document.getElementById('lucro-bruto').innerText = `R$ ${lucroBruto.toFixed(2)}`;
    document.getElementById('lucro-bruto').style.color = lucroBruto >= 0 ? 'green' : 'red';

    const comResp = filtradas.filter(op => op.resp > 0);
    const totalResp = comResp.reduce((acc, op) => acc + op.resp, 0);
    const mediaResp = comResp.length > 0 ? (totalResp / comResp.length) : 0;
    document.getElementById('media-responsabilidade').innerText = `R$ ${mediaResp.toFixed(2)}`;

    const lucroLiquidoReal = bancaNuvem - bancaInicialNuvem;
    const comissoes = lucroBruto - lucroLiquidoReal;
    document.getElementById('comissoes-valor').innerText = `R$ ${comissoes.toFixed(2)}`;
    document.getElementById('comissoes-pct').innerText = `${lucroBruto !== 0 ? ((comissoes/lucroBruto)*100).toFixed(2) : '0.00'}% do Bruto`;

    const pctLucro = mediaResp > 0 ? (lucroBruto / mediaResp) * 100 : 0;
    document.getElementById('pct-lucro').innerText = `${pctLucro.toFixed(2)}%`;
    document.getElementById('pct-lucro').style.color = pctLucro >= 0 ? 'green' : 'red';

    const roiStake = mediaResp > 0 ? (lucroBruto / mediaResp) * 100 : 0;
    const unidades = mediaResp > 0 ? (lucroBruto / mediaResp).toFixed(2) : 0;
    document.getElementById('roi-stake').innerText = `${roiStake.toFixed(2)}% (${unidades > 0 ? '+' : ''}${Math.abs(unidades)} und)`;
    document.getElementById('roi-stake').style.color = roiStake >= 0 ? 'green' : 'red';

    const greens = filtradas.filter(op => op.pnl > 0);
    const reds = filtradas.filter(op => op.pnl < 0);
    document.getElementById('relacao-green-red').innerHTML = `<span style="color: green;">G: ${greens.length}</span> | <span style="color: red;">R: ${reds.length}</span>`;
    document.getElementById('media-green').innerText = `G: R$ ${(greens.length > 0 ? greens.reduce((a,b)=>a+b.pnl,0)/greens.length : 0).toFixed(2)}`;
    document.getElementById('media-red').innerText = `R: R$ ${(reds.length > 0 ? reds.reduce((a,b)=>a+b.pnl,0)/reds.length : 0).toFixed(2)}`;

    atualizarTabela(filtradas);
    renderizarGrafico(filtradas, fGrafico);
    atualizarRanking(filtradas);
}

function atualizarRanking(lista) {
    if (!lista || lista.length === 0) return;
    let maxGreen = lista.reduce((p, c) => c.pnl > p.pnl ? c : p, lista[0]);
    let maxRed = lista.reduce((p, c) => c.pnl < p.pnl ? c : p, lista[0]);
    let maxResp = lista.reduce((p, c) => c.resp > p.resp ? c : p, lista[0]);
    let maxOdd = lista.reduce((p, c) => c.odd > p.odd ? c : p, lista[0]);
    let maxStake = lista.reduce((p, c) => c.stake > p.stake ? c : p, lista[0]);

    const formatDesc = (op) => `${op.mercado.replace(/Resultado.*/ig, "Match Odds").replace(/Placar.*/ig, "Lay Goleada")}\nData: ${op.dataLimpa}`;
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
    if (chart) chart.destroy();

    let agrupadoPorData = {};
    lista.forEach(o => { if(!agrupadoPorData[o.dataLimpa]) agrupadoPorData[o.dataLimpa] = 0; agrupadoPorData[o.dataLimpa] += o.pnl; });
    const labels = Object.keys(agrupadoPorData).sort((a, b) => {
        const valA = new Date("20" + a.split('-')[2], monthOrder[a.split('-')[1].toLowerCase()], a.split('-')[0]);
        const valB = new Date("20" + b.split('-')[2], monthOrder[b.split('-')[1].toLowerCase()], b.split('-')[0]);
        return valA - valB;
    });
    const valoresDiarios = labels.map(l => agrupadoPorData[l]);
    let data = tipoGrafico === 'line' ? valoresDiarios.map((v, i, arr) => arr.slice(0, i + 1).reduce((a, b) => a + b, 0)) : valoresDiarios;

    chart = new Chart(canvas.getContext('2d'), {
        type: tipoGrafico,
        data: { labels: labels, datasets: [{ label: 'PnL', data: data, backgroundColor: '#36a2eb', borderColor: '#36a2eb' }] },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function atualizarTabela(lista) {
    const corpo = document.getElementById('corpo-tabela');
    if(!corpo) return;
    corpo.innerHTML = "";
    lista.forEach(op => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td style="padding:10px;">${op.mercado.replace(/Resultado.*/ig, "Match Odds").replace(/Placar.*/ig, "Lay Goleada")}</td><td>${op.data}</td><td>${op.odd.toFixed(2)}</td><td>R$ ${op.resp.toFixed(2)}</td><td style="color:${op.pnl>=0?'green':'red'}">R$ ${op.pnl.toFixed(2)}</td>`;
        corpo.appendChild(tr);
    });
}

window.ordenarTabela = (coluna) => {
    sortDirection *= -1;
    todasOperacoes.sort((a, b) => (typeof a[coluna] === 'string' ? a[coluna].localeCompare(b[coluna]) : a[coluna] - b[coluna]) * sortDirection);
    aplicarFiltros();
};

function switchTab(activeBtnId, activeContentId) {
    ['conteudo-dashboard', 'conteudo-ranking', 'conteudo-configuracoes'].forEach(id => document.getElementById(id).style.display = 'none');
    ['btn-aba-dashboard', 'btn-aba-ranking', 'btn-aba-config'].forEach(id => { const el = document.getElementById(id); el.style.background = '#e5e7eb'; el.style.color = '#374151'; });
    document.getElementById(activeContentId).style.display = 'block';
    const activeBtn = document.getElementById(activeBtnId); activeBtn.style.background = '#1e40af'; activeBtn.style.color = 'white';
}

document.getElementById('btn-aba-dashboard')?.addEventListener('click', () => switchTab('btn-aba-dashboard', 'conteudo-dashboard'));
document.getElementById('btn-aba-ranking')?.addEventListener('click', () => switchTab('btn-aba-ranking', 'conteudo-ranking'));
document.getElementById('btn-aba-config')?.addEventListener('click', () => switchTab('btn-aba-config', 'conteudo-configuracoes'));
['filtro-estrategia', 'filtro-ano', 'filtro-mes', 'filtro-data', 'tipo-grafico'].forEach(id => document.getElementById(id)?.addEventListener('change', aplicarFiltros));
document.getElementById('btn-salvar-config')?.addEventListener('click', salvarConfiguracoesNoFirebase);
document.getElementById('btn-login')?.addEventListener('click', () => signInWithPopup(auth, provider));
onAuthStateChanged(auth, (user) => { if (user) { usuarioAtual = user; document.getElementById('auth-container').style.display = 'none'; document.getElementById('dashboard').style.display = 'block'; puxarBancaDoFirebase(usuarioAtual); carregarDadosDoGitHub(); } });
