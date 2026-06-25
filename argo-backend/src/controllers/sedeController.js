const Sede = require('../models/Sede');
const {
  asegurarSedePrincipal,
  listarSedesActivas,
  sedesPermitidasUsuario,
  normalizarIdSede,
} = require('../services/sedeContext');
const { esAdmin } = require('../utils/roles');
const { DETE_GEOREFE_VALORES } = require('../constants/jornadaCapacitacion');
const { aplicarPayloadOferta, mapOfertaFromDoc } = require('../services/sedeOferta');
const { sincronizarEncabezadoReciboDesdeSede } = require('../services/configRecibo');

function parseCoord(v) {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function mapSede(s) {
  if (!s) return null;
  const oferta = mapOfertaFromDoc(s);
  return {
    idSede: s.idSede,
    nombre: s.nombre,
    codigo: s.codigo || '',
    direccion: s.direccion || '',
    ciudad: s.ciudad || '',
    departamento: s.departamento || '',
    codMunicipio: s.codMunicipio || '',
    lat: s.lat ?? null,
    lng: s.lng ?? null,
    deteGeorefe: s.deteGeorefe || '',
    telefono: s.telefono || '',
    activa: s.activa !== false,
    esPrincipal: !!s.esPrincipal,
    ...oferta,
  };
}

function aplicarGeo(body, doc) {
  if (body.ciudad != null) doc.ciudad = String(body.ciudad).trim();
  if (body.departamento != null) doc.departamento = String(body.departamento).trim();
  if (body.codMunicipio != null) doc.codMunicipio = String(body.codMunicipio).trim();
  if (body.direccion != null) doc.direccion = String(body.direccion).trim();
  if (body.lat !== undefined) doc.lat = parseCoord(body.lat);
  if (body.lng !== undefined) doc.lng = parseCoord(body.lng);
  if (body.deteGeorefe !== undefined) {
    const d = String(body.deteGeorefe || '').trim();
    doc.deteGeorefe = DETE_GEOREFE_VALORES.includes(d) ? d : '';
  }
}

exports.mias = async (req, res, next) => {
  try {
    await asegurarSedePrincipal();
    const rows = await sedesPermitidasUsuario(req.user.sub, req.user.rol);
    res.json(rows.map(mapSede));
  } catch (e) {
    next(e);
  }
};

exports.listar = async (req, res, next) => {
  try {
    await asegurarSedePrincipal();
    const rows = esAdmin(req.user?.rol) ? await Sede.find({}).sort({ nombre: 1 }).lean() : await listarSedesActivas();
    res.json(rows.map(mapSede));
  } catch (e) {
    next(e);
  }
};

exports.crear = async (req, res, next) => {
  try {
    const body = req.body || {};
    const idSede = normalizarIdSede(body.idSede || body.codigo);
    const nombre = String(body.nombre || '').trim();
    if (!idSede || !nombre) {
      return res.status(400).json({ message: 'idSede y nombre son obligatorios' });
    }
    const existe = await Sede.findOne({ idSede }).lean();
    if (existe) return res.status(409).json({ message: 'Ya existe una sede con ese idSede' });
    if (body.esPrincipal) {
      await Sede.updateMany({}, { $set: { esPrincipal: false } });
    }
    const payload = {
      idSede: idSede.toUpperCase(),
      nombre,
      codigo: String(body.codigo || idSede).trim(),
      telefono: String(body.telefono || '').trim(),
      activa: body.activa !== false,
      esPrincipal: !!body.esPrincipal,
      userAddReg: req.user?.username || 'sistema',
    };
    aplicarGeo(body, payload);
    aplicarPayloadOferta(body, payload);
    const doc = await Sede.create(payload);
    await sincronizarEncabezadoReciboDesdeSede(doc.idSede);
    res.status(201).json(mapSede(doc.toObject()));
  } catch (e) {
    next(e);
  }
};

exports.actualizar = async (req, res, next) => {
  try {
    const idSede = normalizarIdSede(req.params.idSede);
    const doc = await Sede.findOne({ idSede });
    if (!doc) return res.status(404).json({ message: 'Sede no encontrada' });
    const body = req.body || {};
    if (body.nombre != null) doc.nombre = String(body.nombre).trim();
    if (body.codigo != null) doc.codigo = String(body.codigo).trim();
    if (body.telefono != null) doc.telefono = String(body.telefono).trim();
    if (body.activa != null) doc.activa = !!body.activa;
    if (body.esPrincipal) {
      await Sede.updateMany({ _id: { $ne: doc._id } }, { $set: { esPrincipal: false } });
      doc.esPrincipal = true;
    }
    aplicarGeo(body, doc);
    aplicarPayloadOferta(body, doc);
    doc.userChangeRecord = req.user?.username || 'sistema';
    await doc.save();
    await sincronizarEncabezadoReciboDesdeSede(doc.idSede);
    res.json(mapSede(doc.toObject()));
  } catch (e) {
    next(e);
  }
};
