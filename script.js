import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";

// Your web app's Firebase configuration

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

// Função de Login
function loginComGoogle() {
    signInWithPopup(auth, provider)
    .then((result) => {
        console.log("Usuário logado:", result.user.displayName);
        // Redirecionar para o dashboard após login
    })
    .catch((error) => {
        console.error("Erro no login:", error);
    });
}
