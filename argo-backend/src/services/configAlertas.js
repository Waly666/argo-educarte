const Config = require('../models/Config');
const { GRUPOS } = require('../constants/alarmasCatalogo');

const CLAVE = 'alertasGlobal';

/** Valores por defecto por clave de alarma (comportamiento global; usuarios en Roles). */
const DEFAULTS_POR_CLAVE = {
  'alarmas.caja.cerrada': { activo: true, ventanaInicio: 'desde_registro', duracionMinutos: 0, intervaloPollSegundos: 30 },
  'alarmas.caja.sin_abrir': { activo: true, ventanaInicio: 'desde_registro', duracionMinutos: 0, intervaloPollSegundos: 0 },
  'alarmas.caja.descuadres': { activo: true, ventanaInicio: 'desde_inicio_dia', duracionMinutos: 0, intervaloPollSegundos: 60 },
  'alarmas.jornadas.en_proceso': { activo: true, ventanaInicio: 'desde_inicio_dia', duracionMinutos: 0, intervaloPollSegundos: 12 },
  'alarmas.jornadas.certificado_nuevo': { activo: true, ventanaInicio: 'desde_registro', duracionMinutos: 30, intervaloPollSegundos: 45 },
  'alarmas.jornadas.live_toast': { activo: true, ventanaInicio: 'desde_registro', duracionMinutos: 8, intervaloPollSegundos: 12 },
  'alarmas.instructores.clase_asignada': { activo: true, ventanaInicio: 'desde_registro', duracionMinutos: 30, intervaloPollSegundos: 20 },
  'alarmas.instructores.clase_proxima': { activo: true, ventanaInicio: 'desde_registro', duracionMinutos: 20, intervaloPollSegundos: 20, antelacionMinutos: 20 },
  'alarmas.instructores.inspeccion_requerida': { activo: true, ventanaInicio: 'desde_inicio_dia', duracionMinutos: 0, intervaloPollSegundos: 60 },
  'alarmas.programacion_cea.pendiente': { activo: true, ventanaInicio: 'desde_inicio_dia', duracionMinutos: 0, intervaloPollSegundos: 60 },
  'alarmas.programacion_cea.clase_proxima': { activo: true, ventanaInicio: 'desde_registro', duracionMinutos: 15, intervaloPollSegundos: 15, antelacionMinutos: 15 },
  'alarmas.vehiculos.docs_vencidos': { activo: true, ventanaInicio: 'desde_inicio_dia', duracionMinutos: 0, intervaloPollSegundos: 60 },
  'alarmas.vehiculos.docs_faltantes': { activo: true, ventanaInicio: 'desde_inicio_dia', duracionMinutos: 0, intervaloPollSegundos: 60 },
  'alarmas.vehiculos.inspeccion_pendiente': { activo: true, ventanaInicio: 'desde_inicio_dia', duracionMinutos: 0, intervaloPollSegundos: 60 },
  'alarmas.empleados.docs_vencidos': { activo: true, ventanaInicio: 'desde_inicio_dia', duracionMinutos: 0, intervaloPollSegundos: 60 },
  'alarmas.empleados.docs_faltantes': { activo: true, ventanaInicio: 'desde_inicio_dia', duracionMinutos: 0, intervaloPollSegundos: 60 },
  'alarmas.certificados.vencimiento': { activo: true, ventanaInicio: 'desde_inicio_dia', duracionMinutos: 0, intervaloPollSegundos: 60, diasAntelacion: 15 },
  'alarmas.certificados.vencidos': { activo: true, ventanaInicio: 'desde_inicio_dia', duracionMinutos: 0, intervaloPollSegundos: 60, diasGracia: 3 },
  'alarmas.alumnos.saldos': { activo: true, ventanaInicio: 'desde_inicio_dia', duracionMinutos: 0, intervaloPollSegundos: 0 },
  'alarmas.alumnos.documentos': { activo: true, ventanaInicio: 'desde_inicio_dia', duracionMinutos: 0, intervaloPollSegundos: 0 },
  'alarmas.alumnos.clases_cea_creado': { activo: true, ventanaInicio: 'desde_inicio_dia', duracionMinutos: 0, intervaloPollSegundos: 60 },
  'alarmas.alumnos.comprobante_ingreso': { activo: true, ventanaInicio: 'desde_inicio_dia', duracionMinutos: 60, intervaloPollSegundos: 12 },
  'alarmas.alumnos.comprobante_egreso': { activo: true, ventanaInicio: 'desde_inicio_dia', duracionMinutos: 60, intervaloPollSegundos: 12 },
  'alarmas.alumnos.factura': { activo: true, ventanaInicio: 'desde_registro', duracionMinutos: 45, intervaloPollSegundos: 12 },
  'alarmas.aula_virtual.foro_mensaje': { activo: true, ventanaInicio: 'desde_registro', duracionMinutos: 0, intervaloPollSegundos: 0 },
};

