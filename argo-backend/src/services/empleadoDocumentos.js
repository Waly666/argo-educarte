const DocEmpleado = require('../models/DocEmpleado');
const Cargo = require('../models/Cargo');
const {
  obtenerConfigRequisitosDocumentosEmpleados,
  findRequisitoPorCargo,
  tipoDocumentoPorId,
} = require('./configRequisitosDocumentosEmpleados');
const { evaluarVencimientoDoc } = require('./vehiculoDocumentos');

function diasAvisoParaTipoEmp(config, tipoMeta) {
  const perTipo = tipoMeta?.diasAvisoVencimiento;
  if (perTipo != null && Number(perTipo) > 0) {
    const n = parseInt(String(perTipo), 10);
    if (Number.isFinite(n) && n > 0) return Math.min(n, 365);
  }
  const g = parseInt(String(config?.diasAvisoVencimiento ?? 30), 10);
  return Number.isFinite(g) && g > 0 ? Math.min(g, 365) : 30;
}

function mapDocRegistrado(reg, meta, config) {
  const controlaVencimiento = meta?.controlaVencimiento !== false;
  const diasAviso = diasAvisoParaTipoEmp(config, meta);
  if (!reg) {
    return {
      subido: false,
      docId: '',
      urlArchivo: '',
      numero: '',
      fechaExp: null,
      fechaVence: null,
      controlaVencimiento,
      diasAvisoVencimiento: diasAviso,
      vencido: false,
      vencePronto: false,
      faltaFechaVence: false,
    };
  }
  const ev = evaluarVencimientoDoc(reg.fechaVence, diasAviso, controlaVencimiento);
  return {
    subido: true,
    docId: String(reg._id),
    urlArchivo: reg.urlArchivo || '',
    numero: reg.numero || '',
    fechaExp: reg.fechaExp || null,
    fechaVence: reg.fechaVence || null,
    controlaVencimiento,
    diasAvisoVencimiento: diasAviso,
    ...ev,
  };
}

async function etiquetaCargo(idCargo) {
  if (idCargo == null || idCargo === '') return '';
  const n = Number(idCargo);
  const c = await Cargo.findOne({
    $or: [{ idCargo: idCargo }, ...(Number.isFinite(n) ? [{ idCargo: n }] : [])],
  }).lean();
  return String(c?.nombre || idCargo).trim();
}

async function validarFechasDocumentoEmpleado(dto) {
  const config = await obtenerConfigRequisitosDocumentosEmpleados();
  const idDoc = dto.idDocumento != null ? String(dto.idDocumento) : '';
  const meta = idDoc ? tipoDocumentoPorId(config, idDoc) : null;
  if (!meta || meta.controlaVencimiento === false) {
    return { ok: true };
  }
  if (!dto.fechaExp) {
    return {
      ok: false,
      status: 400,
      message: `«${meta.nombre}» requiere fecha de expedición.`,
    };
  }
  if (!dto.fechaVence) {
    return {
      ok: false,
      status: 400,
      message: `«${meta.nombre}» requiere fecha de vencimiento.`,
    };
  }
  const exp = new Date(dto.fechaExp);
  const ven = new Date(dto.fechaVence);
  if (Number.isNaN(exp.getTime()) || Number.isNaN(ven.getTime())) {
    return { ok: false, status: 400, message: 'Fechas de expedición o vencimiento no válidas.' };
  }
  if (ven < exp) {
    return {
      ok: false,
      status: 400,
      message: 'La fecha de vencimiento no puede ser anterior a la de expedición.',
    };
  }
  return { ok: true, meta };
}

async function enriquecerDocumentoRegistrado(doc, config) {
  const cfg = config || (await obtenerConfigRequisitosDocumentosEmpleados());
  const meta = doc.idDocumento != null ? tipoDocumentoPorId(cfg, doc.idDocumento) : null;
  const mapped = mapDocRegistrado(doc, meta, cfg);
  return {
    ...doc,
    controlaVencimiento: mapped.controlaVencimiento,
    diasAvisoVencimiento: mapped.diasAvisoVencimiento,
    vencido: mapped.vencido,
    vencePronto: mapped.vencePronto,
    faltaFechaVence: mapped.faltaFechaVence,
  };
}

async function enriquecerDocumentos(idEmpleado) {
  const config = await obtenerConfigRequisitosDocumentosEmpleados();
  const docs = await DocEmpleado.find({ idEmpleado: Number(idEmpleado) })
    .sort({ documento: 1 })
    .lean();
  return Promise.all(docs.map((d) => enriquecerDocumentoRegistrado(d, config)));
}

async function idsCargosInstructor() {
  const cargos = await Cargo.find({ nombre: /\binstructor/i }).select('idCargo').lean();
  return cargos
    .map((c) => String(c.idCargo ?? '').trim())
    .filter(Boolean);
}

