const Empleado = require('../models/Empleado');
const Usuario = require('../models/Usuario');
const Cargo = require('../models/Cargo');
const DepartamentoEmpresa = require('../models/DepartamentoEmpresa');
const ClaseProgramadaCea = require('../models/ClaseProgramadaCea');
const ClaseJornadaCap = require('../models/ClaseJornadaCap');
const {
  empleadoPorUsuarioId,
  esEmpleadoInstructor,
  nombreEmpleado,
  enriquecerClases,
  filtroInstructorQuery,
} = require('./instructorJornada');
const { listarClases, dtoClase, alertasClasesProximas } = require('./programacionCeaClases');
const { fechaHoyStr } = require('./inspeccionVehiculo');
const { inspeccionRegistradaHoy, vehiculoPorPlaca } = require('./vehiculoInspeccionOperacion');
const { normalizarEmpleadoLegacy, nombreCompletoEmpleado } = require('../utils/empleadoDoc');
const { num } = require('./rrhhCatalogo');

const CAMPOS_PERFIL_EDITABLES = [
  'correoPersonal',
  'correoCorporativo',
  'telefono',
  'celular',
  'direccion',
  'ciudad',
  'departamento',
];

function parseFechaYmd(str) {
  if (!str) return null;
  const s = String(str).trim().slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function inicioDia(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function finDia(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function parseHoraMinutos(horaStr) {
  const m = String(horaStr || '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

async function resolverPerfilEmpleado(emp) {
  const e = normalizarEmpleadoLegacy(emp);
  const [cargo, depto, usuario] = await Promise.all([
    e.cargoId ? Cargo.findOne({ idCargo: e.cargoId }).lean() : null,
    e.departamentoId ? DepartamentoEmpresa.findOne({ idDepartamento: e.departamentoId }).lean() : null,
    e.idUsuario ? Usuario.findById(e.idUsuario).lean() : null,
  ]);
  return {
    ...e,
    salario: num(e.salario),
    nombreCompleto: nombreCompletoEmpleado(e),
    cargoNombre: cargo?.nombre || null,
    departamentoNombre: depto?.nombre || null,
    idUsuario: e.idUsuario ? String(e.idUsuario) : null,
    usuarioLogin: usuario?.username || null,
    usuarioRol: usuario?.rol || null,
  };
}

async function requireInstructor(req) {
  const emp = await empleadoPorUsuarioId(req.user?.sub);
  if (!emp) {
    return { error: 'Su usuario no está vinculado a un empleado en RRHH.', status: 403 };
  }
  if (!(await esEmpleadoInstructor(emp))) {
    return { error: 'Su cargo no corresponde a instructor.', status: 403 };
  }
  return { emp };
}

async function miPerfil(req) {
  const { emp, error, status } = await requireInstructor(req);
  if (error) return { error, status };
  return resolverPerfilEmpleado(emp);
}

async function actualizarMiPerfil(req, body) {
  const { emp, error, status } = await requireInstructor(req);
  if (error) return { error, status };

  const patch = {};
  for (const k of CAMPOS_PERFIL_EDITABLES) {
    if (body[k] === undefined) continue;
    let v = body[k];
    if (v == null || v === '') {
      patch[k] = '';
      continue;
    }
    v = String(v).trim();
    if (k === 'correoPersonal' || k === 'correoCorporativo') v = v.toLowerCase();
    patch[k] = v;
  }

  if (!Object.keys(patch).length) {
    return { error: 'No hay datos para actualizar', status: 400 };
  }

  const user = req.user?.username || 'instructor';
  await Empleado.updateOne(
    { idEmpleado: emp.idEmpleado },
    { $set: { ...patch, updatedAt: new Date(), userChangeRecord: user } },
  );
  const actualizado = await Empleado.findOne({ idEmpleado: emp.idEmpleado }).lean();
  return resolverPerfilEmpleado(actualizado);
}

function horaLocalDesdeDate(d) {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  const h = String(dt.getHours()).padStart(2, '0');
  const m = String(dt.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function normalizarClasePortal(item, origen) {
  const hora =
    origen === 'jornada'
      ? horaLocalDesdeDate(item.horaInicio)
      : String(item.horaDesde || '').trim();
  const horaFin =
    origen === 'jornada'
      ? horaLocalDesdeDate(item.horaFin)
      : String(item.horaHasta || '').trim();

  return {
    _id: String(item._id),
    origen,
    tipoClase: origen === 'jornada' ? 'jornada' : item.tipoClase,
    estado: item.estado,
    fechaClase: item.fechaClase,
    horaDesde: hora,
    horaHasta: horaFin,
    programaLabel: item.programaLabel || item.programaNombre || item.idProg || item.idPrograma || '',
    temaNombre: item.temaNombre || item.nombreClase || item.contratoLabel || '',
    aulaNombre: item.aulaNombre || '',
    tallerNombre: item.tallerNombre || '',
    idVehiculo: item.idVehiculo || item.placa || '',
    vehiculoLabel: item.idVehiculo || item.placa || '',
    inscritos: item.inscritos ?? null,
    instructorNombre: item.instructorNombre || '',
    minutosOrden: parseHoraMinutos(hora) ?? 9999,
    idJornada: item.idJornada || null,
    idProg: item.idProg || item.idPrograma || null,
  };
}

function rangoFechasConsulta(query = {}) {
  const hoy = new Date();
  const desde = inicioDia(parseFechaYmd(query.desde) || hoy);
  const hastaBase = parseFechaYmd(query.hasta) || finDia(hoy);
  const hastaExcl = new Date(hastaBase);
  hastaExcl.setDate(hastaExcl.getDate() + 1);
  hastaExcl.setHours(0, 0, 0, 0);
  return {
    desde,
    hastaExcl,
    hastaLabel: hastaBase.toISOString().slice(0, 10),
  };
}

async function misClases(req, query = {}) {
  const { emp, error, status } = await requireInstructor(req);
  if (error) return { error, status };

  const { desde, hastaExcl, hastaLabel } = rangoFechasConsulta(query);
  const filtroInst = filtroInstructorQuery(emp, req.user?.sub);

  const qCea = {
    ...filtroInst,
    estado: { $ne: 'CANCELADA' },
    fechaClase: { $gte: desde, $lt: hastaExcl },
  };

  const ceaRows = await ClaseProgramadaCea.find(qCea).sort({ fechaClase: 1, horaDesde: 1 }).lean();
  const cea = [];
  for (const r of ceaRows) {
    const dto = await dtoClase(r);
    cea.push(normalizarClasePortal(dto, 'cea'));
  }

  const qJor = {
    ...filtroInst,
    estado: { $in: ['PROGRAMADA', 'EN PROCESO', 'FINALIZADO'] },
    fechaClase: { $gte: desde, $lt: hastaExcl },
  };
  const jorRows = await ClaseJornadaCap.find(qJor).sort({ fechaClase: 1, horaInicio: 1 }).lean();
  const jorEnriched = await enriquecerClases(jorRows);
  const jornada = jorEnriched.map((r) => normalizarClasePortal(r, 'jornada'));

  const todas = [...cea, ...jornada].sort((a, b) => {
    const fa = new Date(a.fechaClase).getTime();
    const fb = new Date(b.fechaClase).getTime();
    if (fa !== fb) return fa - fb;
    return a.minutosOrden - b.minutosOrden;
  });

  return {
    desde: desde.toISOString().slice(0, 10),
    hasta: hastaLabel,
    total: todas.length,
    clases: todas,
    idEmpleado: emp.idEmpleado,
  };
}

async function clasesAsignadasRecientes(req, dias = 7) {
  const { emp, error, status } = await requireInstructor(req);
  if (error) return { error, status };

  const desde = new Date();
  desde.setDate(desde.getDate() - Math.max(1, Number(dias) || 7));

  const filtroInst = filtroInstructorQuery(emp, req.user?.sub);
  const q = {
    ...filtroInst,
    estado: { $in: ['PROGRAMADA', 'CREADO'] },
    updatedAt: { $gte: desde },
  };

  const [ceaRows, jorRows] = await Promise.all([
    ClaseProgramadaCea.find(q).sort({ updatedAt: -1 }).limit(30).lean(),
    ClaseJornadaCap.find(q).sort({ updatedAt: -1 }).limit(30).lean(),
  ]);

  const out = [];
  for (const r of ceaRows) {
    const dto = await dtoClase(r);
    out.push({ ...normalizarClasePortal(dto, 'cea'), asignadaEn: r.updatedAt || r.createdAt });
  }
  for (const r of jorRows) {
    const [enriched] = await enriquecerClases([r]);
    out.push({
      ...normalizarClasePortal(enriched, 'jornada'),
      asignadaEn: r.updatedAt || r.createdAt,
    });
  }

  out.sort((a, b) => new Date(b.asignadaEn).getTime() - new Date(a.asignadaEn).getTime());
  return { total: out.length, clases: out.slice(0, 20) };
}

async function inspeccionPrimeraPracticaDia(req) {
  const { emp, error, status } = await requireInstructor(req);
  if (error) return { error, status };

  const hoyStr = fechaHoyStr();
  const hoy = parseFechaYmd(hoyStr) || inicioDia(new Date());
  const fin = finDia(hoy);

  const filtroInst = filtroInstructorQuery(emp, req.user?.sub);
  const practicas = await ClaseProgramadaCea.find({
    ...filtroInst,
    tipoClase: 'practica',
    estado: { $in: ['PROGRAMADA', 'EN PROCESO'] },
    fechaClase: { $gte: hoy, $lte: fin },
    horaDesde: { $nin: [null, ''] },
    idVehiculo: { $nin: [null, ''] },
  })
    .sort({ horaDesde: 1 })
    .lean();

  if (!practicas.length) {
    return { requerida: false, fecha: hoyStr, mensaje: null, vehiculo: null, clase: null };
  }

  let primera = null;
  for (const p of practicas) {
    const placa = String(p.idVehiculo || '').trim();
    if (!placa) continue;
    const ok = await inspeccionRegistradaHoy(placa, hoyStr);
    if (!ok) {
      primera = p;
      break;
    }
  }

  if (!primera) {
    return {
      requerida: false,
      fecha: hoyStr,
      mensaje: null,
      vehiculo: null,
      clase: null,
      inspeccionCompleta: true,
    };
  }

  const placa = String(primera.idVehiculo || '').trim();
  const vehiculo = placa ? await vehiculoPorPlaca(placa) : null;

  const dto = await dtoClase(primera);

  return {
    requerida: true,
    fecha: hoyStr,
    mensaje: `Antes de iniciar la práctica de hoy (${primera.horaDesde || '—'}) debe completar la inspección preoperacional del vehículo ${placa}.`,
    vehiculo: vehiculo
      ? {
          _id: String(vehiculo._id),
          placa: vehiculo.placa,
          marcaLinea: [vehiculo.nombreMarca, vehiculo.nombreLinea].filter(Boolean).join(' ').trim(),
          claseVehiculo: vehiculo.claseVehiculo || '',
        }
      : placa
        ? { _id: null, placa, marcaLinea: '', claseVehiculo: '' }
        : null,
    clase: normalizarClasePortal(dto, 'cea'),
    inspeccionCompleta: false,
  };
}

async function misAlertas(req) {
  const minutos = Math.min(120, Math.max(1, Number(req.query?.minutos) || 20));
  const { emp, error, status } = await requireInstructor(req);
  if (error) return { error, status };

  const [proximas, asignadas, inspeccion] = await Promise.all([
    alertasClasesProximas(req, minutos),
    clasesAsignadasRecientes(req, Number(req.query?.diasAsignacion) || 3),
    inspeccionPrimeraPracticaDia(req),
  ]);

  return {
    minutosVentana: minutos,
    proximas: proximas.clases || [],
    totalProximas: proximas.total || 0,
    asignadasRecientes: asignadas.clases || [],
    totalAsignadasRecientes: asignadas.total || 0,
    inspeccion,
    idEmpleado: emp.idEmpleado,
    nombreInstructor: nombreEmpleado(emp),
  };
}

module.exports = {
  requireInstructor,
  miPerfil,
  actualizarMiPerfil,
  misClases,
  misAlertas,
  clasesAsignadasRecientes,
  inspeccionPrimeraPracticaDia,
  CAMPOS_PERFIL_EDITABLES,
};
