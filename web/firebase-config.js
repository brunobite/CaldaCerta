// Configuração do Firebase - SUBSTITUA COM SEUS DADOS!
const firebaseConfig = {
  apiKey: "AIzaSyAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  authDomain: "caldacerta-pro.firebaseapp.com",
  projectId: "caldacerta-pro",
  storageBucket: "caldacerta-pro.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef1234567890"
};

// Inicializar Firebase
if (typeof firebase !== 'undefined') {
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
      console.log("✅ Firebase inicializado");
    }
  } catch (error) {
    console.error("❌ Erro ao inicializar Firebase:", error);
  }
} else {
  console.warn("⚠️ Firebase SDK não carregado");
}