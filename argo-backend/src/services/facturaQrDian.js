const crypto = require('crypto');
const QRCode = require('qrcode');

const URL_DIAN_QR = 'https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=';

function soloDigitos(v) {
  return String(v ?? '').replace(/\D/g, '');
}

/** Valor numérico DIAN en QR: al menos un decimal (ej. 500000.0). */
function fmtQrDecimal(n) {
  const v = Number(n) || 0;
  if (Number.isInteger(v)) return `${v}.0`;
  return String(Number(v.toFixed(2)));
}

/** Fecha y hora en zona Colombia (-05:00) para el QR DIAN. */
function fechaHoraBogota(date) {
  const dt = date ? new Date(date) : new Date();
  if (Number.isNaN(dt.getTime())) {
    return { fecha: '1970-01-01', hora: '00:00:00-05:00' };
  }
  const utcMs = dt.getTime() + dt.getTimezoneOffset() * 60000;
  const bogota = new Date(utcMs - 5 * 3600000);
  const y = bogota.getFullYear();
  const m = String(bogota.getMonth() + 1).padStart(2, '0');
  const d = String(bogota.getDate()).padStart(2, '0');
  const h = String(bogota.getHours()).padStart(2, '0');
  const min = String(bogota.getMinutes()).padStart(2, '0');
  const s = String(bogota.getSeconds()).padStart(2, '0');
  return { fecha: `${y}-${m}-${d}`, hora: `${h}:${min}:${s}-05:00` };
}

function hashDocumentoDev(tipo, parts) {
  const payload = [tipo, ...parts].join('|');
  return crypto.createHash('sha384').update(payload).digest('hex');
}

/**
 * Texto plano del QR de factura electrónica (formato DIAN).
 * @see Anexo técnico DIAN — sección 11.3 Código bidimensional QR
 */
function buildTextoQrFactura({
  numero,
  fechaEmision,
  nitEmisor,
  docAdquirente,
  valFac,
  valIva,
  valOtroIm = 0,
  valTolFac,
  cufe,
}) {
  const { fecha, hora } = fechaHoraBogota(fechaEmision);
  const uuid = String(cufe || '').trim();
  const lineas = [
    `NumFac: ${String(numero || '').trim()}`,
    `FecFac: ${fecha}`,
    `HorFac: ${hora}`,
    `NitFac: ${soloDigitos(nitEmisor)}`,
    `DocAdq: ${soloDigitos(docAdquirente)}`,
    `ValFac: ${fmtQrDecimal(valFac)}`,
    `ValIva: ${fmtQrDecimal(valIva)}`,
    `ValOtroIm: ${fmtQrDecimal(valOtroIm)}`,
    `ValTolFac: ${fmtQrDecimal(valTolFac)}`,
    `CUFE: ${uuid}`,
    `${URL_DIAN_QR}${uuid}`,
  ];
  return lineas.join('\n');
}

/**
 * Texto plano del QR de nota crédito electrónica (CUDE en lugar de CUFE).
 */
function buildTextoQrNotaCredito({
  numero,
  fechaEmision,
  nitEmisor,
  docAdquirente,
  valFac,
  valIva,
  valOtroIm = 0,
  valTolFac,
  cude,
}) {
  const { fecha, hora } = fechaHoraBogota(fechaEmision);
  const uuid = String(cude || '').trim();
  const lineas = [
    `NumFac: ${String(numero || '').trim()}`,
    `FecFac: ${fecha}`,
    `HorFac: ${hora}`,
    `NitFac: ${soloDigitos(nitEmisor)}`,
    `DocAdq: ${soloDigitos(docAdquirente)}`,
    `ValFac: ${fmtQrDecimal(valFac)}`,
    `ValIva: ${fmtQrDecimal(valIva)}`,
    `ValOtroIm: ${fmtQrDecimal(valOtroIm)}`,
    `ValTolFac: ${fmtQrDecimal(valTolFac)}`,
    `CUDE: ${uuid}`,
    `${URL_DIAN_QR}${uuid}`,
  ];
  return lineas.join('\n');
}

function resolverCufeFactura(doc, nitEmisor) {
  const existente = String(doc.cufe || '').trim();
  if (existente) return existente;
  return hashDocumentoDev('FE', [
    doc.numeroFactura,
    doc.referenceCode,
    soloDigitos(nitEmisor),
    doc.adquirente?.identificacion,
    doc.valorTotal,
    doc.emitidaAt || doc.createdAt,
  ]);
}

function resolverCudeNota(doc, nitEmisor) {
  const existente = String(doc.cude || '').trim();
  if (existente) return existente;
  return hashDocumentoDev('NC', [
    doc.numeroNota,
    doc.referenceCode,
    soloDigitos(nitEmisor),
    doc.adquirente?.identificacion,
    doc.valorTotal,
    doc.emitidaAt || doc.createdAt,
  ]);
}

async function generarQrDataUrl(texto) {
  if (!texto) return null;
  try {
    return await QRCode.toDataURL(texto, {
      width: 120,
      margin: 1,
      errorCorrectionLevel: 'M',
    });
  } catch {
    return null;
  }
}

module.exports = {
  URL_DIAN_QR,
  buildTextoQrFactura,
  buildTextoQrNotaCredito,
  resolverCufeFactura,
  resolverCudeNota,
  generarQrDataUrl,
  generarUuidDev: hashDocumentoDev,
  fmtQrDecimal,
  fechaHoraBogota,
};
