// Pure calculation functions extracted from app.js for testing

function computeDewPoint(tempC, humidity) {
    const a = 17.27;
    const b = 237.7;
    const alpha = ((a * tempC) / (b + tempC)) + Math.log(humidity / 100);
    return (b * alpha) / (a - alpha);
}

function computeDeltaT(tempC, humidity) {
    return tempC - computeDewPoint(tempC, humidity);
}

function normalizeKey(str) {
    if (!str) return '';
    return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
}

function normalizeProdutoTipo(value) {
    const LEGACY_TYPE_MAP = {
        ADJUVANTE: 'adjuvante',
        ESPALHANTE: 'adjuvante',
        ANTIESPUMA: 'adjuvante',
        FERTILIZANTE: 'fertilizante',
        OLEO: 'oleo',
        PRODUTO: 'outros'
    };
    const PRODUCT_TYPE_LABELS = {
        calcita: 'Corretivo / Calcita',
        fertilizante: 'Fertilizante',
        adjuvante: 'Adjuvante',
        herbicida: 'Herbicida',
        fungicida: 'Fungicida',
        inseticida: 'Inseticida',
        acaricida: 'Acaricida',
        biologico: 'Biológico',
        oleo: 'Óleo Mineral/Vegetal',
        outros: 'Outros'
    };

    if (!value) return '';
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return '';
        if (LEGACY_TYPE_MAP[trimmed]) return LEGACY_TYPE_MAP[trimmed];
        const normalized = trimmed
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();
        if (PRODUCT_TYPE_LABELS[normalized]) return normalized;
    }
    return '';
}

function calculateDoseJarra(dose, jarraVolume, vazao) {
    if (!vazao || vazao <= 0) return 0;
    return (dose * jarraVolume) / vazao;
}

function calculateDoseTanque(dose, tanqueCapacidade, vazao) {
    if (!vazao || vazao <= 0) return 0;
    return (dose * tanqueCapacidade) / vazao;
}

function calculateVolumeTotal(dose, area) {
    return dose * area;
}

function calculateRendimento(tanque, vazao) {
    if (!vazao || vazao <= 0) return 0;
    return tanque / vazao;
}

function sortProductsByHierarchy(products, criterio = 'tipo') {
    const hierarchy = {
        'adjuvante': 1,
        'calcita': 2,
        'fertilizante': 3,
        'oleo': 4,
        'outros': 2,
        'herbicida': 2,
        'fungicida': 2,
        'inseticida': 2,
        'acaricida': 2,
        'biologico': 2
    };

    function resolveProdutoTipo(produto) {
        return normalizeProdutoTipo(produto?.tipoProduto || produto?.tipo);
    }

    return [...products].sort((a, b) => {
        const tipoA = resolveProdutoTipo(a);
        const tipoB = resolveProdutoTipo(b);
        const prioA = hierarchy[tipoA] || hierarchy[a.tipo] || hierarchy[a.formulacao] || 2;
        const prioB = hierarchy[tipoB] || hierarchy[b.tipo] || hierarchy[b.formulacao] || 2;

        if (prioA !== prioB) return prioA - prioB;

        if (prioA === 2 && prioB === 2) {
            if (criterio === 'ph-crescente') {
                return (a.ph || 7) - (b.ph || 7);
            } else if (criterio === 'ph-decrescente') {
                return (b.ph || 7) - (a.ph || 7);
            } else {
                return (a.formulacao || '').localeCompare(b.formulacao || '');
            }
        }

        return 0;
    });
}

function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[&<>"']/g, c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[c]));
}

module.exports = {
    computeDewPoint,
    computeDeltaT,
    normalizeKey,
    normalizeProdutoTipo,
    calculateDoseJarra,
    calculateDoseTanque,
    calculateVolumeTotal,
    calculateRendimento,
    sortProductsByHierarchy,
    escapeHtml
};
