(function () {
  'use strict';

  function debounce(fn, delayMs) {
    let timeout = null;
    return function debounced(...args) {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => fn.apply(this, args), delayMs);
    };
  }

  function createManager(options = {}) {
    const {
      store = window.OfflineDB?.STORES?.MIX_DRAFTS_LOCAL || 'mix_drafts_local',
      draftId = 'lastDraft',
      debounceMs = 600,
      getPayload = () => ({}),
      applyPayload = () => {}
    } = options;

    async function saveNow() {
      if (!window.OfflineDB?.dbPut) return;
      const payload = getPayload();
      await window.OfflineDB.dbPut(store, {
        id: draftId,
        updatedAt: new Date().toISOString(),
        payload
      });
    }

    const scheduleSave = debounce(() => {
      saveNow().catch((error) => {
        console.warn('[Autosave] Falha ao salvar draft:', error);
      });
    }, debounceMs);

    async function loadAndApply() {
      if (!window.OfflineDB?.dbGet) return null;
      const draft = await window.OfflineDB.dbGet(store, draftId);
      if (!draft?.payload) return null;
      applyPayload(draft.payload);
      return draft;
    }

    async function clear() {
      if (!window.OfflineDB?.dbDelete) return;
      await window.OfflineDB.dbDelete(store, draftId);
    }

    return {
      saveNow,
      scheduleSave,
      loadAndApply,
      clear
    };
  }

  window.OfflineAutosave = {
    createManager
  };
})();
