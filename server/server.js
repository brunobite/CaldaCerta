// web/api-config.js

// APIs
const LOCAL_API = "http://localhost:3000";
// Em produção (Render), o melhor é usar URL RELATIVA (mesmo host)
const REMOTE_API = ""; // => /api/...

// Detecta ambiente
const IS_LOCALHOST =
  location.hostname === "localhost" ||
  location.hostname === "127.0.0.1" ||
  location.protocol === "file:";

const IS_RENDER = location.hostname.endsWith("onrender.com");

// Override opcional (para o seu botão "Modo Local" / "Modo Remoto")
//
// Valores aceitos em localStorage:
// localStorage.setItem("MODO_API", "local")  -> força LOCAL_API
// localStorage.setItem("MODO_API", "remoto") -> força REMOTE_API
// localStorage.removeItem("MODO_API")        -> volta automático
const forced = (localStorage.getItem("MODO_API") || "").toLowerCase();
const forceLocal = forced === "local";
const forceRemote = forced === "remoto";

// Regra:
// - Se estiver em localhost/file:// => local
// - Se estiver no Render => remoto (relativo)
// - Se estiver em outro lugar => remoto (relativo)
// - Mas se o usuário forçar via localStorage, respeita
window.API_BASE = forceLocal
  ? LOCAL_API
  : forceRemote
    ? REMOTE_API
    : (IS_LOCALHOST ? LOCAL_API : REMOTE_API);

console.log("✅ API_BASE =", window.API_BASE, "| HOST =", location.hostname, "| forced =", forced);