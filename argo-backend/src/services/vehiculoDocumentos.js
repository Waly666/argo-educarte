const DocVehiculo = require('../models/DocVehiculo');
const { normalizarPlaca } = require('../constants/vehiculo');
const {
  obtenerConfigRequisitosDocumentosVehiculos,
  cargarIndiceClases,
  resolverIdClaseVehiculo,
  findRequisitoPorClase,
  etiquetaClase,
  tipoDocumentoPorId,
  diasAvisoParaTipo,
} = require('./configRequisitosDocumentosVehiculos');

function docVencido(fechaVence) {
  if (!fechaVence) return false;
  const v = new Date(fechaVence);
  return !Number.isNaN(v.getTime()) && v < new Date();
}

function docVencePronto(fechaVence, diasAviso = 30) {
  if (!fechaVence) return false;
  const v = new Date(fechaVence);
  if (Number.isNaN(v.getTime())) return false;
  if (docVencido(fechaVence)) return false;
  const lim = new Date();
  lim.setHours(0, 0, 0, 0);
  lim.setDate(lim.getDate() + Number(diasAviso || 30));
  return v <= lim;
}

function evaluarVencimientoDoc(fechaVence, diasAviso, controlaVencimiento = true) {
  if (!controlaVencimiento) {
    return { vencido: false, vencePronto: false, faltaFechaVence: false };
  }
  if (!fechaVence) {
    return { vencido: false, vencePronto: true, faltaFechaVence: true };
  }
  const vencido = docVencido(fechaVence);
  const vencePronto = !vencido && docVencePronto(fechaVence, diasAviso);
  return { vencido, vencePronto, faltaFechaVence: false };
}

function mapDocRegistrado(reg, meta, config) {
  const controlaVencimiento = meta?.controlaVencimiento !== false;
  const diasAviso = diasAvisoParaTipo(config, meta);
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

async function validarFechasDocumentoVehiculo(dto) {
  const config = await obtenerConfigRequisitosDocumentosVehiculos();
  const idDoc = dto.idDocVehi != null ? String(dto.idDocVehi) : '';
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
  const cfg = config || (await obtenerConfigRequisitosDocumentosVehiculos());
  const meta = doc.idDocVehi != null ? tipoDocumentoPorId(cfg, doc.idDocVehi) : null;
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

async function calcularDocumentosRequeridos(vehiculo) {
  if (!vehiculo?.placa) {
    return { clase: null, documentos: [], sinClase: true, diasAvisoVencimiento: 30, tiposDocumento: [] };
  }

  const [config, docs, indiceClases] = await Promise.all([
    obtenerConfigRequisitosDocumentosVehiculos(),
    DocVehiculo.find({ placa: normalizarPlaca(vehiculo.placa) }).lean(),
    cargarIndiceClases(),
  ]);

  const idClase = resolverIdClaseVehiculo(vehiculo, indiceClases);
  if (!idClase) {
    return {
      clase: null,
      documentos: [],
      sinClase: true,
      diasAvisoVencimiento: config.diasAvisoVencimiento,
      tiposDocumento: (config.tiposDocumento || []).filter((t) => t.activo !== false),
    };
  }

  const req = findRequisitoPorClase(config, idClase, indiceClases);
  const label = etiquetaClase(idClase, indiceClases);

  const docsByTipo = new Map();
  for (const d of docs) {
    if (d.idDocVehi == null || d.idDocVehi === '') continue;
    const key = String(d.idDocVehi);
    if (!docsByTipo.has(key)) docsByTipo.set(key, d);
  }

  const documentos = (req?.idDocumentos || [])
    .map((idDoc) => {
      const meta = tipoDocumentoPorId(config, idDoc);
      if (!meta) return null;
      const reg = docsByTipo.get(String(idDoc));
      return {
        id: meta.id,
        codigo: meta.codigo,
        nombre: meta.nombre,
        descripcion: meta.descripcion,
        requeridoPor: [label],
        ...mapDocRegistrado(reg, meta, config),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  return {
    clase: { idClase, label },
    documentos,
    sinClase: false,
    diasAvisoVencimiento: config.diasAvisoVencimiento,
    tiposDocumento: (config.tiposDocumento || []).filter((t) => t.activo !== false),
  };
}

async function validarDocumentosPendientesVehiculo(vehiculo) {
  const resumen = await calcularDocumentosRequeridos(vehiculo);
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
    clase: resumen.clase,
    sinClase: resumen.sinClase,
  };
}

async function idsDocumentosRequeridos(vehiculo) {
  const [config, indiceClases] = await Promise.all([
    obtenerConfigRequisitosDocumentosVehiculos(),
    cargarIndiceClases(),
  ]);
  const idClase = resolverIdClaseVehiculo(vehiculo, indiceClases);
  if (!idClase) return [];
  const req = findRequisitoPorClase(config, idClase, indiceClases);
  return (req?.idDocumentos || []).map((d) => String(d));
}

module.exports = {
  calcularDocumentosRequeridos,
  validarDocumentosPendientesVehiculo,
  validarFechasDocumentoVehiculo,
  enriquecerDocumentoRegistrado,
  idsDocumentosRequeridos,
  docVencido,
  docVencePronto,
  evaluarVencimientoDoc,
  mapDocRegistrado,
};
