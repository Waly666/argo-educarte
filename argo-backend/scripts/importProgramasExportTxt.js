/**
 * Importa programas (y servicio de matrícula con tarifas) desde exportAlumnos.txt
 * u otro TXT/CSV del export Access.
 *
 * El servicio queda con el mismo nombre del programa. Los demás campos del programa
 * pueden completarse después en ARGO → Programas.
 *
 * Uso (desde argo-backend):
 *   node scripts/importProgramasExportTxt.js
 *   node scripts/importProgramasExportTxt.js --dry-run
 *   node scripts/importProgramasExportTxt.js --file ruta/exportAlumnos.txt
 *   node scripts/importProgramasExportTxt.js --tipo-cap "Licencia de conducción"
 *   node scripts/importProgramasExportTxt.js --update-tarifas
 *
 * Coloque el archivo en: scripts/plantillas/exportAlumnos.txt
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { connectDB } = require('../src/config/db');
const { models: cat } = require('../src/models/catalogos');
const { buscarPrograma, sincronizarServicioPrograma } = require('../src/services/programaServicio');
const { valorMatriculaPrograma } = require('../src/services/programaModalidad');
const { crearProgramaConServicio } = require('../src/services/migracionDatos');

const USUARIO = 'import-programas-txt';

/** Columnas del export Access que se ignoran (Id interno, etc.) */
const IGNORE_HEADERS = new Set(['id', 'idaccess', 'idinterno', 'rowid']);

/** Encabezados Access / Excel → campo interno ARGO */
const HEADER_ALIASES = {
  codigoprograma: 'codigoPrograma',
  codigo: 'codigoPrograma',
  codprograma: 'codigoPrograma',
  cod_prog: 'codigoPrograma',
  codprogramaaccess: 'codigoPrograma',

  nombreprograma: 'nombrePrograma',
  nombreprog: 'nombrePrograma',
  nombre: 'nombrePrograma',
  programa: 'nombrePrograma',
  nomcert: 'nombrePrograma',
  curso: 'nombrePrograma',
  descripcion: 'nombrePrograma',

  tipocapacitacion: 'tipoCapacitacion',
  tipocap: 'tipoCapacitacion',
  tipocapacitacionaccess: 'tipoCapacitacion',
  idtipcap: 'tipoCapacitacion',

  modalidad: 'modalidad',

  tarifa1: 'tarifa1',
  tarifa2: 'tarifa2',
  tarifa3: 'tarifa3',
  tarifavirtual: 'tarifaVirtual',
  /** Referencia; tarifa1 del archivo tiene prioridad si viene aparte */
  valormatricula: 'valorMatricula',
  valor_matricula: 'valorMatricula',
  valorprograma: 'valorMatricula',
  precio: 'tarifa1',
  precio1: 'tarifa1',
  matricula: 'valorMatricula',

  horas: 'horas',
  horastotales: 'horas',
  horastotal: 'horas',
  semestres: 'semestres',
  nsemestres: 'semestres',
  diasvencimiento: 'diasVencimiento',
  diasvenc: 'diasVencimiento',
};

const ORDEN_SIN_ENCABEZADO = [
  'codigoPrograma',
  'nombrePrograma',
  'tipoCapacitacion',
  'tarifa1',
  'tarifa2',
  'tarifa3',
  'tarifaVirtual',
  'horas',
  'semestres',
  'diasVencimiento',
];

function parseArgs(argv) {
  const out = {
    dryRun: false,
    updateTarifas: false,
    sinEncabezado: false,
    file: null,
    tipoCap: null,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--update-tarifas') out.updateTarifas = true;
    else if (a === '--sin-encabezado') out.sinEncabezado = true;
    else if (a === '--file' && argv[i + 1]) {
      out.file = argv[++i];
    } else if (a === '--tipo-cap' && argv[i + 1]) {
      out.tipoCap = argv[++i];
    } else if (a === '--help' || a === '-h') {
      console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(0, 18).join('\n'));
      process.exit(0);
    }
  }
  return out;
}

function resolveArchivo(argPath) {
  const candidatos = [
    argPath,
    path.join(__dirname, 'plantillas', 'exportAlumnos.txt'),
    path.join(__dirname, 'exportAlumnos.txt'),
    path.join(process.cwd(), 'exportAlumnos.txt'),
  ].filter(Boolean);
  for (const p of candidatos) {
    if (p && fs.existsSync(p)) return p;
  }
  return null;
}

function leerTexto(archivo) {
  let raw = fs.readFileSync(archivo);
  let text = raw.toString('utf8');
  if (text.includes('\ufffd') || (!text.includes('\n') && raw.length > 0)) {
    text = raw.toString('latin1');
  }
  return text.replace(/^\uFEFF/, '');
}

