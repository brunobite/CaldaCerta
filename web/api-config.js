// web/api-config.js

// Domínio do seu backend no Render
const REMOTE_API = "https://caldacerta.onrender.com";
const LOCAL_API  = "http://localhost:3000";

// Detecta onde está rodando
const IS_RENDER = location.hostname.endsWith("onrender.com");
const IS_LOCALHOST =
  location.hostname === "localhost" ||
  location.hostname === "127.0.0.1" ||
  location.protocol === "file:";

// ⚠️ REGRA DEFINITIVA:
// - Se estiver no Render -> SEMPRE remoto
// - Se estiver no seu PC -> pode usar local
window.API_BASE = IS_RENDER ? REMOTE_API : (IS_LOCALHOST ? LOCAL_API : REMOTE_API);

console.log("API_BASE =", window.API_BASE, "HOST =", location.hostname);