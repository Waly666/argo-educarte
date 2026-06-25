const facturaSvc = require('../services/facturaElectronica');
const facturaContratoSvc = require('../services/facturaContratoCap');
const notaSvc = require('../services/notaCredito');
const { generarHtmlFactura, generarHtmlNotaCredito } = require('../services/facturaElectronicaHtml');
const { listarRangosFactus, probarConexionFactus } = require('../services/facturaProveedor');
const { parseNumDoc } = require('../utils/numDoc');
const { autorizarAnulacionSimple } = require('../services/anulacionComprobante');
const {
  PROVEEDORES_FE,
  PROVEEDOR_LABELS,
  AMBIENTES_FE,
  MODOS_EMISION,
  MODO_EMISION_LABELS,
  CONDICIONES_IVA,
  CONDICION_IVA_LABELS,
  CONCEPTOS_NOTA_CREDITO,
  CONCEPTO_NOTA_CREDITO_LABELS,
  NOTA_CREDITO_TOTAL,
  NOTA_CREDITO_PARCIAL,
  NC_ANULACION,
  ADQUIRENTE_ALUMNO,
  ADQUIRENTE_CLIENTE,
} = require('../constants/facturacionElectronica');

exports.resumen = async (req, res, next) => {
  try {
    res.json(await facturaSvc.resumenFacturacion({ idSede: req.idSede }));
  } catch (e) {
    next(e);
  }
};

exports.elegiblesAlumno = async (req, res, next) => {
  try {
    const numDoc = parseNumDoc(req.params.numDoc);
    if (numDoc == null) return res.status(400).json({ message: 'Documento de alumno inválido' });
    res.json(await facturaSvc.listarElegiblesPorAlumno(numDoc));
  } catch (e) {
    next(e);
  }
};

exports.estadoFacturaContrato = async (req, res, next) => {
  try {
    res.json(await facturaContratoSvc.estadoFacturaContrato(req.params.idContrato));
  } catch (e) {
    next(e);
  }
};

exports.previewFacturaContrato = async (req, res, next) => {
  try {
    res.json(await facturaContratoSvc.previewFacturaContrato(req.params.idContrato));
  } catch (e) {
    next(e);
  }
};

exports.emitirFacturaContrato = async (req, res, next) => {
  try {
    const doc = await facturaContratoSvc.emitirFacturaContrato(req.params.idContrato, {
      idSede: req.idSede,
      idUsuario: req.user?.sub || null,
      userAddReg: req.user?.username || req.user?.nombre || null,
    });
    res.status(201).json(doc);
  } catch (e) {
    next(e);
  }
};

exports.facturasAlumno = async (req, res, next) => {
  try {
    const numDoc = parseNumDoc(req.params.numDoc);
    if (numDoc == null) return res.status(400).json({ message: 'Documento de alumno inválido' });
    res.json(await facturaSvc.listarFacturasPorAlumno(numDoc));
  } catch (e) {
    next(e);
  }
};

exports.listar = async (req, res, next) => {
  try {
    const skip = Math.max(0, Number(req.query.skip) || 0);
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 200));
    const q = String(req.query.q || '').trim();
    res.json(await facturaSvc.listarFacturas({ idSede: req.idSede, skip, limit, q }));
  } catch (e) {
    next(e);
  }
};

exports.htmlNotaCredito = async (req, res, next) => {
  try {
    const html = await generarHtmlNotaCredito(req.params.notaId);
    if (!html) return res.status(404).send('Nota crédito no encontrada');
    res.type('html').send(html);
  } catch (e) {
    next(e);
  }
};

exports.htmlFactura = async (req, res, next) => {
  try {
    const html = await generarHtmlFactura(req.params.id);
    if (!html) return res.status(404).send('Factura no encontrada');
    res.type('html').send(html);
  } catch (e) {
    next(e);
  }
};

exports.obtener = async (req, res, next) => {
  try {
    res.json(await facturaSvc.obtenerFactura(req.params.id));
  } catch (e) {
    next(e);
  }
};

function parsearEmisionBody(body) {
  return {
    numDoc: parseNumDoc(body.numDoc),
    idLiquidaciones: Array.isArray(body.idLiquidaciones) ? body.idLiquidaciones : [],
    tipoAdquirente: body.tipoAdquirente === ADQUIRENTE_CLIENTE ? ADQUIRENTE_CLIENTE : ADQUIRENTE_ALUMNO,
    idCliente: body.idCliente || null,
  };
}

