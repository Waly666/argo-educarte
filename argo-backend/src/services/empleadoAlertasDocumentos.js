const Empleado = require('../models/Empleado');
const DocEmpleado = require('../models/DocEmpleado');
const Cargo = require('../models/Cargo');
const {
  obtenerConfigRequisitosDocumentosEmpleados,
  findRequisitoPorCargo,
  tipoDocumentoPorId,
  diasAvisoParaTipo,
} = require('./configRequisitosDocumentosEmpleados');
const { evaluarVencimientoDoc } = require('./vehiculoDocumentos');

const MAX_DETALLE = 24;

const FILTER_ACTIVOS = { estado: { $in: [/^activo$/i, 'activo', 'ACTIVO', null] } };

function nombreEmpleado(empleado) {
  const parts = [empleado?.primerNombre, empleado?.segundoNombre, empleado?.primerApellido, empleado?.segundoApellido]
    .map((p) => String(p || '').trim())
    .filter(Boolean);
  if (parts.length) return parts.join(' ');
  return String(empleado?.numeroDocumento || empleado?.idEmpleado || '').trim();
}

async function calcularAlertasDocumentosEmpleados() {
  const [empleados, docs, config] = await Promise.all([
    Empleado.find(FILTER_ACTIVOS)
      .select('_id idEmpleado cargoId primerNombre segundoNombre primerApellido segundoApellido numeroDocumento')
      .lean(),
    DocEmpleado.find({}).lean(),
    obtenerConfigRequisitosDocumentosEmpleados(),
  ]);

  const docsByEmpleado = new Map();
  for (const d of docs) {
    const id = d.idEmpleado;
    if (id == null || id === '') continue;
    const key = String(id);
    if (!docsByEmpleado.has(key)) docsByEmpleado.set(key, []);
    docsByEmpleado.get(key).push(d);
  }

  let docsVencidos = 0;
  let docsPorVencer = 0;
  const alertas = [];
  const empleadosAfectados = new Set();

  for (const empleado of empleados) {
    const idEmpleado = empleado.idEmpleado;
    if (idEmpleado == null || idEmpleado === '') continue;

    const cargoId = empleado.cargoId;
    if (cargoId == null || cargoId === '') continue;

    const req = findRequisitoPorCargo(config, cargoId);
    const idsRequeridos = new Set((req?.idDocumentos || []).map((d) => String(d)));
    if (!idsRequeridos.size) continue;

    const lista = docsByEmpleado.get(String(idEmpleado)) || [];
    const nombre = nombreEmpleado(empleado);

    for (const d of lista) {
      if (d.idDocumento == null || d.idDocumento === '') continue;
      const idDoc = String(d.idDocumento);
      if (!idsRequeridos.has(idDoc)) continue;

      const meta = tipoDocumentoPorId(config, idDoc);
      if (meta?.controlaVencimiento === false) continue;

      const dias = diasAvisoParaTipo(config, meta);
      const ev = evaluarVencimientoDoc(d.fechaVence, dias, true);
      if (!ev.vencido && !ev.vencePronto && !ev.faltaFechaVence) continue;

      if (ev.vencido) docsVencidos += 1;
      else docsPorVencer += 1;

      empleadosAfectados.add(String(idEmpleado));
      alertas.push({
        idEmpleado: Number(idEmpleado),
        empleadoId: String(empleado._id || ''),
        nombreEmpleado: nombre,
        idDocumento: idDoc,
        documento: String(d.documento || meta?.nombre || idDoc).trim(),
        fechaVence: d.fechaVence || null,
        vencido: ev.vencido,
        vencePronto: ev.vencePronto,
        faltaFechaVence: ev.faltaFechaVence,
        diasAvisoVencimiento: dias,
      });
    }
  }

  alertas.sort((a, b) => {
    if (a.vencido !== b.vencido) return a.vencido ? -1 : 1;
    if (a.faltaFechaVence !== b.faltaFechaVence) return a.faltaFechaVence ? -1 : 1;
    const fa = a.fechaVence ? new Date(a.fechaVence).getTime() : Number.MAX_SAFE_INTEGER;
    const fb = b.fechaVence ? new Date(b.fechaVence).getTime() : Number.MAX_SAFE_INTEGER;
    if (fa !== fb) return fa - fb;
    return String(a.nombreEmpleado).localeCompare(String(b.nombreEmpleado), 'es');
  });

  return {
    docsVencidos,
    docsPorVencer,
    totalAlertas: docsVencidos + docsPorVencer,
    empleadosAfectados: empleadosAfectados.size,
    diasAvisoVencimiento: config?.diasAvisoVencimiento ?? 30,
    alertas: alertas.slice(0, MAX_DETALLE),
  };
}

