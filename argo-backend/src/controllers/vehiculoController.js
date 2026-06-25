const mongoose = require('mongoose');
const Vehiculo = require('../models/Vehiculo');
const DocVehiculo = require('../models/DocVehiculo');
const { models } = require('../models/catalogos');
const upload = require('../middleware/upload');
const { enriquecerIndicadoresLista } = require('../services/vehiculoIndicadores');
const {
  calcularDocumentosRequeridos,
  validarDocumentosPendientesVehiculo,
  validarFechasDocumentoVehiculo,
  enriquecerDocumentoRegistrado,
} = require('../services/vehiculoDocumentos');
const { obtenerConfigRequisitosDocumentosVehiculos } = require('../services/configRequisitosDocumentosVehiculos');
const { calcularAlertasDocumentosVehiculos, calcularAlertasDocsFaltantesVehiculos } = require('../services/vehiculoAlertasDocumentos');
const {
  TIPOS_SERVICIO,
  MODALIDADES,
  COMBUSTIBLES,
  ESTADOS_VEHICULO,
  normalizarPlaca,
  parseCarrocerias,
} = require('../constants/vehiculo');

const marcaModel = models.marcasVehiculos;
const lineaModel = models.lineasVehiculos;
const colorModel = models.coloresVehiculos;
const claseModel = models.claseVehiculo;
const itemDocModel = models.itemDocumentosVehiculo;

