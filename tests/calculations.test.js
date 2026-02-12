const {
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
} = require('./calculations');

// ---------------------------------------------------------------------------
// computeDewPoint
// ---------------------------------------------------------------------------
describe('computeDewPoint', () => {
    test('standard conditions (25C, 50% humidity) returns expected value', () => {
        const dp = computeDewPoint(25, 50);
        // Magnus formula reference: dew point ~13.9 C
        expect(dp).toBeCloseTo(13.9, 0);
    });

    test('100% humidity: dew point equals temperature', () => {
        const dp = computeDewPoint(30, 100);
        expect(dp).toBeCloseTo(30, 1);
    });

    test('100% humidity at 0C: dew point equals 0', () => {
        const dp = computeDewPoint(0, 100);
        expect(dp).toBeCloseTo(0, 1);
    });

    test('low humidity produces a lower dew point', () => {
        const dpLow = computeDewPoint(25, 20);
        const dpHigh = computeDewPoint(25, 80);
        expect(dpLow).toBeLessThan(dpHigh);
    });

    test('negative temperature with 80% humidity', () => {
        const dp = computeDewPoint(-5, 80);
        expect(dp).toBeLessThan(-5);
        expect(typeof dp).toBe('number');
        expect(Number.isFinite(dp)).toBe(true);
    });

    test('hot conditions (40C, 70% humidity)', () => {
        const dp = computeDewPoint(40, 70);
        // Should be a reasonable value between 20 and 40
        expect(dp).toBeGreaterThan(20);
        expect(dp).toBeLessThan(40);
    });
});

// ---------------------------------------------------------------------------
// computeDeltaT
// ---------------------------------------------------------------------------
describe('computeDeltaT', () => {
    test('normal conditions (25C, 60% humidity) returns reasonable Delta T', () => {
        const dt = computeDeltaT(25, 60);
        // Delta T should be positive and in a reasonable range (roughly 5-15)
        expect(dt).toBeGreaterThan(0);
        expect(dt).toBeLessThan(20);
    });

    test('low humidity gives higher Delta T', () => {
        const dtLow = computeDeltaT(25, 20);
        const dtHigh = computeDeltaT(25, 80);
        expect(dtLow).toBeGreaterThan(dtHigh);
    });

    test('100% humidity gives Delta T near 0', () => {
        const dt = computeDeltaT(25, 100);
        expect(dt).toBeCloseTo(0, 1);
    });

    test('100% humidity at 30C gives Delta T near 0', () => {
        const dt = computeDeltaT(30, 100);
        expect(dt).toBeCloseTo(0, 1);
    });

    test('edge case: 0C temperature', () => {
        const dt = computeDeltaT(0, 50);
        expect(dt).toBeGreaterThan(0);
        expect(typeof dt).toBe('number');
        expect(Number.isFinite(dt)).toBe(true);
    });

    test('edge case: negative temperature (-10C, 60%)', () => {
        const dt = computeDeltaT(-10, 60);
        expect(dt).toBeGreaterThan(0);
        expect(Number.isFinite(dt)).toBe(true);
    });

    test('Delta T is always temp minus dew point', () => {
        const temp = 25;
        const humidity = 55;
        const dt = computeDeltaT(temp, humidity);
        const dp = computeDewPoint(temp, humidity);
        expect(dt).toBeCloseTo(temp - dp, 10);
    });
});

