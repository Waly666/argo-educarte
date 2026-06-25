const Config = require('../models/Config');

/** Obtiene o crea un documento config por clave (seguro en paralelo y tras restaurar). */
async function ensureConfigDocument(clave, defaults = {}) {
  const key = String(clave || '').trim();
  if (!key) throw new Error('Clave de configuración requerida');

  let doc = await Config.findOne({ clave: key }).lean();
  if (doc) return doc;

  try {
    return await Config.findOneAndUpdate(
      { clave: key },
      { $setOnInsert: { clave: key, ...defaults } },
      { upsert: true, new: true, lean: true },
    );
  } catch (e) {
    if (e.code === 11000) {
      doc = await Config.findOne({ clave: key }).lean();
      if (doc) return doc;
    }
    throw e;
  }
}

module.exports = { ensureConfigDocument };
