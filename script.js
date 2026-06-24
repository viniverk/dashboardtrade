import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

// Configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAvWlAUn5hzr-rWAaTZDAkVsPOJhlkzDC4",
  authDomain: "tradeesportivodashboard.firebaseapp.com",
  projectId: "tradeesportivodashboard",
  storageBucket: "tradeesportivodashboard.firebasestorage.app",
  messagingSenderId: "911731188311",
  appId: "1:911731188311:web:fcdc39a0557d471fb8f912"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// Elementos da interface
const btnLogin = document.getElementById('btn-login');
const dashboard = document.getElementById('dashboard');
const authContainer = document.getElementById('auth-container');
const inputCSV = document.getElementById('csvFile');

// Evento de Login
btnLogin.addEventListener('click', () => {
    signInWithPopup(auth, provider)
    .then((result) => {
        authContainer.style.display = 'none';
        dashboard.style.display = 'block';
    })
    .catch((error) => console.error("Erro no login:", error));
});

// Processamento do CSV
inputCSV.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        const linhas = text.split('\n');
        let lucroTotal = 0;
        let teveEntradaComRiscoAlto = false;

        // O loop começa em 1 para pular o cabeçalho do CSV
        for (let i = 1; i < linhas.length; i++) {
            const colunas = linhas[i].split(',');
            if (colunas.length < 4) continue;

            const resultado = parseFloat(colunas[2]); // Coluna de Lucro/Prejuízo
            const responsabilidade = parseFloat(colunas[3]); // Coluna de Responsabilidade

            lucroTotal += resultado;

            // Validação de Risco: Alerta se responsabilidade > 2% da banca total (R$ 27,00)
            // Como sua stake é R$ 150,00, este alerta vai disparar, servindo como lembrete de risco
            if (responsabilidade > 27.00) {
                teveEntradaComRiscoAlto = true;
            }
        }

        // Subtração do custo fixo de R$ 150,00
        const lucroLiquido = lucroTotal - 150.00;

        // Atualização do Dashboard
        document.getElementById('lucro').innerText = `R$ ${lucroLiquido.toFixed(2)}`;
        
        const riscoStatus = document.getElementById('risco-status');
        if (teveEntradaComRiscoAlto) {
            riscoStatus.innerText = "ALERTA: Gestão de risco agressiva detectada!";
            riscoStatus.style.color = "red";
        } else {
            riscoStatus.innerText = "Gestão de risco dentro do esperado";
            riscoStatus.style.color = "green";
        }
    };
    reader.readAsText(file);
});
