/**
 * Registra asistencia de inscritos en clases finalizadas sin asistencia (reparación).
 * Uso: node scripts/repararAsistenciasClasesFinalizadas.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const ClaseJornadaCap = require('../src/models/ClaseJornadaCap');
const { registrarAsistenciasInscritosPendientes } = require('../src/services/asistenciaJornadaCap');

const reqFake = { user: { username: 'script-reparacion' }, permisos: ['jornadas.gestionar'] };

(async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/argo');
  const clases = await ClaseJornadaCap.find({ estado: 'FINALIZADO' }).lean();
  let totalReg = 0;
  let totalCert = 0;
  for (const cl of clases) {
    const r = await registrarAsistenciasInscritosPendientes(reqFake, cl, {
      omitirValidacionJornada: true,
    });
    if (r.registradas > 0) {
      console.log('Clase', cl._id, '→', r.registradas, 'asistencias,', r.certificadosNuevos, 'certificados');
    }
    totalReg += r.registradas;
    totalCert += r.certificadosNuevos;
  }
  console.log('\nTotal asistencias registradas:', totalReg);
  console.log('Total certificados generados:', totalCert);
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
