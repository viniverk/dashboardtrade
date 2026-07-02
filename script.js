import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, getDocs, deleteDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

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

const TAXA_COMISSAO_BETFAIR = 0.065; // 6.5% sobre cada operação ganha

let bancaNuvem = 1000.00; 
let bancaInicialNuvem = 750.00; 
let bancaNubank = 0.00;
let metaMensal = 0;
let metasPorMes = {};
let movimentacoes = [];
let totalSaques = 0;
let totalAportes = 0;
let chartMensal;

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

// Aplica classe de cor positiva/negativa em um elemento de valor monetário
function setPnlClass(el, valor) {
    if (!el) return;
    el.classList.remove('pnl-pos', 'pnl-neg');
    el.classList.add(valor >= 0 ? 'pnl-pos' : 'pnl-neg');
}

function atualizarBancaRealTotal() {
    const bancaRealTotal = bancaNuvem + bancaNubank;
    const el = document.getElementById('texto-banca-real-total');
    if (el) {
        el.innerText = `R$ ${bancaRealTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
    }
}

// Lucro Líquido Real = (Banca Atual - Banca Inicial) + Saques - Aportes
// Saques somam: dinheiro que saiu da Betfair mas continua sendo seu lucro.
// Aportes subtraem: dinheiro novo que entrou, não é lucro de operações.
function calcularLucroLiquidoReal() {
    return (bancaNuvem - bancaInicialNuvem) + totalSaques - totalAportes;
}

function atualizarWinRate(filtradas) {
    const grid = document.getElementById('winrate-grid');
    if (!grid) return;

    const estrategias = [
        {
            nome: 'Match Odds',
            cor: 'var(--accent-blue)',
            filtro: op => {
                const m = op.mercado.toLowerCase();
                return m.includes('resultado') || m.includes('probabilidades') || m.includes('prolongamento');
            }
        },
        {
            nome: 'Lay Goleada',
            cor: 'var(--red)',
            filtro: op => {
                const m = op.mercado.toLowerCase();
                return m.includes('placar') || m.includes('correct score');
            }
        },
        {
            nome: 'Under à Frente',
            cor: 'var(--green)',
            filtro: op => {
                const m = op.mercado.toLowerCase();
                return m.includes('mais/menos') || m.includes('over/under');
            }
        }
    ];

    grid.innerHTML = '';

    estrategias.forEach((est, idx) => {
        const ops = filtradas.filter(est.filtro);
        const total = ops.length;
        const greens = ops.filter(op => op.pnl > 0).length;
        const reds = ops.filter(op => op.pnl < 0).length;
        const pct = total > 0 ? (greens / total) * 100 : 0;

        // Cor da barra baseada no win rate
        let corBarra = 'var(--red)';
        if (pct >= 60) corBarra = 'var(--green)';
        else if (pct >= 45) corBarra = 'var(--accent-amber)';

        const item = document.createElement('div');
        item.className = 'winrate-item';
        item.innerHTML = `
            <div class="winrate-item-header">
                <span class="winrate-item-nome" style="color:${est.cor}">${est.nome}</span>
            </div>
            <div class="winrate-item-pct" style="color:${corBarra}">${pct.toFixed(1)}%</div>
            <div class="winrate-barra-bg">
                <div class="winrate-barra-fill" style="width:${pct.toFixed(1)}%; background:${corBarra};"></div>
            </div>
            <div class="winrate-item-detalhe">
                ${total > 0
                    ? `✅ ${greens} green &nbsp;·&nbsp; ❌ ${reds} red &nbsp;·&nbsp; ${total} ops`
                    : 'Sem operações nos filtros'}
            </div>
        `;

        grid.appendChild(item);

        // Divisor entre estratégias (exceto após o último)
        if (idx < estrategias.length - 1) {
            const div = document.createElement('div');
            div.className = 'winrate-divider';
            grid.appendChild(div);
        }
    });
}


    const lucroLiquidoReal = calcularLucroLiquidoReal();
    const elLucroLiq = document.getElementById('lucro-liquido');
    if (elLucroLiq) {
        elLucroLiq.innerText = `R$ ${lucroLiquidoReal.toFixed(2)}`;
        setPnlClass(elLucroLiq, lucroLiquidoReal);
    }
}

async function carregarMovimentacoes(user) {
    if (!user) return;
    try {
        const ref = collection(db, "configuracoes_banca", user.uid, "movimentacoes");
        const q = query(ref, orderBy("data", "desc"));
        const snap = await getDocs(q);
        movimentacoes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
        console.error("Erro ao carregar movimentações:", e);
        movimentacoes = [];
    }
    recalcularTotaisMovimentacoes();
    renderizarMovimentacoes();
    atualizarLucroLiquidoReal();
    atualizarBancaRealTotal();
}

function recalcularTotaisMovimentacoes() {
    totalSaques = movimentacoes.filter(m => m.tipo === 'saque').reduce((acc, m) => acc + (m.valor || 0), 0);
    totalAportes = movimentacoes.filter(m => m.tipo === 'aporte').reduce((acc, m) => acc + (m.valor || 0), 0);
}

function renderizarMovimentacoes() {
    const elSacado = document.getElementById('total-sacado');
    const elAportado = document.getElementById('total-aportado');
    const elAjuste = document.getElementById('ajuste-liquido');
    if (elSacado) elSacado.innerText = `R$ ${totalSaques.toFixed(2)}`;
    if (elAportado) elAportado.innerText = `R$ ${totalAportes.toFixed(2)}`;
    if (elAjuste) {
        const ajuste = totalSaques - totalAportes;
        elAjuste.innerText = `R$ ${ajuste.toFixed(2)}`;
        setPnlClass(elAjuste, ajuste);
    }

    const corpo = document.getElementById('corpo-tabela-mov');
    if (!corpo) return;
    corpo.innerHTML = "";

    if (movimentacoes.length === 0) {
        corpo.innerHTML = `<tr><td colspan="5" style="color: var(--text-faint); padding: 16px 10px;">Nenhuma movimentação registrada ainda.</td></tr>`;
        return;
    }

    movimentacoes.forEach(m => {
        const tr = document.createElement('tr');
        const dataFormatada = m.data ? new Date(m.data + 'T00:00:00').toLocaleDateString('pt-BR') : '-';
        const badgeClass = m.tipo === 'saque' ? 'badge-saque' : 'badge-aporte';
        const badgeLabel = m.tipo === 'saque' ? 'Saque' : 'Aporte';
        tr.innerHTML = `
            <td>${dataFormatada}</td>
            <td><span class="badge-tipo ${badgeClass}">${badgeLabel}</span></td>
            <td>R$ ${(m.valor || 0).toFixed(2)}</td>
            <td>${m.observacao ? m.observacao : '-'}</td>
            <td><button class="btn-excluir-mov" data-id="${m.id}">Excluir</button></td>
        `;
        corpo.appendChild(tr);
    });

    corpo.querySelectorAll('.btn-excluir-mov').forEach(btn => {
        btn.addEventListener('click', () => excluirMovimentacao(btn.dataset.id));
    });
}

async function registrarMovimentacao() {
    if (!usuarioAtual) {
        alert("Você precisa estar logado para registrar movimentações!");
        return;
    }

    const tipo = document.getElementById('mov-tipo').value;
    const data = document.getElementById('mov-data').value;
    const valor = parseFloat(document.getElementById('mov-valor').value) || 0;
    const observacao = document.getElementById('mov-obs').value.trim();

    if (!data) {
        alert("Selecione a data da movimentação.");
        return;
    }
    if (valor <= 0) {
        alert("Informe um valor maior que zero.");
        return;
    }

    try {
        const ref = collection(db, "configuracoes_banca", usuarioAtual.uid, "movimentacoes");
        await addDoc(ref, { tipo, data, valor, observacao });

        document.getElementById('mov-valor').value = '';
        document.getElementById('mov-obs').value = '';

        await carregarMovimentacoes(usuarioAtual);
        aplicarFiltros();
    } catch (e) {
        console.error("Erro ao registrar movimentação:", e);
        alert("Falha ao registrar movimentação no Firebase.");
    }
}

async function excluirMovimentacao(id) {
    if (!usuarioAtual) return;
    if (!confirm("Excluir esta movimentação?")) return;

    try {
        await deleteDoc(doc(db, "configuracoes_banca", usuarioAtual.uid, "movimentacoes", id));
        await carregarMovimentacoes(usuarioAtual);
        aplicarFiltros();
    } catch (e) {
        console.error("Erro ao excluir movimentação:", e);
        alert("Falha ao excluir movimentação.");
    }
}

const MESES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function atualizarMetaMensal(operacoesFiltradas) {
    const card = document.getElementById('card-meta');
    const elLucro = document.getElementById('meta-lucro-mes');
    const elAlvo = document.getElementById('meta-valor-alvo');
    const elDesc = document.getElementById('meta-descricao');
    const barra = document.getElementById('meta-barra-progresso');
    const elPct = document.getElementById('meta-pct-texto');
    const elFalta = document.getElementById('meta-faltando');
    if (!card) return;

    // Calcula lucro do mês atual usando TODAS as operações (sem filtro de estratégia)
    const agora = new Date();
    const mesAtual = agora.getMonth();
    const anoAtual = agora.getFullYear();

    const lucroDesseMes = todasOperacoes.filter(op => {
        const partes = op.dataLimpa.split('-');
        if (partes.length < 3) return false;
        const mesOp = monthOrder[partes[1].toLowerCase()];
        const anoOp = parseInt('20' + partes[2]);
        return mesOp === mesAtual && anoOp === anoAtual;
    }).reduce((acc, op) => acc + op.pnl, 0);

    const nomeMes = MESES_PT[mesAtual];
    if (elDesc) elDesc.innerText = `${nomeMes} ${anoAtual} · todas as estratégias`;
    if (elLucro) {
        elLucro.innerText = `R$ ${lucroDesseMes.toFixed(2)}`;
        elLucro.style.color = lucroDesseMes >= 0 ? 'var(--green)' : 'var(--red)';
    }

    if (metaMensal <= 0) {
        if (elAlvo) elAlvo.innerText = '—';
        if (barra) barra.style.width = '0%';
        if (elPct) elPct.innerText = 'Sem meta definida';
        if (elFalta) elFalta.innerText = 'Configure em ⚙️ Configurações';
        card.classList.remove('meta-atingida', 'meta-perto');
        return;
    }

    if (elAlvo) elAlvo.innerText = `R$ ${metaMensal.toFixed(2)}`;

    const pct = Math.min((lucroDesseMes / metaMensal) * 100, 100);
    const pctReal = (lucroDesseMes / metaMensal) * 100;

    if (barra) {
        barra.style.width = `${Math.max(pct, 0)}%`;
        barra.classList.remove('fill-verde', 'fill-amarelo', 'fill-vermelho');
        if (pctReal >= 100) barra.classList.add('fill-verde');
        else if (pctReal >= 70) barra.classList.add('fill-amarelo');
        else barra.classList.add('fill-vermelho');
    }

    if (elPct) elPct.innerText = `${pctReal.toFixed(1)}% da meta`;

    card.classList.remove('meta-atingida', 'meta-perto');
    if (pctReal >= 100) {
        card.classList.add('meta-atingida');
        const excedente = lucroDesseMes - metaMensal;
        if (elFalta) elFalta.innerText = `✅ Meta atingida! R$ ${excedente.toFixed(2)} acima`;
    } else if (pctReal >= 70) {
        card.classList.add('meta-perto');
        const falta = metaMensal - lucroDesseMes;
        if (elFalta) elFalta.innerText = `Faltam R$ ${falta.toFixed(2)} para a meta`;
    } else {
        const falta = metaMensal - lucroDesseMes;
        if (elFalta) elFalta.innerText = `Faltam R$ ${falta.toFixed(2)} para a meta`;
    }
}

function atualizarResumoMensal(operacoesFiltradas) {
    // Agrupa as operações filtradas por "ano-mês"
    const porMes = {};
    operacoesFiltradas.forEach(op => {
        const partes = op.dataLimpa.split('-');
        if (partes.length < 3) return;
        const mes = monthOrder[partes[1].toLowerCase()];
        const ano = parseInt('20' + partes[2]);
        const chave = `${ano}-${String(mes).padStart(2,'0')}`;
        if (!porMes[chave]) porMes[chave] = { ano, mes, lucro: 0, total: 0, greens: 0, reds: 0 };
        porMes[chave].lucro += op.pnl;
        porMes[chave].total++;
        if (op.pnl >= 0) porMes[chave].greens++;
        else porMes[chave].reds++;
    });

    const mesesOrdenados = Object.keys(porMes).sort();
    const dados = mesesOrdenados.map(k => porMes[k]);

    // Lucro máximo absoluto pra escalar as barrinhas
    const maxAbsLucro = Math.max(...dados.map(d => Math.abs(d.lucro)), 1);

    // --- Tabela ---
    const corpo = document.getElementById('corpo-resumo-mensal');
    if (corpo) {
        corpo.innerHTML = '';
        if (dados.length === 0) {
            corpo.innerHTML = `<tr><td colspan="7" style="color:var(--text-faint);padding:14px 10px;">Nenhuma operação encontrada com os filtros atuais.</td></tr>`;
        } else {
            dados.reverse().forEach(d => {
                const nomeMes = MESES_PT[d.mes];
                const winRate = d.total > 0 ? ((d.greens / d.total) * 100).toFixed(1) : '0.0';
                const corLucro = d.lucro >= 0 ? 'var(--green)' : 'var(--red)';
                const larguraBarra = ((Math.abs(d.lucro) / maxAbsLucro) * 80).toFixed(1);
                const corBarra = d.lucro >= 0 ? 'var(--green)' : 'var(--red)';

                let vsMeta = '<span class="vs-meta-badge vs-meta-nd">—</span>';
                const chaveDoMes = `${d.ano}-${String(d.mes + 1).padStart(2, '0')}`;
                const metaDoMes = parseFloat(metasPorMes[chaveDoMes] || 0);
                if (metaDoMes > 0) {
                    const ok = d.lucro >= metaDoMes;
                    const pctMeta = ((d.lucro / metaDoMes) * 100).toFixed(0);
                    vsMeta = ok
                        ? `<span class="vs-meta-badge vs-meta-ok">✅ ${pctMeta}%</span>`
                        : `<span class="vs-meta-badge vs-meta-nok">${pctMeta}%</span>`;
                }

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${nomeMes} ${d.ano}</td>
                    <td>${d.total}</td>
                    <td class="pnl-pos">${d.greens}</td>
                    <td class="pnl-neg">${d.reds}</td>
                    <td>${winRate}%</td>
                    <td>
                        <div class="barra-mes">
                            <div class="barra-mes-fill" style="width:${larguraBarra}px; background:${corBarra};"></div>
                            <span style="color:${corLucro}; font-weight:600;">R$ ${d.lucro.toFixed(2)}</span>
                        </div>
                    </td>
                    <td>${vsMeta}</td>
                `;
                corpo.appendChild(tr);
            });
        }
    }

    // --- Gráfico ---
    const canvasMensal = document.getElementById('graficoMensal');
    if (!canvasMensal) return;
    if (chartMensal) chartMensal.destroy();

    const labelsGrafico = dados.map(d => `${MESES_PT[d.mes].slice(0,3)} ${d.ano}`).reverse();
    const valoresGrafico = dados.map(d => d.lucro).reverse();

    chartMensal = new Chart(canvasMensal.getContext('2d'), {
        type: 'bar',
        data: {
            labels: labelsGrafico,
            datasets: [{
                label: 'Lucro por Mês (R$)',
                data: valoresGrafico,
                backgroundColor: valoresGrafico.map(v => v >= 0 ? '#2dd4a7' : '#ff5c72'),
                borderRadius: 4,
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            layout: { padding: { top: 30 } },
            scales: {
                y: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#8392ad' } },
                x: { grid: { display: false }, ticks: { color: '#8392ad' } }
            },
            plugins: {
                legend: { display: false },
                datalabels: { anchor: 'end', align: 'top', color: '#e7ecf4', font: { size: 11 }, formatter: v => 'R$ ' + v.toFixed(0) }
            }
        }
    });
}

function chaveDoMesAtual() {
    const agora = new Date();
    return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
}

async function salvarMetaDoMes() {
    if (!usuarioAtual) { alert("Você precisa estar logado!"); return; }
    const sel = document.getElementById('meta-mes-sel');
    const val = parseFloat(document.getElementById('meta-mes-valor').value) || 0;
    const chave = sel.value;

    metasPorMes[chave] = val;

    // Atualiza metaMensal se for o mês atual
    if (chave === chaveDoMesAtual()) metaMensal = val;

    try {
        const docRef = doc(db, "configuracoes_banca", usuarioAtual.uid);
        await setDoc(docRef, { metasPorMes }, { merge: true });
        renderizarTabelaMetas();
        aplicarFiltros();
        alert("Meta salva com sucesso!");
    } catch (e) {
        console.error("Erro ao salvar meta:", e);
        alert("Falha ao salvar a meta.");
    }
}

async function excluirMetaDoMes(chave) {
    if (!usuarioAtual) return;
    if (!confirm("Remover a meta deste mês?")) return;
    delete metasPorMes[chave];
    if (chave === chaveDoMesAtual()) metaMensal = 0;
    try {
        const docRef = doc(db, "configuracoes_banca", usuarioAtual.uid);
        await setDoc(docRef, { metasPorMes }, { merge: true });
        renderizarTabelaMetas();
        aplicarFiltros();
    } catch (e) {
        console.error("Erro ao excluir meta:", e);
    }
}

function renderizarTabelaMetas() {
    const corpo = document.getElementById('corpo-metas-mensais');
    if (!corpo) return;
    corpo.innerHTML = '';

    const chaves = Object.keys(metasPorMes).filter(k => metasPorMes[k] > 0).sort().reverse();

    if (chaves.length === 0) {
        corpo.innerHTML = `<tr><td colspan="5" style="color:var(--text-faint);padding:14px 10px;">Nenhuma meta definida ainda.</td></tr>`;
        return;
    }

    chaves.forEach(chave => {
        const [ano, mes] = chave.split('-');
        const nomeMes = `${MESES_PT[parseInt(mes) - 1]} ${ano}`;
        const meta = metasPorMes[chave];

        // Lucro real daquele mês (todas as operações)
        const lucroMes = todasOperacoes.filter(op => {
            const partes = op.dataLimpa.split('-');
            if (partes.length < 3) return false;
            const mesOp = String(monthOrder[partes[1].toLowerCase()] + 1).padStart(2, '0');
            const anoOp = '20' + partes[2];
            return `${anoOp}-${mesOp}` === chave;
        }).reduce((acc, op) => acc + op.pnl, 0);

        const pct = meta > 0 ? ((lucroMes / meta) * 100).toFixed(1) : '—';
        const corPct = lucroMes >= meta ? 'var(--green)' : lucroMes >= 0 ? 'var(--accent-amber)' : 'var(--red)';
        const badgeClass = lucroMes >= meta ? 'vs-meta-ok' : 'vs-meta-nok';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${nomeMes}</td>
            <td>R$ ${meta.toFixed(2)}</td>
            <td style="color:${lucroMes >= 0 ? 'var(--green)' : 'var(--red)'}; font-weight:600;">R$ ${lucroMes.toFixed(2)}</td>
            <td><span class="vs-meta-badge ${badgeClass}">${pct}%</span></td>
            <td><button class="btn-excluir-mov" data-chave="${chave}">Remover</button></td>
        `;
        corpo.appendChild(tr);
    });

    corpo.querySelectorAll('.btn-excluir-mov').forEach(btn => {
        btn.addEventListener('click', () => excluirMetaDoMes(btn.dataset.chave));
    });
}

async function puxarBancaDoFirebase(user) {
    if (!user) return;
    try {
        const docRef = doc(db, "configuracoes_banca", user.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            bancaNuvem = parseFloat(docSnap.data().valorBanca || 1000);
            bancaInicialNuvem = parseFloat(docSnap.data().valorBancaInicial || 750);
            bancaNubank = parseFloat(docSnap.data().valorNubank || 0);
            metasPorMes = docSnap.data().metasPorMes || {};
        } else {
            bancaNuvem = 1000;
            bancaInicialNuvem = 750;
            bancaNubank = 0;
            metasPorMes = {};
        }
        
        document.getElementById('input-banca-usuario').value = bancaNuvem.toFixed(2);
        document.getElementById('input-banca-inicial').value = bancaInicialNuvem.toFixed(2);
        document.getElementById('input-banca-nubank').value = bancaNubank.toFixed(2);

        // Derivar metaMensal sempre do mapa de metas por mês
        const chaveHoje = chaveDoMesAtual();
        metaMensal = parseFloat(metasPorMes[chaveHoje] || 0);

        renderizarTabelaMetas();
        document.getElementById('texto-banca-superior').innerText = `R$ ${bancaNuvem.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;

        // Pré-selecionar mês atual no select de metas
        const selMeta = document.getElementById('meta-mes-sel');
        if (selMeta) {
            selMeta.value = chaveDoMesAtual();
            document.getElementById('meta-mes-valor').value = parseFloat(metasPorMes[chaveDoMesAtual()] || 0).toFixed(2);
        }
        
        atualizarLucroLiquidoReal();
        atualizarBancaRealTotal();
    } catch (e) {
        console.error("Erro ao ler banca:", e);
    }
}

async function salvarConfiguracoesNoFirebase() {
    if (!usuarioAtual) {
        alert("Você precisa estar logado para salvar as configurações!");
        return;
    }
    
    bancaNuvem = parseFloat(document.getElementById('input-banca-usuario').value) || 0;
    bancaInicialNuvem = parseFloat(document.getElementById('input-banca-inicial').value) || 0;
    bancaNubank = parseFloat(document.getElementById('input-banca-nubank').value) || 0;

    try {
        const docRef = doc(db, "configuracoes_banca", usuarioAtual.uid);
        await setDoc(docRef, { 
            valorBanca: bancaNuvem,
            valorBancaInicial: bancaInicialNuvem,
            valorNubank: bancaNubank,
            metasPorMes: metasPorMes
        }, { merge: true });
        
        document.getElementById('texto-banca-superior').innerText = `R$ ${bancaNuvem.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
        atualizarLucroLiquidoReal();
        atualizarBancaRealTotal();
        aplicarFiltros();
        alert("Configurações salvas com sucesso!");
    } catch (e) {
        console.error("Erro ao salvar configurações:", e);
        alert("Falha ao salvar dados no Firebase.");
    }
}

atualizarLucroLiquidoReal();

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
    
    if(selAno) {
        selAno.innerHTML = '<option value="TODOS">Todos</option>';
        anos.forEach(a => selAno.innerHTML += `<option value="${a}">${a}</option>`);
    }
    if(selData) {
        selData.innerHTML = '<option value="TODAS">Todas as Datas</option>';
        datas.forEach(d => selData.innerHTML += `<option value="${d}">${d}</option>`);
    }
}

function aplicarFiltros() {
    const fEstrat = document.getElementById('filtro-estrategia').value;
    const fAno = document.getElementById('filtro-ano').value;
    const fMes = document.getElementById('filtro-mes').value; 
    const fData = document.getElementById('filtro-data').value;
    const fGrafico = document.getElementById('tipo-grafico').value;

    const mesesMap = {
        "0": "jan", "1": "fev", "2": "mar", "3": "abr", "4": "mai", "5": "jun",
        "6": "jul", "7": "ago", "8": "set", "9": "out", "10": "nov", "11": "dez"
    };
    const mesBuscado = mesesMap[fMes];

    const filtradas = todasOperacoes.filter(op => {
        const mercLower = op.mercado.toLowerCase();
        const condEstrat = (fEstrat === 'TODAS' || 
                           (fEstrat === 'MO' && (mercLower.includes('resultado') || mercLower.includes('probabilidades') || mercLower.includes('prolongamento'))) || 
                           (fEstrat === 'LG' && (mercLower.includes('placar') || mercLower.includes('correct score'))) ||
                           (fEstrat === 'UF' && (mercLower.includes('mais/menos') || mercLower.includes('over/under'))));
                           
        const condAno = (fAno === 'TODOS' || op.ano === fAno);
        const condMes = (fMes === 'TODOS' || op.mes === mesBuscado);
        const condData = (fData === 'TODAS' || op.dataLimpa === fData);
        
        return condEstrat && condAno && condMes && condData;
    });

    const lucroBruto = filtradas.reduce((acc, op) => acc + op.pnl, 0);
    const elLucroBruto = document.getElementById('lucro-bruto');
    elLucroBruto.innerText = `R$ ${lucroBruto.toFixed(2)}`;
    setPnlClass(elLucroBruto, lucroBruto);

    // COMISSÕES = Lucro Bruto Total (todas as ops) − Lucro Líquido Real
    // Usa o total sem filtro pois o Lucro Líquido Real reflete a conta inteira
    const lucroBrutoTotal = todasOperacoes.reduce((acc, op) => acc + op.pnl, 0);
    const lucroLiquidoReal = calcularLucroLiquidoReal();
    const comissoes = lucroBrutoTotal - lucroLiquidoReal;
    const pctComissoes = lucroBrutoTotal !== 0 ? (comissoes / Math.abs(lucroBrutoTotal)) * 100 : 0;

    const elComissoesValor = document.getElementById('comissoes-valor');
    const elComissoesPct = document.getElementById('comissoes-pct');
    if (elComissoesValor) elComissoesValor.innerText = `R$ ${comissoes.toFixed(2)}`;
    if (elComissoesPct) elComissoesPct.innerText = `${pctComissoes.toFixed(2)}% do Bruto total da conta`;

    const comResp = filtradas.filter(op => op.resp > 0);
    const totalResp = comResp.reduce((acc, op) => acc + op.resp, 0);
    const mediaResp = comResp.length > 0 ? (totalResp / comResp.length) : 0;
    document.getElementById('media-responsabilidade').innerText = `R$ ${mediaResp.toFixed(2)}`;

    const roiStake = mediaResp > 0 ? (lucroBruto / mediaResp) * 100 : 0;
    const unidades = mediaResp > 0 ? (lucroBruto / mediaResp).toFixed(2) : 0;
																																	 
    const elRoiStake = document.getElementById('roi-stake');
    if (elRoiStake) {
        const roiDisplay = Math.min(Math.abs(roiStake), 9999); 
        const sinal = roiStake > 0 ? '+' : (roiStake < 0 ? '-' : '');
        elRoiStake.innerText = `${sinal}${roiDisplay.toFixed(2)}% (${sinal}${Math.abs(unidades)} und)`;
        setPnlClass(elRoiStake, roiStake);
    }
																																			 

    atualizarTabela(filtradas);
    renderizarGrafico(filtradas, fGrafico);
    atualizarRanking(filtradas);
    atualizarMetaMensal(filtradas);
    atualizarResumoMensal(filtradas);
    atualizarWinRate(filtradas);
}

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
        m = m.replace(/Resultado da partida/ig, "Match Odds").replace(/Resultado/ig, "Match Odds").replace(/Placar correto/ig, "Lay Goleada").replace(/Placar/ig, "Lay Goleada").replace(/Prolongamento/ig, "Match Odds (Prol.)").replace(/Mais\/Menos/ig, "Under à Frente").replace(/Over\/Under/ig, "Under à Frente");
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

    const corGrid = 'rgba(255, 255, 255, 0.06)';
    const corTexto = '#8392ad';

    chart = new Chart(ctx, {
        type: tipoGrafico,
        data: {
            labels: labels,
            datasets: [{
                label: tipoGrafico === 'line' ? 'Evolução da Banca (R$)' : 'Lucro Diário (R$)',
                data: dadosParaGrafico, 
                backgroundColor: tipoGrafico === 'bar' ? valoresDiarios.map(v => v >= 0 ? '#2dd4a7' : '#ff5c72') : 'rgba(232, 163, 61, 0.15)',
                borderColor: '#e8a33d',
                borderWidth: 2,
                fill: tipoGrafico === 'line',
                tension: 0.25
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            layout: { padding: { top: 30 } },
            scales: {
                y: { beginAtZero: true, grace: '20%', grid: { color: corGrid }, ticks: { color: corTexto } },
                x: { grid: { color: corGrid }, ticks: { color: corTexto } }
            },
            plugins: {
                legend: { labels: { color: corTexto } },
                datalabels: { anchor: 'end', align: 'top', color: '#e7ecf4', formatter: v => 'R$ ' + v.toFixed(2) }
            }
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
                                       .replace(/Placar/ig, "Lay Goleada")
                                       .replace(/Prolongamento/ig, "Match Odds (Prol.)")
                                       .replace(/Mais\/Menos/ig, "Under à Frente")
                                       .replace(/Over\/Under/ig, "Under à Frente");

        const pnlClass = op.pnl >= 0 ? 'pnl-pos' : 'pnl-neg';

        tr.innerHTML = `
            <td>${displayMercado}</td>
            <td>${op.data}</td>
            <td class="cell-odd">${op.odd > 0 ? op.odd.toFixed(2) : '-'}</td>
            <td>${op.resp > 0 ? 'R$ ' + op.resp.toFixed(2) : '-'}</td>
            <td class="${pnlClass}">R$ ${op.pnl.toFixed(2)}</td>
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

function switchTab(activeBtnId, activeContentId) {
    ['conteudo-dashboard', 'conteudo-ranking', 'conteudo-operacoes', 'conteudo-movimentacoes', 'conteudo-configuracoes'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.style.display = 'none';
    });

    ['btn-aba-dashboard', 'btn-aba-ranking', 'btn-aba-operacoes', 'btn-aba-mov', 'btn-aba-config'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.classList.remove('active');
    });

    const activeContent = document.getElementById(activeContentId);
    if(activeContent) activeContent.style.display = 'block';

    const activeBtn = document.getElementById(activeBtnId);
    if(activeBtn) activeBtn.classList.add('active');

    // Mostrar filtros só nas abas que fazem uso deles
    const abasComFiltro = ['btn-aba-dashboard', 'btn-aba-ranking', 'btn-aba-operacoes'];
    const filtros = document.querySelector('.filtros-container');
    if (filtros) filtros.style.display = abasComFiltro.includes(activeBtnId) ? 'flex' : 'none';
}

const btnDash = document.getElementById('btn-aba-dashboard');
if(btnDash) btnDash.addEventListener('click', () => switchTab('btn-aba-dashboard', 'conteudo-dashboard'));

const btnRank = document.getElementById('btn-aba-ranking');
if(btnRank) btnRank.addEventListener('click', () => switchTab('btn-aba-ranking', 'conteudo-ranking'));

const btnOps = document.getElementById('btn-aba-operacoes');
if(btnOps) btnOps.addEventListener('click', () => switchTab('btn-aba-operacoes', 'conteudo-operacoes'));

const btnMov = document.getElementById('btn-aba-mov');
if(btnMov) btnMov.addEventListener('click', () => switchTab('btn-aba-mov', 'conteudo-movimentacoes'));

const btnRegistrarMov = document.getElementById('btn-registrar-mov');
if(btnRegistrarMov) btnRegistrarMov.addEventListener('click', registrarMovimentacao);

const btnConfig = document.getElementById('btn-aba-config');
if(btnConfig) btnConfig.addEventListener('click', () => switchTab('btn-aba-config', 'conteudo-configuracoes'));

['filtro-estrategia', 'filtro-ano', 'filtro-mes', 'filtro-data', 'tipo-grafico'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.addEventListener('change', aplicarFiltros);
});

const btnSalvarConfig = document.getElementById('btn-salvar-config');
if(btnSalvarConfig) btnSalvarConfig.addEventListener('click', salvarConfiguracoesNoFirebase);

const btnSalvarMetaMes = document.getElementById('btn-salvar-meta-mes');
if(btnSalvarMetaMes) btnSalvarMetaMes.addEventListener('click', salvarMetaDoMes);

const selMetaMes = document.getElementById('meta-mes-sel');
if(selMetaMes) selMetaMes.addEventListener('change', () => {
    const val = parseFloat(metasPorMes[selMetaMes.value] || 0);
    document.getElementById('meta-mes-valor').value = val.toFixed(2);
});

const btnResumoTabela = document.getElementById('btn-resumo-tabela');
const btnResumoGrafico = document.getElementById('btn-resumo-grafico');
if (btnResumoTabela && btnResumoGrafico) {
    btnResumoTabela.addEventListener('click', () => {
        document.getElementById('resumo-tabela-wrapper').style.display = '';
        document.getElementById('resumo-grafico-wrapper').style.display = 'none';
        btnResumoTabela.classList.add('active');
        btnResumoGrafico.classList.remove('active');
    });
    btnResumoGrafico.addEventListener('click', () => {
        document.getElementById('resumo-tabela-wrapper').style.display = 'none';
        document.getElementById('resumo-grafico-wrapper').style.display = '';
        btnResumoGrafico.classList.add('active');
        btnResumoTabela.classList.remove('active');
        if (chartMensal) chartMensal.resize();
    });
}

const inputMovData = document.getElementById('mov-data');
if (inputMovData) inputMovData.value = new Date().toISOString().split('T')[0];

document.getElementById('btn-login').addEventListener('click', () => {
    signInWithPopup(auth, provider).then(async (result) => {
        usuarioAtual = result.user;
        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
        await puxarBancaDoFirebase(usuarioAtual);
        await carregarMovimentacoes(usuarioAtual);
        carregarDadosDoGitHub();
    }).catch(error => console.error("Erro no login:", error));
});

onAuthStateChanged(auth, async (user) => {
    if (user) {
        usuarioAtual = user;
        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
        await puxarBancaDoFirebase(usuarioAtual);
        await carregarMovimentacoes(usuarioAtual);
        carregarDadosDoGitHub();
    }
});
