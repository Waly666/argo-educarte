const Cliente = require('../models/Cliente');
const {
  TIPOS_IDENTIFICACION,
  ORGANIZACIONES_LEGALES,
  TRIBUTOS,
  RESPONSABILIDADES_FISCALES,
} = require('../constants/catalogosDian');
const {
  TIPOS_CONTRATO_CAP,
  TIPO_CONTRATO_CAP_LABELS,
  TIPO_CONTRATO_LEGAL_ORG,
  esTipoContratoCapValido,
} = require('../constants/tipoContratoCap');

function mapCliente(c) {
  if (!c) return null;
  const o = c.toObject ? c.toObject() : c;
  return {
    _id: o._id,
    identificationDocumentCode: o.identificationDocumentCode || '31',
    identificacion: o.identificacion || '',
    dv: o.dv || '',
    legalOrganizationCode: o.legalOrganizationCode || '1',
    razonSocial: o.razonSocial || '',
    nombreComercial: o.nombreComercial || '',
    nombres: o.nombres || '',
    tributeCode: o.tributeCode || 'ZZ',
    responsabilidadFiscal: o.responsabilidadFiscal || 'R-99-PN',
    direccion: o.direccion || '',
    correo: o.correo || '',
    telefono: o.telefono || '',
    municipioCodigo: o.municipioCodigo || '',
    municipioNombre: o.municipioNombre || '',
    tipoContratoCap: o.tipoContratoCap || '',
    tipoContratoCapLabel: TIPO_CONTRATO_CAP_LABELS[o.tipoContratoCap] || '',
    granContribuyente: !!o.granContribuyente,
    autoretenedor: !!o.autoretenedor,
    agenteRetenedorIva: !!o.agenteRetenedorIva,
    porcentajeReteIva: Number(o.porcentajeReteIva) || 0,
    porcentajeReteFuente: Number(o.porcentajeReteFuente) || 0,
    activo: o.activo !== false,
    nombre: o.razonSocial || o.nombres || '',
  };
}

function aplicarBody(doc, body) {
  const campos = [
    'identificationDocumentCode',
    'identificacion',
    'dv',
    'legalOrganizationCode',
    'razonSocial',
    'nombreComercial',
    'nombres',
    'tributeCode',
    'responsabilidadFiscal',
    'direccion',
    'correo',
    'telefono',
    'municipioCodigo',
    'municipioNombre',
  ];
  for (const k of campos) {
    if (body[k] != null) doc[k] = String(body[k]).trim();
  }
  if (body.tipoContratoCap != null) {
    const tipo = String(body.tipoContratoCap || '').trim();
    if (tipo && !esTipoContratoCapValido(tipo)) {
      const err = new Error('Tipo de contratante no válido');
      err.status = 400;
      throw err;
    }
    doc.tipoContratoCap = tipo;
    if (tipo && TIPO_CONTRATO_LEGAL_ORG[tipo]) {
      doc.legalOrganizationCode = TIPO_CONTRATO_LEGAL_ORG[tipo];
    }
  }
  if (body.granContribuyente != null) doc.granContribuyente = body.granContribuyente === true || body.granContribuyente === 'true';
  if (body.autoretenedor != null) doc.autoretenedor = body.autoretenedor === true || body.autoretenedor === 'true';
  if (body.agenteRetenedorIva != null) doc.agenteRetenedorIva = body.agenteRetenedorIva === true || body.agenteRetenedorIva === 'true';
  if (body.porcentajeReteIva != null) doc.porcentajeReteIva = Number(body.porcentajeReteIva) || 0;
  if (body.porcentajeReteFuente != null) doc.porcentajeReteFuente = Number(body.porcentajeReteFuente) || 0;
  if (body.activo != null) doc.activo = body.activo !== false && body.activo !== 'false';
}

exports.catalogos = (_req, res) => {
  res.json({
    tiposIdentificacion: TIPOS_IDENTIFICACION,
    organizacionesLegales: ORGANIZACIONES_LEGALES,
    tributos: TRIBUTOS,
    responsabilidadesFiscales: RESPONSABILIDADES_FISCALES,
    tiposContratoCap: TIPOS_CONTRATO_CAP.map((id) => ({
      id,
      label: TIPO_CONTRATO_CAP_LABELS[id] || id,
    })),
  });
};

exports.listar = async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const filtro = { activo: { $ne: false } };
    if (q) {
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filtro.$or = [{ razonSocial: re }, { nombres: re }, { identificacion: re }, { nombreComercial: re }];
    }
    const rows = await Cliente.find(filtro).sort({ razonSocial: 1, nombres: 1 }).limit(500).lean();
    res.json(rows.map(mapCliente));
  } catch (e) {
    next(e);
  }
};

exports.obtener = async (req, res, next) => {
  try {
    const doc = await Cliente.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ message: 'Cliente no encontrado' });
    res.json(mapCliente(doc));
  } catch (e) {
    next(e);
  }
};

exports.crear = async (req, res, next) => {
  try {
    const body = req.body || {};
    const identificacion = String(body.identificacion || '').trim();
    const razon = String(body.razonSocial || body.nombres || '').trim();
    if (!identificacion || !razon) {
      return res.status(400).json({ message: 'Identificación y razón social / nombre son obligatorios' });
    }
    const tipoCap = String(body.tipoContratoCap || '').trim();
    if (!esTipoContratoCapValido(tipoCap)) {
      return res.status(400).json({
        message: 'Seleccione el tipo de contratante (empresa, entidad oficial, ONG o persona natural)',
      });
    }
    const existe = await Cliente.findOne({ identificacion }).lean();
    if (existe) return res.status(409).json({ message: 'Ya existe un cliente con esa identificación' });

    const doc = new Cliente({});
    aplicarBody(doc, body);
    doc.userAddReg = req.user?.username || 'sistema';
    await doc.save();
    res.status(201).json(mapCliente(doc));
  } catch (e) {
    next(e);
  }
};

exports.actualizar = async (req, res, next) => {
  try {
    const doc = await Cliente.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Cliente no encontrado' });
    aplicarBody(doc, req.body || {});
    doc.userChangeRecord = req.user?.username || 'sistema';
    await doc.save();
    res.json(mapCliente(doc));
  } catch (e) {
    next(e);
  }
};

exports.eliminar = async (req, res, next) => {
  try {
    const doc = await Cliente.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Cliente no encontrado' });
    doc.activo = false;
    doc.userChangeRecord = req.user?.username || 'sistema';
    await doc.save();
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};

exports.mapCliente = mapCliente;
