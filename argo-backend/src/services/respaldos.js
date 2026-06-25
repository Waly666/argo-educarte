const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
const archiver = require('archiver');
const unzipper = require('unzipper');

const Config = require('../models/Config');
const { baseDir: uploadsDir } = require('../middleware/upload');
const { ensureConfigDocument } = require('./configEnsure');
const progreso = require('./progresoOperacion');
const {
  claveCifradoConfigurada,
  cifrarArchivo,
  descifrarArchivo,
  esArchivoCifrado,
  EXTENSION_CIFRADA,
} = require('./respaldoCifrado');

const { EJSON } = mongoose.mongo.BSON;

const BACKUP_DIR = path.join(__dirname, '..', '..', process.env.BACKUP_DIR || 'backups');
const CLAVE_CONFIG = 'respaldos';
const FORMATO = 'argo-backup';
const VERSION = 1;
const BATCH_INSERT = 500;
/** Sufijo de colecciones temporales durante restauración (no pisan datos hasta el swap final). */
const STAGING_SUFFIX = '__argo_restore_staging';
const UPLOADS_STAGING_DIR = path.join(path.dirname(uploadsDir), '.uploads-restore-staging');

const DEFAULTS_CONFIG = {
  clave: CLAVE_CONFIG,
  autoHabilitado: true,
  horaAuto: '02:30',
  retencionDias: 30,
};

let operacionEnCurso = null;

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function nombreSeguro(nombre) {
  const n = path.basename(String(nombre || ''));
  if (!/^[\w.\-]+$/.test(n) || (!n.endsWith('.zip') && !n.endsWith(EXTENSION_CIFRADA))) {
    const err = new Error('Nombre de respaldo inválido');
    err.status = 400;
    throw err;
  }
  return n;
}

function rutaRespaldo(nombre) {
  return path.join(BACKUP_DIR, nombreSeguro(nombre));
}

function marcarOperacion(tipo) {
  if (operacionEnCurso) {
    const err = new Error(
      `Ya hay una operación en curso (${operacionEnCurso}). Espere a que termine.`,
    );
    err.status = 409;
    throw err;
  }
  operacionEnCurso = tipo;
}

function liberarOperacion() {
  operacionEnCurso = null;
}

function tsArchivo(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

async function sha256Archivo(ruta) {
  const hash = crypto.createHash('sha256');
  await new Promise((resolve, reject) => {
    fs.createReadStream(ruta)
      .on('data', (c) => hash.update(c))
      .on('end', resolve)
      .on('error', reject);
  });
  return hash.digest('hex');
}

/** Recrea los índices de todos los modelos (se pierden al eliminar colecciones). */
async function recrearIndices() {
  for (const nombre of mongoose.modelNames()) {
    await mongoose
      .model(nombre)
      .createIndexes()
      .catch((e) => console.warn(`[ARGO respaldos] índices ${nombre}:`, e.message));
  }
}

async function coleccionesApp() {
  const db = mongoose.connection.db;
  const cols = await db.listCollections().toArray();
  return cols
    .map((c) => c.name)
    .filter((n) => !n.startsWith('system.'))
    .sort();
}

/** Exporta cada colección a JSONL (EJSON canónico) en dirSalida. */
async function exportarColecciones(dirSalida, onColeccion = null) {
  const db = mongoose.connection.db;
  const nombres = await coleccionesApp();
  if (onColeccion) onColeccion(0, nombres.length, null);
  const resumen = [];
  let i = 0;
  for (const nombre of nombres) {
    const rutaArchivo = path.join(dirSalida, `${nombre}.jsonl`);
    const ws = fs.createWriteStream(rutaArchivo, { encoding: 'utf8' });
    let docs = 0;
    const cursor = db.collection(nombre).find({});
    for await (const doc of cursor) {
      const linea = EJSON.stringify(doc, { relaxed: false });
      if (!ws.write(`${linea}\n`)) {
        await new Promise((r) => ws.once('drain', r));
      }
      docs += 1;
    }
    await new Promise((resolve, reject) => {
      ws.end(() => resolve());
      ws.on('error', reject);
    });
    resumen.push({ nombre, docs });
    i += 1;
    if (onColeccion) onColeccion(i, nombres.length, nombre);
  }
  return resumen;
}

function comprimirADestino(dirTrabajo, rutaZip) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(rutaZip);
    const archive = archiver('zip', { zlib: { level: 6 } });
    output.on('close', resolve);
    archive.on('error', reject);
    output.on('error', reject);
    archive.pipe(output);
    archive.directory(path.join(dirTrabajo, 'db'), 'db');
    archive.file(path.join(dirTrabajo, 'manifest.json'), { name: 'manifest.json' });
    if (fs.existsSync(uploadsDir)) {
      archive.directory(uploadsDir, 'uploads');
    }
    archive.finalize();
  });
}

