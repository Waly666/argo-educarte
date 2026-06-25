const mongoose = require('mongoose');
const XLSX = require('xlsx');

const DatosAlumno = require('../models/DatosAlumno');
const Matricula = require('../models/Matricula');
const Liquidacion = require('../models/Liquidacion');
const Ingreso = require('../models/Ingreso');
const Certificado = require('../models/Certificado');
const Config = require('../models/Config');
const { models: cat } = require('../models/catalogos');
const { parseNumDoc, numDocInvalidMessage } = require('../utils/numDoc');
const {
  num,
  maxNumericId,
  insertarCatalogo,
  generarCodigoProg,
  buscarPrograma,
  sincronizarServicioPrograma,
  listarServiciosMatricula,
} = require('./programaServicio');
const { cargarIndiceTipCap, resolverIdTipCapCanonico } = require('./tipoCapacitacionMatch');
const { esProgramaJornadasCap } = require('./jornadaCapacitacion');
const { normalizarTipoCertificado } = require('./clasificacionCertificado');
const {
  normalizarModalidadesPrograma,
  esSoloVirtual,
  valorMatriculaPrograma,
} = require('./programaModalidad');
const {
  MODALIDAD_VIRTUAL,
  MODALIDAD_PRESENCIAL,
} = require('../constants/modalidadPrograma');
const { CLAVE: CLAVE_CERT } = require('./configCertificado');
const { CLAVE: CLAVE_RECIBO } = require('./configRecibo');
const { ID_PROG_HISTORICO } = require('../constants/migracionHistorico');
const { vincularPagoMigradoALiquidaciones } = require('./migracionMovimientos');
const progreso = require('./progresoOperacion');

/** Historial de lotes de migración. */
const MigracionLote =
  mongoose.models.MigracionLote ||
  mongoose.model(
    'MigracionLote',
    new mongoose.Schema({}, { collection: 'migracionLotes', strict: false, timestamps: true }),
  );

const HOJAS = {
  programas: 'Programas',
  alumnos: 'Alumnos',
  matriculas: 'Matriculas',
  pagos: 'Pagos',
  certificados: 'Certificados',
};

const CLAVES_HOJAS = Object.keys(HOJAS);

/**
 * Normaliza la selección de qué migrar (dinámico por cliente):
 * acepta array o cadena "alumnos,certificados". Vacío/inválido = todas.
 */
function normalizarHojas(raw) {
  let lista = raw;
  if (typeof raw === 'string') lista = raw.split(',');
  if (!Array.isArray(lista)) return [...CLAVES_HOJAS];
  const sel = lista
    .map((h) => String(h || '').trim().toLowerCase())
    .filter((h) => CLAVES_HOJAS.includes(h));
  return sel.length ? sel : [...CLAVES_HOJAS];
}

/** Integridad relacional: completa (default) o histórica para certificados sin alumno/programa. */
function normalizarOpcionesIntegridad(raw = {}) {
  const certificadosHistoricos =
    raw.certificadosHistoricos === true
    || raw.certificadosHistoricos === 'true'
    || raw.modoIntegridad === 'historica'
    || raw.modoIntegridad === 'parcial';
  return {
    modoIntegridad: certificadosHistoricos ? 'historica' : 'completa',
    certificadosHistoricos,
    exigirAlumnoEnCertificados: !certificadosHistoricos,
    exigirProgramaEnCertificados: !certificadosHistoricos,
  };
}

const COLUMNAS = {
  programas: [
    'codigoPrograma', 'nombrePrograma', 'tipoCapacitacion', 'modalidad', 'horas', 'semestres',
    'diasVencimiento', 'tarifa1', 'tarifa2', 'tarifa3', 'tarifaVirtual',
  ],
  alumnos: [
    'numDoc', 'tipoDoc', 'nombre1', 'nombre2', 'apellido1', 'apellido2',
    'fechaNacimiento', 'genero', 'celular', 'correo', 'direccion', 'municipio', 'observaciones',
  ],
  matriculas: [
    'numDoc', 'codigoPrograma', 'fechaMatricula', 'valorTotal', 'valorPagado', 'estado', 'observaciones',
  ],
  pagos: [
    'numDoc', 'numeroRecibo', 'fecha', 'valor', 'formaPago', 'concepto', 'observaciones',
  ],
  certificados: [
    'numDoc', 'nombreTitular', 'codVerificacion', 'codigoPrograma', 'codigoCertificado', 'nombreCurso', 'horas',
    'fechaEmision', 'fechaVencimiento', 'numActa', 'numFolio', 'numRunt', 'estado',
  ],
};