// ---------------------------------------------------------------------------
// normalizeKey
// ---------------------------------------------------------------------------
describe('normalizeKey', () => {
    test('should remove accents from Portuguese text', () => {
        expect(normalizeKey('Glifosato')).toBe('glifosato');
    });

    test('should remove accents and diacritics', () => {
        expect(normalizeKey('acucar')).toBe('acucar');
        expect(normalizeKey('acao')).toBe('acao');
        expect(normalizeKey('oleos')).toBe('oleos');
    });

    test('should remove special characters and hyphens', () => {
        expect(normalizeKey('oleo-vegetal')).toBe('oleovegetal');
    });

    test('should handle accented characters properly', () => {
        expect(normalizeKey('\u00f3leo-vegetal')).toBe('oleovegetal');
    });

    test('should convert to lowercase', () => {
        expect(normalizeKey('GLIFOSATO')).toBe('glifosato');
        expect(normalizeKey('MixedCase')).toBe('mixedcase');
    });

    test('should handle empty string', () => {
        expect(normalizeKey('')).toBe('');
    });

    test('should handle null input', () => {
        expect(normalizeKey(null)).toBe('');
    });

    test('should handle undefined input', () => {
        expect(normalizeKey(undefined)).toBe('');
    });

    test('should remove spaces', () => {
        expect(normalizeKey('hello world')).toBe('helloworld');
    });

    test('should handle numbers', () => {
        expect(normalizeKey('produto123')).toBe('produto123');
    });

    test('should handle unicode combining characters', () => {
        // e + combining accent (two codepoints for e with accent)
        expect(normalizeKey('caf\u0065\u0301')).toBe('cafe');
    });
});

// ---------------------------------------------------------------------------
// normalizeProdutoTipo
// ---------------------------------------------------------------------------
describe('normalizeProdutoTipo', () => {
    // Legacy type mapping
    test('should map legacy type ADJUVANTE', () => {
        expect(normalizeProdutoTipo('ADJUVANTE')).toBe('adjuvante');
    });

    test('should map legacy type ESPALHANTE to adjuvante', () => {
        expect(normalizeProdutoTipo('ESPALHANTE')).toBe('adjuvante');
    });

    test('should map legacy type ANTIESPUMA to adjuvante', () => {
        expect(normalizeProdutoTipo('ANTIESPUMA')).toBe('adjuvante');
    });

    test('should map legacy type FERTILIZANTE', () => {
        expect(normalizeProdutoTipo('FERTILIZANTE')).toBe('fertilizante');
    });

    test('should map legacy type OLEO', () => {
        expect(normalizeProdutoTipo('OLEO')).toBe('oleo');
    });

    test('should map legacy type PRODUTO to outros', () => {
        expect(normalizeProdutoTipo('PRODUTO')).toBe('outros');
    });

    // Modern type handling
    test('should handle modern type herbicida', () => {
        expect(normalizeProdutoTipo('herbicida')).toBe('herbicida');
    });

    test('should handle modern type fungicida', () => {
        expect(normalizeProdutoTipo('fungicida')).toBe('fungicida');
    });

    test('should handle modern type inseticida', () => {
        expect(normalizeProdutoTipo('inseticida')).toBe('inseticida');
    });

    test('should handle modern type acaricida', () => {
        expect(normalizeProdutoTipo('acaricida')).toBe('acaricida');
    });

    test('should handle modern type biologico (with accent)', () => {
        expect(normalizeProdutoTipo('Biol\u00f3gico')).toBe('biologico');
    });

    test('should handle modern type calcita', () => {
        expect(normalizeProdutoTipo('calcita')).toBe('calcita');
    });

    // Edge cases
    test('should return empty string for unknown type', () => {
        expect(normalizeProdutoTipo('desconhecido')).toBe('');
    });

    test('should return empty string for null', () => {
        expect(normalizeProdutoTipo(null)).toBe('');
    });

    test('should return empty string for undefined', () => {
        expect(normalizeProdutoTipo(undefined)).toBe('');
    });

    test('should return empty string for empty string', () => {
        expect(normalizeProdutoTipo('')).toBe('');
    });

    test('should return empty string for whitespace-only string', () => {
        expect(normalizeProdutoTipo('   ')).toBe('');
    });

    test('should return empty string for non-string values', () => {
        expect(normalizeProdutoTipo(123)).toBe('');
        expect(normalizeProdutoTipo({})).toBe('');
        expect(normalizeProdutoTipo([])).toBe('');
    });

    test('should trim whitespace before matching', () => {
        expect(normalizeProdutoTipo('  ADJUVANTE  ')).toBe('adjuvante');
        expect(normalizeProdutoTipo('  herbicida  ')).toBe('herbicida');
    });
});