function reglaVacia(meta) {
  const base = DEFAULTS_POR_CLAVE[meta.key] || {
    activo: true,
    ventanaInicio: 'desde_registro',
    duracionMinutos: 30,
    intervaloPollSegundos: 60,
  };
  return {
    key: meta.key,
    label: meta.label,
    grupoId: meta.grupoId,
    grupoLabel: meta.grupoLabel,
    activo: base.activo !== false,
    ventanaInicio: base.ventanaInicio === 'desde_inicio_dia' ? 'desde_inicio_dia' : 'desde_registro',
    duracionMinutos: Math.max(0, Number(base.duracionMinutos) || 0),
    intervaloPollSegundos: Math.max(0, Number(base.intervaloPollSegundos) || 0),
    antelacionMinutos: Math.max(0, Number(base.antelacionMinutos) || 0),
    diasAntelacion: Math.max(0, Number(base.diasAntelacion) || 0),
    diasGracia: Math.max(0, Number(base.diasGracia) || 0),
  };
}

function catalogoMetadatos() {
  const out = [];
  for (const g of GRUPOS) {
    for (const a of g.alarmas) {
      out.push({
        key: a.key,
        label: a.label,
        grupoId: g.id,
        grupoLabel: g.label,
      });
    }
  }
  return out;
}

function normalizarRegla(raw, meta) {
  const r = { ...reglaVacia(meta), ...(raw || {}), key: meta.key, label: meta.label, grupoId: meta.grupoId, grupoLabel: meta.grupoLabel };
  r.activo = r.activo !== false && r.activo !== 'false';
  r.ventanaInicio = String(r.ventanaInicio || 'desde_registro') === 'desde_inicio_dia' ? 'desde_inicio_dia' : 'desde_registro';
  r.duracionMinutos = Math.max(0, Math.min(24 * 60, Number(r.duracionMinutos) || 0));
  r.intervaloPollSegundos = Math.max(0, Math.min(600, Number(r.intervaloPollSegundos) || 0));
  r.antelacionMinutos = Math.max(0, Math.min(120, Number(r.antelacionMinutos) || 0));
  r.diasAntelacion = Math.max(0, Math.min(90, Number(r.diasAntelacion) || 0));
  r.diasGracia = Math.max(0, Math.min(30, Number(r.diasGracia) || 0));
  return r;
}

async function obtenerConfigAlertas() {
  const doc = await Config.findOne({ clave: CLAVE }).lean();
  const mapa = new Map();
  for (const row of doc?.reglas || []) {
    if (row?.key) mapa.set(row.key, row);
  }
  return catalogoMetadatos().map((meta) => normalizarRegla(mapa.get(meta.key), meta));
}

async function reglaPorClave(key) {
  const reglas = await obtenerConfigAlertas();
  return reglas.find((r) => r.key === key) || null;
}

async function actualizarConfigAlertas(body, user) {
  const lista = Array.isArray(body?.reglas) ? body.reglas : [];
  const mapa = new Map(lista.map((x) => [x?.key, x]));
  const reglas = catalogoMetadatos().map((meta) => normalizarRegla(mapa.get(meta.key), meta));
  await Config.findOneAndUpdate(
    { clave: CLAVE },
    { $set: { clave: CLAVE, reglas, userChangeRecord: user || '' } },
    { upsert: true, new: true },
  );
  return reglas;
}

module.exports = {
  CLAVE,
  DEFAULTS_POR_CLAVE,
  catalogoMetadatos,
  obtenerConfigAlertas,
  reglaPorClave,
  actualizarConfigAlertas,
};