async function idsDocumentosRequeridosInspeccion(config, empleado) {
  const instructorCargoIds = await idsCargosInstructor();
  const cargoEmp = String(empleado?.cargoId ?? '').trim();
  const esInstructor = cargoEmp && instructorCargoIds.includes(cargoEmp);
  const idDocumentos = new Set();

  if (esInstructor) {
    const req = findRequisitoPorCargo(config, cargoEmp);
    (req?.idDocumentos || []).forEach((id) => idDocumentos.add(String(id)));
  } else if (instructorCargoIds.length) {
    for (const cid of instructorCargoIds) {
      const req = findRequisitoPorCargo(config, cid);
      (req?.idDocumentos || []).forEach((id) => idDocumentos.add(String(id)));
    }
  } else if (cargoEmp) {
    const req = findRequisitoPorCargo(config, cargoEmp);
    (req?.idDocumentos || []).forEach((id) => idDocumentos.add(String(id)));
  }

  return [...idDocumentos];
}

function mapDocumentosDesdeIds(config, idDocumentos, docsByTipo, requeridoPor) {
  return idDocumentos
    .map((idDoc) => {
      const meta = tipoDocumentoPorId(config, idDoc);
      if (!meta) return null;
      const reg = docsByTipo.get(String(idDoc));
      return {
        id: meta.id,
        codigo: meta.codigo,
        nombre: meta.nombre,
        descripcion: meta.descripcion,
        requeridoPor,
        ...mapDocRegistrado(reg, meta, config),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

async function calcularDocumentosRequeridos(empleado) {
  if (!empleado?.idEmpleado) {
    return { cargo: null, documentos: [], sinCargo: true, diasAvisoVencimiento: 30, tiposDocumento: [] };
  }

  const [config, docs] = await Promise.all([
    obtenerConfigRequisitosDocumentosEmpleados(),
    DocEmpleado.find({ idEmpleado: Number(empleado.idEmpleado) }).lean(),
  ]);

  const cargoId = empleado.cargoId;
  if (cargoId == null || cargoId === '') {
    return {
      cargo: null,
      documentos: [],
      sinCargo: true,
      diasAvisoVencimiento: config.diasAvisoVencimiento,
      tiposDocumento: (config.tiposDocumento || []).filter((t) => t.activo !== false),
    };
  }

  const req = findRequisitoPorCargo(config, cargoId);
  const label = await etiquetaCargo(cargoId);

  const docsByTipo = new Map();
  for (const d of docs) {
    if (d.idDocumento == null || d.idDocumento === '') continue;
    const key = String(d.idDocumento);
    if (!docsByTipo.has(key)) docsByTipo.set(key, d);
  }

  const documentos = mapDocumentosDesdeIds(config, req?.idDocumentos || [], docsByTipo, [label]);

  return {
    cargo: { idCargo: String(cargoId), label },
    documentos,
    sinCargo: false,
    diasAvisoVencimiento: config.diasAvisoVencimiento,
    tiposDocumento: (config.tiposDocumento || []).filter((t) => t.activo !== false),
  };
}

/** Requisitos de la sección instructor/conductor en inspección vehicular. */
async function calcularDocumentosRequeridosInspeccion(empleado) {
  if (!empleado?.idEmpleado) {
    return { documentos: [] };
  }

  const [config, docs] = await Promise.all([
    obtenerConfigRequisitosDocumentosEmpleados(),
    DocEmpleado.find({ idEmpleado: Number(empleado.idEmpleado) }).lean(),
  ]);

  const docsByTipo = new Map();
  for (const d of docs) {
    if (d.idDocumento == null || d.idDocumento === '') continue;
    const key = String(d.idDocumento);
    if (!docsByTipo.has(key)) docsByTipo.set(key, d);
  }

  const idDocumentos = await idsDocumentosRequeridosInspeccion(config, empleado);
  const instructorCargoIds = await idsCargosInstructor();
  const requeridoPor = [];
  for (const cid of instructorCargoIds.length ? instructorCargoIds : [empleado.cargoId]) {
    const label = await etiquetaCargo(cid);
    if (label) requeridoPor.push(label);
  }

  return {
    documentos: mapDocumentosDesdeIds(config, idDocumentos, docsByTipo, [...new Set(requeridoPor)]),
  };
}

async function validarDocumentosPendientesEmpleado(empleado) {
  const resumen = await calcularDocumentosRequeridos(empleado);
  const pendientes = (resumen.documentos || [])
    .filter((d) => !d.subido)
    .map((d) => ({
      id: d.id,
      codigo: d.codigo,
      nombre: d.nombre,
      requeridoPor: d.requeridoPor,
    }));

  return {
    ok: pendientes.length === 0,
    pendientes,
    cargo: resumen.cargo,
    sinCargo: resumen.sinCargo,
  };
}

module.exports = {
  calcularDocumentosRequeridos,
  calcularDocumentosRequeridosInspeccion,
  validarDocumentosPendientesEmpleado,
  validarFechasDocumentoEmpleado,
  enriquecerDocumentoRegistrado,
  enriquecerDocumentos,
  etiquetaCargo,
};
