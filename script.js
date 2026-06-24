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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

const btnLogin = document.getElementById('btn-login');
const dashboard = document.getElementById('dashboard');
const authContainer = document.getElementById('auth-container');
const inputCSV = document.getElementById('csvFile');

btnLogin.addEventListener('click', () => {
    signInWithPopup(auth, provider)
    .then(() => {
        authContainer.style.display = 'none';
        dashboard.style.display = 'block';
    })
    .catch((error) => console.error("Erro no login:", error));
});

inputCSV.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        const linhas = text.split('\n');
        let lucroTotal = 0;
        let teveEntradaComRiscoAlto = false;

        for (let i = 1; i < linhas.length; i++) {
            // Tenta separar por ; primeiro, se não achar, separa por ,
            let colunas = linhas[i].includes(';') ? linhas[i].split(';') : linhas[i].split(',');
            
            if (colunas.length < 4) continue;

            // Ajuste os índices [2] e [3] se necessário após verificar o Console (F12)
            const resultado = parseFloat(colunas[2].replace(',', '.')); 
            const responsabilidade = parseFloat(colunas[3].replace(',', '.'));

            if (!isNaN(resultado)) lucroTotal += resultado;
            if (!isNaN(responsabilidade) && responsabilidade > 27.00) {
                teveEntradaComRiscoAlto = true;
            }
        }

        const lucroLiquido = lucroTotal - 150.00;
        document.getElementById('lucro').innerText = `R$ ${lucroLiquido.toFixed(2)}`;
        
        const riscoStatus = document.getElementById('risco-status');
        riscoStatus.innerText = teveEntradaComRiscoAlto ? "ALERTA: Gestão de risco agressiva!" : "Gestão de risco OK";
        riscoStatus.style.color = teveEntradaComRiscoAlto ? "red" : "green";
    };
    reader.readAsText(file);
});
