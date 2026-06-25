const mongoose = require('mongoose');
const { parseNumDoc } = require('../utils/numDoc');

/**
 * Convierte numDoc string → Number y elimina campo legacy numDocCanon si existía.
 */
async function normalizarNumDocAlumnos() {
  const col = mongoose.connection.collection('datosAlumnos');
  const rows = await col.find({}).toArray();
  let actualizados = 0;

  for (const r of rows) {
    const n = parseNumDoc(r.numDoc);
    const patch = {};
    if (n != null && r.numDoc !== n) patch.numDoc = n;
    if (r.numDocCanon != null) patch.numDocCanon = null;
    if (Object.keys(patch).length) {
      const $set = {};
      const $unset = {};
      if (patch.numDoc != null) $set.numDoc = patch.numDoc;
      if (patch.numDocCanon === null) $unset.numDocCanon = '';
      await col.updateOne({ _id: r._id }, { ...(Object.keys($set).length ? { $set } : {}), ...(Object.keys($unset).length ? { $unset } : {}) });
      actualizados += 1;
    }
  }

  try {
    await col.dropIndex('numDocCanon_1');
  } catch {
    /* no existe */
  }

  const DatosAlumno = require('../models/DatosAlumno');
  await DatosAlumno.syncIndexes();

  return { total: rows.length, actualizados };
}

module.exports = { normalizarNumDocAlumnos };
