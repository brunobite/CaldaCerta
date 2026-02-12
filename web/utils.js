// ============================================
// CaldaCerta Pro - Utilitários compartilhados
// Carregado antes de app.js via <script>
// ============================================

/**
 * Escapa caracteres HTML especiais para prevenir XSS
 * @param {*} str - valor a ser escapado
 * @returns {string} string segura para inserção em HTML
 */
window.escapeHtml = function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[&<>"']/g, c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[c]));
};

/**
 * Sanitiza URLs para prevenir javascript: e data: injeção
 * @param {string} url - URL a ser validada
 * @returns {string} URL segura ou string vazia
 */
window.sanitizeUrl = function sanitizeUrl(url) {
    if (!url || typeof url !== 'string') return '';
    const trimmed = url.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
    return '';
};

/**
 * Normaliza texto removendo acentos e caracteres especiais
 * @param {string} str - texto a normalizar
 * @returns {string} texto normalizado
 */
window.normalizeKey = function normalizeKey(str) {
    if (!str) return '';
    return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
};
