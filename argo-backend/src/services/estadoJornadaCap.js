const Contratacion = require('../models/Contratacion');
const JornadaCap = require('../models/JornadaCap');
const {
  ESTADO_JORNADA_INACTIVO,
  ESTADO_JORNADA_EN_PROCESO,
  ESTADO_JORNADA_FINALIZADO,
} = require('../constants/jornadaCapacitacion');
const { parseFechaCalendario } = require('../utils/fechaCalendario');
const { contratoEstaEnEjecucion } = require('./contratoFinalizacionCap');

function inicioDia(fecha) {
  return parseFechaCalendario(fecha);
}

/** INACTIVO (futura) → EN PROCESO (día programado) → FINALIZADO (días pasados). */
function estadoJornadaPorFecha(fechaProgramacion, hoy = new Date()) {
  const prog = inicioDia(fechaProgramacion);
  const ref = inicioDia(hoy);
  if (prog.getTime() > ref.getTime()) return ESTADO_JORNADA_INACTIVO;
  if (prog.getTime() === ref.getTime()) return ESTADO_JORNADA_EN_PROCESO;
  return ESTADO_JORNADA_FINALIZADO;
}

async function sincronizarEstadoJornada(jornadaOrId) {
  let j = null;
  if (
    typeof jornadaOrId === 'object' &&
    jornadaOrId != null &&
    jornadaOrId.fechaProgramacion != null
  ) {
    j = jornadaOrId;
  } else {
    const id = jornadaOrId?._id ?? jornadaOrId;
    j = await JornadaCap.findById(id).lean();
  }
  if (!j) return null;
  let esperado = estadoJornadaPorFecha(j.fechaProgramacion);
  if (j.idContrato) {
    const c = await Contratacion.findById(j.idContrato).select('estado').lean();
    if (c && !contratoEstaEnEjecucion(c.estado)) {
      esperado = ESTADO_JORNADA_FINALIZADO;
    }
  }
  if (j.estado !== esperado) {
    await JornadaCap.updateOne({ _id: j._id }, { $set: { estado: esperado } });
    return { ...j, estado: esperado };
  }
  return j;
}

async function sincronizarEstadosJornadas(rows) {
  const out = [];
  for (const row of rows) {
    out.push(await sincronizarEstadoJornada(row));
  }
  return out;
}

function jornadaOperableHoy(jornada, hoy = new Date()) {
  if (!jornada?.fechaProgramacion) return false;
  return estadoJornadaPorFecha(jornada.fechaProgramacion, hoy) === ESTADO_JORNADA_EN_PROCESO;
}

/** Solo el día programado = hoy (calendario local del servidor). */
function mensajeSiJornadaNoOperable(jornada) {
  if (!jornada?.fechaProgramacion) return 'Jornada no encontrada';
  const estado = estadoJornadaPorFecha(jornada.fechaProgramacion);
  if (estado === ESTADO_JORNADA_INACTIVO) {
    return 'Solo puede operar en la jornada el día programado (aún no es ese día).';
  }
  if (estado === ESTADO_JORNADA_FINALIZADO) {
    return 'La jornada ya finalizó. No se puede operar en fechas pasadas.';
  }
  return null;
}

/** Solo se puede iniciar una clase el mismo día de la jornada (diasHasta === 0). */
function mensajeSiJornadaNoIniciableClase(jornada) {
  if (!jornada?.fechaProgramacion) return 'Jornada no encontrada';
  const dias = diasHastaJornada(jornada.fechaProgramacion);
  if (dias > 0) {
    return `Solo puede iniciar la clase el día de la jornada (faltan ${dias} día(s)).`;
  }
  if (dias < 0) {
    return 'La jornada ya finalizó. No se puede iniciar la clase.';
  }
  if (estadoJornadaPorFecha(jornada.fechaProgramacion) !== ESTADO_JORNADA_EN_PROCESO) {
    return 'La jornada no está EN PROCESO hoy.';
  }
  return null;
}