function escRegex(s) {
  return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Prefijo o inicio de palabra (evita que "TO" coincida con "MOTOR"). */
function regexBusquedaIncremental(q) {
  const t = String(q || '').trim();
  if (!t) return null;
  const e = escRegex(t);
  return new RegExp(`(^|[\\s(/\\-])${e}`, 'i');
}

function filtroTextoIncremental(q, campos) {
  const re = regexBusquedaIncremental(q);
  if (!re) return null;
  return { $or: campos.map((campo) => ({ [campo]: re })) };
}

const VEHICULO_FIELDS = [
  'placa',
  'codigoMarca',
  'nombreMarca',
  'codigoLinea',
  'nombreLinea',
  'modelo',
  'idClase',
  'claseVehiculo',
  'idColor',
  'color',
  'tipoServicio',
  'carroceria',
  'modalidad',
  'cilindraje',
  'numeroMotor',
  'numeroChasis',
  'serie',
  'tonelaje',
  'pasajeros',
  'combustible',
  'numeroLicencia',
  'observaciones',
  'estado',
];

const SORT_KEYS = {
  placa: ['placa'],
  marca: ['nombreMarca', 'placa'],
  linea: ['nombreLinea', 'placa'],
  modelo: ['modelo', 'placa'],
  clase: ['claseVehiculo', 'placa'],
  color: ['color', 'placa'],
  estado: ['estado', 'placa'],
};

function pickFields(body, fields) {
  const out = {};
  for (const k of fields) {
    if (body[k] !== undefined && body[k] !== '') out[k] = body[k];
  }
  return out;
}

function resolveSort(sortRaw, dirRaw) {
  const key = String(sortRaw || '').trim();
  const dir = String(dirRaw || '').toLowerCase() === 'desc' ? -1 : 1;
  const fields = SORT_KEYS[key] || SORT_KEYS.placa;
  const out = {};
  for (const f of fields) out[f] = dir;
  return out;
}

function mapListaItem(doc) {
  return {
    _id: doc._id,
    placa: doc.placa,
    codigoMarca: doc.codigoMarca,
    nombreMarca: doc.nombreMarca,
    codigoLinea: doc.codigoLinea,
    nombreLinea: doc.nombreLinea,
    modelo: doc.modelo,
    idClase: doc.idClase,
    claseVehiculo: doc.claseVehiculo,
    color: doc.color,
    tipoServicio: doc.tipoServicio,
    carroceria: doc.carroceria,
    modalidad: doc.modalidad,
    combustible: doc.combustible,
    estado: doc.estado || 'Libre',
    urlFoto: doc.urlFoto,
  };
}

function pickVehiculo(body) {
  const dto = pickFields(body, VEHICULO_FIELDS);
  if (dto.placa) dto.placa = normalizarPlaca(dto.placa);
  if (dto.tipoServicio) dto.tipoServicio = String(dto.tipoServicio).trim().toUpperCase();
  if (dto.modalidad) dto.modalidad = String(dto.modalidad).trim().toUpperCase();
  if (dto.combustible) dto.combustible = String(dto.combustible).trim().toUpperCase();
  if (dto.estado) {
    const e = String(dto.estado).trim();
    dto.estado = e.charAt(0).toUpperCase() + e.slice(1).toLowerCase();
  }
  return dto;
}

function aplicarFoto(dto, file) {
  if (file) dto.urlFoto = upload.publicUrl('vehiculos', file.filename);
}

async function buscarVehiculo(id) {
  const q = String(id);
  if (mongoose.Types.ObjectId.isValid(q)) {
    const byId = await Vehiculo.findById(q).lean();
    if (byId) return byId;
  }
  return Vehiculo.findOne({ placa: normalizarPlaca(q) }).lean();
}

async function enriquecerDocumentos(placa) {
  const config = await obtenerConfigRequisitosDocumentosVehiculos();
  const docs = await DocVehiculo.find({ placa: normalizarPlaca(placa) })
    .sort({ documento: 1 })
    .lean();
  return Promise.all(docs.map((d) => enriquecerDocumentoRegistrado(d, config)));
}

exports.meta = (_req, res) => {
  res.json({
    tiposServicio: TIPOS_SERVICIO,
    modalidades: MODALIDADES,
    combustibles: COMBUSTIBLES,
    estados: ESTADOS_VEHICULO,
  });
};

/** Resumen de vencimientos de documentos — visible para cualquier usuario autenticado. */
exports.alertasDocumentos = async (_req, res, next) => {
  try {
    const data = await calcularAlertasDocumentosVehiculos();
    res.json(data);
  } catch (e) {
    next(e);
  }
};

/** Documentos requeridos no registrados por vehículo — alerta global. */
exports.alertasDocumentosFaltantes = async (_req, res, next) => {
  try {
    const data = await calcularAlertasDocsFaltantesVehiculos();
    res.json(data);
  } catch (e) {
    next(e);
  }
};

exports.listarMarcas = async (req, res, next) => {
  try {
    const q = (req.query.q || '').toString().trim();
    const limit = Number(req.query.limit) || (q.length >= 1 ? 35 : 500);
    let filter = {};
    if (q.length >= 1) {
      const texto = filtroTextoIncremental(q, ['nombreMarca']);
      const codigo = new RegExp(`^${escRegex(q)}`, 'i');
      filter = texto ? { $or: [...texto.$or, { codigoMarca: codigo }] } : { codigoMarca: codigo };
    }
    const rows = await marcaModel.find(filter).sort({ nombreMarca: 1 }).limit(limit).lean();
    res.json(rows);
  } catch (e) {
    next(e);
  }
};

exports.listarLineas = async (req, res, next) => {
  try {
    const codigoMarca = (req.query.codigoMarca || '').toString().trim();
    if (!codigoMarca) {
      return res.status(400).json({ message: 'codigoMarca es obligatorio' });
    }
    const q = (req.query.q || '').toString().trim();
    const filter = { codigoMarca };
    if (q.length >= 1) {
      const texto = filtroTextoIncremental(q, ['nombreLinea']);
      const codigo = new RegExp(`^${escRegex(q)}`, 'i');
      filter.$or = texto ? [...texto.$or, { codigoLinea: codigo }] : [{ codigoLinea: codigo }];
    }
    const rows = await lineaModel
      .find(filter)
      .sort({ nombreLinea: 1 })
      .limit(Number(req.query.limit) || (q.length >= 1 ? 40 : 200))
      .lean();
    res.json(rows);
  } catch (e) {
    next(e);
  }
};

exports.listarColores = async (req, res, next) => {
  try {
    const q = (req.query.q || '').toString().trim();
    if (q.length < 2) return res.json([]);
    const texto = filtroTextoIncremental(q, ['descripcion']);
    if (!texto) return res.json([]);
    const rows = await colorModel
      .find(texto)
      .sort({ descripcion: 1 })
      .limit(Number(req.query.limit) || 35)
      .lean();
    res.json(rows);
  } catch (e) {
    next(e);
  }
};

exports.listarClases = async (_req, res, next) => {
  try {
    const rows = await claseModel.find({}).sort({ idClase: 1 }).lean();
    res.json(
      rows.map((r) => ({
        ...r,
        carroceriasLista: parseCarrocerias(r.carrocerias),
      })),
    );
  } catch (e) {
    next(e);
  }
};

exports.listarTiposDocumento = async (_req, res, next) => {
  try {
    const rows = await itemDocModel.find({}).sort({ idDocVehi: 1 }).lean();
    res.json(rows);
  } catch (e) {
    next(e);
  }
};

exports.verificarPlaca = async (req, res, next) => {
  try {
    const placa = normalizarPlaca(req.params.placa);
    if (!placa) return res.status(400).json({ message: 'Placa inválida' });
    const excluir = (req.query.excluirId || '').toString().trim();
    const filter = { placa };
    if (excluir && mongoose.Types.ObjectId.isValid(excluir)) {
      filter._id = { $ne: new mongoose.Types.ObjectId(excluir) };
    }
    const doc = await Vehiculo.findOne(filter).select('_id placa nombreMarca nombreLinea modelo').lean();
    res.json({ existe: !!doc, vehiculo: doc || null });
  } catch (e) {
    next(e);
  }
};

exports.listar = async (req, res, next) => {
  try {
    const q = (req.query.q || '').toString().trim();
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const skip = (page - 1) * limit;
    const filter = {};
    if (req.idSede) filter.idSede = req.idSede;

    if (q.length >= 2) {
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { placa: re },
        { nombreMarca: re },
        { nombreLinea: re },
        { modelo: re },
        { claseVehiculo: re },
        { color: re },
        { numeroMotor: re },
        { numeroChasis: re },
      ];
    }

    const sort = resolveSort(req.query.sort, req.query.dir);
    const [total, docs] = await Promise.all([
      Vehiculo.countDocuments(filter),
      Vehiculo.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    ]);

    const items = await enriquecerIndicadoresLista(docs.map(mapListaItem));

    res.json({
      items,
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (e) {
    next(e);
  }
};

exports.porId = async (req, res, next) => {
  try {
    const doc = await buscarVehiculo(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Vehículo no encontrado' });
    const documentos = await enriquecerDocumentos(doc.placa);
    res.json({ ...doc, documentos });
  } catch (e) {
    next(e);
  }
};

exports.crear = async (req, res, next) => {
  try {
    const dto = pickVehiculo(req.body);
    aplicarFoto(dto, req.file);
    if (!dto.placa) return res.status(400).json({ message: 'La placa es obligatoria' });

    const dup = await Vehiculo.findOne({ placa: dto.placa }).lean();
    if (dup) {
      return res.status(409).json({
        message: 'Ya existe un vehículo con esa placa',
        existingId: dup._id,
        placa: dup.placa,
      });
    }

    const user = req.user?.username || 'sistema';
    const now = new Date();
    const doc = await Vehiculo.create({
      ...dto,
      idSede: req.idSede || dto.idSede || '',
      estado: dto.estado || 'Libre',
      fechaAudi: now,
      userAddReg: user,
      userChangeRecord: user,
    });
    res.status(201).json(doc.toObject());
  } catch (e) {
    if (e?.code === 11000) {
      return res.status(409).json({ message: 'Ya existe un vehículo con esa placa' });
    }
    next(e);
  }
};

exports.actualizar = async (req, res, next) => {
  try {
    const prev = await buscarVehiculo(req.params.id);
    if (!prev) return res.status(404).json({ message: 'Vehículo no encontrado' });

    const dto = pickVehiculo(req.body);
    aplicarFoto(dto, req.file);

    if (dto.placa && dto.placa !== prev.placa) {
      const dup = await Vehiculo.findOne({ placa: dto.placa, _id: { $ne: prev._id } }).lean();
      if (dup) {
        return res.status(409).json({
          message: 'Ya existe un vehículo con esa placa',
          existingId: dup._id,
        });
      }
    }

    const user = req.user?.username || 'sistema';
    const now = new Date();
    const placaAnterior = prev.placa;
    const placaNueva = dto.placa || placaAnterior;

    const updated = await Vehiculo.findByIdAndUpdate(
      prev._id,
      {
        $set: {
          ...dto,
          userChangeRecord: user,
          fechaMod: now,
        },
      },
      { new: true, runValidators: true },
    ).lean();

    if (placaNueva !== placaAnterior) {
      await DocVehiculo.updateMany({ placa: placaAnterior }, { $set: { placa: placaNueva } });
    }

    res.json(updated);
  } catch (e) {
    if (e?.code === 11000) {
      return res.status(409).json({ message: 'Ya existe un vehículo con esa placa' });
    }
    next(e);
  }
};

exports.eliminar = async (req, res, next) => {
  try {
    const prev = await buscarVehiculo(req.params.id);
    if (!prev) return res.status(404).json({ message: 'Vehículo no encontrado' });
    await DocVehiculo.deleteMany({ placa: prev.placa });
    await Vehiculo.deleteOne({ _id: prev._id });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};

exports.listarDocumentos = async (req, res, next) => {
  try {
    const veh = await buscarVehiculo(req.params.id);
    if (!veh) return res.status(404).json({ message: 'Vehículo no encontrado' });
    const documentos = await enriquecerDocumentos(veh.placa);
    res.json(documentos);
  } catch (e) {
    next(e);
  }
};

exports.documentosRequeridos = async (req, res, next) => {
  try {
    const veh = await buscarVehiculo(req.params.id);
    if (!veh) return res.status(404).json({ message: 'Vehículo no encontrado' });
    res.json(await calcularDocumentosRequeridos(veh));
  } catch (e) {
    next(e);
  }
};

exports.documentosValidacion = async (req, res, next) => {
  try {
    const veh = await buscarVehiculo(req.params.id);
    if (!veh) return res.status(404).json({ message: 'Vehículo no encontrado' });
    res.json(await validarDocumentosPendientesVehiculo(veh));
  } catch (e) {
    next(e);
  }
};

function pickDocumento(body) {
  const dto = {};
  if (body.idDocVehi != null && body.idDocVehi !== '') dto.idDocVehi = body.idDocVehi;
  if (body.documento != null) dto.documento = String(body.documento).trim();
  if (body.numero != null) dto.numero = String(body.numero).trim();
  if (body.fechaExp) dto.fechaExp = new Date(body.fechaExp);
  if (body.fechaVence) dto.fechaVence = new Date(body.fechaVence);
  return dto;
}

exports.crearDocumento = async (req, res, next) => {
  try {
    const veh = await buscarVehiculo(req.params.id);
    if (!veh) return res.status(404).json({ message: 'Vehículo no encontrado' });

    const dto = pickDocumento(req.body);
    if (!dto.documento && dto.idDocVehi != null) {
      const tipo = await itemDocModel.findOne({ idDocVehi: dto.idDocVehi }).lean();
      if (tipo?.documentoVehi) dto.documento = String(tipo.documentoVehi).trim();
    }
    if (!dto.documento) return res.status(400).json({ message: 'documento es obligatorio' });

    const valFechas = await validarFechasDocumentoVehiculo(dto);
    if (!valFechas.ok) return res.status(valFechas.status).json({ message: valFechas.message });

    if (req.file) dto.urlArchivo = upload.publicUrl('vehiculos', req.file.filename);

    const user = req.user?.username || 'sistema';
    const now = new Date();
    const doc = await DocVehiculo.create({
      ...dto,
      placa: veh.placa,
      fechaAudi: now,
      userAddReg: user,
      userChangeRecord: user,
    });
    res.status(201).json(doc.toObject());
  } catch (e) {
    next(e);
  }
};

exports.actualizarDocumento = async (req, res, next) => {
  try {
    const veh = await buscarVehiculo(req.params.id);
    if (!veh) return res.status(404).json({ message: 'Vehículo no encontrado' });

    const docPrev = await DocVehiculo.findOne({
      _id: req.params.docId,
      placa: veh.placa,
    });
    if (!docPrev) return res.status(404).json({ message: 'Documento no encontrado' });

    const dto = pickDocumento(req.body);
    if (req.file) dto.urlArchivo = upload.publicUrl('vehiculos', req.file.filename);

    const merged = {
      idDocVehi: dto.idDocVehi ?? docPrev.idDocVehi,
      fechaExp: dto.fechaExp ?? docPrev.fechaExp,
      fechaVence: dto.fechaVence ?? docPrev.fechaVence,
      ...dto,
    };
    const valFechas = await validarFechasDocumentoVehiculo(merged);
    if (!valFechas.ok) return res.status(valFechas.status).json({ message: valFechas.message });

    const user = req.user?.username || 'sistema';
    Object.assign(docPrev, dto, { userChangeRecord: user, fechaMod: new Date() });
    await docPrev.save();
    res.json(docPrev.toObject());
  } catch (e) {
    next(e);
  }
};

exports.eliminarDocumento = async (req, res, next) => {
  try {
    const veh = await buscarVehiculo(req.params.id);
    if (!veh) return res.status(404).json({ message: 'Vehículo no encontrado' });

    const result = await DocVehiculo.deleteOne({
      _id: req.params.docId,
      placa: veh.placa,
    });
    if (!result.deletedCount) return res.status(404).json({ message: 'Documento no encontrado' });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};