exports.preview = async (req, res, next) => {
  try {
    const dto = parsearEmisionBody(req.body || {});
    res.json(await facturaSvc.previewFactura(dto));
  } catch (e) {
    next(e);
  }
};

exports.emitir = async (req, res, next) => {
  try {
    const dto = parsearEmisionBody(req.body || {});
    if (!dto.idLiquidaciones.length) {
      return res.status(400).json({ message: 'Seleccione al menos un ítem a facturar' });
    }
    const doc = await facturaSvc.emitirFacturaMulti({
      ...dto,
      idSede: req.idSede,
      idUsuario: req.user?.sub || null,
      userAddReg: req.user?.username || req.user?.nombre || null,
    });
    res.status(201).json(doc);
  } catch (e) {
    next(e);
  }
};

exports.catalogos = (_req, res) => {
  res.json({
    proveedores: PROVEEDORES_FE.map((id) => ({ id, label: PROVEEDOR_LABELS[id] || id })),
    ambientes: AMBIENTES_FE.map((id) => ({ id, label: id === 'sandbox' ? 'Sandbox (pruebas)' : 'Producción' })),
    modosEmision: MODOS_EMISION.map((id) => ({ id, label: MODO_EMISION_LABELS[id] || id })),
    condicionesIva: CONDICIONES_IVA.map((id) => ({ id, label: CONDICION_IVA_LABELS[id] || id })),
    conceptosNotaCredito: CONCEPTOS_NOTA_CREDITO.map((id) => ({ id, label: CONCEPTO_NOTA_CREDITO_LABELS[id] || id })),
  });
};

function parsearNotaBody(idFactura, body) {
  const b = body || {};
  return {
    idFactura,
    tipo: b.tipo === NOTA_CREDITO_PARCIAL ? NOTA_CREDITO_PARCIAL : NOTA_CREDITO_TOTAL,
    conceptoCorreccion: b.conceptoCorreccion || NC_ANULACION,
    idLiquidaciones: Array.isArray(b.idLiquidaciones) ? b.idLiquidaciones : [],
    motivo: String(b.motivo || '').trim(),
  };
}

exports.notaCreditoPreview = async (req, res, next) => {
  try {
    res.json(await notaSvc.previewNotaCredito(parsearNotaBody(req.params.id, req.body)));
  } catch (e) {
    next(e);
  }
};

exports.notaCreditoEmitir = async (req, res, next) => {
  try {
    // La nota crédito es la anulación legal de una factura electrónica:
    // requiere autorización de un administrador (cajeros aportan credenciales).
    const auth = await autorizarAnulacionSimple(
      req,
      'Anular una factura (emitir nota crédito) requiere autorización de un administrador.',
    );
    if (!auth.ok) {
      return res.status(auth.status).json({ message: auth.message, code: auth.code });
    }
    const doc = await notaSvc.emitirNota({
      ...parsearNotaBody(req.params.id, req.body),
      idSede: req.idSede,
      idUsuario: req.user?.sub || null,
      userAddReg: req.user?.username || req.user?.nombre || null,
      autorizadoPor: auth.supervisor?.autorizadoPor || req.user?.username || null,
      nombreAutoriza: auth.supervisor?.nombreAutoriza || null,
    });
    res.status(201).json(doc);
  } catch (e) {
    next(e);
  }
};

exports.notasDeFactura = async (req, res, next) => {
  try {
    res.json(await notaSvc.listarNotasDeFactura(req.params.id));
  } catch (e) {
    next(e);
  }
};

exports.listarNotas = async (req, res, next) => {
  try {
    const skip = Math.max(0, Number(req.query.skip) || 0);
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 200));
    res.json(await notaSvc.listarNotas({ idSede: req.idSede, skip, limit }));
  } catch (e) {
    next(e);
  }
};

exports.probarConexion = async (_req, res, next) => {
  try {
    res.json(await probarConexionFactus());
  } catch (e) {
    next(e);
  }
};

exports.rangosFactus = async (_req, res, next) => {
  try {
    res.json(await listarRangosFactus());
  } catch (e) {
    next(e);
  }
};
