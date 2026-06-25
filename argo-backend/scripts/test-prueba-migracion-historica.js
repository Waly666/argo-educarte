/**
 * Prueba rápida: migración de certificados históricos (sin alumno/programa).
 * Uso: node scripts/test-prueba-migracion-historica.js [--import]
 */
require('dotenv').config();
const XLSX = require('xlsx');
const { connectDB } = require('../src/config/db');
const { analizarArchivo, importarArchivo } = require('../src/services/migracionDatos');
const { consultarCertificadosPublico } = require('../src/services/aulaVirtualCertificados');

const NUM_DOC = 9998887776;

function crearExcelPrueba() {
  const wb = XLSX.utils.book_new();
  const filas = [
    {
      numDoc: NUM_DOC,
      nombreTitular: 'MARIA PRUEBA MIGRACION',
      codigoPrograma: '',
      codVerificacion: 'VRF-PRUEBA-HIST-001',
      codigoCertificado: 'CERT-PRUEBA-HIST-001',
      nombreCurso: 'Curso histórico de prueba',
      horas: 20,
      fechaEmision: '2023-05-10',
      fechaVencimiento: '2024-05-10',
      numActa: '',
      numFolio: '',
      numRunt: '',
      estado: 'vigente',
    },
  ];
  const ws = XLSX.utils.json_to_sheet(filas);
  XLSX.utils.book_append_sheet(wb, ws, 'Certificados');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

async function main() {
  const buffer = crearExcelPrueba();
  const opts = { certificadosHistoricos: true };

  console.log('--- Validación modo histórico ---');
  const analisis = await analizarArchivo(buffer, ['certificados'], opts);
  console.log('Modo:', analisis.opcionesIntegridad);
  console.log('Válidos:', analisis.validos.certificados.length);
  console.log('Errores:', analisis.errores.length, analisis.errores);

  if (analisis.errores.length) {
    process.exitCode = 1;
    return;
  }

  if (!process.argv.includes('--import')) {
    console.log('\nOK validación. Ejecute con --import para importar y consultar en Aula Virtual.');
    return;
  }

  await connectDB();
  console.log('\n--- Importación ---');
  const r = await importarArchivo(buffer, {
    usuario: 'test-script',
    nombreArchivo: 'prueba-historica.xlsx',
    hojas: ['certificados'],
    ...opts,
  });
  console.log('Resultado:', r.certificados);

  console.log('\n--- Consulta pública Aula Virtual ---');
  const consulta = await consultarCertificadosPublico(NUM_DOC);
  console.log(JSON.stringify(consulta, null, 2));

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
