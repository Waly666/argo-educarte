/** Cédula / NUIP Colombia: mínimo histórico 6, capacidad hasta 14 dígitos. */
const NUM_DOC_MIN_DIGITS = 6;
const NUM_DOC_MAX_DIGITS = 14;

function numDocInvalidMessage() {
  return `Número de documento inválido (use ${NUM_DOC_MIN_DIGITS} a ${NUM_DOC_MAX_DIGITS} dígitos)`;
}

function isValidNumDocDigits(digits) {
  return digits.length >= NUM_DOC_MIN_DIGITS && digits.length <= NUM_DOC_MAX_DIGITS;
}

/**
 * numDoc en datosAlumnos y tablas relacionadas: Number (double en MongoDB).
 * Acepta entrada con puntos/espacios (ej. 1.017.204.030).
 */
function parseNumDoc(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const n = Math.trunc(value);
    return n > 0 ? n : null;
  }
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return null;
  const n = Number(digits);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (!isValidNumDocDigits(digits)) return null;
  return n;
}

function numDocFromParams(param) {
  return parseNumDoc(param);
}

function numDocEquals(a, b) {
  const na = parseNumDoc(a);
  const nb = parseNumDoc(b);
  return na != null && nb != null && na === nb;
}

/** Para respuestas API / UI (sin notación científica) */
function numDocToString(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(Math.trunc(value));
  }
  const digits = String(value).replace(/\D/g, '');
  return digits || String(value).trim();
}

/** Filtro Mongoose (numDoc siempre Number tras normalización). */
function numDocQuery(value) {
  const n = parseNumDoc(value);
  if (n == null) return null;
  return { numDoc: n };
}

/**
 * Colección nativa: detecta numDoc legacy string hasta migrar a Number.
 */
function numDocQueryNativo(value) {
  const n = parseNumDoc(value);
  if (n == null) return null;
  const s = String(n);
  return {
    $or: [{ numDoc: n }, { numDoc: s }, { $expr: { $eq: [{ $toString: '$numDoc' }, s] } }],
  };
}

module.exports = {
  NUM_DOC_MIN_DIGITS,
  NUM_DOC_MAX_DIGITS,
  numDocInvalidMessage,
  isValidNumDocDigits,
  parseNumDoc,
  numDocFromParams,
  numDocEquals,
  numDocToString,
  numDocQuery,
  numDocQueryNativo,
};
