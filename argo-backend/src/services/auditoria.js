const fs = require('fs');
const path = require('path');
const Auditoria = require('../models/Auditoria');
const { num } = require('../utils/coerceTypes');

const CAMPOS_OMITIDOS = new Set([
  '_id',
  '__v',
  'password',
  'passwordHash',
  'token',
  'refreshToken',
]);

let idSeq = 0;

async function siguienteIdAuditoria() {
  const last = await Auditoria.findOne({}).sort({ idAuditoria: -1 }).select('idAuditoria').lean();
  const n = Number(last?.idAuditoria);
  return Number.isFinite(n) ? n + 1 : 1;
}

function usuarioDeReq(req) {
  const u = req?.user || {};
  return {
    usuario: u.username || u.sub || 'sistema',
    idUsuario: u.sub ? String(u.sub) : null,
    rol: u.rol ? String(u.rol) : null,
  };
}

function sanitizar(obj) {
  if (obj == null) return null;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizar);
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (CAMPOS_OMITIDOS.has(k)) {
      out[k] = '[omitido]';
      continue;
    }
    if (v && typeof v === 'object' && v.$numberDecimal != null) {
      out[k] = num(v);
      continue;
    }
    if (v && typeof v === 'object' && v._bsontype === 'Decimal128') {
      out[k] = num(v);
      continue;
    }
    out[k] = sanitizar(v);
  }
  return out;
}

function planoDoc(doc) {
  if (!doc) return null;
  const o = doc.toObject ? doc.toObject() : doc;
  return sanitizar(o);
}

function calcularCambios(antes, despues) {
  const cambios = [];
  const keys = new Set([...Object.keys(antes || {}), ...Object.keys(despues || {})]);
  for (const campo of keys) {
    if (CAMPOS_OMITIDOS.has(campo)) continue;
    const a = antes?.[campo];
    const d = despues?.[campo];
    const sa = JSON.stringify(a ?? null);
    const sd = JSON.stringify(d ?? null);
    if (sa !== sd) {
      cambios.push({ campo, antes: a ?? null, despues: d ?? null });
    }
  }
  return cambios;
}

function rutaBase(ruta) {
  return String(ruta || '')
    .split('?')[0]
    .replace(/\/[a-f0-9]{24}/gi, '/:id')
    .replace(/\/\d+/g, '/:id');
}

function escribirArchivoLog(registro) {
  try {
    const logsDir = path.join(__dirname, '..', '..', 'logs', 'auditoria');
    fs.mkdirSync(logsDir, { recursive: true });
    const dia = new Date().toISOString().slice(0, 10);
    const archivo = path.join(logsDir, `auditoria-${dia}.log`);
    const linea = `${JSON.stringify(registro)}\n`;
    fs.appendFileSync(archivo, linea, 'utf8');
    return path.relative(path.join(__dirname, '..', '..'), archivo).replace(/\\/g, '/');
  } catch {
    return null;
  }
}

/**
 * Registra auditoría en BD y archivo diario.
 */
async function registrarAuditoria(opts) {
  const {
    req,
    accion,
    entidad,
    idEntidad,
    resumen,
    datosAntes,
    datosDespues,
    payload,
    codigoHttp,
  } = opts;

  const usr = usuarioDeReq(req);
  const ruta = opts.ruta || req?.originalUrl || req?.url || '';
  const metodo = opts.metodo || req?.method || '';

  const antes = sanitizar(datosAntes);
  const despues = sanitizar(datosDespues);
  const cambios =
    opts.cambios && opts.cambios.length
      ? opts.cambios.map((c) => ({
          campo: c.campo,
          antes: sanitizar(c.antes),
          despues: sanitizar(c.despues),
        }))
      : calcularCambios(antes, despues);

  const idAuditoria = await siguienteIdAuditoria();
  const doc = {
    idAuditoria,
    fecha: new Date(),
    accion,
    entidad: entidad || null,
    idEntidad: idEntidad != null ? String(idEntidad) : null,
    metodo,
    ruta,
    rutaBase: rutaBase(ruta),
    codigoHttp: codigoHttp ?? null,
    ...usr,
    ip: req?.ip || req?.headers?.['x-forwarded-for'] || null,
    userAgent: req?.headers?.['user-agent'] || null,
    resumen: resumen || null,
    datosAntes: antes,
    datosDespues: despues,
    cambios,
    payload: sanitizar(payload),
  };

  doc.archivoLog = escribirArchivoLog({
    idAuditoria,
    fecha: doc.fecha.toISOString(),
    accion: doc.accion,
    entidad: doc.entidad,
    idEntidad: doc.idEntidad,
    usuario: doc.usuario,
    ruta: doc.ruta,
    resumen: doc.resumen,
    cambios: doc.cambios,
  });

  idSeq += 1;
  setImmediate(() => {
    Auditoria.create(doc).catch((err) => {
      console.error('[ARGO auditoria]', err.message);
    });
  });

  return doc;
}

function registrarCreacion(req, entidad, doc, extras = {}) {
  const plano = planoDoc(doc);
  return registrarAuditoria({
    req,
    accion: 'crear',
    entidad,
    idEntidad: extras.idEntidad ?? plano?._id ?? plano?.idServ ?? plano?.idSesion,
    resumen: extras.resumen || `Creación ${entidad}`,
    datosDespues: plano,
    payload: extras.payload,
    codigoHttp: extras.codigoHttp ?? 201,
  });
}

function registrarModificacion(req, entidad, antes, despues, extras = {}) {
  const a = planoDoc(antes);
  const d = planoDoc(despues);
  const cambios = calcularCambios(a, d);
  return registrarAuditoria({
    req,
    accion: 'modificar',
    entidad,
    idEntidad: extras.idEntidad ?? d?._id ?? a?._id,
    resumen:
      extras.resumen ||
      (cambios.length
        ? `Modificación ${entidad}: ${cambios.map((c) => c.campo).join(', ')}`
        : `Modificación ${entidad}`),
    datosAntes: a,
    datosDespues: d,
    cambios,
    payload: extras.payload,
    codigoHttp: extras.codigoHttp ?? 200,
  });
}

function registrarEliminacion(req, entidad, antes, extras = {}) {
  const a = planoDoc(antes);
  return registrarAuditoria({
    req,
    accion: 'eliminar',
    entidad,
    idEntidad: extras.idEntidad ?? a?._id,
    resumen: extras.resumen || `Eliminación ${entidad}`,
    datosAntes: a,
    payload: extras.payload,
    codigoHttp: extras.codigoHttp ?? 200,
  });
}

module.exports = {
  registrarAuditoria,
  registrarCreacion,
  registrarModificacion,
  registrarEliminacion,
  calcularCambios,
  sanitizar,
  planoDoc,
  rutaBase,
};
