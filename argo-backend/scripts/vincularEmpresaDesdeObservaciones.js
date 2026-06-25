/**
 * Vincula empresaId en alumnos a partir del texto en observaciones (nombre de empresa legacy).
 *
 * Criterios de coincidencia:
 * - Mayúsculas / minúsculas / tildes: no importan.
 * - Coincidencia exacta o parcial (una parte del texto contiene a la otra).
 * - Si observaciones tiene varias partes (| ; , -), prueba cada una.
 * - Solo actualiza si hay exactamente UN cliente que coincide; si no, no hace nada.
 * - No crea empresas nuevas.
 *
 * Uso local:
 *   cd argo-backend
 *   node scripts/vincularEmpresaDesdeObservaciones.js --dry-run
 *   node scripts/vincularEmpresaDesdeObservaciones.js
 *
 * Uso en servidor (Docker):
 *   docker compose exec argo-backend node scripts/vincularEmpresaDesdeObservaciones.js --dry-run
 */
require('dotenv').config();
const mongoose = require('mongoose');
const DatosAlumno = require('../src/models/DatosAlumno');
const Cliente = require('../src/models/Cliente');
const {
  buscarClienteUnicoDesdeObservaciones,
  clientesQueCoinciden,
  segmentosObservaciones,
} = require('../src/services/empresaDesdeObservaciones');

const dryRun = process.argv.includes('--dry-run');

function nombreCliente(cli) {
  return cli.razonSocial?.trim() || cli.nombreComercial?.trim() || cli.nombres?.trim() || cli.identificacion || '';
}

(async () => {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/argo';
  await mongoose.connect(uri);
  console.error(`Conectado a MongoDB (${uri.replace(/\/\/.*@/, '//***@')})`);

  const clientes = await Cliente.find({ activo: { $ne: false } })
    .select('_id razonSocial nombreComercial nombres identificacion')
    .lean();

  const alumnos = await DatosAlumno.find({
    $or: [{ empresaId: null }, { empresaId: { $exists: false } }],
    observaciones: { $exists: true, $nin: [null, ''] },
  })
    .select('_id numDoc observaciones empresaId')
    .lean();

  let vinculados = 0;
  let sinCoincidencia = 0;
  let ambiguos = 0;
  const detalle = [];
  const ambiguosDetalle = [];

  for (const al of alumnos) {
    const obs = String(al.observaciones || '').trim();
    if (!obs) continue;

    const hit = buscarClienteUnicoDesdeObservaciones(obs, clientes);
    if (hit) {
      const { cliente: cli, segmentoUsado } = hit;
      detalle.push({
        numDoc: al.numDoc,
        observaciones: obs,
        segmentoUsado,
        empresaId: String(cli._id),
        empresaNombre: nombreCliente(cli),
      });
      if (!dryRun) {
        await DatosAlumno.updateOne(
          { _id: al._id },
          { $set: { empresaId: cli._id, fechaMod: new Date(), userChangeRecord: 'vincular-empresa-obs' } },
        );
      }
      vinculados += 1;
      continue;
    }

    let maxCoincidencias = 0;
    for (const seg of segmentosObservaciones(obs)) {
      const n = clientesQueCoinciden(seg, clientes).length;
      if (n > maxCoincidencias) maxCoincidencias = n;
    }
    if (maxCoincidencias > 1) {
      ambiguos += 1;
      ambiguosDetalle.push({ numDoc: al.numDoc, observaciones: obs, maxCoincidencias });
    } else {
      sinCoincidencia += 1;
    }
  }

  const resumen = {
    modo: dryRun ? 'dry-run' : 'aplicado',
    clientesActivos: clientes.length,
    candidatos: alumnos.length,
    vinculados,
    sinCoincidencia,
    ambiguos,
    vinculos: detalle,
    ambiguosEjemplos: ambiguosDetalle.slice(0, 30),
  };

  console.log(JSON.stringify(resumen, null, 2));

  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
