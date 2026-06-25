const Vehiculo = require('../models/Vehiculo');
const DocVehiculo = require('../models/DocVehiculo');
const {
  obtenerConfigRequisitosDocumentosVehiculos,
  cargarIndiceClases,
  resolverIdClaseVehiculo,
  findRequisitoPorClase,
  tipoDocumentoPorId,
  diasAvisoParaTipo,
} = require('./configRequisitosDocumentosVehiculos');
const { evaluarVencimientoDoc } = require('./vehiculoDocumentos');

const MAX_DETALLE = 24;

async function calcularAlertasDocumentosVehiculos() {
  const [vehiculos, docs, config, indiceClases] = await Promise.all([
    Vehiculo.find({})
      .select('_id placa idClase claseVehiculo codigoMarca nombreMarca codigoLinea nombreLinea modelo')
      .lean(),
    DocVehiculo.find({}).lean(),
    obtenerConfigRequisitosDocumentosVehiculos(),
    cargarIndiceClases(),
  ]);

  const docsByPlaca = new Map();
  for (const d of docs) {
    const p = String(d.placa || '').trim();
    if (!p) continue;
    if (!docsByPlaca.has(p)) docsByPlaca.set(p, []);
    docsByPlaca.get(p).push(d);
  }

  let docsVencidos = 0;
  let docsPorVencer = 0;
  const alertas = [];
  const placasAfectadas = new Set();

  for (const vehiculo of vehiculos) {
    const placa = String(vehiculo.placa || '').trim();
    if (!placa) continue;

    const lista = docsByPlaca.get(placa) || [];
    const idsPresentes = new Set();
    const idClase = resolverIdClaseVehiculo(vehiculo, indiceClases);
    const req = idClase ? findRequisitoPorClase(config, idClase, indiceClases) : null;
    const idsRequeridos = new Set((req?.idDocumentos || []).map((d) => String(d)));

    for (const d of lista) {
      if (d.idDocVehi == null || d.idDocVehi === '') continue;
      const idDoc = String(d.idDocVehi);
      idsPresentes.add(idDoc);
      if (!idsRequeridos.has(idDoc)) continue;

      const meta = tipoDocumentoPorId(config, idDoc);
      if (meta?.controlaVencimiento === false) continue;

      const dias = diasAvisoParaTipo(config, meta);
      const ev = evaluarVencimientoDoc(d.fechaVence, dias, true);
      if (!ev.vencido && !ev.vencePronto && !ev.faltaFechaVence) continue;

      if (ev.vencido) docsVencidos += 1;
      else docsPorVencer += 1;

      placasAfectadas.add(placa);
      alertas.push({
        placa,
        vehiculoId: String(vehiculo._id),
        idDocVehi: idDoc,
        documento: String(d.documento || meta?.documentoVehi || meta?.documento || idDoc).trim(),
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
    return fa - fb;
  });

  return {
    docsVencidos,
    docsPorVencer,
    totalAlertas: docsVencidos + docsPorVencer,
    vehiculosAfectados: placasAfectadas.size,
    diasAvisoVencimiento: config?.diasAvisoVencimiento ?? 30,
    alertas: alertas.slice(0, MAX_DETALLE),
  };
}

async function calcularAlertasDocsFaltantesVehiculos() {
  const [vehiculos, docs, config, indiceClases] = await Promise.all([
    Vehiculo.find({})
      .select('_id placa idClase claseVehiculo nombreMarca nombreLinea')
      .lean(),
    DocVehiculo.find({}).lean(),
    obtenerConfigRequisitosDocumentosVehiculos(),
    cargarIndiceClases(),
  ]);

  const docsByPlaca = new Map();
  for (const d of docs) {
    const p = String(d.placa || '').trim();
    if (!p) continue;
    if (!docsByPlaca.has(p)) docsByPlaca.set(p, []);
    docsByPlaca.get(p).push(d);
  }

  let totalFaltantes = 0;
  const alertas = [];
  const placasAfectadas = new Set();

  for (const vehiculo of vehiculos) {
    const placa = String(vehiculo.placa || '').trim();
    if (!placa) continue;

    const idClase = resolverIdClaseVehiculo(vehiculo, indiceClases);
    const req = idClase ? findRequisitoPorClase(config, idClase, indiceClases) : null;
    const idsRequeridos = (req?.idDocumentos || []).map((d) => String(d));
    if (!idsRequeridos.length) continue;

    const idsPresentes = new Set();
    for (const d of docsByPlaca.get(placa) || []) {
      if (d.idDocVehi == null || d.idDocVehi === '') continue;
      idsPresentes.add(String(d.idDocVehi));
    }

    for (const idDoc of idsRequeridos) {
      if (idsPresentes.has(idDoc)) continue;
      const meta = tipoDocumentoPorId(config, idDoc);
      totalFaltantes += 1;
      placasAfectadas.add(placa);
      alertas.push({
        placa,
        vehiculoId: String(vehiculo._id),
        idDocVehi: idDoc,
        documento: String(meta?.nombre || meta?.documentoVehi || meta?.documento || idDoc).trim(),
        claseVehiculo: vehiculo.claseVehiculo || '',
      });
    }
  }

  alertas.sort((a, b) => {
    const pa = String(a.placa).localeCompare(String(b.placa));
    if (pa !== 0) return pa;
    return String(a.documento).localeCompare(String(b.documento));
  });

  return {
    totalFaltantes,
    vehiculosAfectados: placasAfectadas.size,
    alertas: alertas.slice(0, MAX_DETALLE),
  };
}

module.exports = { calcularAlertasDocumentosVehiculos, calcularAlertasDocsFaltantesVehiculos };
