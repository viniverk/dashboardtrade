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

// Elementos da interface
const btnLogin = document.getElementById('btn-login');
const dashboard = document.getElementById('dashboard');
const inputCSV = document.getElementById('csvFile');

// Função de Login
btnLogin.addEventListener('click', () => {
    signInWithPopup(auth, provider)
    .then((result) => {
        console.log("Usuário logado:", result.user.displayName);
        document.getElementById('auth-container').style.display = 'none';
        dashboard.style.display = 'block'; // Mostra o dashboard após login [cite: 87]
    })
    .catch((error) => console.error("Erro no login:", error));
});

// Leitura do CSV
inputCSV.addEventListener('change', (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
        console.log("Arquivo carregado. Iniciando processamento...");
        // Aqui entrará a lógica de cálculo de lucro líquido e validação de risco [cite: 88, 89]
    };
    reader.readAsText(file);
});
