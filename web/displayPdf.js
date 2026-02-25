// Fonte única de formatação de doses para exibição no PDF
function formatarDoseJarra(ml) {
    return ml.toFixed(2).replace('.', ',') + ' mL';
}

function formatarDoseHa(valor, unidade = 'L/ha') {
    return valor.toFixed(2).replace('.', ',') + ' ' + unidade;
}

window.formatarDoseJarra = formatarDoseJarra;
window.formatarDoseHa = formatarDoseHa;