const EJEMPLOS = {
  programas: [{
    codigoPrograma: '101', nombrePrograma: 'CURSO DE CONDUCCIÓN B1',
    tipoCapacitacion: 'Licencia de conducción', modalidad: 'Presencial', horas: 40, semestres: '',
    diasVencimiento: 365, tarifa1: 1200000, tarifa2: '', tarifa3: '', tarifaVirtual: '',
  }, {
    codigoPrograma: '201', nombrePrograma: 'CURSO PRIMER RESPONDIENTE (VIRTUAL)',
    tipoCapacitacion: 'Curso', modalidad: 'Virtual', horas: 20, semestres: '',
    diasVencimiento: 365, tarifa1: '', tarifa2: '', tarifa3: '', tarifaVirtual: 150000,
  }],
  alumnos: [{
    numDoc: 1098765432, tipoDoc: 'CC', nombre1: 'JUAN', nombre2: 'CARLOS',
    apellido1: 'PEREZ', apellido2: 'GOMEZ', fechaNacimiento: '1995-04-23', genero: 'Masculino',
    celular: '3001234567', correo: 'juan@correo.com', direccion: 'Calle 1 # 2-3',
    municipio: 'Bucaramanga', observaciones: '',
  }],
  matriculas: [{
    numDoc: 1098765432, codigoPrograma: '101', fechaMatricula: '2024-02-15',
    valorTotal: 1200000, valorPagado: 800000, estado: 'Activo', observaciones: '',
  }],
  pagos: [{
    numDoc: 1098765432, numeroRecibo: 'RC-00125', fecha: '2024-02-15', valor: 800000,
    formaPago: 'Efectivo', concepto: 'Abono curso de conducción', observaciones: '',
  }],
  certificados: [{
    numDoc: 1098765432, nombreTitular: 'JUAN CARLOS PEREZ GOMEZ', codVerificacion: 'VRF-2024-000045',
    codigoPrograma: '', codigoCertificado: 'CERT-000045', nombreCurso: 'Curso de conducción B1', horas: 40,
    fechaEmision: '2024-06-30', fechaVencimiento: '', numActa: '', numFolio: '', numRunt: '',
    estado: 'vigente',
  }],
};

function instrucciones(hojasSel, opciones = {}) {
  const opts = normalizarOpcionesIntegridad(opciones);
  const filas = [
    ['PLANTILLA DE MIGRACIÓN DE DATOS — ARGO'],
    [`Incluye: ${hojasSel.map((h) => HOJAS[h]).join(', ')}`],
    [''],
    ['Cómo usarla:'],
    ['1. Exporte los datos de su aplicación anterior y péguelos en las hojas de este archivo.'],
    ['2. No cambie los nombres de las hojas ni de las columnas de la fila 1.'],
    ['3. Borre las filas de ejemplo antes de importar.'],
    ['4. Las fechas pueden ir como AAAA-MM-DD o DD/MM/AAAA.'],
    [`5. numDoc es el número de documento sin puntos ni espacios (6 a 14 dígitos).`],
    ['6. codigoPrograma enlaza matrículas y certificados con el programa: debe venir en la hoja Programas o existir ya en ARGO (Académico → Programas).'],
    ['7. En el ERP: Sistema → Migración de datos → "Validar archivo" para revisar errores antes de importar.'],
    [''],
  ];
  const detalle = {
    programas:
      'Hoja Programas: obligatorios codigoPrograma, nombrePrograma y tipoCapacitacion. modalidad = Presencial, Virtual o Mixta (vacío = se deduce de las tarifas). En Presencial/Mixta tarifa1 = valor de matrícula (obligatorio); en Virtual configure tarifaVirtual (obligatorio) y tarifa1 puede ir vacío. semestres vacío = un solo cobro; con número, el valor se reparte en cuotas. tarifa2/tarifa3 = precios alternativos presenciales; tarifaVirtual = precio aula virtual. tipoCapacitacion debe coincidir con un tipo del catálogo de ARGO.',
    alumnos: 'Hoja Alumnos: obligatorios numDoc, nombre1, apellido1.',
    matriculas:
      'Hoja Matriculas: obligatorios numDoc y codigoPrograma. valorTotal y valorPagado calculan el saldo pendiente. El codigoPrograma debe existir en ARGO o venir en la hoja Programas.',
    pagos: 'Hoja Pagos: obligatorios numDoc y valor. numeroRecibo conserva el número del sistema anterior.',
    certificados: opts.certificadosHistoricos
      ? 'Hoja Certificados (modo histórico): obligatorios numDoc y fechaEmision. codVerificacion es el código que verán en la consulta pública del Aula Virtual. Recomendado nombreCurso y nombreTitular. codigoPrograma es opcional (si viene y no existe en ARGO, se importa como histórico). horas = horas del certificado. estado: vigente o anulado.'
      : 'Hoja Certificados: obligatorios numDoc y fechaEmision. Si codigoPrograma existe en ARGO se vincula; si viene vacío o el programa no está en ARGO, se importa como certificado histórico (use nombreCurso). estado: vigente o anulado.',
  };
  for (const h of hojasSel) filas.push([detalle[h]]);
  if (opts.certificadosHistoricos && hojasSel.includes('certificados')) {
    filas.push(
      [''],
      ['MODO HISTÓRICO: no se exige que el alumno ni el programa existan en ARGO.'],
      ['nombreTitular se usa en la consulta del Aula Virtual si el alumno aún no está registrado.'],
    );
  } else if (!hojasSel.includes('alumnos')) {
    filas.push(
      [''],
      ['IMPORTANTE: esta plantilla no incluye la hoja Alumnos. Los numDoc referenciados deben'],
      ['existir ya en ARGO; de lo contrario la validación marcará error en esas filas.'],
    );
  }
  if (
    !opts.certificadosHistoricos
    && !hojasSel.includes('programas')
    && (hojasSel.includes('matriculas') || hojasSel.includes('certificados'))
  ) {
    filas.push(
      [''],
      ['IMPORTANTE: esta plantilla no incluye la hoja Programas. Los codigoPrograma referenciados'],
      ['deben existir ya en ARGO (Académico → Programas); de lo contrario esas filas saldrán con error.'],
    );
  }
  return filas;
}

