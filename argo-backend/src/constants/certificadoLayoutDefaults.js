/** Campos de datos que se superponen sobre la plantilla PNG */
const CAMPOS_IDS = [
  'nombre',
  'tipoDoc',
  'doc',
  'expedida',
  'curso',
  'ciudad',
  'horas',
  'fecha',
  'vence',
  'acta',
  'folio',
  'runt',
  'obs',
  'certId',
];

const CAMPOS_LABEL = {
  nombre: 'Nombre del alumno',
  tipoDoc: 'Tipo de documento (código)',
  doc: 'Número de documento',
  expedida: 'Documento expedido en',
  curso: 'Nombre del curso / encabezado',
  ciudad: 'Ciudad (constancia)',
  horas: 'Intensidad horaria',
  fecha: 'Fecha de emisión',
  vence: 'Válido hasta',
  acta: 'Número de acta',
  folio: 'Número de folio',
  runt: 'Número RUNT',
  obs: 'Observaciones',
  certId: 'Código del certificado',
};

const LAYOUT_HORIZONTAL = {
  pageW: '297mm',
  pageH: '210mm',
  color: '#4a3a6a',
  nombre: { top: '28%', fs: '28pt', fw: '700', align: 'center', w: '82%' },
  tipoDoc: { top: '35.5%', left: '48%', w: '10%', align: 'right', fs: '12.5pt' },
  doc: { top: '35.5%', left: '62%', w: '34%', align: 'left', fs: '12.5pt' },
  expedida: { top: '38.2%', left: '48%', w: '48%', align: 'left', fs: '10pt' },
  curso: { top: '42%', fs: '32pt', fw: '700', align: 'center', w: '82%' },
  ciudad: { top: '54%', fs: '10pt', align: 'center' },
  horas: { top: '60.8%', left: '61.5%', w: '10%', align: 'left', fs: '15pt' },
  fecha: { top: '59%', left: '36%', w: '22%', align: 'center', fs: '11.5pt' },
  vence: { top: '59%', left: '60%', w: '26%', align: 'center', fs: '9.5pt' },
  acta: { top: '70%', left: '12%', w: '22%', align: 'center', fs: '9pt' },
  folio: { top: '70%', left: '38%', w: '22%', align: 'center', fs: '9pt' },
  runt: { top: '70%', left: '64%', w: '22%', align: 'center', fs: '9pt' },
  obs: { top: '74%', fs: '8.5pt', align: 'center' },
  certId: { bottom: '10%', left: '4%', fs: '7pt', align: 'left' },
};

const LAYOUT_VERTICAL = {
  pageW: '210mm',
  pageH: '297mm',
  color: '#4a3a6a',
  nombre: { top: '31%', fs: '26pt', fw: '700', ls: '0.03em', align: 'center', w: '82%' },
  tipoDoc: { top: '39%', left: '46%', w: '12%', align: 'right', fs: '12.5pt' },
  doc: { top: '39%', left: '62%', w: '34%', align: 'left', fs: '12.5pt' },
  expedida: { top: '41.5%', left: '46%', w: '50%', align: 'left', fs: '10pt' },
  curso: { top: '47%', fs: '32pt', fw: '700', align: 'center', w: '82%' },
  ciudad: { top: '57%', fs: '10pt', align: 'center' },
  horas: { top: '64.5%', left: '60.5%', w: '12%', align: 'left', fs: '15pt' },
  fecha: { top: '62%', left: '34%', w: '24%', align: 'center', fs: '11.5pt' },
  vence: { top: '62%', left: '58%', w: '28%', align: 'center', fs: '9.5pt' },
  acta: { top: '72%', left: '10%', w: '25%', align: 'center', fs: '9pt' },
  folio: { top: '72%', left: '38%', w: '25%', align: 'center', fs: '9pt' },
  runt: { top: '72%', left: '66%', w: '25%', align: 'center', fs: '9pt' },
  obs: { top: '76%', fs: '8.5pt', align: 'center' },
  certId: { bottom: '11%', left: '5%', fs: '7pt', align: 'left' },
};

const DEFAULTS_ORIENTACION = {
  vertical: LAYOUT_VERTICAL,
  horizontal: LAYOUT_HORIZONTAL,
};

const MUESTRA_PREVIEW = {
  certificado: {
    _id: 'preview',
    codigoCert: 'CERT-000001',
    fechaEmision: new Date().toISOString(),
    fechaVencimiento: new Date(Date.now() + 365 * 86400000).toISOString(),
    numActa: '12345',
    numFolio: '67890',
    numRunt: 'RUNT-001',
    observaciones: 'Sin observaciones',
    encabezado: 'TRANSPORTE DE MERCANCIAS PELIGROSAS CLASE 3',
  },
  alumno: {
    nombre1: 'JUAN',
    nombre2: 'CARLOS',
    apellido1: 'PEREZ',
    apellido2: 'GOMEZ',
    tipoDoc: '1',
    numDoc: '1234567890',
    expedida: 'BOGOTÁ D.C.',
  },
  tipoDocCod: 'CC',
  programa: {
    nomCert: 'CAPACITACIÓN EJEMPLO ARGO',
    horas: 40,
  },
};

/** Posición QR por esquina (por orientación de hoja) */
const QR_PRESETS = {
  vertical: {
    inferior_izquierda: { bottom: '2.5%', left: '2.5%' },
    inferior_derecha: { bottom: '2.5%', right: '2.5%' },
    superior_derecha: { top: '2%', right: '2.5%' },
    superior_izquierda: { top: '2%', left: '2.5%' },
  },
  horizontal: {
    inferior_izquierda: { bottom: '2.5%', left: '2.5%' },
    inferior_derecha: { bottom: '2.5%', right: '2.5%' },
    superior_derecha: { top: '2%', right: '2.5%' },
    superior_izquierda: { top: '2%', left: '2.5%' },
  },
};

const { QR_DEFAULT_SIZE_PCT } = require('../utils/certificadoQr');

module.exports = {
  CAMPOS_IDS,
  CAMPOS_LABEL,
  LAYOUT_HORIZONTAL,
  LAYOUT_VERTICAL,
  DEFAULTS_ORIENTACION,
  MUESTRA_PREVIEW,
  QR_PRESETS,
  QR_DEFAULT_SIZE_PCT,
};
