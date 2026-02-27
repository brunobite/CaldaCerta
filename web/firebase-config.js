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

  window.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch((error) => {
    console.error('Não foi possível configurar persistência LOCAL do Firebase Auth:', error);
  });

  // Habilitar persistência offline do Realtime Database
  firebase.database().goOnline();
  const _connectedRef = firebase.database().ref('.info/connected');
  const _connectedHandler = (snap) => {
    window._firebaseConnected = !!snap.val();
    document.dispatchEvent(new CustomEvent('firebase-connection', {
      detail: { connected: window._firebaseConnected }
    }));
    if (snap.val()) {
      console.log('[Offline] Firebase conectado');
    } else {
      console.log('[Offline] Firebase desconectado - usando cache local');
    }
  };
  _connectedRef.on('value', _connectedHandler, (error) => {
    window._firebaseConnected = false;
    console.error('Erro ao monitorar conexão Firebase:', error);
  });
  // Expor função para cancelar o listener no logout
  window._cancelConnectionListener = () => {
    _connectedRef.off('value', _connectedHandler);
  };

  console.log('Firebase inicializado com sucesso');
} else {
  console.warn('Firebase SDK não carregado');
}
