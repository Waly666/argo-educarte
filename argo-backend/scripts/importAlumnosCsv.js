/**
 * Importa alumnos desde CSV (;) exportado para migración.
 *
 * Uso (desde argo-backend):
 *   node scripts/importAlumnosCsv.js
 *   node scripts/importAlumnosCsv.js --dry-run
 *   node scripts/importAlumnosCsv.js --file scripts/plantillas/alumnos-migracion-campos.csv
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const DatosAlumno = require('../src/models/DatosAlumno');
const { parseNumDoc } = require('../src/utils/numDoc');
const { TIPO_ALUMNO_DEFAULT, normalizarTipoAlumno } = require('../src/constants/tipoAlumno');

const MESES = {
  ene: 0,
  feb: 1,
  mar: 2,
  abr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  ago: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dic: 11,
};

const HEADER_ALIASES = {
  tipoDoc: 'tipoDoc',
  numDoc: 'numDoc',
  apellido1: 'apellido1',
  apellido2: 'apellido2',
  nombre1: 'nombre1',
  nombre2: 'nombre2',
  tipoAlumno: 'tipoAlumno',
  expedida: 'expedida',
  fechanac: 'fechaNac',
  fechaNac: 'fechaNac',
  genero: 'genero',
  tiposangre: 'tipoSangre',
  tipoSangre: 'tipoSangre',
  jornada: 'jornada',
  estadocivil: 'estadoCivil',
  estadoCivil: 'estadoCivil',
  estrato: 'estrato',
  regimensalud: 'regimenSalud',
  regimenSalud: 'regimenSalud',
  nivelformacion: 'nivelFormacion',
  nivelFormacion: 'nivelFormacion',
  ocupacion: 'ocupacion',
  ocpupacion: 'ocupacion',
  discapacidad: 'discapacidad',
  multiculturalidad: 'multiCulturalidad',
  multiCulturalidad: 'multiCulturalidad',
  munorigen: 'munOrigen',
  munOrigen: 'munOrigen',
  celular: 'celular',
  email: 'correo',
  correo: 'correo',
  direccion: 'direccion',
  observaciones: 'observaciones',
};

function resolveArchivo(argPath) {
  const candidatos = [
    argPath,
    path.join(__dirname, 'plantillas', 'alumnos-migracion-campos.csv'),
    path.join(__dirname, 'plantillas', 'alumnos-migracion-datos.csv'),
  ].filter(Boolean);
  for (const p of candidatos) {
    if (p && fs.existsSync(p)) return p;
  }
  return null;
}

function parseCsvSemicolon(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
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
    } else if (c === ';') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      field = '';
      if (row.some((x) => String(x).trim())) rows.push(row);
      row = [];
    } else if (c === '\r') {
      /* ignore */
    } else {
      field += c;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    if (row.some((x) => String(x).trim())) rows.push(row);
  }
  return rows;
}

