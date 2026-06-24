import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";

const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "seu-projeto.firebaseapp.com",
  projectId: "seu-projeto",
  storageBucket: "seu-projeto.appspot.com",
  messagingSenderId: "ID",
  appId: "ID_DO_APP"
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
