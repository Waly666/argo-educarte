const jwt = require('jsonwebtoken');
const ActividadHttp = require('../models/ActividadHttp');
const { rutaBase } = require('./auditoria');
const { obtenerMetricasSistema } = require('./systemMonitor');

const ACTIVOS_MINUTOS = 10;
const sesionesActivas = new Map();
let nextIdActividad = null;

async function initContadorActividad() {
  const last = await ActividadHttp.findOne({}).sort({ idActividad: -1 }).select('idActividad').lean();
  const n = Number(last?.idActividad);
  nextIdActividad = Number.isFinite(n) ? n + 1 : 1;
}

function allocIdActividad() {
  if (nextIdActividad == null) nextIdActividad = 1;
  return nextIdActividad++;
}

function usuarioDeToken(payload) {
  if (!payload) return null;
  return {
    idUsuario: payload.sub ? String(payload.sub) : null,
    usuario: payload.username || payload.sub || null,
    rol: payload.rol ? String(payload.rol) : null,
  };
}

function normalizarRutaPantalla(rutaFrontend) {
  const raw = String(rutaFrontend || '').trim();
  if (!raw) return null;
  return raw.split('?')[0].slice(0, 500);
}

function describirPantalla(rutaFrontend) {
  const u = normalizarRutaPantalla(rutaFrontend);
  if (!u) return null;
  const path = u.replace(/^\/app\/?/i, '/');

  const map = [
    { re: /^\/configuracion\/monitor/i, t: 'Monitor de recursos' },
    { re: /^\/configuracion\/auditoria/i, t: 'Auditoría' },
    { re: /^\/configuracion\/usuarios/i, t: 'Usuarios (configuración)' },
    { re: /^\/configuracion\/roles/i, t: 'Roles y permisos' },
    { re: /^\/configuracion\/recibos/i, t: 'Config. recibos' },
    { re: /^\/configuracion\/nomina/i, t: 'Config. nómina' },
    { re: /^\/configuracion\/certificados/i, t: 'Config. certificados' },
    { re: /^\/configuracion\/catalogos/i, t: 'Catálogos (config)' },
    { re: /^\/configuracion\/requisitos-documentos-alumnos/i, t: 'Requisitos alumnos' },
    { re: /^\/configuracion\/requisitos-documentos(?!-)/i, t: 'Requisitos alumnos' },
    { re: /^\/configuracion/i, t: 'Configuración' },
    { re: /^\/dashboard/i, t: 'Dashboard' },
    { re: /^\/jornadas\/en-proceso/i, t: 'Jornadas en proceso' },
    { re: /^\/jornadas\/clases-hoy/i, t: 'Clases de hoy' },
    { re: /^\/jornadas\/certificados/i, t: 'Certificados de jornada' },
    { re: /^\/jornadas\/instructor/i, t: 'Panel instructor' },
    { re: /^\/jornadas\/alumnos/i, t: 'Alumnos (jornadas)' },
    { re: /^\/jornadas/i, t: 'Jornadas de capacitación' },
    { re: /^\/contratos/i, t: 'Contratos' },
    { re: /^\/alumnos\/nuevo/i, t: 'Nuevo alumno' },
    { re: /^\/alumnos\/.+/i, t: 'Ficha de alumno' },
    { re: /^\/alumnos/i, t: 'Listado de alumnos' },
    { re: /^\/programas/i, t: 'Programas educativos' },
    { re: /^\/servicios/i, t: 'Servicios' },
    { re: /^\/cobros-pendientes/i, t: 'Cobros pendientes' },
    { re: /^\/caja\/ingresos-todos/i, t: 'Ingresos (admin caja)' },
    { re: /^\/caja\/egresos-todos/i, t: 'Egresos (admin caja)' },
    { re: /^\/caja\/descuadres/i, t: 'Descuadres de caja' },
    { re: /^\/caja\/ingresos/i, t: 'Ingresos de caja' },
    { re: /^\/caja\/egresos/i, t: 'Egresos de caja' },
    { re: /^\/caja/i, t: 'Caja / cuadre' },
    { re: /^\/cierres/i, t: 'Cierres de caja' },
    { re: /^\/cierre-general/i, t: 'Cierre general' },
    { re: /^\/rrhh\/empleados/i, t: 'RRHH · empleados' },
    { re: /^\/rrhh\/contratos/i, t: 'RRHH · contratos' },
    { re: /^\/rrhh\/nomina/i, t: 'RRHH · nómina' },
    { re: /^\/rrhh\/novedades/i, t: 'RRHH · novedades' },
    { re: /^\/rrhh\/catalogos/i, t: 'RRHH · catálogos' },
    { re: /^\/rrhh/i, t: 'Recursos humanos' },
    { re: /^\/facturacion/i, t: 'Facturación' },
    { re: /^\/instructores/i, t: 'Instructores' },
    { re: /^\/vehiculos/i, t: 'Vehículos' },
  ];

  for (const { re, t } of map) {
    if (re.test(path)) return t;
  }
  return `En ${path}`;
}

