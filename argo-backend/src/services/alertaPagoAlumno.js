const DatosAlumno = require('../models/DatosAlumno');
const { normalizarFrecuenciaAlertaPago } = require('../constants/alertaPago');
const { numDocQuery } = require('../utils/numDoc');
const {
  partesCalendarioColombia,
  partesFechaSoloAlmacenada,
  diffDiasCalendario,
} = require('../utils/timezoneColombia');

/** ¿Hoy (Colombia) corresponde cobrar según frecuencia y fecha ancla? */
function esDiaAlertaPago(frecuencia, fechaAncla, hoy = new Date()) {
  const f = normalizarFrecuenciaAlertaPago(frecuencia);
  if (!f || !fechaAncla) return false;

  const hCol = partesCalendarioColombia(hoy);
  const a = partesFechaSoloAlmacenada(fechaAncla);
  if (!hCol || !a) return false;

  if (f === 'mensual') {
    return hCol.d === a.d;
  }
  if (f === 'quincenal') {
    const diffDays = diffDiasCalendario(a, hCol);
    return diffDays >= 0 && diffDays % 15 === 0;
  }
  return false;
}

function nombreCompletoAlumno(a) {
  return [a.nombre1, a.nombre2, a.apellido1, a.apellido2].filter(Boolean).join(' ').trim();
}

function normalizarAlertaPagoEnDto(dto) {
  if (!dto || typeof dto !== 'object') return;
  const tieneFrec = dto.alertaPagoFrecuencia !== undefined;
  const tieneFecha = dto.alertaPago !== undefined;
  if (!tieneFrec && !tieneFecha) return;

  const f = normalizarFrecuenciaAlertaPago(dto.alertaPagoFrecuencia);
  if (!f) {
    delete dto.alertaPagoFrecuencia;
    delete dto.alertaPago;
    return;
  }
  dto.alertaPagoFrecuencia = f;

  if (!dto.alertaPago) {
    delete dto.alertaPagoFrecuencia;
    delete dto.alertaPago;
    return;
  }
  const d = new Date(dto.alertaPago);
  if (Number.isNaN(d.getTime())) {
    delete dto.alertaPagoFrecuencia;
    delete dto.alertaPago;
    return;
  }
  dto.alertaPago = d;
}

async function limpiarAlertaPagoPorNumDoc(numDoc) {
  const q = numDocQuery(numDoc);
  if (!q) return { ok: false };
  await DatosAlumno.updateOne(q, {
    $unset: { alertaPagoFrecuencia: '', alertaPago: '' },
    $set: { fechaMod: new Date() },
  });
  return { ok: true };
}

async function listarAlertasPagoHoy(hoy = new Date()) {
  const rows = await DatosAlumno.find({
    alertaPagoFrecuencia: { $in: ['quincenal', 'mensual'] },
    alertaPago: { $ne: null },
  })
    .select('_id numDoc apellido1 apellido2 nombre1 nombre2 celular alertaPagoFrecuencia alertaPago')
    .lean();

  return rows
    .filter((a) => esDiaAlertaPago(a.alertaPagoFrecuencia, a.alertaPago, hoy))
    .map((a) => ({
      alumnoId: String(a._id),
      numDoc: a.numDoc,
      nombreCompleto: nombreCompletoAlumno(a),
      celular: a.celular || null,
      alertaPagoFrecuencia: a.alertaPagoFrecuencia,
      alertaPago: a.alertaPago,
    }));
}

module.exports = {
  esDiaAlertaPago,
  normalizarAlertaPagoEnDto,
  limpiarAlertaPagoPorNumDoc,
  listarAlertasPagoHoy,
};
