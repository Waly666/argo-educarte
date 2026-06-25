const Config = require('../models/Config');
const { ensureConfigDocument } = require('./configEnsure');

const CLAVE = 'migracion';

const DEFAULTS = {
  /** Interruptor maestro: matrícula histórica y recibos de migración. */
  movimientosHabilitados: false,
  /** Prefijo sugerido si no indican número de recibo del sistema anterior. */
  prefijoRecibo: 'MIG-',
};

async function obtenerConfigMigracion() {
  const doc = await ensureConfigDocument(CLAVE, DEFAULTS);
  return {
    movimientosHabilitados: doc.movimientosHabilitados === true,
    prefijoRecibo: String(doc.prefijoRecibo || DEFAULTS.prefijoRecibo).trim() || DEFAULTS.prefijoRecibo,
  };
}

async function actualizarConfigMigracion(patch = {}) {
  const actual = await obtenerConfigMigracion();
  const next = {
    movimientosHabilitados:
      patch.movimientosHabilitados !== undefined
        ? patch.movimientosHabilitados === true || patch.movimientosHabilitados === 'true'
        : actual.movimientosHabilitados,
    prefijoRecibo:
      patch.prefijoRecibo !== undefined
        ? String(patch.prefijoRecibo || DEFAULTS.prefijoRecibo).trim() || DEFAULTS.prefijoRecibo
        : actual.prefijoRecibo,
  };
  await Config.findOneAndUpdate(
    { clave: CLAVE },
    { $set: { clave: CLAVE, ...next } },
    { upsert: true },
  );
  return next;
}

module.exports = {
  CLAVE,
  DEFAULTS,
  obtenerConfigMigracion,
  actualizarConfigMigracion,
};
