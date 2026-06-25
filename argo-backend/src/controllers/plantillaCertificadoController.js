const PlantillaCertificado = require('../models/PlantillaCertificado');
const upload = require('../middleware/upload');

const { TIPOS_VALIDOS } = require('../services/clasificacionCertificado');

exports.listar = async (req, res, next) => {
  try {
    const q = {};
    if (req.query.tipo && TIPOS_VALIDOS.includes(req.query.tipo)) {
      q.tipoCertificado = req.query.tipo;
    }
    q.activa = { $ne: false };
    const rows = await PlantillaCertificado.find(q).sort({ tipoCertificado: 1, nombre: 1 }).lean();
    res.json(rows);
  } catch (e) {
    next(e);
  }
};

exports.listarTodas = async (_req, res, next) => {
  try {
    const rows = await PlantillaCertificado.find().sort({ nombre: 1 }).lean();
    res.json(rows);
  } catch (e) {
    next(e);
  }
};

exports.crear = async (req, res, next) => {
  try {
    const { nombre, orientacion, tipoCertificado } = req.body || {};
    if (!nombre?.trim()) return res.status(400).json({ message: 'El nombre es obligatorio' });
    if (!tipoCertificado || !TIPOS_VALIDOS.includes(tipoCertificado)) {
      return res.status(400).json({
        message:
          'tipoCertificado inválido (curso, tecnico, competencias, diplomado, licencia, mercancias_peligrosas, jornada_capacitacion)',
      });
    }
    const ori = orientacion === 'horizontal' ? 'horizontal' : 'vertical';
    let urlFondo = '';
    if (req.file?.filename) {
      urlFondo = upload.publicUrl('certificados', req.file.filename);
    }
    const doc = await PlantillaCertificado.create({
      nombre: nombre.trim(),
      tipoCertificado,
      orientacion: ori,
      urlFondo,
      activa: true,
    });
    res.status(201).json(doc);
  } catch (e) {
    next(e);
  }
};

exports.actualizar = async (req, res, next) => {
  try {
    const { nombre, orientacion, activa, tipoCertificado } = req.body || {};
    const dto = {};
    if (nombre != null) dto.nombre = String(nombre).trim();
    if (tipoCertificado && TIPOS_VALIDOS.includes(tipoCertificado)) dto.tipoCertificado = tipoCertificado;
    if (orientacion === 'horizontal' || orientacion === 'vertical') dto.orientacion = orientacion;
    if (activa != null) dto.activa = activa === true || activa === 'true';
    if (req.file?.filename) dto.urlFondo = upload.publicUrl('certificados', req.file.filename);

    const doc = await PlantillaCertificado.findByIdAndUpdate(req.params.id, { $set: dto }, { new: true }).lean();
    if (!doc) return res.status(404).json({ message: 'Plantilla no encontrada' });
    res.json(doc);
  } catch (e) {
    next(e);
  }
};

exports.eliminar = async (req, res, next) => {
  try {
    const doc = await PlantillaCertificado.findByIdAndUpdate(
      req.params.id,
      { $set: { activa: false } },
      { new: true },
    );
    if (!doc) return res.status(404).json({ message: 'Plantilla no encontrada' });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};