function detectarDelimitador(linea) {
  const counts = {
    '\t': (linea.match(/\t/g) || []).length,
    ';': (linea.match(/;/g) || []).length,
    ',': (linea.match(/,/g) || []).length,
  };
  const mejor = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return mejor[1] > 0 ? mejor[0] : '\t';
}

function splitLinea(linea, delim) {
  const out = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < linea.length; i += 1) {
    const c = linea[i];
    if (inQuotes) {
      if (c === '"') {
        if (linea[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delim) {
      out.push(field.trim());
      field = '';
    } else {
      field += c;
    }
  }
  out.push(field.trim());
  return out;
}

function normalizarHeader(h) {
  return String(h || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_]/g, '');
}

function num(v) {
  if (v == null || v === '') return 0;
  const s = String(v).replace(/\$/g, '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function filaTienePrograma(row) {
  return !!(String(row.nombrePrograma || '').trim() || String(row.codigoPrograma || '').trim());
}

function mapHeaders(headers) {
  return headers.map((h) => {
    const norm = normalizarHeader(h);
    if (IGNORE_HEADERS.has(norm)) return null;
    return HEADER_ALIASES[norm] || null;
  });
}

function rowDesdeCells(cells, mapped) {
  const row = {};
  for (let i = 0; i < mapped.length; i += 1) {
    const key = mapped[i];
    if (!key) continue;
    const val = cells[i];
    if (val == null || val === '') continue;
    row[key] = val;
  }
  return row;
}

function parseArchivo(texto, sinEncabezado) {
  const lineas = texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !/^[-=]+$/.test(l));

  if (!lineas.length) return [];

  const delim = detectarDelimitador(lineas[0]);
  let mapped;
  let start = 0;

  if (sinEncabezado) {
    mapped = ORDEN_SIN_ENCABEZADO;
  } else {
    const headers = splitLinea(lineas[0], delim);
    mapped = mapHeaders(headers);
    const tienePrograma = mapped.some((k) => k === 'nombrePrograma' || k === 'codigoPrograma' || k === 'tarifa1');
    if (!tienePrograma) {
      mapped = ORDEN_SIN_ENCABEZADO;
      start = 0;
    } else {
      start = 1;
    }
  }

  const filas = [];
  for (let i = start; i < lineas.length; i += 1) {
    const cells = splitLinea(lineas[i], delim);
    const row = rowDesdeCells(cells, mapped);
    if (filaTienePrograma(row)) filas.push(row);
  }
  return dedupeProgramas(filas);
}

function dedupeProgramas(filas) {
  const map = new Map();
  for (const f of filas) {
    const cod = String(f.codigoPrograma || '').trim().toUpperCase();
    const nom = String(f.nombrePrograma || '').trim().toUpperCase();
    const key = cod || nom;
    if (!key) continue;
    const prev = map.get(key) || {};
    map.set(key, { ...prev, ...f });
  }
  return [...map.values()];
}

function inferirTipoCapDesdeCodigo(codigo) {
  const c = String(codigo || '').toUpperCase();
  if (c.startsWith('TEC') || c.startsWith('NCL')) return 'TECNICO LABORAL';
  if (c.startsWith('DIP')) return 'DIPLOMADO';
  return 'CURSO DE CONDUCCIÓN';
}

function normalizarFila(fila, tipoCapDefault) {
  const nombrePrograma = String(fila.nombrePrograma || '').trim();
  let codigoPrograma = String(fila.codigoPrograma || '').trim();
  if (!codigoPrograma && nombrePrograma) {
    codigoPrograma = nombrePrograma
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 24);
  }
  const tipoCapacitacion =
    String(fila.tipoCapacitacion || '').trim() ||
    tipoCapDefault ||
    inferirTipoCapDesdeCodigo(codigoPrograma);
  const tarifa1 = num(fila.tarifa1) || num(fila.valorMatricula);

  return {
    codigoPrograma,
    nombrePrograma: nombrePrograma || codigoPrograma,
    tipoCapacitacion,
    modalidad: fila.modalidad,
    tarifa1,
    tarifa2: fila.tarifa2 != null && fila.tarifa2 !== '' ? num(fila.tarifa2) : undefined,
    tarifa3: fila.tarifa3 != null && fila.tarifa3 !== '' ? num(fila.tarifa3) : undefined,
    tarifaVirtual:
      fila.tarifaVirtual != null && fila.tarifaVirtual !== '' ? num(fila.tarifaVirtual) : undefined,
    horas: fila.horas != null && fila.horas !== '' ? num(fila.horas) : undefined,
    semestres: fila.semestres != null && fila.semestres !== '' ? num(fila.semestres) : undefined,
    diasVencimiento:
      fila.diasVencimiento != null && fila.diasVencimiento !== ''
        ? num(fila.diasVencimiento)
        : undefined,
  };
}