function describirActividad(metodo, rb, status) {
  const m = String(metodo || 'GET').toUpperCase();
  const ok = status >= 200 && status < 300;
  const fallo = status >= 400;

  const map = [
    { re: /\/auth\/login$/i, t: 'Iniciando sesión' },
    { re: /\/auth\/me$/i, t: 'Consultando perfil de sesión' },
    { re: /\/caja\/sesiones\/activa\/ingresos/i, t: 'Listando ingresos de su caja' },
    { re: /\/caja\/sesiones\/activa\/egresos/i, t: 'Listando egresos de su caja' },
    { re: /\/caja\/sesiones\/activa/i, t: 'Revisando su caja abierta' },
    { re: /\/caja\/sesiones\/abrir/i, t: 'Abriendo caja' },
    { re: /\/caja\/sesiones\/.*\/cerrar/i, t: 'Cerrando caja' },
    { re: /\/caja\/sesiones\/.*\/resumen/i, t: 'Consultando resumen de caja' },
    { re: /\/caja\/cierre-general/i, t: 'Cierre general de caja (admin)' },
    { re: /\/caja\/sesiones\/abiertas/i, t: 'Supervisando cajas abiertas' },
    { re: /\/ingresos/i, t: m === 'POST' ? 'Registrando ingreso / cobro' : 'Consultando ingresos' },
    { re: /\/egresos/i, t: m === 'POST' ? 'Registrando egreso' : 'Consultando egresos' },
    { re: /\/alumnos/i, t: m === 'POST' ? 'Creando / editando alumno' : 'Consultando alumnos' },
    { re: /\/matriculas/i, t: 'Gestión de matrículas' },
    { re: /\/liquidacion/i, t: 'Liquidación / cartera' },
    { re: /\/usuarios/i, t: 'Administración de usuarios' },
    { re: /\/actividad/i, t: 'Monitoreo de actividad' },
    { re: /\/auditoria/i, t: 'Consultando auditoría' },
    { re: /\/catalogos/i, t: 'Consultando catálogos' },
    { re: /\/programas/i, t: 'Programas educativos' },
    { re: /\/servicios/i, t: 'Servicios' },
    { re: /\/certificados/i, t: 'Certificados' },
    { re: /\/rrhh/i, t: 'Recursos humanos' },
    { re: /\/config/i, t: 'Configuración del sistema' },
    { re: /\/jornadas/i, t: 'Jornadas de capacitación' },
  ];

  for (const { re, t } of map) {
    if (re.test(rb)) {
      if (fallo) return `${t} (error ${status})`;
      return t;
    }
  }

  const verbo =
    m === 'GET'
      ? 'Consultando'
      : m === 'POST'
        ? 'Creando / enviando'
        : m === 'PUT' || m === 'PATCH'
          ? 'Modificando'
          : m === 'DELETE'
            ? 'Eliminando'
            : m;
  return `${verbo} ${rb}${fallo ? ` (${status})` : ok ? '' : ` (${status})`}`;
}

function extraerUsuarioReq(req) {
  if (req.user) {
    return {
      idUsuario: req.user.sub ? String(req.user.sub) : null,
      usuario: req.user.username || null,
      rol: req.user.rol ? String(req.user.rol) : null,
    };
  }
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  try {
    return usuarioDeToken(jwt.verify(token, process.env.JWT_SECRET));
  } catch {
    return null;
  }
}

