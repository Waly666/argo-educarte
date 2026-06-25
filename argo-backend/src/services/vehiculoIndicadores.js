const DocVehiculo = require('../models/DocVehiculo');
const InspTecPreop = require('../models/InspTecPreop');
const {
  obtenerConfigRequisitosDocumentosVehiculos,
  cargarIndiceClases,
  resolverIdClaseVehiculo,
  findRequisitoPorClase,
  tipoDocumentoPorId,
  diasAvisoParaTipo,
} = require('./configRequisitosDocumentosVehiculos');
const { evaluarVencimientoDoc } = require('./vehiculoDocumentos');
const { fechaHoyStr } = require('./inspeccionVehiculo');

async function enriquecerIndicadoresLista(items) {
  if (!items?.length) return items;

  const placas = [...new Set(items.map((i) => String(i.placa || '').trim()).filter(Boolean))];
  const hoy = fechaHoyStr();
  const [docs, config, indiceClases, inspeccionesHoy] = await Promise.all([
    DocVehiculo.find({ placa: { $in: placas } }).lean(),
    obtenerConfigRequisitosDocumentosVehiculos(),
    cargarIndiceClases(),
    InspTecPreop.find({ fecha: hoy, placa: { $in: placas } }).select('placa').lean(),
  ]);

  const placasConInspeccion = new Set(
    inspeccionesHoy.map((i) => String(i.placa || '').trim()).filter(Boolean),
  );

  const docsByPlaca = new Map();
  for (const d of docs) {
    const p = String(d.placa || '').trim();
    if (!p) continue;
    if (!docsByPlaca.has(p)) docsByPlaca.set(p, []);
    docsByPlaca.get(p).push(d);
  }

  return items.map((item) => {
    const lista = docsByPlaca.get(item.placa) || [];
    let docsVencidos = 0;
    let docsPorVencer = 0;
    const idsPresentes = new Set();

    const idClase = resolverIdClaseVehiculo(item, indiceClases);
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
      if (ev.vencido) docsVencidos += 1;
      else if (ev.vencePronto || ev.faltaFechaVence) docsPorVencer += 1;
    }

    const docsFaltantes = [...idsRequeridos].filter((id) => !idsPresentes.has(id)).length;
    const placa = String(item.placa || '').trim();
    const inspeccionPendiente = placa ? !placasConInspeccion.has(placa) : false;

    return {
      ...item,
      indicadores: {
        docsVencidos,
        docsPorVencer,
        docsFaltantes,
        totalDocumentos: lista.length,
        totalTiposCatalogo: idsRequeridos.size,
        inspeccionPendiente,
        inspeccionFecha: hoy,
        ocupado: /^ocupado$/i.test(String(item.estado || '')),
        sinFoto: !item.urlFoto,
        sinClase: !idClase,
      },
    };
  });
}

module.exports = { enriquecerIndicadoresLista };
