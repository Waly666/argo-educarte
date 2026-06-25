/** Formatos de impresión de comprobantes de ingreso y egreso. */
const FORMATOS = {
  VALIDADORA: 'validadora',
  MEDIA_CARTA: 'media_carta',
};

const FORMATOS_VALIDOS = Object.values(FORMATOS);

/** Media carta Colombia: 14 × 21,6 cm */
const MEDIA_CARTA_ANCHO_MM = 140;
const MEDIA_CARTA_ALTO_MM = 216;

function normalizarFormatoComprobante(val, fallback = FORMATOS.VALIDADORA) {
  const s = String(val ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (FORMATOS_VALIDOS.includes(s)) return s;
  if (s === 'mediacarta' || s === 'media_carta_colombia') return FORMATOS.MEDIA_CARTA;
  return fallback;
}

function formatoIngreso(config) {
  return normalizarFormatoComprobante(config?.formatoComprobanteIngreso, FORMATOS.VALIDADORA);
}

function formatoEgreso(config) {
  return normalizarFormatoComprobante(config?.formatoComprobanteEgreso, FORMATOS.VALIDADORA);
}

module.exports = {
  FORMATOS,
  FORMATOS_VALIDOS,
  MEDIA_CARTA_ANCHO_MM,
  MEDIA_CARTA_ALTO_MM,
  normalizarFormatoComprobante,
  formatoIngreso,
  formatoEgreso,
};
