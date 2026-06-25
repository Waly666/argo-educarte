/** Normaliza el estado de un comprobante a comparación insensible a mayúsculas. */
function estadoNormalizado(doc) {
  return String(doc?.estado ?? '')
    .trim()
    .toUpperCase();
}

/** True si el comprobante (ingreso, egreso, certificado, factura) está anulado. */
function esComprobanteAnulado(doc) {
  if (!doc) return false;
  if (doc.anulado === true) return true;
  const e = estadoNormalizado(doc);
  return e === 'ANULADO' || e === 'ANULADA';
}

module.exports = { esComprobanteAnulado, estadoNormalizado };
