// web/api-config.js

(function () {
  // Se estiver rodando local (arquivo ou localhost), usa API local
  // Senão, usa a API remota do Render.
  const isLocal =
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1" ||
    location.protocol === "file:";

  // ATENÇÃO: troque para o seu domínio real se mudar
  const REMOTE_API = "https://caldacerta.onrender.com";
  const LOCAL_API = "http://localhost:3000";

  window.API_BASE = isLocal ? LOCAL_API : REMOTE_API;

  // Helpers (se você já tem esses métodos, mantenha os nomes e só ajuste o base)
  window.API = {
    async getProdutos() {
      const r = await fetch(`${window.API_BASE}/api/produtos`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    async getSimulacoes() {
      const r = await fetch(`${window.API_BASE}/api/simulacoes`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    async getStats() {
      const r = await fetch(`${window.API_BASE}/api/stats`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    async salvarSimulacao(payload) {
      const r = await fetch(`${window.API_BASE}/api/simulacoes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      return data;
    },
    async uploadProdutos(file) {
      const form = new FormData();
      form.append("file", file);

      const r = await fetch(`${window.API_BASE}/api/produtos/upload`, {
        method: "POST",
        body: form,
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      return data;
    },
  };

  console.log("API_BASE =", window.API_BASE);
})();
