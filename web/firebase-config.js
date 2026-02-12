// ============================================
// CONFIGURAÇÃO DO FIREBASE (fonte única de verdade)
// ============================================
const firebaseConfig = {
  apiKey: "AIzaSyCWLwnpqAVyreJmj6Nsto7vox-B3SuOlFY",
  authDomain: "caldacerta-pro.firebaseapp.com",
  databaseURL: "https://caldacerta-pro-default-rtdb.firebaseio.com",
  projectId: "caldacerta-pro",
  storageBucket: "caldacerta-pro.firebasestorage.app",
  messagingSenderId: "980579278802",
  appId: "1:980579278802:web:c15f7e6cd2721580c3720b"
};

// Inicializar Firebase
if (typeof firebase !== 'undefined') {
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
  } catch (error) {
    console.error('Erro ao inicializar Firebase:', error);
  }

  // Criar referências globais
  window.auth = firebase.auth();
  window.database = firebase.database();

  // Habilitar persistência offline do Realtime Database
  firebase.database().goOnline();
  firebase.database().ref('.info/connected').on('value', (snap) => {
    window._firebaseConnected = !!snap.val();
    document.dispatchEvent(new CustomEvent('firebase-connection', {
      detail: { connected: window._firebaseConnected }
    }));
    if (snap.val()) {
      console.log('[Offline] Firebase conectado');
    } else {
      console.log('[Offline] Firebase desconectado - usando cache local');
    }
  }, (error) => {
    window._firebaseConnected = false;
    console.error('Erro ao monitorar conexão Firebase:', error);
  });

  console.log('Firebase inicializado com sucesso');
} else {
  console.warn('Firebase SDK não carregado');
}
