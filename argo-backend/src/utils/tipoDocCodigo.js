/** Códigos abreviados cuando catTipoDoc no está disponible (id numérico legacy). */
const FALLBACK_CODIGO_POR_ID = {
  1: 'CC',
  2: 'TI',
  3: 'RC',
  4: 'CE',
  5: 'PA',
  6: 'NIT',
};

/**
 * Código corto del tipo de documento (CC, TI, CE…) para impresiones.
 * @param {object|null|undefined} alumno
 * @param {object|null|undefined} catRow fila de catTipoDoc
 */
function codigoTipoDocumentoAlumno(alumno, catRow) {
  const codCat = String(catRow?.codigo || '').trim();
  if (codCat) return codCat.toUpperCase();

  const raw = String(alumno?.tipoDoc || '').trim();
  if (!raw) return 'CC';
  if (/^[A-Za-z]{2,5}$/.test(raw)) return raw.toUpperCase();

  const norm = raw.replace(/^(\d+)\).*/, '$1');
  return FALLBACK_CODIGO_POR_ID[norm] || FALLBACK_CODIGO_POR_ID[raw] || raw.toUpperCase();
}

module.exports = { codigoTipoDocumentoAlumno, FALLBACK_CODIGO_POR_ID };
