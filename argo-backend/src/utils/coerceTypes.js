const mongoose = require('mongoose');

/** Lee número desde Number, string o BSON Decimal128. */
function num(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'object' && v.$numberDecimal != null) {
    return Number(v.$numberDecimal) || 0;
  }
  if (typeof v === 'object' && typeof v.toString === 'function' && v._bsontype === 'Decimal128') {
    return Number(v.toString()) || 0;
  }
  const n = Number(String(v).replace(/[^\d.,-]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function roundMoney(v) {
  return Math.round(num(v));
}

function toDec(v) {
  return mongoose.Types.Decimal128.fromString(String(roundMoney(v)));
}

/** Campos monetarios en pesos (enteros). */
function isMoneyField(key) {
  const k = String(key || '');
  if (/^tarifa\d*$/i.test(k)) return true;
  if (/^valor/i.test(k)) return true;
  if (/^salario/i.test(k)) return true;
  if (/^saldo$/i.test(k)) return true;
  if (/^abonado$/i.test(k)) return true;
  if (/^neto/i.test(k)) return true;
  if (/^ibc$/i.test(k)) return true;
  if (/^total/i.test(k) && /devengo|deduc|neto|patron|provis|costo/i.test(k)) return true;
  if (/valorMatricula|valorUnitario|valorEgreso|tarifaHoraPractica/i.test(k)) return true;
  return false;
}

/** Cantidades, porcentajes, horas, IDs numéricos. */
function isIntegerField(key) {
  const k = String(key || '');
  if (isMoneyField(k)) return false;
  if (/^id[A-Z_]/i.test(k) || /^idServ$|^idProg$|^idPrograma$/i.test(k)) return true;
  if (/^(cantidad|semestres|horas|horasTeoria|horasPractica|horasTaller|diasVencimiento|nivelRiesgo|horasSemanales|diasNovedad|numSemestre|iva|consecutivo)/i.test(k)) {
    return true;
  }
  return false;
}

function coerceFieldValue(key, value, { asDecimal128 = false } = {}) {
  if (value == null || value === '') return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'object' && !value.$numberDecimal && value._bsontype !== 'Decimal128') {
    return value;
  }

  if (isMoneyField(key)) {
    const n = roundMoney(value);
    return asDecimal128 ? toDec(n) : n;
  }
  if (isIntegerField(key)) {
    const n = Math.round(num(value));
    return Number.isFinite(n) ? n : null;
  }
  if (typeof value === 'string') {
    const t = value.trim();
    return t === '' ? null : t;
  }
  return value;
}

/** Normaliza un documento antes de guardar en catálogo o colección flexible. */
function coerceDocument(doc, opts = {}) {
  if (!doc || typeof doc !== 'object') return doc;
  const out = {};
  for (const [k, v] of Object.entries(doc)) {
    if (k === '_id' || k === '__v') continue;
    out[k] = coerceFieldValue(k, v, opts);
  }
  return out;
}

/** Recursivo para liquidación nómina (detalle anidado). */
function coerceDocumentDeep(doc, opts = {}) {
  if (doc == null) return doc;
  if (Array.isArray(doc)) return doc.map((x) => coerceDocumentDeep(x, opts));
  if (typeof doc !== 'object') return doc;
  const out = {};
  for (const [k, v] of Object.entries(doc)) {
    if (k === '_id' || k === '__v') continue;
    if (Array.isArray(v)) {
      out[k] = v.map((x) => coerceDocumentDeep(x, opts));
    } else if (v && typeof v === 'object' && !v.$numberDecimal && v._bsontype !== 'Decimal128') {
      out[k] = coerceDocumentDeep(v, opts);
    } else {
      out[k] = coerceFieldValue(k, v, opts);
    }
  }
  return out;
}

module.exports = {
  num,
  roundMoney,
  toDec,
  isMoneyField,
  isIntegerField,
  coerceFieldValue,
  coerceDocument,
  coerceDocumentDeep,
};
