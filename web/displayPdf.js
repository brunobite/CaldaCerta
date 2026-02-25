// Fonte única de formatação de doses para exibição no PDF

// Converte número para formato brasileiro com unidade correta
function formatarDoseJarra(ml) {
    return ml.toFixed(2).replace(".", ",") + " mL";
    // Exemplo: 33.333 → "33,33 mL"
}

function formatarDoseHa(valor, unidade = "L/ha") {
    return valor.toFixed(2).replace(".", ",") + " " + unidade;
    // Exemplo: 2.0 → "2,00 L/ha"
}

window.formatarDoseJarra = formatarDoseJarra;
window.formatarDoseHa = formatarDoseHa;
