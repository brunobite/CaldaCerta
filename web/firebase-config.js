const firebaseConfig = {
  apiKey: "AIzaSyCWLwnpqAVyreJmj6Nsto7vox-B3SuOlFY",
  authDomain: "caldacerta-pro.firebaseapp.com",
  databaseURL: "https://caldacerta-pro-default-rtdb.firebaseio.com", // ⬅️ CORRETO!
  projectId: "caldacerta-pro",
  storageBucket: "caldacerta-pro.firebasestorage.app",
  messagingSenderId: "980579278802",
  appId: "1:980579278802:web:584ae84f646df794c3720b"
};

console.log("🔥 Firebase Config loaded");

// Inicializar Firebase (versão v8 - compatibilidade)
try {
  if (typeof firebase === 'undefined') {
    console.error("❌ Firebase SDK não foi carregado. Verifique a ordem dos scripts.");
  } else {
    // Verificar se já foi inicializado
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
      console.log("✅ Firebase inicializado com sucesso!");
      
      // Testar conexão
      const db = firebase.database();
      db.ref('.info/connected').on('value', (snap) => {
        if (snap.val() === true) {
          console.log("🌐 Conectado ao Firebase Realtime Database");
        }
      });
      
    } else {
      console.log("✅ Firebase já estava inicializado");
    }
  }
} catch (error) {
  console.error("❌ Erro ao inicializar Firebase:", error);
}