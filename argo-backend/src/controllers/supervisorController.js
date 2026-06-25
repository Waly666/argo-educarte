const Supervisor = require('../models/Supervisor');
const { auditoriaUsuario } = require('../services/jornadaCapacitacion');

exports.listar = async (_req, res, next) => {
  try {
    const rows = await Supervisor.find({ activo: { $ne: false } }).sort({ nombre: 1 }).lean();
    res.json(rows);
  } catch (e) {
    next(e);
  }
};

exports.crear = async (req, res, next) => {
  try {
    const { nombre, documento, email, telefono } = req.body || {};
    if (!nombre?.trim()) return res.status(400).json({ message: 'nombre es obligatorio' });
    const doc = await Supervisor.create({
      nombre: nombre.trim(),
      documento: String(documento || '').trim(),
      email: String(email || '').trim(),
      telefono: String(telefono || '').trim(),
      userAddReg: auditoriaUsuario(req),
    });
    res.status(201).json(doc);
  } catch (e) {
    next(e);
  }
};

exports.actualizar = async (req, res, next) => {
  try {
    const { nombre, documento, email, telefono, activo } = req.body || {};
    const dto = { userChangeRecord: auditoriaUsuario(req) };
    if (nombre != null) dto.nombre = String(nombre).trim();
    if (documento != null) dto.documento = String(documento).trim();
    if (email != null) dto.email = String(email).trim();
    if (telefono != null) dto.telefono = String(telefono).trim();
    if (activo != null) dto.activo = activo === true || activo === 'true';
    const doc = await Supervisor.findByIdAndUpdate(req.params.id, { $set: dto }, { new: true }).lean();
    if (!doc) return res.status(404).json({ message: 'Supervisor no encontrado' });
    res.json(doc);
  } catch (e) {
    next(e);
  }
};
