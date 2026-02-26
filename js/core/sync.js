import { getDb } from './db.js';

const OUTBOX_STORE = 'outbox_local';
const MAX_ATTEMPTS = 5;

function getCurrentUid(payload = {}) {
  if (payload.uid) {
    return payload.uid;
  }

  const authFromWindow = typeof window !== 'undefined' ? window.auth : null;
  if (authFromWindow?.currentUser?.uid) {
    return authFromWindow.currentUser.uid;
  }

  const firebaseAuth = typeof window !== 'undefined' ? window.firebaseAuth : null;
  if (typeof firebaseAuth?.getAuth === 'function') {
    const auth = firebaseAuth.getAuth();
    if (auth?.currentUser?.uid) {
      return auth.currentUser.uid;
    }
  }

  throw new Error('Usuário não autenticado para sincronização.');
}

function getRtdbApi() {
  const firebaseDatabase = typeof window !== 'undefined' ? window.firebaseDatabase : null;
  if (
    firebaseDatabase &&
    typeof firebaseDatabase.getDatabase === 'function' &&
    typeof firebaseDatabase.ref === 'function' &&
    typeof firebaseDatabase.set === 'function'
  ) {
    return {
      setByPath: async (path, value) => {
        const db = firebaseDatabase.getDatabase();
        await firebaseDatabase.set(firebaseDatabase.ref(db, path), value);
      }
    };
  }

  const compatDatabase = typeof window !== 'undefined' ? window.database : null;
  if (compatDatabase && typeof compatDatabase.ref === 'function') {
    return {
      setByPath: async (path, value) => {
        await compatDatabase.ref(path).set(value);
      }
    };
  }

  throw new Error('Firebase RTDB indisponível no escopo global.');
}

function resolveOperationPath(operationType, uid, mixId) {
  switch (operationType) {
    case 'UPSERT_MISTURA':
      return `usuarios/${uid}/misturas/${mixId}`;
    case 'UPSERT_SNAPSHOT':
      return `usuarios/${uid}/misturas/${mixId}/reportSnapshot`;
    case 'UPSERT_INDEX':
      return `usuarios/${uid}/mix_index/${mixId}`;
    default:
      throw new Error(`operationType não suportado: ${operationType}`);
  }
}

function resolveOperationValue(operationType, payload) {
  if (operationType === 'UPSERT_SNAPSHOT') {
    return payload.reportSnapshot ?? payload.snapshot ?? payload.data ?? payload;
  }

  if (operationType === 'UPSERT_INDEX') {
    return payload.index ?? payload.data ?? payload;
  }

  return payload.mistura ?? payload.data ?? payload;
}

export async function addToOutbox(operationType, payload) {
  const db = await getDb();
  await db.add(OUTBOX_STORE, {
    operationType,
    payload,
    status: 'pending',
    createdAt: new Date().toISOString(),
    attempts: 0
  });
}

export async function sendToFirebase(operationType, payload) {
  const uid = getCurrentUid(payload);
  const mixId = payload.mixId;

  if (!mixId) {
    throw new Error('payload.mixId é obrigatório para sincronização.');
  }

  const path = resolveOperationPath(operationType, uid, mixId);
  const value = resolveOperationValue(operationType, payload);
  const rtdb = getRtdbApi();

  await rtdb.setByPath(path, value);
}

export async function processOutbox() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return;
  }

  const db = await getDb();
  const pending = await db.getAllFromIndex(OUTBOX_STORE, 'status', 'pending');

  for (const item of pending) {
    try {
      await sendToFirebase(item.operationType, item.payload);
      await db.put(OUTBOX_STORE, { ...item, status: 'done' });
    } catch (_error) {
      const attempts = (item.attempts || 0) + 1;
      const status = attempts >= MAX_ATTEMPTS ? 'failed' : 'pending';
      await db.put(OUTBOX_STORE, { ...item, attempts, status });
    }
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', processOutbox);
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    if (typeof navigator === 'undefined' || navigator.onLine) {
      processOutbox();
    }
  });
}
