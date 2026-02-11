// ===== BUSCA POR ÍNDICE (palavras completas) =====
const DEFAULT_LIMIT = 30;

function normalizeKey(text) {
  return (text || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractWords(term) {
  const key = normalizeKey(term);
  return [...new Set(key.split(' ').filter(w => w.length >= 2))];
}

async function fetchCatalogProductById(id) {
  const snap = await firebase.database().ref(`produtos_catalogo/${id}`).once('value');
  if (!snap.exists()) return null;
  return { id, ...snap.val(), source: 'catalogo' };
}

async function searchCatalog(term, limit = DEFAULT_LIMIT) {
  const words = extractWords(term);
  if (!words.length) return [];

  // 1) Para cada palavra, pegar lista de IDs no índice
  const indexSnaps = await Promise.all(
    words.map(w => firebase.database().ref(`produtos_catalogo_busca/${w}`).once('value'))
  );

  const sets = indexSnaps.map(snap => new Set(Object.keys(snap.val() || {})));

  // Se qualquer palavra não retornou nada -> sem resultados
  if (sets.some(set => set.size === 0)) return [];

  // 2) Interseção (AND)
  let intersection = sets[0];
  for (let i = 1; i < sets.length; i++) {
    intersection = new Set([...intersection].filter(id => sets[i].has(id)));
    if (intersection.size === 0) return [];
  }

  // 3) Limitar IDs e buscar produtos
  const ids = [...intersection].slice(0, limit);
  const products = await Promise.all(ids.map(fetchCatalogProductById));

  // 4) Filtro extra (garante que contém as palavras no texto)
  const filtered = (products.filter(Boolean)).filter(p => {
    const hay = normalizeKey(`${p.nomeComercial || ''} ${p.empresa || ''} ${p.tipoProduto || ''}`);
    return words.every(w => hay.includes(w));
  });

  return filtered;
}