// ---------------------------------------------------------------------------
// calculateDoseJarra
// ---------------------------------------------------------------------------
describe('calculateDoseJarra', () => {
    test('normal calculation: dose 2, jarra 1000, vazao 200', () => {
        expect(calculateDoseJarra(2, 1000, 200)).toBe(10);
    });

    test('division by zero: vazao 0 returns 0 (not Infinity)', () => {
        expect(calculateDoseJarra(2, 1000, 0)).toBe(0);
    });

    test('negative vazao returns 0', () => {
        expect(calculateDoseJarra(2, 1000, -100)).toBe(0);
    });

    test('null vazao returns 0', () => {
        expect(calculateDoseJarra(2, 1000, null)).toBe(0);
    });

    test('undefined vazao returns 0', () => {
        expect(calculateDoseJarra(2, 1000, undefined)).toBe(0);
    });

    test('small dose: dose 0.1, jarra 500, vazao 100', () => {
        expect(calculateDoseJarra(0.1, 500, 100)).toBeCloseTo(0.5);
    });

    test('large values: dose 10, jarra 5000, vazao 250', () => {
        expect(calculateDoseJarra(10, 5000, 250)).toBe(200);
    });

    test('dose 0 returns 0', () => {
        expect(calculateDoseJarra(0, 1000, 200)).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// calculateDoseTanque
// ---------------------------------------------------------------------------
describe('calculateDoseTanque', () => {
    test('normal calculation: dose 2, tanque 2000, vazao 200', () => {
        expect(calculateDoseTanque(2, 2000, 200)).toBe(20);
    });

    test('division by zero: vazao 0 returns 0', () => {
        expect(calculateDoseTanque(2, 2000, 0)).toBe(0);
    });

    test('negative vazao returns 0', () => {
        expect(calculateDoseTanque(2, 2000, -50)).toBe(0);
    });

    test('small values', () => {
        expect(calculateDoseTanque(0.5, 500, 100)).toBeCloseTo(2.5);
    });
});

// ---------------------------------------------------------------------------
// calculateVolumeTotal
// ---------------------------------------------------------------------------
describe('calculateVolumeTotal', () => {
    test('normal calculation: dose 200, area 50', () => {
        expect(calculateVolumeTotal(200, 50)).toBe(10000);
    });

    test('dose 0 returns 0', () => {
        expect(calculateVolumeTotal(0, 100)).toBe(0);
    });

    test('area 0 returns 0', () => {
        expect(calculateVolumeTotal(200, 0)).toBe(0);
    });

    test('decimal values', () => {
        expect(calculateVolumeTotal(1.5, 10)).toBeCloseTo(15);
    });
});

// ---------------------------------------------------------------------------
// calculateRendimento
// ---------------------------------------------------------------------------
describe('calculateRendimento', () => {
    test('normal calculation: tanque 2000, vazao 200', () => {
        expect(calculateRendimento(2000, 200)).toBe(10);
    });

    test('zero vazao returns 0 (not Infinity)', () => {
        expect(calculateRendimento(2000, 0)).toBe(0);
    });

    test('negative vazao returns 0', () => {
        expect(calculateRendimento(2000, -100)).toBe(0);
    });

    test('null vazao returns 0', () => {
        expect(calculateRendimento(2000, null)).toBe(0);
    });

    test('undefined vazao returns 0', () => {
        expect(calculateRendimento(2000, undefined)).toBe(0);
    });

    test('decimal result: tanque 1000, vazao 300', () => {
        expect(calculateRendimento(1000, 300)).toBeCloseTo(3.333, 2);
    });

    test('tanque 0 returns 0', () => {
        expect(calculateRendimento(0, 200)).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// sortProductsByHierarchy
// ---------------------------------------------------------------------------
describe('sortProductsByHierarchy', () => {
    test('adjuvantes should come first (priority 1)', () => {
        const products = [
            { tipoProduto: 'herbicida', nome: 'Herb1', formulacao: 'SC' },
            { tipoProduto: 'adjuvante', nome: 'Adj1', formulacao: 'SL' },
            { tipoProduto: 'fungicida', nome: 'Fung1', formulacao: 'WG' }
        ];
        const sorted = sortProductsByHierarchy(products);
        expect(sorted[0].nome).toBe('Adj1');
    });

    test('oleo should come last (priority 4)', () => {
        const products = [
            { tipoProduto: 'oleo', nome: 'Oil1', formulacao: 'EC' },
            { tipoProduto: 'herbicida', nome: 'Herb1', formulacao: 'SC' },
            { tipoProduto: 'adjuvante', nome: 'Adj1', formulacao: 'SL' }
        ];
        const sorted = sortProductsByHierarchy(products);
        expect(sorted[sorted.length - 1].nome).toBe('Oil1');
    });

    test('full hierarchy order: adjuvante < herbicida/fungicida < fertilizante < oleo', () => {
        const products = [
            { tipoProduto: 'oleo', nome: 'Oil1', formulacao: 'EC' },
            { tipoProduto: 'fertilizante', nome: 'Fert1', formulacao: 'SL' },
            { tipoProduto: 'adjuvante', nome: 'Adj1', formulacao: 'SL' },
            { tipoProduto: 'herbicida', nome: 'Herb1', formulacao: 'SC' }
        ];
        const sorted = sortProductsByHierarchy(products);
        expect(sorted[0].nome).toBe('Adj1');       // priority 1
        expect(sorted[1].nome).toBe('Herb1');       // priority 2
        expect(sorted[2].nome).toBe('Fert1');       // priority 3
        expect(sorted[3].nome).toBe('Oil1');        // priority 4
    });

    test('pH ascending sorting for same-priority products', () => {
        const products = [
            { tipoProduto: 'herbicida', nome: 'Herb-pH8', ph: 8, formulacao: 'SC' },
            { tipoProduto: 'fungicida', nome: 'Fung-pH4', ph: 4, formulacao: 'WG' },
            { tipoProduto: 'inseticida', nome: 'Ins-pH6', ph: 6, formulacao: 'EC' }
        ];
        const sorted = sortProductsByHierarchy(products, 'ph-crescente');
        expect(sorted[0].nome).toBe('Fung-pH4');
        expect(sorted[1].nome).toBe('Ins-pH6');
        expect(sorted[2].nome).toBe('Herb-pH8');
    });

    test('pH descending sorting for same-priority products', () => {
        const products = [
            { tipoProduto: 'herbicida', nome: 'Herb-pH8', ph: 8, formulacao: 'SC' },
            { tipoProduto: 'fungicida', nome: 'Fung-pH4', ph: 4, formulacao: 'WG' },
            { tipoProduto: 'inseticida', nome: 'Ins-pH6', ph: 6, formulacao: 'EC' }
        ];
        const sorted = sortProductsByHierarchy(products, 'ph-decrescente');
        expect(sorted[0].nome).toBe('Herb-pH8');
        expect(sorted[1].nome).toBe('Ins-pH6');
        expect(sorted[2].nome).toBe('Fung-pH4');
    });

    test('default sorting by formulacao for same-priority products', () => {
        const products = [
            { tipoProduto: 'herbicida', nome: 'Herb-WG', formulacao: 'WG' },
            { tipoProduto: 'fungicida', nome: 'Fung-EC', formulacao: 'EC' },
            { tipoProduto: 'inseticida', nome: 'Ins-SC', formulacao: 'SC' }
        ];
        const sorted = sortProductsByHierarchy(products);
        expect(sorted[0].nome).toBe('Fung-EC');
        expect(sorted[1].nome).toBe('Ins-SC');
        expect(sorted[2].nome).toBe('Herb-WG');
    });

    test('products without formulacao should not crash (TypeError fix)', () => {
        const products = [
            { tipoProduto: 'herbicida', nome: 'Herb1' },
            { tipoProduto: 'fungicida', nome: 'Fung1' },
            { tipoProduto: 'inseticida', nome: 'Ins1' }
        ];
        expect(() => sortProductsByHierarchy(products)).not.toThrow();
        const sorted = sortProductsByHierarchy(products);
        expect(sorted).toHaveLength(3);
    });

    test('products with missing tipoProduto should not crash', () => {
        const products = [
            { nome: 'Unknown1' },
            { tipoProduto: 'herbicida', nome: 'Herb1', formulacao: 'SC' },
            { nome: 'Unknown2', formulacao: 'WG' }
        ];
        expect(() => sortProductsByHierarchy(products)).not.toThrow();
    });

    test('empty product list returns empty array', () => {
        expect(sortProductsByHierarchy([])).toEqual([]);
    });

    test('does not mutate original array', () => {
        const products = [
            { tipoProduto: 'oleo', nome: 'Oil1', formulacao: 'EC' },
            { tipoProduto: 'adjuvante', nome: 'Adj1', formulacao: 'SL' }
        ];
        const original = [...products];
        sortProductsByHierarchy(products);
        expect(products).toEqual(original);
    });

    test('pH sorting uses default 7 when ph is missing', () => {
        const products = [
            { tipoProduto: 'herbicida', nome: 'Herb-noPH', formulacao: 'SC' },
            { tipoProduto: 'fungicida', nome: 'Fung-pH3', ph: 3, formulacao: 'WG' }
        ];
        const sorted = sortProductsByHierarchy(products, 'ph-crescente');
        expect(sorted[0].nome).toBe('Fung-pH3');  // pH 3 < default 7
        expect(sorted[1].nome).toBe('Herb-noPH'); // default pH 7
    });

    test('legacy ADJUVANTE type is recognized via tipoProduto', () => {
        const products = [
            { tipoProduto: 'ADJUVANTE', nome: 'LegacyAdj', formulacao: 'SL' },
            { tipoProduto: 'herbicida', nome: 'Herb1', formulacao: 'SC' }
        ];
        const sorted = sortProductsByHierarchy(products);
        expect(sorted[0].nome).toBe('LegacyAdj'); // adjuvante has priority 1
    });
});

// ---------------------------------------------------------------------------
// escapeHtml
// ---------------------------------------------------------------------------
describe('escapeHtml', () => {
    test('should escape ampersand', () => {
        expect(escapeHtml('a & b')).toBe('a &amp; b');
    });

    test('should escape less-than', () => {
        expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
    });

    test('should escape greater-than', () => {
        expect(escapeHtml('a > b')).toBe('a &gt; b');
    });

    test('should escape double quotes', () => {
        expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;');
    });

    test('should escape single quotes', () => {
        expect(escapeHtml("it's")).toBe("it&#39;s");
    });

    test('should escape all special characters together', () => {
        expect(escapeHtml('<a href="url">&\'test\'')).toBe(
            '&lt;a href=&quot;url&quot;&gt;&amp;&#39;test&#39;'
        );
    });

    test('should handle non-string input (number)', () => {
        expect(escapeHtml(123)).toBe('');
    });

    test('should handle non-string input (null)', () => {
        expect(escapeHtml(null)).toBe('');
    });

    test('should handle non-string input (undefined)', () => {
        expect(escapeHtml(undefined)).toBe('');
    });

    test('should handle non-string input (object)', () => {
        expect(escapeHtml({})).toBe('');
    });

    test('should handle empty string', () => {
        expect(escapeHtml('')).toBe('');
    });

    test('should not alter strings without special characters', () => {
        expect(escapeHtml('hello world 123')).toBe('hello world 123');
    });
});