const MS_DIA = 24 * 60 * 60 * 1000;

/** Distancia en días entre la fecha de la jornada y la fecha de referencia (hoy). */
function diasHastaJornada(fechaProgramacion, hoy = new Date()) {
  const prog = inicioDia(fechaProgramacion).getTime();
  const ref = inicioDia(hoy).getTime();
  return Math.round((prog - ref) / MS_DIA);
}

/** True si la jornada es hoy o mañana (ventana de creación de clases). */
function jornadaEnVentanaCreacionClase(jornada, hoy = new Date()) {
  if (!jornada?.fechaProgramacion) return false;
  const dias = diasHastaJornada(jornada.fechaProgramacion, hoy);
  return dias === 0 || dias === 1;
}

/**
 * Solo se permite crear clases el día anterior o el día de la jornada.
 * - Antes de eso: jornada aún muy lejana.
 * - Después: jornada ya finalizada.
 */
function mensajeSiJornadaNoDisponibleParaClase(jornada) {
  if (!jornada) return 'Jornada no encontrada';
  const dias = diasHastaJornada(jornada.fechaProgramacion);
  if (dias > 1) {
    return 'Solo puede crear clases el día anterior o el mismo día de la jornada.';
  }
  if (dias < 0) {
    return 'No se pueden crear clases en jornadas ya finalizadas.';
  }
  return null;
}

async function migrarEstadosJornadaCap() {
  const rows = await JornadaCap.find().select('_id fechaProgramacion estado').lean();
  let n = 0;
  for (const j of rows) {
    const esperado = estadoJornadaPorFecha(j.fechaProgramacion);
    if (j.estado !== esperado) {
      await JornadaCap.updateOne({ _id: j._id }, { $set: { estado: esperado } });
      n += 1;
    }
  }
  if (n > 0) console.log(`[ARGO] Jornadas Cap.: ${n} estado(s) sincronizado(s) por fecha`);
}

/** Rellena fechaClase en clases antiguas a partir de la jornada vinculada. */
async function migrarFechaClaseCap() {
  const ClaseJornadaCap = require('../models/ClaseJornadaCap');
  const sinFecha = await ClaseJornadaCap.find({
    $or: [{ fechaClase: null }, { fechaClase: { $exists: false } }],
  })
    .select('_id idJornada')
    .lean();
  let n = 0;
  for (const c of sinFecha) {
    const j = await JornadaCap.findById(c.idJornada).select('fechaProgramacion').lean();
    if (!j?.fechaProgramacion) continue;
    await ClaseJornadaCap.updateOne(
      { _id: c._id },
      { $set: { fechaClase: inicioDia(j.fechaProgramacion) } },
    );
    n += 1;
  }
  if (n > 0) console.log(`[ARGO] Clases jornada: ${n} fechaClase rellenada(s)`);
}

/** Copia urlFoto legado a urlforo si aplica. */
async function migrarUrlforoClaseCap() {
  const ClaseJornadaCap = require('../models/ClaseJornadaCap');
  const r = await ClaseJornadaCap.updateMany(
    { urlFoto: { $exists: true, $nin: [null, ''] }, urlforo: { $in: [null, '', undefined] } },
    [{ $set: { urlforo: '$urlFoto' } }],
  );
  if (r.modifiedCount > 0) {
    console.log(`[ARGO] Clases jornada: ${r.modifiedCount} urlforo migrada(s) desde urlFoto`);
  }
}

module.exports = {
  inicioDia,
  estadoJornadaPorFecha,
  sincronizarEstadoJornada,
  sincronizarEstadosJornadas,
  jornadaOperableHoy,
  jornadaEnVentanaCreacionClase,
  diasHastaJornada,
  mensajeSiJornadaNoOperable,
  mensajeSiJornadaNoIniciableClase,
  mensajeSiJornadaNoDisponibleParaClase,
  migrarEstadosJornadaCap,
  migrarFechaClaseCap,
  migrarUrlforoClaseCap,
};