function actualizarSesionActiva(usr, doc) {
  if (!usr?.idUsuario) return;
  const prev = sesionesActivas.get(usr.idUsuario) || {};
  sesionesActivas.set(usr.idUsuario, {
    idUsuario: usr.idUsuario,
    usuario: doc.usuario,
    nombreUsuario: doc.nombreUsuario,
    rol: doc.rol,
    ultimaActividad: doc.actividad,
    ultimaRuta: doc.rutaPantalla || doc.rutaBase || doc.ruta,
    rutaPantalla: doc.rutaPantalla || null,
    ultimoMetodo: doc.metodo,
    ultimoCodigo: doc.codigoHttp,
    ultimaFecha: doc.fecha,
    peticionesEnVentana: (prev.peticionesEnVentana || 0) + 1,
    bytesEntradaVentana: (prev.bytesEntradaVentana || 0) + (doc.bytesEntrada || 0),
    bytesSalidaVentana: (prev.bytesSalidaVentana || 0) + (doc.bytesSalida || 0),
  });
}

async function registrarPeticion({
  req,
  statusCode,
  duracionMs,
  nombreUsuario,
  bytesEntrada = 0,
  bytesSalida = 0,
}) {
  const ruta = req.originalUrl || req.url || '';
  const rb = rutaBase(ruta);
  let usr = extraerUsuarioReq(req);

  if (!usr?.idUsuario && !usr?.usuario && /\/auth\/login$/i.test(rb) && statusCode >= 200 && statusCode < 300) {
    const login = req.body?.username || req.body?.usuario;
    if (login) usr = { idUsuario: null, usuario: String(login).trim(), rol: null };
  }
  if (!usr?.idUsuario && !usr?.usuario) return null;
  const metodo = req.method || 'GET';
  const rutaPantalla = normalizarRutaPantalla(req.headers['x-argo-pantalla']);
  const actividadPantalla = rutaPantalla ? describirPantalla(rutaPantalla) : null;
  const actividad = actividadPantalla || describirActividad(metodo, rb, statusCode);

  const doc = {
    idActividad: allocIdActividad(),
    fecha: new Date(),
    ...usr,
    nombreUsuario: nombreUsuario || null,
    metodo,
    ruta,
    rutaBase: rb,
    rutaPantalla,
    codigoHttp: statusCode,
    duracionMs,
    bytesEntrada,
    bytesSalida,
    actividad,
    ip: req.ip || req.headers?.['x-forwarded-for'] || null,
  };

  actualizarSesionActiva(usr, doc);

  setImmediate(() => {
    ActividadHttp.create(doc).catch((err) => {
      console.error('[ARGO actividad]', err.message);
    });
  });

  return doc;
}