function nombreMayusculas(v) {
  return String(v || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

function codigoCatalogo(v) {
  const t = String(v || '').trim();
  if (!t || /NO REGISTRA|NO SABE|NINGUNO|SIN INFORM/i.test(t)) return '';
  const m = t.match(/^(\d+)/);
  return m ? m[1] : '';
}

function normalizarGenero(v) {
  const t = String(v || '').toUpperCase().trim();
  if (!t) return '';
  if (t === 'M' || t.includes('MASCULINO')) return 'M';
  if (t === 'F' || t.includes('FEMENINO')) return 'F';
  return '';
}

function normalizarTipoSangre(v) {
  const valid = new Set(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']);
  const t = String(v || '').toUpperCase().replace(/\s/g, '');
  const m = t.match(/^(AB|A|B|O)(\+|-)$/);
  if (m) {
    const k = `${m[1]}${m[2]}`;
    return valid.has(k) ? k : '';
  }
  return valid.has(t) ? t : '';
}

function parseFechaNac(raw) {
  const t = String(raw || '').trim();
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    const d = new Date(`${t}T12:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const m = t.match(/^(\d{1,2})[-/](\w{3,})[-/](\d{2,4})$/i);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const mon = MESES[m[2].slice(0, 3).toLowerCase()];
  if (mon == null || !Number.isFinite(day)) return null;
  let year = parseInt(m[3], 10);
  if (year < 100) year += year >= 50 ? 1900 : 2000;
  const d = new Date(year, mon, day, 12, 0, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

function limpiarContacto(v, esEmail = false) {
  let t = String(v || '').trim().replace(/^"+|"+$/g, '').replace(/\s+/g, ' ');
  if (!t || /^1\.\s*NO REGISTRA$/i.test(t) || /^NO REGISTRA$/i.test(t)) return '';
  if (/NO REGISTRA/i.test(t) && !t.includes('@')) return '';
  if (esEmail) {
    t = t.toLowerCase();
    if (!t.includes('@')) return '';
  } else {
    t = t.replace(/\D/g, '');
    if (t.length < 7) return '';
  }
  return t;
}

function mapHeader(headerRow) {
  return headerRow.map((h) => {
    const key = String(h || '')
      .trim()
      .replace(/^\uFEFF/, '');
    const norm = key.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    for (const [alias, field] of Object.entries(HEADER_ALIASES)) {
      if (alias.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === norm) return field;
    }
    return key;
  });
}

function rowToObject(headers, cols) {
  const obj = {};
  for (let i = 0; i < headers.length; i += 1) {
    obj[headers[i]] = cols[i] != null ? String(cols[i]).trim() : '';
  }
  return obj;
}

function buildAlumnoDto(raw) {
  const numDoc = parseNumDoc(raw.numDoc);
  const apellido1 = nombreMayusculas(raw.apellido1);
  const nombre1 = nombreMayusculas(raw.nombre1);
  if (numDoc == null || !apellido1 || !nombre1) {
    return { error: 'Faltan numDoc válido, apellido1 o nombre1' };
  }

  let discapacidad = codigoCatalogo(raw.discapacidad);
  if (/NINGUNO|NO APLICA/i.test(String(raw.discapacidad || ''))) discapacidad = '9';

  const regimenCod = codigoCatalogo(raw.regimenSalud);
  const regimenTexto = String(raw.regimenSalud || '').trim();
  const obsParts = [];
  if (String(raw.observaciones || '').trim()) obsParts.push(String(raw.observaciones).trim());
  if (!regimenCod && regimenTexto && !/NO SABE/i.test(regimenTexto)) {
    obsParts.push(`EPS migrada: ${regimenTexto}`);
  }

  const dto = {
    tipoDoc: codigoCatalogo(raw.tipoDoc) || '1',
    numDoc,
    apellido1,
    apellido2: nombreMayusculas(raw.apellido2),
    nombre1,
    nombre2: nombreMayusculas(raw.nombre2),
    tipoAlumno: normalizarTipoAlumno(raw.tipoAlumno || TIPO_ALUMNO_DEFAULT),
    expedida: nombreMayusculas(raw.expedida),
    genero: normalizarGenero(raw.genero),
    tipoSangre: normalizarTipoSangre(raw.tipoSangre),
    jornada: codigoCatalogo(raw.jornada),
    estadoCivil: codigoCatalogo(raw.estadoCivil),
    estrato: codigoCatalogo(raw.estrato),
    regimenSalud: regimenCod,
    nivelFormacion: codigoCatalogo(raw.nivelFormacion),
    ocupacion: codigoCatalogo(raw.ocupacion),
    discapacidad: discapacidad || '9',
    multiCulturalidad: String(raw.multiCulturalidad || 'NO_APLICA').trim() || 'NO_APLICA',
    munOrigen: String(raw.munOrigen || '').trim(),
    celular: limpiarContacto(raw.celular, false),
    correo: limpiarContacto(raw.correo, true),
    direccion: String(raw.direccion || '').trim(),
    observaciones: obsParts.join(' | '),
    userAddReg: 'import-csv',
  };

  const fechaNac = parseFechaNac(raw.fechaNac);
  if (fechaNac) dto.fechaNac = fechaNac;
  if (dto.munOrigen) dto.codMunicipio = dto.munOrigen;

  return { dto };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const fileArg = args.find((a) => a.startsWith('--file='))?.slice(7)
    || (args.includes('--file') ? args[args.indexOf('--file') + 1] : null);

  const archivo = resolveArchivo(fileArg);
  if (!archivo) {
    console.error('No se encontró el CSV. Use --file=ruta/al/archivo.csv');
    process.exit(1);
  }

  const rawText = fs.readFileSync(archivo, 'latin1');
  const rows = parseCsvSemicolon(rawText);
  if (rows.length < 2) {
    console.error('CSV vacío o sin datos.');
    process.exit(1);
  }

  const headers = mapHeader(rows[0]);
  const dataRows = rows.slice(1);

  const uri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/argo';
  await mongoose.connect(uri);
  console.log(`[ARGO import alumnos] Archivo: ${archivo}`);
  console.log(`[ARGO import alumnos] Filas CSV: ${dataRows.length}${dryRun ? ' (dry-run)' : ''}`);

  const stats = {
    insertados: 0,
    omitidos: 0,
    errores: 0,
  };
  const erroresMuestra = [];

  for (let i = 0; i < dataRows.length; i += 1) {
    const cols = dataRows[i];
    if (cols.length !== headers.length) {
      stats.errores += 1;
      if (erroresMuestra.length < 8) {
        erroresMuestra.push(`Fila ${i + 2}: columnas ${cols.length} (esperadas ${headers.length})`);
      }
      continue;
    }

    const raw = rowToObject(headers, cols);
    const built = buildAlumnoDto(raw);
    if (built.error) {
      stats.errores += 1;
      if (erroresMuestra.length < 8) {
        erroresMuestra.push(`Fila ${i + 2}: ${built.error} (doc ${raw.numDoc || '?'})`);
      }
      continue;
    }

    const existe = await DatosAlumno.findOne({ numDoc: built.dto.numDoc }).select('_id numDoc').lean();
    if (existe) {
      stats.omitidos += 1;
      continue;
    }

    if (!dryRun) {
      const now = new Date();
      await DatosAlumno.create({
        ...built.dto,
        fechaReg: now,
        fechaAudi: now,
        fechaMod: now,
      });
    }
    stats.insertados += 1;

    if ((i + 1) % 500 === 0) {
      console.log(`  … ${i + 1}/${dataRows.length} procesadas`);
    }
  }

  console.log('[ARGO import alumnos] Resultado:');
  console.log(`  Insertados: ${stats.insertados}`);
  console.log(`  Omitidos (ya existían): ${stats.omitidos}`);
  console.log(`  Errores: ${stats.errores}`);
  if (erroresMuestra.length) {
    console.log('  Ejemplos de error:');
    for (const e of erroresMuestra) console.log(`    - ${e}`);
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