async function calcularAlertasDocsFaltantesEmpleados() {
  const [empleados, docs, config, cargos] = await Promise.all([
    Empleado.find(FILTER_ACTIVOS)
      .select('_id idEmpleado cargoId primerNombre segundoNombre primerApellido segundoApellido numeroDocumento')
      .lean(),
    DocEmpleado.find({}).lean(),
    obtenerConfigRequisitosDocumentosEmpleados(),
    Cargo.find({}).select('idCargo nombreCargo').lean(),
  ]);

  const cargoPorId = new Map(
    (cargos || []).map((c) => [String(c.idCargo), String(c.nombreCargo || '').trim()]),
  );
  const esInstructorCargo = (cargoId) => /\binstructor/i.test(cargoPorId.get(String(cargoId)) || '');

  const docsByEmpleado = new Map();
  for (const d of docs) {
    const id = d.idEmpleado;
    if (id == null || id === '') continue;
    const key = String(id);
    if (!docsByEmpleado.has(key)) docsByEmpleado.set(key, []);
    docsByEmpleado.get(key).push(d);
  }

  let totalFaltantes = 0;
  const alertas = [];
  const empleadosAfectados = new Set();

  for (const empleado of empleados) {
    const idEmpleado = empleado.idEmpleado;
    if (idEmpleado == null || idEmpleado === '') continue;

    const cargoId = empleado.cargoId;
    if (cargoId == null || cargoId === '') continue;

    const req = findRequisitoPorCargo(config, cargoId);
    const idsRequeridos = (req?.idDocumentos || []).map((d) => String(d));
    if (!idsRequeridos.length) continue;

    const idsPresentes = new Set();
    for (const d of docsByEmpleado.get(String(idEmpleado)) || []) {
      if (d.idDocumento == null || d.idDocumento === '') continue;
      idsPresentes.add(String(d.idDocumento));
    }

    const nombre = nombreEmpleado(empleado);

    for (const idDoc of idsRequeridos) {
      if (idsPresentes.has(idDoc)) continue;
      const meta = tipoDocumentoPorId(config, idDoc);
      totalFaltantes += 1;
      empleadosAfectados.add(String(idEmpleado));
      alertas.push({
        idEmpleado: Number(idEmpleado),
        empleadoId: String(empleado._id || ''),
        nombreEmpleado: nombre,
        numeroDocumento: String(empleado.numeroDocumento || '').trim(),
        esInstructor: esInstructorCargo(cargoId),
        idDocumento: idDoc,
        documento: String(meta?.nombre || idDoc).trim(),
      });
    }
  }

  alertas.sort((a, b) => {
    const na = String(a.nombreEmpleado).localeCompare(String(b.nombreEmpleado), 'es');
    if (na !== 0) return na;
    return String(a.documento).localeCompare(String(b.documento), 'es');
  });

  return {
    totalFaltantes,
    empleadosAfectados: empleadosAfectados.size,
    alertas: alertas.slice(0, MAX_DETALLE),
  };
}

module.exports = { calcularAlertasDocumentosEmpleados, calcularAlertasDocsFaltantesEmpleados };