async function buscarProgramaExistente(fila) {
  const cod = String(fila.codigoPrograma || '').trim();
  if (cod) {
    const porCod = await buscarPrograma(cod);
    if (porCod) return porCod;
  }
  const nom = String(fila.nombrePrograma || '').trim();
  if (!nom) return null;
  const re = new RegExp(`^${nom.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
  return cat.programas.findOne({ $or: [{ nombreProg: re }, { nomCert: re }] }).lean();
}

async function actualizarTarifas(prog, fila) {
  const nombre = String(fila.nombrePrograma || prog.nombreProg || '').trim();
  const bodyServ = {
    descrServicio: nombre,
    tarifa1: fila.tarifa1,
    tarifa2: fila.tarifa2,
    tarifa3: fila.tarifa3,
    tarifaVirtual: fila.tarifaVirtual,
  };
  await sincronizarServicioPrograma(prog, bodyServ, { username: USUARIO });
  const valorMatricula = valorMatriculaPrograma(prog, [], bodyServ);
  await cat.programas.updateOne(
    { idPrograma: prog.idPrograma },
    {
      $set: {
        valorMatricula,
        nombreProg: nombre.toUpperCase(),
        nomCert: nombre.toUpperCase(),
        fechaMod: new Date(),
        userChangeRecord: USUARIO,
      },
    },
  );
}

async function main() {
  const opts = parseArgs(process.argv);
  const archivo = resolveArchivo(opts.file);
  if (!archivo) {
    console.error('No se encontró exportAlumnos.txt.');
    console.error('Colóquelo en scripts/plantillas/exportAlumnos.txt o use --file ruta');
    process.exit(1);
  }

  const filasRaw = parseArchivo(leerTexto(archivo), opts.sinEncabezado);
  if (!filasRaw.length) {
    console.error(`Sin programas en ${archivo}. Revise encabezados o use --sin-encabezado`);
    process.exit(1);
  }

  const filas = filasRaw.map((f, i) => normalizarFila(f, opts.tipoCap));
  console.log(`Archivo: ${archivo}`);
  console.log(`Programas únicos detectados: ${filas.length}`);
  if (opts.dryRun) console.log('Modo simulación (--dry-run): no se escribe en Mongo.\n');

  await connectDB();

  let creados = 0;
  let actualizados = 0;
  let omitidos = 0;
  let errores = 0;

  for (let i = 0; i < filas.length; i += 1) {
    const fila = filas[i];
    const label = `${fila.codigoPrograma} · ${fila.nombrePrograma}`;
    try {
      const existente = await buscarProgramaExistente(fila);
      if (existente) {
        if (opts.updateTarifas) {
          if (opts.dryRun) {
            console.log(`  ~ ${label} (actualizar tarifas)`);
            actualizados += 1;
          } else {
            await actualizarTarifas(existente, fila);
            console.log(`  ~ ${label} → tarifas actualizadas (#${existente.idPrograma})`);
            actualizados += 1;
          }
        } else {
          console.log(`  · ${label} ya existe (#${existente.idPrograma}) — omitido`);
          omitidos += 1;
        }
        continue;
      }

      if (fila.tarifa1 <= 0 && !(fila.tarifaVirtual > 0)) {
        console.warn(`  ! ${label}: sin tarifa1 ni tarifaVirtual — omitido`);
        omitidos += 1;
        continue;
      }

      if (opts.dryRun) {
        console.log(`  + ${label} | T1=${fila.tarifa1} T2=${fila.tarifa2 ?? '-'} T3=${fila.tarifa3 ?? '-'} TV=${fila.tarifaVirtual ?? '-'}`);
        creados += 1;
        continue;
      }

      const prog = await crearProgramaConServicio(fila, null, USUARIO);
      console.log(`  + ${label} → programa #${prog.idPrograma} (${prog.codigoProg})`);
      creados += 1;
    } catch (e) {
      errores += 1;
      console.error(`  ✗ ${label}: ${e.message || e}`);
    }
  }

  console.log('\nResumen:');
  console.log(`  Creados:      ${creados}`);
  console.log(`  Actualizados: ${actualizados}`);
  console.log(`  Omitidos:     ${omitidos}`);
  console.log(`  Errores:      ${errores}`);

  await require('mongoose').disconnect();
  process.exit(errores > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