function generarPlantilla(hojas, opciones = {}) {
  const hojasSel = normalizarHojas(hojas);
  const wb = XLSX.utils.book_new();
  const wsInstr = XLSX.utils.aoa_to_sheet(instrucciones(hojasSel, opciones));
  wsInstr['!cols'] = [{ wch: 110 }];
  XLSX.utils.book_append_sheet(wb, wsInstr, 'Instrucciones');
  for (const clave of hojasSel) {
    const ws = XLSX.utils.json_to_sheet(EJEMPLOS[clave], { header: COLUMNAS[clave] });
    ws['!cols'] = COLUMNAS[clave].map((c) => ({ wch: Math.max(14, c.length + 4) }));
    XLSX.utils.book_append_sheet(wb, ws, HOJAS[clave]);
  }
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

function parseFecha(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
  if (typeof v === 'number') {
    // Serial de Excel
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return new Date(d.y, d.m - 1, d.d, d.H || 0, d.M || 0, d.S || 0);
    return null;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseValor(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const n = Number(String(v).replace(/[$.\s]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function normalizarFormaPago(v) {
  const s = String(v || '').trim().toLowerCase();
  if (!s) return undefined;
  if (s.startsWith('efect')) return 'Efectivo';
  if (s.startsWith('transf') || s.includes('consign')) return 'Transferencia';
  if (s.startsWith('cheq')) return 'Cheque';
  if (s.includes('debito') || s.includes('débito')) return 'Tarjeta debito';
  if (s.includes('credito') || s.includes('crédito') || s.includes('tarjeta')) return 'Tarjeta de Credito';
  return undefined;
}

function leerHoja(wb, nombre) {
  const ws = wb.Sheets[nombre];
  if (!ws) return [];
  const filas = XLSX.utils.sheet_to_json(ws, { defval: '', raw: true });
  // __rowNum__ es 0-based incluyendo encabezado → fila Excel = +1
  return filas.map((f) => ({ ...f, _fila: (f.__rowNum__ ?? 0) + 1 }));
}

function str(v) {
  return String(v ?? '').trim();
}

/** Resuelve el tipo de capacitación y si es jornada (sin cobro al alumno). */
async function resolverTipoCap(raw, indiceTipCap) {
  const indice =
    indiceTipCap && typeof indiceTipCap === 'object' && indiceTipCap.byCanon
      ? indiceTipCap
      : await cargarIndiceTipCap();
  const idTipCap = resolverIdTipCapCanonico(raw, indice) || str(raw);
  const esJornada = await esProgramaJornadasCap({ idTipCap, nombreProg: '' });
  return { idTipCap, esJornada };
}

/**
 * Deduce las modalidades de un programa de la migración: usa la columna
 * `modalidad` si viene; si no, las infiere de las tarifas (tarifaVirtual =>
 * virtual; tarifa1 => presencial).
 */
function modalidadesDeFila(fila) {
  const explicit = normalizarModalidadesPrograma(
    str(fila.modalidad) ? [fila.modalidad] : [],
  );
  if (explicit.length) return explicit;
  const mods = [];
  const tienePres = num(fila.tarifa1) > 0;
  const tieneVirtual = num(fila.tarifaVirtual) > 0;
  if (tienePres || !tieneVirtual) mods.push(MODALIDAD_PRESENCIAL);
  if (tieneVirtual) mods.push(MODALIDAD_VIRTUAL);
  return mods.length ? mods : [MODALIDAD_PRESENCIAL];
}

/**
 * Crea un programa (y su servicio de matrícula con tarifas) replicando la
 * lógica del alta normal: idPrograma/codigoProg, servicio vía
 * sincronizarServicioPrograma. Reutilizable desde la migración.
 */
async function crearProgramaConServicio(fila, indiceTipCap, usuario) {
  const { idTipCap, esJornada } = await resolverTipoCap(fila.tipoCapacitacion, indiceTipCap);
  const nombreProg = str(fila.nombrePrograma).toUpperCase();
  const tarifa1 = num(fila.tarifa1);
  const tarifaVirtual = num(fila.tarifaVirtual);
  const modalidades = esJornada ? [] : modalidadesDeFila(fila);
  const soloVirtual = !esJornada && esSoloVirtual(modalidades);
  const valorMatricula = esJornada
    ? 0
    : valorMatriculaPrograma({ modalidades }, [], { tarifa1, tarifaVirtual });

  let codigoProg = str(fila.codigoPrograma);
  if (!codigoProg) codigoProg = await generarCodigoProg(idTipCap);

  const now = new Date();
  const semestres =
    fila.semestres != null && str(fila.semestres) !== '' ? Number(fila.semestres) : null;
  const idPrograma = await maxNumericId(cat.programas, 'idPrograma');
  const progDoc = {
    idPrograma,
    codigoProg,
    nombreProg,
    nomCert: nombreProg,
    idTipCap,
    semestres: Number.isFinite(semestres) && semestres >= 1 ? semestres : null,
    horas: str(fila.horas) !== '' ? Number(fila.horas) : null,
    valorMatricula,
    estado: 'ACTIVO',
    diasVencimiento: str(fila.diasVencimiento) !== '' ? Number(fila.diasVencimiento) : 365,
    tipoCertificado: normalizarTipoCertificado(null),
    ...(esJornada ? {} : { modalidades }),
    migrado: true,
    fechaAudi: now,
    userAddReg: usuario,
    fechaMod: now,
    userChangeRecord: usuario,
  };
  const prog = await insertarCatalogo(cat.programas, progDoc);

  if (!esJornada) {
    await sincronizarServicioPrograma(
      prog,
      {
        tarifa1: soloVirtual ? num(fila.tarifa1) || undefined : tarifa1,
        tarifa2: num(fila.tarifa2) || undefined,
        tarifa3: num(fila.tarifa3) || undefined,
        tarifaVirtual: tarifaVirtual || undefined,
      },
      { username: usuario },
    );
  }
  return prog;
}

/**
 * Lee y valida el archivo. Devuelve filas normalizadas y errores por hoja.
 * No escribe en la base de datos.
 * `hojas` define qué se migra (dinámico por cliente): las hojas no
 * seleccionadas se ignoran aunque tengan datos.
 */
async function analizarArchivo(buffer, hojas, opcionesIntegridad = {}) {
  const hojasSel = normalizarHojas(hojas);
  const opts = normalizarOpcionesIntegridad(opcionesIntegridad);
  const activa = (h) => hojasSel.includes(h);
  let wb;
  try {
    wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  } catch {
    const err = new Error('No se pudo leer el archivo. Use la plantilla Excel (.xlsx) de ARGO.');
    err.status = 400;
    throw err;
  }

  const datos = {
    programas: activa('programas') ? leerHoja(wb, HOJAS.programas) : [],
    alumnos: activa('alumnos') ? leerHoja(wb, HOJAS.alumnos) : [],
    matriculas: activa('matriculas') ? leerHoja(wb, HOJAS.matriculas) : [],
    pagos: activa('pagos') ? leerHoja(wb, HOJAS.pagos) : [],
    certificados: activa('certificados') ? leerHoja(wb, HOJAS.certificados) : [],
  };

  /** Hojas con datos en el archivo pero excluidas de la selección. */
  const ignoradas = CLAVES_HOJAS.filter(
    (h) => !activa(h) && leerHoja(wb, HOJAS[h]).length > 0,
  ).map((h) => HOJAS[h]);

  const indice = activa('programas') ? await cargarIndiceTipCap() : null;

  const errores = [];
  const addErr = (hoja, fila, mensaje) => errores.push({ hoja, fila, mensaje });

  // --- Programas (se crean primero; matrículas y certificados pueden referenciarlos) ---
  const programasValidos = [];
  const codigosProgramaArchivo = new Set();
  const vistosCodigo = new Set();
  for (const f of datos.programas) {
    const codigo = str(f.codigoPrograma);
    if (!codigo) {
      addErr(HOJAS.programas, f._fila, 'codigoPrograma es obligatorio');
      continue;
    }
    if (vistosCodigo.has(codigo.toLowerCase())) {
      addErr(HOJAS.programas, f._fila, `codigoPrograma "${codigo}" repetido en el archivo`);
      continue;
    }
    vistosCodigo.add(codigo.toLowerCase());
    if (!str(f.nombrePrograma)) {
      addErr(HOJAS.programas, f._fila, `Programa ${codigo}: nombrePrograma es obligatorio`);
      continue;
    }
    if (!str(f.tipoCapacitacion)) {
      addErr(HOJAS.programas, f._fila, `Programa ${codigo}: tipoCapacitacion es obligatorio`);
      continue;
    }
    const { idTipCap, esJornada } = await resolverTipoCap(f.tipoCapacitacion, indice);
    if (!idTipCap) {
      addErr(HOJAS.programas, f._fila, `Programa ${codigo}: tipoCapacitacion "${f.tipoCapacitacion}" no se reconoce`);
      continue;
    }
    if (!esJornada) {
      const modalidades = modalidadesDeFila(f);
      const soloVirtual = esSoloVirtual(modalidades);
      const tienePres = modalidades.some((m) => m !== MODALIDAD_VIRTUAL);
      if (soloVirtual && num(f.tarifaVirtual) <= 0) {
        addErr(HOJAS.programas, f._fila, `Programa ${codigo}: modalidad Virtual requiere tarifaVirtual mayor a 0`);
        continue;
      }
      if (tienePres && num(f.tarifa1) <= 0) {
        addErr(HOJAS.programas, f._fila, `Programa ${codigo}: tarifa1 (valor de matrícula) debe ser mayor a 0`);
        continue;
      }
      if (modalidades.includes(MODALIDAD_VIRTUAL) && num(f.tarifaVirtual) <= 0) {
        addErr(HOJAS.programas, f._fila, `Programa ${codigo}: modalidad Virtual requiere tarifaVirtual mayor a 0`);
        continue;
      }
    }
    codigosProgramaArchivo.add(codigo.toLowerCase());
    programasValidos.push({ _fila: f._fila, codigo, doc: f });
  }

  // numDocs presentes: en BD o en la hoja Alumnos del mismo archivo
  const numDocsArchivo = new Set();
  const alumnosValidos = [];
  const vistosAlumno = new Set();

  for (const f of datos.alumnos) {
    const numDoc = parseNumDoc(f.numDoc);
    if (numDoc == null) {
      addErr(HOJAS.alumnos, f._fila, `numDoc inválido: "${f.numDoc}" (${numDocInvalidMessage()})`);
      continue;
    }
    if (vistosAlumno.has(numDoc)) {
      addErr(HOJAS.alumnos, f._fila, `numDoc ${numDoc} repetido en el archivo`);
      continue;
    }
    vistosAlumno.add(numDoc);
    if (!str(f.nombre1) || !str(f.apellido1)) {
      addErr(HOJAS.alumnos, f._fila, `Alumno ${numDoc}: nombre1 y apellido1 son obligatorios`);
      continue;
    }
    const fechaNac = f.fechaNacimiento ? parseFecha(f.fechaNacimiento) : null;
    if (f.fechaNacimiento && !fechaNac) {
      addErr(HOJAS.alumnos, f._fila, `Alumno ${numDoc}: fechaNacimiento inválida ("${f.fechaNacimiento}")`);
    }
    numDocsArchivo.add(numDoc);
    alumnosValidos.push({ _fila: f._fila, numDoc, doc: f, fechaNac });
  }

  const existeAlumno = async (numDoc) => {
    if (numDocsArchivo.has(numDoc)) return true;
    const n = await DatosAlumno.countDocuments({ numDoc });
    return n > 0;
  };

  // Un programa es válido si ya existe en ARGO o si viene en la hoja Programas del archivo.
  const cacheExistePrograma = new Map();
  const existePrograma = async (codigo) => {
    const c = str(codigo);
    if (!c) return false;
    if (codigosProgramaArchivo.has(c.toLowerCase())) return true;
    if (cacheExistePrograma.has(c)) return cacheExistePrograma.get(c);
    const prog = await buscarPrograma(c);
    const ok = !!prog;
    cacheExistePrograma.set(c, ok);
    return ok;
  };

  const matriculasValidas = [];
  for (const f of datos.matriculas) {
    const numDoc = parseNumDoc(f.numDoc);
    if (numDoc == null) {
      addErr(HOJAS.matriculas, f._fila, `numDoc inválido: "${f.numDoc}"`);
      continue;
    }
    if (!(await existeAlumno(numDoc))) {
      addErr(HOJAS.matriculas, f._fila, `Alumno ${numDoc} no existe (ni en ARGO ni en la hoja Alumnos)`);
      continue;
    }
    const codigoPrograma = str(f.codigoPrograma);
    if (!(await existePrograma(codigoPrograma))) {
      addErr(HOJAS.matriculas, f._fila, `Programa "${codigoPrograma}" no existe en ARGO ni en la hoja Programas`);
      continue;
    }
    const valorTotal = parseValor(f.valorTotal) ?? 0;
    const valorPagado = parseValor(f.valorPagado) ?? 0;
    matriculasValidas.push({
      _fila: f._fila,
      numDoc,
      codigoPrograma,
      fechaMat: parseFecha(f.fechaMatricula) || new Date(),
      valorTotal,
      valorPagado,
      estado: str(f.estado) || 'Activo',
      observaciones: str(f.observaciones),
    });
  }

  const pagosValidos = [];
  for (const f of datos.pagos) {
    const numDoc = parseNumDoc(f.numDoc);
    if (numDoc == null) {
      addErr(HOJAS.pagos, f._fila, `numDoc inválido: "${f.numDoc}"`);
      continue;
    }
    if (!(await existeAlumno(numDoc))) {
      addErr(HOJAS.pagos, f._fila, `Alumno ${numDoc} no existe (ni en ARGO ni en la hoja Alumnos)`);
      continue;
    }
    const valor = parseValor(f.valor);
    if (valor == null || valor <= 0) {
      addErr(HOJAS.pagos, f._fila, `Pago de ${numDoc}: valor inválido ("${f.valor}")`);
      continue;
    }
    pagosValidos.push({
      _fila: f._fila,
      numDoc,
      numeroRecibo: str(f.numeroRecibo),
      fecha: parseFecha(f.fecha) || new Date(),
      valor,
      formaPago: normalizarFormaPago(f.formaPago),
      concepto: str(f.concepto),
      observaciones: str(f.observaciones),
    });
  }

  const certificadosValidos = [];
  for (const f of datos.certificados) {
    const numDoc = parseNumDoc(f.numDoc);
    if (numDoc == null) {
      addErr(HOJAS.certificados, f._fila, `numDoc inválido: "${f.numDoc}"`);
      continue;
    }
    const codigoPrograma = str(f.codigoPrograma);
    const progEnArgo = codigoPrograma ? await existePrograma(codigoPrograma) : false;
    /** Sin programa en ARGO, código vacío o modo histórico → certificado independiente (idProg HISTORICO). */
    const historico =
      opts.certificadosHistoricos || !codigoPrograma || (codigoPrograma && !progEnArgo);
    if (!historico && !(await existeAlumno(numDoc))) {
      addErr(HOJAS.certificados, f._fila, `Alumno ${numDoc} no existe (ni en ARGO ni en la hoja Alumnos)`);
      continue;
    }
    const fechaEmision = parseFecha(f.fechaEmision);
    if (!fechaEmision) {
      addErr(HOJAS.certificados, f._fila, `Certificado de ${numDoc}: fechaEmision obligatoria o inválida`);
      continue;
    }
    const encabezado = str(f.nombreCurso);
    const nombreTitular = str(f.nombreTitular);
    if (historico && !encabezado && !nombreTitular && !str(f.codigoCertificado) && !str(f.codVerificacion)) {
      addErr(
        HOJAS.certificados,
        f._fila,
        `Certificado de ${numDoc}: indique nombreCurso, nombreTitular, codVerificacion o codigoCertificado`,
      );
      continue;
    }
    if (!historico && !codigoPrograma) {
      addErr(
        HOJAS.certificados,
        f._fila,
        'codigoPrograma es obligatorio cuando el certificado debe ligarse a un programa de ARGO',
      );
      continue;
    }
    if (!historico && codigoPrograma && !progEnArgo) {
      addErr(
        HOJAS.certificados,
        f._fila,
        `Programa "${codigoPrograma}" no existe en ARGO ni en la hoja Programas`,
      );
      continue;
    }
    const horasRaw = str(f.horas);
    const horasCert = horasRaw !== '' && Number.isFinite(Number(horasRaw)) ? Number(horasRaw) : null;
    const estado = str(f.estado).toLowerCase() === 'anulado' ? 'anulado' : 'vigente';
    certificadosValidos.push({
      _fila: f._fila,
      numDoc,
      codigoPrograma: progEnArgo ? codigoPrograma : null,
      codigoProgramaOrigen: codigoPrograma || null,
      codigoCert: str(f.codigoCertificado),
      codVerificacion: str(f.codVerificacion),
      encabezado,
      nombreTitular,
      horasCert,
      fechaEmision,
      fechaVencimiento: parseFecha(f.fechaVencimiento),
      numActa: str(f.numActa),
      numFolio: str(f.numFolio),
      numRunt: str(f.numRunt),
      estado,
      historico,
    });
  }

  return {
    hojas: hojasSel,
    opcionesIntegridad: opts,
    ignoradas,
    errores,
    indice,
    totales: {
      programas: datos.programas.length,
      alumnos: datos.alumnos.length,
      matriculas: datos.matriculas.length,
      pagos: datos.pagos.length,
      certificados: datos.certificados.length,
    },
    validos: {
      programas: programasValidos,
      alumnos: alumnosValidos,
      matriculas: matriculasValidas,
      pagos: pagosValidos,
      certificados: certificadosValidos,
    },
  };
}

function idProgDe(prog) {
  return String(prog.idPrograma ?? prog._id);
}

function toDec(n) {
  return mongoose.Types.Decimal128.fromString(String(Math.round(Number(n) || 0)));
}

function numDesdeCodigo(codigo) {
  const m = String(codigo || '').match(/(\d+)\s*$/);
  return m ? parseInt(m[1], 10) : 0;
}

/** Ajusta consecutivos para que los próximos números no choquen con los migrados. */
async function sincronizarConsecutivos() {
  const certs = await Certificado.find({ codigoCert: { $exists: true, $ne: '' } })
    .select('codigoCert')
    .lean();
  const maxCert = certs.reduce((m, c) => Math.max(m, numDesdeCodigo(c.codigoCert)), 0);
  await Config.updateOne(
    { clave: CLAVE_CERT, consecutivoCertificado: { $lt: maxCert } },
    { $set: { consecutivoCertificado: maxCert } },
  );

  const cfgRecibo = await Config.findOne({ clave: CLAVE_RECIBO }).lean();
  if (cfgRecibo) {
    const pref = String(cfgRecibo.prefijoComprobanteIngreso || 'CI').trim();
    const recibos = await Ingreso.find({ numRecibo: new RegExp(`^${pref}-\\d+$`) })
      .select('numRecibo')
      .lean();
    const maxRec = recibos.reduce((m, r) => Math.max(m, numDesdeCodigo(r.numRecibo)), 0);
    await Config.updateOne(
      { clave: CLAVE_RECIBO, consecutivoComprobanteIngreso: { $lt: maxRec } },
      { $set: { consecutivoComprobanteIngreso: maxRec } },
    );
  }
}

/**
 * Importa el archivo. opciones:
 * - hojas: qué migrar (['alumnos','certificados']…); vacío = todo.
 * - actualizarExistentes: si un alumno ya existe, actualiza sus datos (default false: se omite).
 * - idSede: sede asignada a matrículas y pagos migrados.
 */
async function importarArchivo(
  buffer,
  {
    usuario = 'sistema',
    nombreArchivo = '',
    idSede = null,
    actualizarExistentes = false,
    hojas,
    certificadosHistoricos,
    modoIntegridad,
  } = {},
) {
  const analisis = await analizarArchivo(buffer, hojas, { certificadosHistoricos, modoIntegridad });
  const totalFilas =
    analisis.validos.programas.length
    + analisis.validos.alumnos.length
    + analisis.validos.matriculas.length
    + analisis.validos.pagos.length
    + analisis.validos.certificados.length;

  progreso.iniciar('migracion', 'Validación completada, importando…');
  progreso.definirTotal(totalFilas);

  try {
  const lote = `MIG-${Date.now()}`;
  const marca = { migrado: true, loteMigracion: lote };
  const sede = String(idSede || '').trim() || 'PRINCIPAL';

  const resultado = {
    lote,
    hojas: analisis.hojas,
    programas: { creados: 0, omitidos: 0 },
    alumnos: { creados: 0, actualizados: 0, omitidos: 0 },
    matriculas: { creadas: 0, omitidas: 0 },
    pagos: { creados: 0, omitidos: 0 },
    certificados: { creados: 0, omitidos: 0 },
    filasConError: analisis.errores.length,
  };

  // Cache de programas (por código) que comparten matrículas y certificados.
  const cacheProg = new Map();
  const resolverProg = async (codigo) => {
    const c = str(codigo);
    if (cacheProg.has(c)) return cacheProg.get(c);
    const prog = await buscarPrograma(c);
    cacheProg.set(c, prog);
    return prog;
  };
  /** idServ del servicio de matrícula principal del programa (para ligar la liquidación). */
  const idServPrincipal = async (prog) => {
    try {
      const servs = await listarServiciosMatricula(prog);
      return servs[0]?.idServ != null ? String(servs[0].idServ) : null;
    } catch {
      return null;
    }
  };

  // 0) Programas (+ servicios con tarifas). Deben crearse antes que matrículas y certificados.
  progreso.fase('Programas', { total: totalFilas, reiniciarHecho: false });
  for (const p of analisis.validos.programas) {
    const existente = await buscarPrograma(p.codigo);
    if (existente) {
      cacheProg.set(p.codigo, existente);
      resultado.programas.omitidos += 1;
      progreso.avanzar(1);
      continue;
    }
    const prog = await crearProgramaConServicio(p.doc, analisis.indice, usuario);
    cacheProg.set(p.codigo, prog);
    resultado.programas.creados += 1;
    progreso.avanzar(1);
  }

  // 1) Alumnos
  progreso.fase('Alumnos', { reiniciarHecho: false });
  for (const a of analisis.validos.alumnos) {
    const f = a.doc;
    const existente = await DatosAlumno.findOne({ numDoc: a.numDoc }).select('_id').lean();
    const payload = {
      tipoDoc: str(f.tipoDoc) || 'CC',
      nombre1: str(f.nombre1).toUpperCase(),
      nombre2: str(f.nombre2).toUpperCase(),
      apellido1: str(f.apellido1).toUpperCase(),
      apellido2: str(f.apellido2).toUpperCase(),
      fechaNac: a.fechaNac || undefined,
      genero: str(f.genero),
      celular: str(f.celular),
      correo: str(f.correo).toLowerCase(),
      direccion: str(f.direccion),
      munOrigen: str(f.municipio),
      observaciones: str(f.observaciones),
      userAddReg: usuario,
      ...marca,
    };
    if (existente) {
      if (actualizarExistentes) {
        await DatosAlumno.updateOne({ _id: existente._id }, { $set: { ...payload, fechaMod: new Date() } });
        resultado.alumnos.actualizados += 1;
      } else {
        resultado.alumnos.omitidos += 1;
      }
      progreso.avanzar(1);
      continue;
    }
    await DatosAlumno.create({ numDoc: a.numDoc, ...payload });
    resultado.alumnos.creados += 1;
    progreso.avanzar(1);
  }

  // 2) Matrículas (+ liquidación con el saldo pendiente, ligada a programa y servicio)
  progreso.fase('Matrículas', { reiniciarHecho: false });
  for (const m of analisis.validos.matriculas) {
    const prog = await resolverProg(m.codigoPrograma);
    if (!prog) {
      resultado.matriculas.omitidas += 1;
      progreso.avanzar(1);
      continue;
    }
    const idProg = idProgDe(prog);
    const ya = await Matricula.countDocuments({ numDoc: m.numDoc, idProg });
    if (ya > 0) {
      resultado.matriculas.omitidas += 1;
      progreso.avanzar(1);
      continue;
    }
    const saldo = Math.max(0, m.valorTotal - m.valorPagado);
    let pagada = 'No Pago';
    if (m.valorTotal > 0 && saldo <= 0) pagada = 'Pagado';
    else if (m.valorPagado > 0) pagada = 'Pago Parcial';

    const mat = await Matricula.create({
      numDoc: m.numDoc,
      idSede: sede,
      idPrograma: idProg,
      idProg,
      fechaMat: m.fechaMat,
      valorMat: toDec(m.valorTotal),
      tarifa: 1,
      pagada,
      estado: m.estado,
      observaciones: m.observaciones,
      ...marca,
    });

    if (m.valorTotal > 0) {
      await Liquidacion.create({
        numDoc: m.numDoc,
        idSede: sede,
        idMat: mat._id,
        idMatricula: mat._id,
        idProg,
        idServ: await idServPrincipal(prog),
        descripcion: `${prog.nombreProg || prog.descripcion || 'Programa'} (migrado)`,
        valor: toDec(m.valorTotal),
        abonado: toDec(m.valorPagado),
        saldo: toDec(saldo),
        estado: saldo <= 0 ? 'pagado' : m.valorPagado > 0 ? 'parcial' : 'pendiente',
        fechaCreacion: m.fechaMat,
        ...marca,
      });
    }
    resultado.matriculas.creadas += 1;
    progreso.avanzar(1);
  }

  // 3) Pagos históricos
  progreso.fase('Pagos históricos', { reiniciarHecho: false });
  let secuenciaPago = 0;
  for (const p of analisis.validos.pagos) {
    const numRecibo = p.numeroRecibo || `${lote}-${String((secuenciaPago += 1)).padStart(4, '0')}`;
    const ya = await Ingreso.countDocuments({ numDoc: p.numDoc, numRecibo });
    if (ya > 0) {
      resultado.pagos.omitidos += 1;
      progreso.avanzar(1);
      continue;
    }
    const ing = await Ingreso.create({
      numDoc: p.numDoc,
      valor: toDec(p.valor),
      numRecibo,
      idTipoPago: 'MIGRACION',
      tipoIngreso: 'MIGRACION',
      idTipoIngreso: 'MIGRACION',
      concepto: p.concepto || 'Pago migrado del sistema anterior',
      fecha: p.fecha,
      formaPago: p.formaPago,
      observaciones: p.observaciones,
      ingresoCaja: false,
      idSede: sede,
      userAddReg: usuario,
      origenMigracion: true,
      ...marca,
    });
    await vincularPagoMigradoALiquidaciones(ing._id);
    resultado.pagos.creados += 1;
    progreso.avanzar(1);
  }

  // 4) Certificados (históricos o ligados a programa existente en ARGO)
  progreso.fase('Certificados', { reiniciarHecho: false });
  for (const c of analisis.validos.certificados) {
    let idProg = ID_PROG_HISTORICO;
    let nombreProg = '';
    if (c.codigoPrograma) {
      const prog = await resolverProg(c.codigoPrograma);
      if (prog) {
        idProg = idProgDe(prog);
        nombreProg = prog.nombreProg || '';
      }
    }
    const esHistorico = c.historico === true || idProg === ID_PROG_HISTORICO;
    if (c.codVerificacion) {
      const yaVer = await Certificado.countDocuments({ codVerificacion: c.codVerificacion });
      if (yaVer > 0) {
        resultado.certificados.omitidos += 1;
        progreso.avanzar(1);
        continue;
      }
    }
    if (c.codigoCert) {
      const ya = await Certificado.countDocuments({ codigoCert: c.codigoCert });
      if (ya > 0) {
        resultado.certificados.omitidos += 1;
        progreso.avanzar(1);
        continue;
      }
    }
    await Certificado.create({
      numDoc: c.numDoc,
      idProg,
      codigoCert: c.codigoCert || undefined,
      codVerificacion: c.codVerificacion || undefined,
      encabezado: c.encabezado || nombreProg || c.codigoCert || '',
      nombreTitular: c.nombreTitular || undefined,
      horasCert: c.horasCert != null ? String(c.horasCert) : undefined,
      fechaEmision: c.fechaEmision,
      fechaVencimiento: c.fechaVencimiento || undefined,
      numActa: c.numActa || undefined,
      numFolio: c.numFolio || undefined,
      numRunt: c.numRunt || undefined,
      estado: c.estado,
      migracionHistorica: esHistorico,
      codigoProgramaOrigen: c.codigoProgramaOrigen || undefined,
      ...marca,
    });
    resultado.certificados.creados += 1;
    progreso.avanzar(1);
  }

  progreso.fase('Finalizando', { reiniciarHecho: false });
  await sincronizarConsecutivos();

  await MigracionLote.create({
    lote,
    fecha: new Date(),
    usuario,
    archivo: nombreArchivo,
    hojas: analisis.hojas,
    resultado,
    errores: analisis.errores.slice(0, 200),
  });

  progreso.finalizar('ok', `Importación ${lote} completada`);
  return { ...resultado, ignoradas: analisis.ignoradas, errores: analisis.errores };
  } catch (e) {
    progreso.finalizar('error', e.message || 'Error en la importación');
    throw e;
  }
}

async function listarLotes() {
  return MigracionLote.find({}).sort({ fecha: -1 }).limit(50).lean();
}

module.exports = {
  generarPlantilla,
  analizarArchivo,
  importarArchivo,
  listarLotes,
  crearProgramaConServicio,
  normalizarOpcionesIntegridad,
  HOJAS,
};