async function escribirMeta(rutaFinal, meta) {
  await fs.promises.writeFile(`${rutaFinal}.meta.json`, JSON.stringify(meta, null, 2), 'utf8');
}

async function leerMeta(rutaFinal) {
  try {
    return JSON.parse(await fs.promises.readFile(`${rutaFinal}.meta.json`, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Crea un respaldo completo (BD + archivos subidos).
 * tipo: manual | auto | pre-reset | pre-restauracion
 */
async function crearRespaldo({
  tipo = 'manual',
  usuario = 'sistema',
  nota = '',
  _interno = false,
  reportarProgreso = !_interno,
} = {}) {
  if (!_interno) {
    marcarOperacion(`respaldo ${tipo}`);
    progreso.iniciar('respaldo', 'Exportando datos…');
  }
  // Etiqueta de fase: si es interno (copia previa de reset/restauración) se aclara.
  const etiqueta = (txt) => (_interno ? `Copia de seguridad previa: ${txt}` : txt);
  const inicio = Date.now();
  const fecha = new Date();
  const base = `argo-respaldo-${tsArchivo(fecha)}-${tipo}`;
  const dirTrabajo = path.join(BACKUP_DIR, `.tmp-${base}`);
  const rutaZip = path.join(BACKUP_DIR, `${base}.zip`);
  try {
    ensureDir(BACKUP_DIR);
    ensureDir(path.join(dirTrabajo, 'db'));

    if (reportarProgreso) progreso.fase(etiqueta('exportando datos…'), { total: 0 });
    const reportar = reportarProgreso
      ? (hechas, total) => {
          if (total) progreso.definirTotal(total);
          progreso.avanzar(hechas - progreso.obtener().hecho);
        }
      : null;
    const colecciones = await exportarColecciones(path.join(dirTrabajo, 'db'), reportar);
    if (reportarProgreso) progreso.fase(etiqueta('comprimiendo el archivo…'), { total: 0 });
    const manifest = {
      formato: FORMATO,
      version: VERSION,
      fecha: fecha.toISOString(),
      tipo,
      usuario,
      nota: String(nota || ''),
      baseDatos: mongoose.connection.name,
      colecciones,
      totalDocs: colecciones.reduce((s, c) => s + c.docs, 0),
    };
    await fs.promises.writeFile(
      path.join(dirTrabajo, 'manifest.json'),
      JSON.stringify(manifest, null, 2),
      'utf8',
    );

    await comprimirADestino(dirTrabajo, rutaZip);

    let rutaFinal = rutaZip;
    const cifrado = claveCifradoConfigurada();
    if (cifrado) {
      if (reportarProgreso) progreso.fase(etiqueta('cifrando el archivo…'), { total: 0 });
      rutaFinal = path.join(BACKUP_DIR, `${base}${EXTENSION_CIFRADA}`);
      await cifrarArchivo(rutaZip, rutaFinal);
    }

    const stat = await fs.promises.stat(rutaFinal);
    const meta = {
      archivo: path.basename(rutaFinal),
      fecha: fecha.toISOString(),
      tipo,
      usuario,
      nota: String(nota || ''),
      tamano: stat.size,
      sha256: await sha256Archivo(rutaFinal),
      cifrado,
      colecciones: colecciones.length,
      totalDocs: manifest.totalDocs,
      duracionMs: Date.now() - inicio,
    };
    await escribirMeta(rutaFinal, meta);
    if (!_interno) {
      progreso.finalizar('ok', `Copia creada: ${meta.archivo} (${meta.totalDocs} documentos)`);
    }
    return meta;
  } catch (err) {
    await fs.promises.unlink(rutaZip).catch(() => {});
    if (!_interno) progreso.finalizar('error', err.message || 'Error al crear la copia');
    throw err;
  } finally {
    if (!_interno) liberarOperacion();
    await fs.promises.rm(dirTrabajo, { recursive: true, force: true }).catch(() => {});
  }
}

async function listarRespaldos() {
  ensureDir(BACKUP_DIR);
  const archivos = await fs.promises.readdir(BACKUP_DIR);
  const out = [];
  for (const a of archivos) {
    if (!a.endsWith('.zip') && !a.endsWith(EXTENSION_CIFRADA)) continue;
    const ruta = path.join(BACKUP_DIR, a);
    const stat = await fs.promises.stat(ruta).catch(() => null);
    if (!stat || !stat.isFile()) continue;
    const meta = await leerMeta(ruta);
    out.push(
      meta || {
        archivo: a,
        fecha: stat.mtime.toISOString(),
        tipo: a.includes('-auto') ? 'auto' : 'manual',
        usuario: null,
        tamano: stat.size,
        cifrado: a.endsWith(EXTENSION_CIFRADA),
      },
    );
  }
  out.sort((x, y) => String(y.fecha).localeCompare(String(x.fecha)));
  return out;
}

async function eliminarRespaldo(nombre) {
  const ruta = rutaRespaldo(nombre);
  if (!fs.existsSync(ruta)) {
    const err = new Error('Respaldo no encontrado');
    err.status = 404;
    throw err;
  }
  await fs.promises.unlink(ruta);
  await fs.promises.unlink(`${ruta}.meta.json`).catch(() => {});
}

/** Elimina respaldos automáticos con más días que la retención configurada. */
async function aplicarRetencion(retencionDias) {
  const dias = Math.max(1, Number(retencionDias) || DEFAULTS_CONFIG.retencionDias);
  const limite = Date.now() - dias * 24 * 60 * 60 * 1000;
  const lista = await listarRespaldos();
  let eliminados = 0;
  for (const r of lista) {
    if (r.tipo !== 'auto') continue;
    if (new Date(r.fecha).getTime() < limite) {
      await eliminarRespaldo(r.archivo).catch(() => {});
      eliminados += 1;
    }
  }
  return eliminados;
}

async function vaciarDirectorio(dir) {
  if (!fs.existsSync(dir)) return;
  const entradas = await fs.promises.readdir(dir);
  for (const e of entradas) {
    await fs.promises.rm(path.join(dir, e), { recursive: true, force: true });
  }
}

async function insertManyResiliente(collection, lote) {
  if (!lote.length) return 0;
  try {
    const r = await collection.insertMany(lote, { ordered: false });
    return r.insertedCount ?? lote.length;
  } catch (e) {
    if (e.code === 11000 || e.name === 'MongoBulkWriteError') {
      return e.result?.insertedCount ?? 0;
    }
    throw e;
  }
}

function dedupeConfigPorClave(docs) {
  const map = new Map();
  for (const doc of docs) {
    const clave = doc?.clave != null ? String(doc.clave).trim() : '';
    if (clave) map.set(clave, doc);
  }
  return [...map.values()];
}

async function limpiarColeccionesStaging(db) {
  const cols = await coleccionesApp();
  for (const nombre of cols) {
    if (nombre.endsWith(STAGING_SUFFIX)) {
      await db.collection(nombre).drop().catch(() => {});
    }
  }
}

async function insertarJsonlEnColeccion(entrada, nombreColeccion, db, esConfig = false, onDocs = null) {
  const readline = require('readline');
  // Crea la colección aunque quede vacía, para que el swap (rename) no falle.
  await db.createCollection(nombreColeccion).catch(() => {});
  const rl = readline.createInterface({ input: entrada.stream(), crlfDelay: Infinity });
  let lote = [];
  let docs = 0;
  const collection = db.collection(nombreColeccion);
  for await (const linea of rl) {
    const t = linea.trim();
    if (!t) continue;
    lote.push(EJSON.parse(t, { relaxed: false }));
    if (lote.length >= BATCH_INSERT) {
      if (esConfig) lote = dedupeConfigPorClave(lote);
      const ins = await insertManyResiliente(collection, lote);
      docs += ins;
      if (onDocs) onDocs(lote.length);
      lote = [];
    }
  }
  if (lote.length) {
    if (esConfig) lote = dedupeConfigPorClave(lote);
    const ins = await insertManyResiliente(collection, lote);
    docs += ins;
    if (onDocs) onDocs(lote.length);
  }
  return docs;
}

async function restaurarColeccionesDesdeZip(zipAbierto, onDocs = null) {
  const db = mongoose.connection.db;
  const entradasDb = zipAbierto.files.filter(
    (f) => f.path.startsWith('db/') && f.path.endsWith('.jsonl') && f.type === 'File',
  );

  await limpiarColeccionesStaging(db);
  const resumen = [];
  const nombresBackup = [];
  try {
    for (const entrada of entradasDb) {
      const nombre = path.basename(entrada.path, '.jsonl');
      const staging = `${nombre}${STAGING_SUFFIX}`;
      nombresBackup.push(nombre);
      const docs = await insertarJsonlEnColeccion(entrada, staging, db, nombre === 'config', onDocs);
      resumen.push({ nombre, docs });
    }

    const nombresSet = new Set(nombresBackup);
    const actuales = await coleccionesApp();
    for (const nombre of actuales) {
      if (!nombresSet.has(nombre) && !nombre.endsWith(STAGING_SUFFIX)) {
        await db.collection(nombre).drop().catch(() => {});
      }
    }
    for (const nombre of nombresBackup) {
      const staging = `${nombre}${STAGING_SUFFIX}`;
      await db.collection(nombre).drop().catch(() => {});
      await db.collection(staging).rename(nombre);
    }
    return resumen;
  } catch (err) {
    await limpiarColeccionesStaging(db).catch(() => {});
    throw err;
  }
}

async function restaurarUploadsDesdeZip(zipAbierto, onArchivo = null) {
  await fs.promises.rm(UPLOADS_STAGING_DIR, { recursive: true, force: true }).catch(() => {});
  ensureDir(UPLOADS_STAGING_DIR);
  const entradas = zipAbierto.files.filter(
    (f) => f.path.startsWith('uploads/') && f.type === 'File',
  );
  if (onArchivo) onArchivo(0, entradas.length);
  let archivos = 0;
  for (const entrada of entradas) {
    const relativo = entrada.path.slice('uploads/'.length);
    if (!relativo) continue;
    const destino = path.join(UPLOADS_STAGING_DIR, relativo);
    if (!destino.startsWith(path.resolve(UPLOADS_STAGING_DIR))) continue;
    ensureDir(path.dirname(destino));
    await new Promise((resolve, reject) => {
      entrada
        .stream()
        .pipe(fs.createWriteStream(destino))
        .on('finish', resolve)
        .on('error', reject);
    });
    archivos += 1;
    if (onArchivo) onArchivo(archivos, entradas.length);
  }
  await vaciarDirectorio(uploadsDir);
  ensureDir(uploadsDir);
  const raiz = path.resolve(UPLOADS_STAGING_DIR);
  const moverRecursivo = async (dir) => {
    const entradas = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const e of entradas) {
      const origen = path.join(dir, e.name);
      const rel = path.relative(raiz, origen);
      const destino = path.join(uploadsDir, rel);
      if (e.isDirectory()) {
        ensureDir(destino);
        await moverRecursivo(origen);
      } else {
        ensureDir(path.dirname(destino));
        await fs.promises.rename(origen, destino);
      }
    }
  };
  await moverRecursivo(UPLOADS_STAGING_DIR);
  await fs.promises.rm(UPLOADS_STAGING_DIR, { recursive: true, force: true }).catch(() => {});
  return archivos;
}

/**
 * Restaura un respaldo completo (reemplaza BD y archivos subidos).
 * rutaArchivo: ruta absoluta del .zip o .argobk a restaurar.
 */
async function restaurarRespaldo(rutaArchivo, { usuario = 'sistema', crearSeguridad = true } = {}) {
  if (!fs.existsSync(rutaArchivo)) {
    const err = new Error('Archivo de respaldo no encontrado');
    err.status = 404;
    throw err;
  }

  progreso.iniciar('restauracion', 'Preparando restauración…');

  // Respaldo de seguridad del estado actual antes de pisarlo.
  let respaldoSeguridad = null;
  if (crearSeguridad) {
    progreso.fase('Creando copia de seguridad previa…', { total: 0 });
    respaldoSeguridad = await crearRespaldo({
      tipo: 'pre-restauracion',
      usuario,
      nota: `Antes de restaurar ${path.basename(rutaArchivo)}`,
      _interno: true,
      reportarProgreso: true,
    });
  }

  marcarOperacion('restauración');
  let rutaZip = rutaArchivo;
  let zipTemporal = null;
  try {
    if (esArchivoCifrado(rutaArchivo)) {
      progreso.fase('Descifrando el archivo…', { total: 0 });
      zipTemporal = path.join(BACKUP_DIR, `.restore-${Date.now()}.zip`);
      await descifrarArchivo(rutaArchivo, zipTemporal);
      rutaZip = zipTemporal;
    }

    const zipAbierto = await unzipper.Open.file(rutaZip);
    const entradaManifest = zipAbierto.files.find((f) => f.path === 'manifest.json');
    if (!entradaManifest) {
      const err = new Error('El archivo no es un respaldo válido de ARGO (falta manifest.json)');
      err.status = 400;
      throw err;
    }
    const manifest = JSON.parse((await entradaManifest.buffer()).toString('utf8'));
    if (manifest.formato !== FORMATO) {
      const err = new Error('Formato de respaldo no reconocido');
      err.status = 400;
      throw err;
    }

    progreso.fase('Cargando datos…', { total: Number(manifest.totalDocs) || 0 });
    const colecciones = await restaurarColeccionesDesdeZip(zipAbierto, (n) => progreso.avanzar(n));

    progreso.fase('Restaurando archivos (fotos, documentos)…', { total: 0 });
    const archivosRestaurados = await restaurarUploadsDesdeZip(zipAbierto, (hechos, total) => {
      if (total && progreso.obtener().total !== total) progreso.definirTotal(total);
      progreso.avanzar(hechos - progreso.obtener().hecho);
    });

    progreso.fase('Reconstruyendo índices y caché…', { total: 0 });
    // Reinicializa índices, estructuras mínimas y cachés tras el reemplazo.
    await recrearIndices();
    const { initRolesSistema, limpiarCache } = require('./rolesPermisos');
    await initRolesSistema();
    limpiarCache();

    const docsRestaurados = colecciones.reduce((s, c) => s + c.docs, 0);
    progreso.finalizar('ok', `Restauración completada: ${docsRestaurados} documentos y ${archivosRestaurados} archivos.`);
    return {
      manifest: {
        fecha: manifest.fecha,
        tipo: manifest.tipo,
        usuario: manifest.usuario,
        totalDocs: manifest.totalDocs,
      },
      colecciones: colecciones.length,
      docsRestaurados,
      archivosRestaurados,
      respaldoSeguridad: respaldoSeguridad?.archivo || null,
    };
  } catch (err) {
    progreso.finalizar('error', err.message || 'La restauración falló');
    throw err;
  } finally {
    liberarOperacion();
    if (zipTemporal) await fs.promises.unlink(zipTemporal).catch(() => {});
  }
}

function normalizarHora(h) {
  const m = String(h || '').trim().match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : DEFAULTS_CONFIG.horaAuto;
}

async function obtenerConfigRespaldos() {
  let doc = await Config.findOne({ clave: CLAVE_CONFIG }).lean();
  if (!doc) doc = await ensureConfigDocument(CLAVE_CONFIG, DEFAULTS_CONFIG);
  return {
    autoHabilitado: doc.autoHabilitado !== false,
    horaAuto: normalizarHora(doc.horaAuto),
    retencionDias: Math.max(1, Math.min(365, Number(doc.retencionDias) || DEFAULTS_CONFIG.retencionDias)),
    cifradoActivo: claveCifradoConfigurada(),
  };
}

async function actualizarConfigRespaldos(payload = {}) {
  const set = {};
  if (payload.autoHabilitado !== undefined) set.autoHabilitado = payload.autoHabilitado === true;
  if (payload.horaAuto !== undefined) set.horaAuto = normalizarHora(payload.horaAuto);
  if (payload.retencionDias !== undefined) {
    set.retencionDias = Math.max(1, Math.min(365, Number(payload.retencionDias) || DEFAULTS_CONFIG.retencionDias));
  }
  await Config.findOneAndUpdate(
    { clave: CLAVE_CONFIG },
    { $set: set, $setOnInsert: { clave: CLAVE_CONFIG } },
    { upsert: true },
  );
  return obtenerConfigRespaldos();
}

module.exports = {
  BACKUP_DIR,
  recrearIndices,
  crearRespaldo,
  listarRespaldos,
  eliminarRespaldo,
  rutaRespaldo,
  restaurarRespaldo,
  aplicarRetencion,
  obtenerConfigRespaldos,
  actualizarConfigRespaldos,
  obtenerProgreso: progreso.obtener,
};
