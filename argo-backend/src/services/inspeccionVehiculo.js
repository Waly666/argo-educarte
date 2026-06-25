const Vehiculo = require('../models/Vehiculo');
const Empleado = require('../models/Empleado');
const InspTecPreop = require('../models/InspTecPreop');
const DetInspeccion = require('../models/DetInspeccion');
const { empleadoPorUsuarioId, nombreEmpleado } = require('./instructorJornada');
const { calcularDocumentosRequeridos: calcularDocsVehiculo } = require('./vehiculoDocumentos');
const { calcularDocumentosRequeridosInspeccion } = require('./empleadoDocumentos');
const { fechaHoyStr, horaActualStr, normSi } = require('../utils/inspeccionClaseVehiculo');
const { normalizarRol } = require('../utils/roles');
const { previewConsecutivoInspeccion, reservarConsecutivoInspeccion } = require('./configFormatoInspeccionVehiculos');
const {
  plantillaChecklistPorVehiculo,
  detalleDesdeBody,
  mergeChecklistPreop,
} = require('./catalogoInspeccionPreop');
const { PRIMERA_REVISION } = require('../constants/inspeccionPreop');

function observacionEstadoDocumento(doc) {
  if (!doc.subido) return 'Sin registrar';
  if (doc.vencido) return 'Vencido';
  if (doc.faltaFechaVence) return 'Falta fecha de vencimiento';
  if (doc.vencePronto) return 'Por vencer';
  return '';
}

function documentoCumple(doc) {
  return !!(doc.subido && !doc.vencido && !doc.vencePronto && !doc.faltaFechaVence);
}

function mapDocumentosCumplimiento(documentos) {
  return (documentos || []).map((d) => {
    const cumple = documentoCumple(d);
    return {
      id: String(d.id),
      nombre: String(d.nombre || '').trim(),
      si: cumple,
      observacion: cumple ? '' : observacionEstadoDocumento(d),
    };
  });
}

async function armarChecklistDocumentosVehiculo(vehiculo) {
  const res = await calcularDocsVehiculo(vehiculo);
  return mapDocumentosCumplimiento(res.documentos);
}

async function armarChecklistDocumentosInstructor(empleado) {
  if (!empleado?.idEmpleado) return [];
  const res = await calcularDocumentosRequeridosInspeccion(empleado);
  return mapDocumentosCumplimiento(res.documentos);
}

function mergeChecklist(plantilla, guardado) {
  const byId = new Map((guardado || []).map((r) => [String(r.id), r]));
  return (plantilla || []).map((p) => {
    const prev = byId.get(String(p.id));
    return {
      id: String(p.id),
      nombre: String(p.nombre || prev?.nombre || '').trim(),
      si: prev?.si != null ? normSi(prev.si) : null,
      observacion: String(prev?.observacion || '').trim(),
    };
  });
}