async function listarActivos(minutos = ACTIVOS_MINUTOS) {
  const desde = new Date(Date.now() - minutos * 60 * 1000);

  const agg = await ActividadHttp.aggregate([
    { $match: { fecha: { $gte: desde }, idUsuario: { $exists: true, $ne: null } } },
    { $sort: { fecha: -1 } },
    {
      $group: {
        _id: '$idUsuario',
        usuario: { $first: '$usuario' },
        nombreUsuario: { $first: '$nombreUsuario' },
        rol: { $first: '$rol' },
        ultimaActividad: { $first: '$actividad' },
        ultimaRuta: { $first: { $ifNull: ['$rutaPantalla', '$rutaBase'] } },
        rutaPantalla: { $first: '$rutaPantalla' },
        ultimoMetodo: { $first: '$metodo' },
        ultimoCodigo: { $first: '$codigoHttp' },
        ultimaFecha: { $first: '$fecha' },
        peticionesRecientes: { $sum: 1 },
        bytesEntrada: { $sum: { $ifNull: ['$bytesEntrada', 0] } },
        bytesSalida: { $sum: { $ifNull: ['$bytesSalida', 0] } },
      },
    },
    { $sort: { ultimaFecha: -1 } },
  ]);

  const mem = [...sesionesActivas.values()].filter(
    (s) => s.ultimaFecha && new Date(s.ultimaFecha) >= desde,
  );

  const porId = new Map();
  for (const row of agg) {
    porId.set(row._id, {
      idUsuario: row._id,
      usuario: row.usuario,
      nombreUsuario: row.nombreUsuario,
      rol: row.rol,
      ultimaActividad: row.ultimaActividad,
      ultimaRuta: row.ultimaRuta,
      rutaPantalla: row.rutaPantalla || null,
      ultimoMetodo: row.ultimoMetodo,
      ultimoCodigo: row.ultimoCodigo,
      ultimaFecha: row.ultimaFecha,
      peticionesRecientes: row.peticionesRecientes,
      bytesEntrada: row.bytesEntrada,
      bytesSalida: row.bytesSalida,
      bytesTotal: row.bytesEntrada + row.bytesSalida,
      enLinea: true,
    });
  }
  for (const s of mem) {
    const prev = porId.get(s.idUsuario);
    const merged = {
      ...s,
      bytesEntrada: Math.max(s.bytesEntradaVentana || 0, prev?.bytesEntrada || 0),
      bytesSalida: Math.max(s.bytesSalidaVentana || 0, prev?.bytesSalida || 0),
      peticionesRecientes: Math.max(s.peticionesEnVentana || 0, prev?.peticionesRecientes || 0),
      enLinea: true,
    };
    merged.bytesTotal = merged.bytesEntrada + merged.bytesSalida;
    if (!prev || new Date(s.ultimaFecha) >= new Date(prev.ultimaFecha)) {
      porId.set(s.idUsuario, { ...prev, ...merged });
    }
  }

  return [...porId.values()].sort(
    (a, b) => new Date(b.ultimaFecha).getTime() - new Date(a.ultimaFecha).getTime(),
  );
}

async function resumenTraficoVentana(minutos = ACTIVOS_MINUTOS) {
  const desde = new Date(Date.now() - minutos * 60 * 1000);
  const agg = await ActividadHttp.aggregate([
    { $match: { fecha: { $gte: desde } } },
    {
      $group: {
        _id: null,
        peticiones: { $sum: 1 },
        bytesEntrada: { $sum: { $ifNull: ['$bytesEntrada', 0] } },
        bytesSalida: { $sum: { $ifNull: ['$bytesSalida', 0] } },
      },
    },
  ]);
  const row = agg[0] || { peticiones: 0, bytesEntrada: 0, bytesSalida: 0 };
  return {
    peticiones: row.peticiones,
    bytesEntrada: row.bytesEntrada,
    bytesSalida: row.bytesSalida,
    bytesTotal: row.bytesEntrada + row.bytesSalida,
  };
}

async function obtenerMonitor(minutos = ACTIVOS_MINUTOS) {
  const [sistema, usuarios, trafico] = await Promise.all([
    Promise.resolve(obtenerMetricasSistema()),
    listarActivos(minutos),
    resumenTraficoVentana(minutos),
  ]);
  return {
    timestamp: new Date().toISOString(),
    minutosVentana: minutos,
    sistema,
    trafico,
    usuariosConectados: usuarios.length,
    usuarios,
  };
}

async function listarHistorial(filtros = {}) {
  const { desde, hasta, usuario, idUsuario, limit: limitRaw, page: pageRaw } = filtros;
  const filter = {};
  if (desde || hasta) {
    filter.fecha = {};
    if (desde) filter.fecha.$gte = new Date(desde);
    if (hasta) filter.fecha.$lte = new Date(hasta);
  }
  if (usuario) filter.usuario = new RegExp(String(usuario).trim(), 'i');
  if (idUsuario) filter.idUsuario = String(idUsuario);

  const limit = Math.min(Math.max(Number(limitRaw) || 80, 1), 300);
  const page = Math.max(Number(pageRaw) || 1, 1);
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    ActividadHttp.find(filter).sort({ fecha: -1, idActividad: -1 }).skip(skip).limit(limit).lean(),
    ActividadHttp.countDocuments(filter),
  ]);

  return { items, total, page, limit, pages: Math.ceil(total / limit) || 1 };
}

module.exports = {
  initContadorActividad,
  registrarPeticion,
  listarActivos,
  listarHistorial,
  obtenerMonitor,
  describirActividad,
  describirPantalla,
  ACTIVOS_MINUTOS,
};
