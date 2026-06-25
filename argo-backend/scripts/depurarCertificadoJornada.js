require('dotenv').config();
const mongoose = require('mongoose');
const Contratacion = require('../src/models/Contratacion');
const JornadaCap = require('../src/models/JornadaCap');
const ClaseJornadaCap = require('../src/models/ClaseJornadaCap');
const AsisClasJorCap = require('../src/models/AsisClasJorCap');
const Matricula = require('../src/models/Matricula');
const Liquidacion = require('../src/models/Liquidacion');
const Certificado = require('../src/models/Certificado');
const PlantillaCertificado = require('../src/models/PlantillaCertificado');
const {
  intentarCertificadoJornadaAuto,
  progresoCertificacion,
  contarAsistenciasContrato,
} = require('../src/services/certificadoJornadaAuto');
const { parseNumDoc } = require('../src/utils/numDoc');

(async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/argo');

  const contratos = await Contratacion.find({}).sort({ updatedAt: -1 }).limit(5).lean();
  console.log('\n=== CONTRATOS RECIENTES ===');
  for (const c of contratos) {
    console.log({
      _id: c._id,
      codContrato: c.codContrato,
      numSesCert: c.numSesCert,
      nombreCertificacion: c.nombreCertificacion,
    });
  }

  const clases = await ClaseJornadaCap.find({ estado: 'FINALIZADO' }).sort({ updatedAt: -1 }).limit(5).lean();
  console.log('\n=== CLASES FINALIZADAS RECIENTES ===');
  for (const cl of clases) {
    const j = await JornadaCap.findById(cl.idJornada).lean();
    const nAsis = await AsisClasJorCap.countDocuments({ idclaseJornada: cl._id });
    console.log({
      _id: cl._id,
      idJornada: cl.idJornada,
      idContrato: j?.idContrato,
      idPrograma: cl.idPrograma,
      nAsis,
    });
  }

  const asistencias = await AsisClasJorCap.find({}).sort({ createdAt: -1 }).limit(10).lean();
  console.log('\n=== ASISTENCIAS RECIENTES ===');
  for (const a of asistencias) {
    const cl = await ClaseJornadaCap.findById(a.idclaseJornada).lean();
    const j = cl ? await JornadaCap.findById(cl.idJornada).lean() : null;
    console.log({
      numDoc: a.numDocAlumno,
      clase: a.idclaseJornada,
      idContrato: j?.idContrato,
      idProg: cl?.idPrograma,
    });
  }

  const plantillas = await PlantillaCertificado.find({
    tipoCertificado: 'jornada_capacitacion',
    activa: { $ne: false },
  }).lean();
  console.log('\n=== PLANTILLAS jornada_capacitacion ===', plantillas.length);

  // Diagnóstico por alumno con asistencias
  const docs = [...new Set(asistencias.map((a) => a.numDocAlumno))];
  for (const numDoc of docs.slice(0, 5)) {
    const asis = await AsisClasJorCap.find({ numDocAlumno: numDoc }).lean();
    for (const a of asis) {
      const cl = await ClaseJornadaCap.findById(a.idclaseJornada).lean();
      if (!cl) continue;
      const j = await JornadaCap.findById(cl.idJornada).lean();
      if (!j?.idContrato) {
        console.log('\nALUMNO', numDoc, '- jornada sin idContrato');
        continue;
      }
      const progId = String(cl.idPrograma);
      const sesiones = await contarAsistenciasContrato(numDoc, j.idContrato);
      const progreso = await progresoCertificacion(numDoc, j.idContrato);
      const mats = await Matricula.find({ numDoc }).lean();
      const liqs = await Liquidacion.find({ numDoc: parseNumDoc(numDoc) }).lean();
      const intento = await intentarCertificadoJornadaAuto(numDoc, progId, j.idContrato, j._id);
      console.log('\n--- DIAG ALUMNO', numDoc, 'contrato', j.idContrato, '---');
      console.log('sesiones:', sesiones, 'numSesCert:', progreso.numSesCert);
      console.log('matriculas:', mats.map((m) => ({ idProg: m.idProg, estado: m.estado })));
      console.log('liquidaciones:', liqs.map((l) => ({ idProg: l.idProg, idMat: l.idMat })));
      console.log('intento cert:', intento);
    }
  }

  const certs = await Certificado.find({ generadoAutoJornada: true }).sort({ createdAt: -1 }).limit(5).lean();
  console.log('\n=== CERTS AUTO ===', certs.length, certs.map((c) => c.codigoCert));

  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