function mergeDocumentosChecklist(plantilla, guardado) {
  if (!guardado?.length) return plantilla || [];
  const plantillaById = new Map((plantilla || []).map((p) => [String(p.id), p]));
  const usados = new Set();
  const out = (guardado || []).map((g) => {
    const id = String(g.id);
    usados.add(id);
    const p = plantillaById.get(id);
    return {
      id,
      nombre: String(g.nombre || p?.nombre || '').trim(),
      si: g.si != null ? normSi(g.si) : p?.si != null ? normSi(p.si) : null,
      observacion: String(g.observacion || p?.observacion || '').trim(),
    };
  });
  for (const p of plantilla || []) {
    if (usados.has(String(p.id))) continue;
    out.push(p);
  }
  return out.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

async function resolverEmpleadoInstructorOpcional(userId) {
  return empleadoPorUsuarioId(userId);
}

async function resolverEmpleadoInstructor(userId) {
  const emp = await resolverEmpleadoInstructorOpcional(userId);
  if (!emp) {
    const err = new Error('Su usuario no está vinculado a un empleado. No puede diligenciar inspecciones.');
    err.status = 403;
    throw err;
  }
  return emp;
}

async function nombreEmpleadoPorId(idEmpleado) {
  const id = Number(idEmpleado);
  if (!Number.isFinite(id)) return '';
  const emp = await Empleado.findOne({ idEmpleado: id }).lean();
  return nombreEmpleado(emp).trim();
}

async function nombreEmpleadoPorDocumento(documento) {
  const doc = String(documento ?? '').trim();
  if (!doc || doc === PRIMERA_REVISION) return '';
  const emp = await Empleado.findOne({ numeroDocumento: doc }).lean();
  return nombreEmpleado(emp).trim();
}

function nombreEmpleadoLogueado(empleado) {
  return nombreEmpleado(empleado).trim();
}

function documentoEmpleado(empleado) {
  return String(empleado?.numeroDocumento ?? '').trim();
}

async function entregaDesdeInspeccionAnterior(anterior) {
  if (!anterior) return { entrega: PRIMERA_REVISION, quienEntrega: PRIMERA_REVISION };
  const doc = String(anterior.recibe || '').trim();
  if (!doc) {
    const nom =
      (await nombreEmpleadoPorId(anterior.idEmpleadoRecibe)) ||
      String(anterior.nombreRecibe || anterior.quienRecibe || '').trim();
    return {
      entrega: nom || PRIMERA_REVISION,
      quienEntrega: nom || PRIMERA_REVISION,
    };
  }
  const nom =
    (await nombreEmpleadoPorDocumento(doc)) ||
    String(anterior.nombreRecibe || anterior.quienRecibe || '').trim() ||
    doc;
  return { entrega: doc, quienEntrega: nom };
}

function avisoRolInstructor(user) {
  const rol = normalizarRol(user?.rol);
  if (rol === 'instructor') return null;
  const etiqueta = rol === 'admin' ? 'Administrador' : rol;
  return `Su usuario tiene rol «${etiqueta}». Las inspecciones deben ser diligenciadas por un instructor.`;
}

async function resolverCustodiaInspeccion(placa, fecha, empleado) {
  const anterior = await InspTecPreop.findOne({ placa, fecha: { $lt: fecha } })
    .sort({ fecha: -1, hora: -1 })
    .lean();

  const recibe = documentoEmpleado(empleado);
  const quienRecibe = nombreEmpleadoLogueado(empleado);
  const { entrega, quienEntrega } = await entregaDesdeInspeccionAnterior(anterior);

  return {
    entrega,
    recibe,
    quienEntrega,
    quienRecibe,
    esPrimeraRevision: quienEntrega === PRIMERA_REVISION,
    fechaRevisionAnterior: anterior?.fecha || null,
    idEmpleadoRecibe: empleado?.idEmpleado ?? null,
  };
}

async function armarPlantillaInspeccion(vehiculo, empleado) {
  const [checklist, documentosVehiculo, documentosInstructor, consecutivo] = await Promise.all([
    plantillaChecklistPorVehiculo(vehiculo),
    armarChecklistDocumentosVehiculo(vehiculo),
    armarChecklistDocumentosInstructor(empleado),
    previewConsecutivoInspeccion(),
  ]);

  return {
    placa: String(vehiculo.placa || '').trim(),
    fecha: fechaHoyStr(),
    hora: horaActualStr(),
    combustible: String(vehiculo.combustible || '').trim(),
    idClase: checklist.idClase,
    claseVehiculo: checklist.claseVehiculo || String(vehiculo.claseVehiculo || '').trim(),
    idEmpleadoInstructor: empleado?.idEmpleado ?? null,
    nombreInstructor: nombreEmpleado(empleado),
    entrega: '',
    recibe: '',
    quienEntrega: '',
    quienRecibe: '',
    inspector: '',
    documentoInspector: '',
    documentosVehiculo,
    documentosInstructor,
    grupos: checklist.grupos,
    aptoLaborar: null,
    observacionesGenerales: '',
    urlfotoLatDer: '',
    urlfotoLatIzq: '',
    urlfotoFrontal: '',
    urlfotoPost: '',
    consecutivo,
    lineasPlantilla: checklist.lineas,
  };
}

function mapCabeceraDto(guardada, plantilla, custodia, avisoRol) {
  const quienRecibe =
    String(guardada.nombreRecibe || guardada.quienRecibe || custodia.quienRecibe || '').trim() ||
    custodia.quienRecibe;

  return {
    _id: String(guardada._id),
    placa: guardada.placa,
    fecha: guardada.fecha,
    hora: guardada.hora || plantilla.hora,
    combustible: guardada.combustible ?? plantilla.combustible,
    entrega: guardada.entrega ?? custodia.entrega,
    recibe: guardada.recibe ?? custodia.recibe,
    quienEntrega: guardada.quienEntrega ?? custodia.quienEntrega,
    quienRecibe,
    inspector: String(guardada.inspector || '').trim(),
    documentoInspector: String(guardada.documentoInspector || '').trim(),
    idEmpleadoInstructor: guardada.idEmpleadoRecibe ?? plantilla.idEmpleadoInstructor,
    nombreInstructor: quienRecibe || plantilla.nombreInstructor,
    idClase: plantilla.idClase,
    claseVehiculo: plantilla.claseVehiculo,
    urlfotoLatDer: String(guardada.urlfotoLatDer || '').trim(),
    urlfotoLatIzq: String(guardada.urlfotoLatIzq || '').trim(),
    urlfotoFrontal: String(guardada.urlfotoFrontal || '').trim(),
    urlfotoPost: String(guardada.urlfotoPost || '').trim(),
    aptoLaborar: normSi(guardada.aptoLaborar),
    observacionesGenerales: String(guardada.observacionesGenerales || '').trim(),
    consecutivo: guardada.consecutivo || plantilla.consecutivo,
    guardada: true,
    esPrimeraRevision: custodia.esPrimeraRevision,
    fechaRevisionAnterior: custodia.fechaRevisionAnterior,
    avisoRolInstructor: avisoRol,
    fechaAudi: guardada.fechaAudi,
    fechaMod: guardada.fechaMod,
  };
}

async function obtenerInspeccionDelDia(vehiculo, empleado, fecha, user) {
  const f = fecha || fechaHoyStr();
  const plantilla = await armarPlantillaInspeccion(vehiculo, empleado);
  const placa = plantilla.placa;
  const avisoRol = user ? avisoRolInstructor(user) : null;
  const custodia = await resolverCustodiaInspeccion(placa, f, empleado);
  const guardada = await InspTecPreop.findOne({ placa, fecha: f }).lean();

  if (!guardada) {
    const { lineasPlantilla, ...restPlantilla } = plantilla;
    return {
      ...restPlantilla,
      fecha: f,
      guardada: false,
      _id: null,
      entrega: custodia.entrega,
      recibe: custodia.recibe,
      quienEntrega: custodia.quienEntrega,
      quienRecibe: custodia.quienRecibe,
      nombreInstructor: custodia.quienRecibe || plantilla.nombreInstructor,
      esPrimeraRevision: custodia.esPrimeraRevision,
      fechaRevisionAnterior: custodia.fechaRevisionAnterior,
      avisoRolInstructor: avisoRol,
    };
  }

  const detalle = await DetInspeccion.find({ idInspeccion: guardada._id }).lean();
  const grupos = mergeChecklistPreop(plantilla.lineasPlantilla, detalle, normSi);

  return {
    ...mapCabeceraDto(guardada, plantilla, custodia, avisoRol),
    documentosVehiculo: mergeDocumentosChecklist(plantilla.documentosVehiculo, guardada.documentosVehiculo),
    documentosInstructor: mergeDocumentosChecklist(plantilla.documentosInstructor, guardada.documentosInstructor),
    grupos,
  };
}

function normalizeItems(items) {
  return (items || []).map((r) => ({
    id: String(r.id),
    nombre: String(r.nombre || '').trim(),
    si: normSi(r.si),
    observacion: String(r.observacion || '').trim(),
  }));
}

async function guardarInspeccion(vehiculo, empleado, body, userLogin, user) {
  const fecha = String(body?.fecha || fechaHoyStr()).trim();
  const plantilla = await armarPlantillaInspeccion(vehiculo, empleado);
  const placa = String(vehiculo.placa || '').trim();
  const existing = await InspTecPreop.findOne({ placa, fecha }).lean();
  const custodia = await resolverCustodiaInspeccion(placa, fecha, empleado);

  const entrega = existing
    ? String(existing.entrega || existing.quienEntrega || custodia.entrega).trim()
    : custodia.entrega;
  const quienEntrega = existing
    ? String(existing.quienEntrega || custodia.quienEntrega).trim()
    : custodia.quienEntrega;
  const recibe = existing ? String(existing.recibe || custodia.recibe).trim() : custodia.recibe;
  const quienRecibe = existing
    ? String(existing.nombreRecibe || existing.quienRecibe || custodia.quienRecibe).trim()
    : custodia.quienRecibe;
  const idEmpleadoRecibe = existing?.idEmpleadoRecibe ?? empleado.idEmpleado;
  const consecutivo = existing
    ? String(existing.consecutivo || '').trim() || (await reservarConsecutivoInspeccion())
    : await reservarConsecutivoInspeccion();

  const dto = {
    placa,
    fecha,
    hora: String(body?.hora || horaActualStr()).trim(),
    combustible: String(body?.combustible ?? plantilla.combustible ?? '').trim(),
    entrega,
    recibe,
    quienEntrega,
    quienRecibe,
    nombreRecibe: quienRecibe,
    idEmpleadoRecibe,
    inspector: String(body?.inspector ?? existing?.inspector ?? '').trim(),
    documentoInspector: String(body?.documentoInspector ?? existing?.documentoInspector ?? '').trim(),
    documentosVehiculo: normalizeItems(plantilla.documentosVehiculo),
    documentosInstructor: normalizeItems(plantilla.documentosInstructor),
    aptoLaborar: normSi(body?.aptoLaborar),
    observacionesGenerales: String(body?.observacionesGenerales || '').trim(),
    urlfotoLatDer: String(body?.urlfotoLatDer ?? existing?.urlfotoLatDer ?? '').trim(),
    urlfotoLatIzq: String(body?.urlfotoLatIzq ?? existing?.urlfotoLatIzq ?? '').trim(),
    urlfotoFrontal: String(body?.urlfotoFrontal ?? existing?.urlfotoFrontal ?? '').trim(),
    urlfotoPost: String(body?.urlfotoPost ?? existing?.urlfotoPost ?? '').trim(),
    consecutivo,
    userChangeRecord: userLogin,
    fechaMod: new Date(),
  };

  let idInspeccion;
  if (existing) {
    await InspTecPreop.findOneAndUpdate({ _id: existing._id }, { $set: dto }, { new: true }).lean();
    idInspeccion = existing._id;
  } else {
    dto.fechaAudi = new Date();
    dto.userAddReg = userLogin;
    const created = await InspTecPreop.create(dto);
    idInspeccion = created._id;
  }

  const filasDet = detalleDesdeBody(body, plantilla.lineasPlantilla).map((r) => ({
    idInspeccion,
    idItem: r.idItem,
    idCaracteristica: r.idCaracteristica,
    aprobado: normSi(r.aprobado),
    observacion: r.observacion,
  }));

  await DetInspeccion.deleteMany({ idInspeccion });
  if (filasDet.length) {
    await DetInspeccion.insertMany(filasDet);
  }

  return obtenerInspeccionDelDia(vehiculo, empleado, fecha, user);
}

async function obtenerVehiculoPorId(id) {
  const vehiculo = await Vehiculo.findById(id).lean();
  if (!vehiculo) {
    const err = new Error('Vehículo no encontrado');
    err.status = 404;
    throw err;
  }
  return vehiculo;
}

async function listarInspecciones(vehiculo, { limit = 50, skip = 0 } = {}) {
  const placa = String(vehiculo.placa || '').trim();
  const q = { placa };
  const [rows, total] = await Promise.all([
    InspTecPreop.find(q)
      .sort({ fecha: -1, hora: -1 })
      .skip(skip)
      .limit(limit)
      .select('_id placa fecha hora nombreRecibe quienRecibe aptoLaborar consecutivo fechaMod fechaAudi')
      .lean(),
    InspTecPreop.countDocuments(q),
  ]);

  return {
    placa,
    total,
    inspecciones: rows.map((r) => ({
      _id: String(r._id),
      placa: r.placa,
      fecha: r.fecha,
      hora: r.hora || '',
      nombreInstructor: r.nombreRecibe || r.quienRecibe || '',
      aptoLaborar: normSi(r.aptoLaborar),
      consecutivo: r.consecutivo || '',
      fechaMod: r.fechaMod || r.fechaAudi || null,
    })),
  };
}

module.exports = {
  resolverEmpleadoInstructor,
  resolverEmpleadoInstructorOpcional,
  armarPlantillaInspeccion,
  obtenerInspeccionDelDia,
  guardarInspeccion,
  listarInspecciones,
  obtenerVehiculoPorId,
  fechaHoyStr,
  PRIMERA_REVISION,
};
