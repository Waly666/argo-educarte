const { maxNumericId } = require('./programaServicio');
const { coerceDocument, num, isMoneyField } = require('../utils/coerceTypes');

function serializeCatalogRow(row, fields) {
  if (!row || typeof row !== 'object') return row;
  const out = { ...row };
  for (const k of fields) {
    if (!isMoneyField(k)) continue;
    const raw = out[k];
    out[k] = raw == null || raw === '' ? null : num(raw);
  }
  return out;
}

function pickFields(body, fields) {
  const dto = {};
  for (const k of fields) {
    if (body[k] !== undefined && body[k] !== '') dto[k] = body[k];
  }
  return dto;
}

function createCatalogController(Model, opts) {
  const { idField, fields, required = ['nombre'], searchFields = ['nombre'] } = opts;

  async function buscarPorId(id) {
    const q = String(id);
    const n = Number(q);
    return Model.findOne({
      $or: [{ [idField]: q }, ...(Number.isFinite(n) ? [{ [idField]: n }] : [])],
    }).lean();
  }

  return {
    listar: async (req, res, next) => {
      try {
        const q = (req.query.q || '').toString().trim();
        const filter = {};
        if (q.length >= 2) {
          const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
          filter.$or = searchFields.map((f) => ({ [f]: re }));
        }
        const soloActivos = req.query.activos !== 'false';
        if (soloActivos && fields.includes('estado')) {
          filter.estado = { $in: [/^activo$/i, 'activo', 'ACTIVO', 'Activo', null] };
        }
        const rows = await Model.find(filter).sort({ nombre: 1 }).lean();
        res.json(rows.map((r) => serializeCatalogRow(r, fields)));
      } catch (e) {
        next(e);
      }
    },

    obtener: async (req, res, next) => {
      try {
        const row = await buscarPorId(req.params.id);
        if (!row) return res.status(404).json({ message: 'Registro no encontrado' });
        res.json(serializeCatalogRow(row, fields));
      } catch (e) {
        next(e);
      }
    },

    crear: async (req, res, next) => {
      try {
        const dto = pickFields(req.body || {}, fields);
        for (const r of required) {
          if (!dto[r] || !String(dto[r]).trim()) {
            return res.status(400).json({ message: `${r} es obligatorio` });
          }
        }
        if (dto.nombre) dto.nombre = String(dto.nombre).trim();
        if (dto.estado == null) dto.estado = 'activo';
        const id = await maxNumericId(Model, idField);
        const user = req.user?.username || 'sistema';
        const now = new Date();
        const doc = coerceDocument({
          [idField]: id,
          ...dto,
          createdAt: now,
          updatedAt: now,
          userAddReg: user,
          userChangeRecord: user,
        });
        const created = await Model.create(doc);
        const row = created.toObject ? created.toObject() : created;
        res.status(201).json(serializeCatalogRow(row, fields));
      } catch (e) {
        next(e);
      }
    },

    actualizar: async (req, res, next) => {
      try {
        const row = await buscarPorId(req.params.id);
        if (!row) return res.status(404).json({ message: 'Registro no encontrado' });
        const dto = pickFields(req.body || {}, fields);
        if (dto.nombre) dto.nombre = String(dto.nombre).trim();
        const user = req.user?.username || 'sistema';
        const patch = coerceDocument({
          ...dto,
          updatedAt: new Date(),
          userChangeRecord: user,
        });
        await Model.updateOne({ [idField]: row[idField] }, { $set: patch });
        const actualizado = await Model.findOne({ [idField]: row[idField] }).lean();
        res.json(serializeCatalogRow(actualizado, fields));
      } catch (e) {
        next(e);
      }
    },

    eliminar: async (req, res, next) => {
      try {
        const row = await buscarPorId(req.params.id);
        if (!row) return res.status(404).json({ message: 'Registro no encontrado' });
        await Model.deleteOne({ [idField]: row[idField] });
        res.json({ ok: true });
      } catch (e) {
        next(e);
      }
    },
  };
}

module.exports = { createCatalogController, pickFields, num };
