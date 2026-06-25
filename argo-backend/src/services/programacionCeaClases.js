const ClaseProgramadaCea = require('../models/ClaseProgramadaCea');
const InscripcionClaseCea = require('../models/InscripcionClaseCea');
const TemaProgramaCea = require('../models/TemaProgramaCea');
const DatosAlumno = require('../models/DatosAlumno');
const Empleado = require('../models/Empleado');
const Vehiculo = require('../models/Vehiculo');
const mongoose = require('mongoose');
const { normalizarPlaca } = require('../constants/vehiculo');
const { models: cat } = require('../models/catalogos');
const { TIPOS_CLASE_CEA } = require('../constants/programacionCea');
const { obtenerConfig } = require('./configProgramacionCea');
const { diaProgramable, horarioParaDia } = require('./festivosColombia');
const {
  buscarProgramaCea,
  rastreoAlumno,
  labelPrograma,
  horasClase,
} = require('./programacionCeaRastreo');
const { idProgDePrograma } = require('./programaServicio');
const { empleadoPorUsuarioId, nombreEmpleado, listarInstructoresConUsuario } = require('./instructorJornada');
const { tieneAlguno, permisosParaRol } = require('./rolesPermisos');
const { coincideBusquedaAlumno, concatNombreAlumno } = require('../utils/busquedaAlumnoNombre');
const { parseNumDoc } = require('../utils/numDoc');
const { normalizarIdSede } = require('./sedeContext');
const { parseFechaCalendario, hoyCalendario } = require('../utils/fechaCalendario');
const { bloqueoInspeccionParaIniciarClase } = require('./vehiculoInspeccionOperacion');

function err(msg, status = 400) {
  const e = new Error(msg);
  e.status = status;
  return e;
}

function puedeGestionarCea(req) {
  const permisos = req?.permisos || [];
  return tieneAlguno(permisos, ['programacion_cea.gestionar', '*']);
}

/** Instructor (operar): solo ajustes de última hora — horario, ubicación, cupo. */
function bodyEdicionOperar(body, clase) {
  return {
    idProg: clase.idProg,
    tipoClase: clase.tipoClase,
    idTema: clase.idTema,
    idEmpleadoInstructor: clase.idEmpleadoInstructor,
    fechaClase: body.fechaClase ?? clase.fechaClase,
    horaDesde: body.horaDesde ?? clase.horaDesde,
    horaHasta: body.horaHasta ?? clase.horaHasta,
    duracionHoras: body.duracionHoras ?? clase.duracionHoras,
    idAula: body.idAula ?? clase.idAula,
    idTaller: body.idTaller ?? clase.idTaller,
    idVehiculo: body.idVehiculo ?? clase.idVehiculo,
    cupoMaximo: body.cupoMaximo ?? clase.cupoMaximo,
    observaciones: body.observaciones ?? clase.observaciones,
  };
}

function esObjectIdMongo(val) {
  return /^[a-fA-F0-9]{24}$/.test(String(val || ''));
}

/** Busca en catálogo por id legible (idAula, idTaller…) sin cast inválido a _id. */
function queryCatalogoPorId(idField, idValue) {
  const or = [{ [idField]: idValue }];
  if (esObjectIdMongo(idValue)) or.push({ _id: idValue });
  return { $or: or };
}

function inicioDia(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function parseFechaYmd(str) {
  if (str instanceof Date) return inicioDia(str);
  const m = String(str || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : inicioDia(d);
}

function parseHoraMinutos(horaStr) {
  const m = String(horaStr ?? '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

const TZ_CEA = 'America/Bogota';

function ymdEnZona(date = new Date(), tz = TZ_CEA) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(date);
}

function minutosEnZona(date = new Date(), tz = TZ_CEA) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const min = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return h * 60 + min;
}

/** YYYY-MM-DD calendario de fechaClase (misma intención que el formulario). */
function ymdFechaClaseCampo(fechaClase) {
  if (fechaClase == null) return '';
  const raw = String(fechaClase);
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const d = fechaClase instanceof Date ? fechaClase : new Date(fechaClase);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

function esFechaClaseHoy(fechaClase, now = new Date()) {
  const hoyBogota = ymdEnZona(now);
  const hoyServidor = ymdFechaClaseCampo(inicioDia(now));
  const claseYmd = ymdFechaClaseCampo(fechaClase);
  let claseYmdBogota = '';
  try {
    const d = fechaClase instanceof Date ? fechaClase : new Date(fechaClase);
    if (!Number.isNaN(d.getTime())) claseYmdBogota = ymdEnZona(d);
  } catch {
    claseYmdBogota = '';
  }
  return (
    claseYmd === hoyBogota ||
    claseYmd === hoyServidor ||
    claseYmdBogota === hoyBogota
  );
}

function minutosAHora(mins) {
  const h = Math.floor(mins / 60) % 24;
  const min = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function calcularHoraHasta(horaDesde, duracionHoras) {
  const start = parseHoraMinutos(horaDesde);
  if (start == null || !duracionHoras) return '';
  return minutosAHora(start + Math.round(Number(duracionHoras) * 60));
}

function esFechaClaseNoFutura(fechaClase) {
  const fc = parseFechaCalendario(fechaClase);
  const hoy = hoyCalendario();
  if (!fc || !hoy) return false;
  return fc.getTime() <= hoy.getTime();
}

function fechaHoraProgramada(fechaClase, horaStr) {
  const fd = parseFechaCalendario(fechaClase);
  const mins = parseHoraMinutos(horaStr);
  if (!fd || mins == null) return null;
  const d = new Date(fd);
  d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
  return d;
}

function horarioProgramadoCompleto(clase) {
  if (!clase?.fechaClase) return null;
  const horaDesde = clase.horaDesde;
  let horaHasta = clase.horaHasta;
  if (!parseHoraMinutos(horaDesde)) return null;
  if (!parseHoraMinutos(horaHasta)) {
    horaHasta = calcularHoraHasta(horaDesde, clase.duracionHoras);
  }
  if (!parseHoraMinutos(horaHasta)) return null;
  const horaInicio = fechaHoraProgramada(clase.fechaClase, horaDesde);
  const horaFin = fechaHoraProgramada(clase.fechaClase, horaHasta);
  if (!horaInicio || !horaFin || horaFin <= horaInicio) return null;
  return { horaInicio, horaFin, horaHasta };
}

function horasEntreHoras(horaDesde, horaHasta) {
  const desde = parseHoraMinutos(horaDesde);
  const hasta = parseHoraMinutos(horaHasta);
  if (desde == null || hasta == null || hasta <= desde) return null;
  return Math.round(((hasta - desde) / 60) * 100) / 100;
}

/** idVehiculo en clases CEA es la placa; acepta también _id Mongo si viene del front legacy. */
async function buscarVehiculoPorRef(ref) {
  const raw = String(ref || '').trim();
  if (!raw) return null;
  const placaNorm = normalizarPlaca(raw);
  const filtro = [{ placa: placaNorm }];
  if (mongoose.isValidObjectId(raw)) {
    filtro.unshift({ _id: raw });
  }
  return Vehiculo.findOne({ $or: filtro }).lean();
}

function rangoMinutosClase(clase, bufferExtra = 0) {
  const desde = parseHoraMinutos(clase.horaDesde);
  let hasta = parseHoraMinutos(clase.horaHasta);
  if (desde == null) return null;
  if (hasta == null && clase.duracionHoras > 0) {
    hasta = desde + Math.round(Number(clase.duracionHoras) * 60);
  }
  if (hasta == null || hasta <= desde) return null;
  return { desde, hasta: hasta + bufferExtra };
}

function rangosSeSolapan(a, b) {
  if (!a || !b) return false;
  return a.desde < b.hasta && b.desde < a.hasta;
}

function labelTipoClaseConflicto(tipo) {
  const map = { teoria: 'teoría', taller: 'taller', practica: 'práctica' };
  return map[String(tipo || '').toLowerCase()] || String(tipo || 'clase');
}

function describeClaseSolapada(ex) {
  const tipo = labelTipoClaseConflicto(ex.tipoClase);
  const horario = [ex.horaDesde, ex.horaHasta].filter(Boolean).join('–') || 'sin horario';
  const estado = ex.estado ? `, ${ex.estado}` : '';
  return `clase de ${tipo} ${horario}${estado}`;
}

function mensajeConflictoRecurso(tipo, recursoLabel, ex) {
  return `${recursoLabel} ya está en uso: ${describeClaseSolapada(ex)}.`;
}

function mensajePrincipalConflictos(conflictos) {
  if (!conflictos?.length) return 'Conflicto de programación detectado';
  if (conflictos.length === 1) return conflictos[0].mensaje;
  return `${conflictos[0].mensaje} Además hay ${conflictos.length - 1} conflicto(s) más (revise el detalle).`;
}

function bloqueConfigPorTipo(tipo, config) {
  if (tipo === 'teoria') return config.aula;
  if (tipo === 'taller') return config.taller;
  return config.vehiculo;
}

async function resolverInstructorCea(req, body = {}) {
  const permisos = req.permisos || (await permisosParaRol(req.user?.rol));
  const puedeAsignar = tieneAlguno(permisos, ['programacion_cea.gestionar']);

  const idEmpleadoRaw = body.idEmpleadoInstructor ?? body.idEmpleado;
  if (idEmpleadoRaw != null && idEmpleadoRaw !== '' && puedeAsignar) {
    const idEmpleado = Number(idEmpleadoRaw);
    if (!Number.isFinite(idEmpleado)) throw err('idEmpleadoInstructor inválido');
    const emp = await Empleado.findOne({ idEmpleado }).lean();
    if (!emp) throw err('Empleado instructor no encontrado', 404);
    return {
      idEmpleadoInstructor: emp.idEmpleado,
      idUsuarioInstructor: emp.idUsuario ? String(emp.idUsuario) : '',
      instructorNombre: nombreEmpleado(emp),
    };
  }

  const emp = await empleadoPorUsuarioId(req.user?.sub);
  if (!emp) {
    throw err('Su usuario debe estar vinculado a un empleado en RRHH para operar clases CEA.');
  }
  return {
    idEmpleadoInstructor: emp.idEmpleado,
    idUsuarioInstructor: emp.idUsuario ? String(emp.idUsuario) : String(req.user?.sub || ''),
    instructorNombre: nombreEmpleado(emp),
  };
}

async function filtroClasesPorRol(req) {
  const permisos = req.permisos || (await permisosParaRol(req.user?.rol));
  if (tieneAlguno(permisos, ['programacion_cea.gestionar'])) return null;
  const emp = await empleadoPorUsuarioId(req.user?.sub);
  const or = [];
  if (emp?.idEmpleado != null) or.push({ idEmpleadoInstructor: emp.idEmpleado });
  const uid = req.user?.sub ? String(req.user.sub) : '';
  if (uid) or.push({ idUsuarioInstructor: uid });
  if (!or.length) return { _id: null };
  return { $or: or };
}

async function dtoClase(clase) {
  if (!clase) return null;
  const doc = clase.toObject ? clase.toObject() : { ...clase };
  let temaNombre = '';
  if (doc.idTema) {
    const tema = await TemaProgramaCea.findById(doc.idTema).lean();
    temaNombre = tema?.nombre || '';
  }
  let instructorNombre = doc.instructorNombre || '';
  if (!instructorNombre && doc.idEmpleadoInstructor) {
    const emp = await Empleado.findOne({ idEmpleado: doc.idEmpleadoInstructor }).lean();
    instructorNombre = nombreEmpleado(emp);
  }
  let aulaNombre = '';
  if (doc.idAula) {
    const a = await cat.aulas.findOne(queryCatalogoPorId('idAula', doc.idAula)).lean();
    aulaNombre = a?.nombre || a?.descrAula || String(doc.idAula);
  }
  let tallerNombre = '';
  if (doc.idTaller) {
    const t = await cat.talleres.findOne(queryCatalogoPorId('idTaller', doc.idTaller)).lean();
    tallerNombre = t?.nombre || String(doc.idTaller);
  }
  const prog = await buscarProgramaCea(doc.idProg);
  const inscritos = await InscripcionClaseCea.countDocuments({ idClase: doc._id });
  return {
    ...doc,
    temaNombre,
    instructorNombre,
    aulaNombre,
    tallerNombre,
    programaLabel: prog ? labelPrograma(prog) : doc.idProg,
    inscritos,
    cupoDisponible: doc.cupoMaximo != null ? Math.max(0, doc.cupoMaximo - inscritos) : null,
  };
}

async function validarHorarioClase({ tipoClase, fechaClase, horaDesde, horaHasta, duracionHoras, config }) {
  const bloque = bloqueConfigPorTipo(tipoClase, config);
  if (!diaProgramable(fechaClase, bloque)) {
    throw err('La fecha seleccionada no está habilitada para programar (día, sábado, domingo o festivo).');
  }
  const horario = horarioParaDia(bloque, fechaClase);
  const ini = parseHoraMinutos(horaDesde);
  let fin = parseHoraMinutos(horaHasta);
  if (tipoClase === 'practica' && duracionHoras > 0) {
    fin = ini != null ? ini + Math.round(Number(duracionHoras) * 60) : null;
  }
  const hIni = parseHoraMinutos(horario?.horaDesde || bloque.horaDesde);
  const hFin = parseHoraMinutos(horario?.horaHasta || bloque.horaHasta);
  if (ini == null || fin == null) throw err('Indique horaDesde y horaHasta válidas (HH:mm).');
  if (ini < hIni || fin > hFin) {
    throw err(`El horario debe estar entre ${horario?.horaDesde || bloque.horaDesde} y ${horario?.horaHasta || bloque.horaHasta} para este tipo de día.`);
  }
  if (fin <= ini) throw err('La hora de fin debe ser posterior a la de inicio.');
}

async function detectarConflictos(claseData, excludeId = null) {
  const config = await obtenerConfig();
  const buffer = Number(config.vehiculo?.bufferMinutos) || 0;
  const fecha = inicioDia(claseData.fechaClase);
  const finDia = new Date(fecha);
  finDia.setDate(finDia.getDate() + 1);

  const q = {
    fechaClase: { $gte: fecha, $lt: finDia },
    estado: { $nin: ['CANCELADA'] },
  };
  if (excludeId) q._id = { $ne: excludeId };

  const existentes = await ClaseProgramadaCea.find(q).lean();
  const rangoNuevo = rangoMinutosClase(claseData, claseData.tipoClase === 'practica' ? buffer : 0);
  if (!rangoNuevo) return [];

  const empIds = [...new Set(existentes.map((e) => e.idEmpleadoInstructor).filter(Boolean))];
  const instructores = empIds.length
    ? await Empleado.find({ idEmpleado: { $in: empIds } })
        .select('idEmpleado nombre1 apellido1 nombre2 apellido2')
        .lean()
    : [];
  const mapInstructor = new Map(
    instructores.map((e) => [Number(e.idEmpleado), nombreEmpleado(e)]),
  );

  const conflictos = [];
  for (const ex of existentes) {
    const bufEx = ex.tipoClase === 'practica' ? buffer : 0;
    const rangoEx = rangoMinutosClase(ex, bufEx);
    if (!rangosSeSolapan(rangoNuevo, rangoEx)) continue;

    if (claseData.idVehiculo && ex.idVehiculo && String(claseData.idVehiculo) === String(ex.idVehiculo)) {
      const placa = String(claseData.idVehiculo).toUpperCase();
      conflictos.push({
        tipo: 'vehiculo',
        mensaje: mensajeConflictoRecurso('vehiculo', `Vehículo ${placa}`, ex),
        idClase: ex._id,
        recurso: placa,
      });
    }
    if (claseData.idAula && ex.idAula && String(claseData.idAula) === String(ex.idAula)) {
      conflictos.push({
        tipo: 'aula',
        mensaje: mensajeConflictoRecurso('aula', `Aula ${claseData.idAula}`, ex),
        idClase: ex._id,
        recurso: String(claseData.idAula),
      });
    }
    if (claseData.idTaller && ex.idTaller && String(claseData.idTaller) === String(ex.idTaller)) {
      conflictos.push({
        tipo: 'taller',
        mensaje: mensajeConflictoRecurso('taller', `Taller ${claseData.idTaller}`, ex),
        idClase: ex._id,
        recurso: String(claseData.idTaller),
      });
    }
    if (
      claseData.idEmpleadoInstructor &&
      ex.idEmpleadoInstructor &&
      Number(claseData.idEmpleadoInstructor) === Number(ex.idEmpleadoInstructor)
    ) {
      const nom =
        mapInstructor.get(Number(ex.idEmpleadoInstructor)) ||
        `instructor #${ex.idEmpleadoInstructor}`;
      conflictos.push({
        tipo: 'instructor',
        mensaje: mensajeConflictoRecurso('instructor', `Instructor ${nom}`, ex),
        idClase: ex._id,
        recurso: nom,
      });
    }
  }
  return conflictos;
}

async function armarDatosClase(body, req, { excludeId = null } = {}) {
  const config = await obtenerConfig();
  const idProg = String(body.idProg || '').trim();
  const tipoClase = String(body.tipoClase || '').trim();
  if (!idProg) throw err('idProg es obligatorio');
  if (!TIPOS_CLASE_CEA.includes(tipoClase)) throw err('tipoClase inválido');

  const prog = await buscarProgramaCea(idProg);
  if (!prog) throw err('Programa CEA no encontrado', 404);

  const fechaClase = body.fechaClase != null ? parseFechaYmd(body.fechaClase) : null;
  if (!fechaClase) throw err('fechaClase inválida (YYYY-MM-DD)');

  let horaDesde = String(body.horaDesde || '').trim();
  let horaHasta = String(body.horaHasta || '').trim();
  let duracionHoras = body.duracionHoras != null && body.duracionHoras !== '' ? Number(body.duracionHoras) : null;

  if (tipoClase === 'practica') {
    const permitidas = config.vehiculo?.duracionesPermitidas || [1, 2, 3, 4];
    if (!duracionHoras || !permitidas.includes(duracionHoras)) {
      throw err(`Duración de práctica inválida. Permitidas: ${permitidas.join(', ')} h`);
    }
    if (!horaDesde) throw err('horaDesde es obligatoria');
    horaHasta = calcularHoraHasta(horaDesde, duracionHoras);
  } else if (!horaDesde || !horaHasta) {
    throw err('horaDesde y horaHasta son obligatorias');
  }

  const instructor = await resolverInstructorCea(req, body);

  let idTema = body.idTema || null;
  let idAula = String(body.idAula || '').trim();
  let idTaller = String(body.idTaller || '').trim();
  let idVehiculo = String(body.idVehiculo || '').trim();
  let cupoMaximo = body.cupoMaximo != null && body.cupoMaximo !== '' ? Number(body.cupoMaximo) : null;

  if (tipoClase === 'teoria') {
    if (!idTema) throw err('Seleccione un tema de teoría');
    if (!idAula) throw err('Seleccione un aula');
    idTaller = '';
    idVehiculo = '';
    if (!cupoMaximo) cupoMaximo = config.aula?.cupoMaximoDefault || 10;
  } else if (tipoClase === 'taller') {
    if (!idTema) throw err('Seleccione un tema de taller');
    if (!idTaller) throw err('Seleccione ubicación de taller');
    idAula = '';
    idVehiculo = '';
    if (!cupoMaximo) cupoMaximo = config.taller?.cupoMaximoDefault || 10;
  } else {
    idTema = null;
    idAula = '';
    idTaller = '';
    if (!idVehiculo) throw err('Seleccione un vehículo');
    const veh = await buscarVehiculoPorRef(idVehiculo);
    if (!veh) throw err('Vehículo no encontrado', 404);
    idVehiculo = veh.placa;
    cupoMaximo = 1;
    duracionHoras = duracionHoras || 1;
  }

  if (fechaClase) {
    await validarHorarioClase({ tipoClase, fechaClase, horaDesde, horaHasta, duracionHoras, config });
  }

  const idSede = normalizarIdSede(req?.idSede || body.idSede);
  if (!idSede) throw err('Debe seleccionar la sede para programar la clase', 428);

  const data = {
    idProg: String(idProgDePrograma(prog)),
    idSede,
    tipoClase,
    idTema: idTema || null,
    fechaClase,
    horaDesde,
    horaHasta,
    duracionHoras,
    idAula,
    idTaller,
    idVehiculo,
    idEmpleadoInstructor: instructor.idEmpleadoInstructor,
    idUsuarioInstructor: instructor.idUsuarioInstructor,
    cupoMaximo,
    observaciones: String(body.observaciones || '').trim(),
  };

  const hdAuto = horasEntreHoras(data.horaDesde, data.horaHasta);
  if (hdAuto != null && hdAuto > 0) {
    data.horasDescuento = hdAuto;
  }

  if (tipoClase === 'practica') {
    const nd = parseNumDoc(body.numDoc);
    const tieneIns = Array.isArray(body.inscripciones) && body.inscripciones.length > 0;
    let yaInscritos = false;
    if (excludeId) {
      yaInscritos = (await InscripcionClaseCea.countDocuments({ idClase: excludeId })) > 0;
    }
    if (!nd && !tieneIns && !yaInscritos) {
      throw err('Seleccione el alumno para la clase práctica');
    }
  }

  if (fechaClase) {
    const conflictos = await detectarConflictos(data, excludeId);
    if (conflictos.length) {
      const e = err(mensajePrincipalConflictos(conflictos));
      e.status = 409;
      e.conflictos = conflictos;
      throw e;
    }
  }

  return data;
}

async function listarClases(req) {
  const q = {};
  const rolFiltro = await filtroClasesPorRol(req);
  if (rolFiltro) Object.assign(q, rolFiltro);

  const { desde, hasta, fecha, idProg, tipoClase, estado } = req.query || {};
  if (fecha) {
    const d = parseFechaYmd(fecha);
    if (d) {
      const fin = new Date(d);
      fin.setDate(fin.getDate() + 1);
      q.fechaClase = { $gte: d, $lt: fin };
    }
  } else if (desde || hasta) {
    q.fechaClase = {};
    if (desde) q.fechaClase.$gte = parseFechaYmd(desde) || new Date(desde);
    if (hasta) {
      const h = parseFechaYmd(hasta) || new Date(hasta);
      h.setDate(h.getDate() + 1);
      q.fechaClase.$lt = h;
    }
  }
  if (idProg) q.idProg = String(idProg);
  if (tipoClase) q.tipoClase = String(tipoClase);
  if (estado) q.estado = String(estado);
  // Instructor: ve sus clases en todas las sedes; admin sigue filtrado por sede activa.
  if (req.idSede && rolFiltro) {
    /* sin filtro sede */
  } else if (req.idSede) {
    q.idSede = String(req.idSede);
  }

  const rows = await ClaseProgramadaCea.find(q).sort({ fechaClase: 1, horaDesde: 1 }).lean();
  const out = [];
  for (const r of rows) out.push(await dtoClase(r));
  return out;
}

async function obtenerClase(id) {
  const clase = await ClaseProgramadaCea.findById(id);
  if (!clase) return null;
  return dtoClase(clase);
}

async function crearClase(body, req) {
  try {
    const data = await armarDatosClase(body, req);
    const clase = await ClaseProgramadaCea.create({
      ...data,
      estado: 'PROGRAMADA',
      inscritos: 0,
      userAddReg: req.user?.username || 'sistema',
    });

    const pendientes = [];
    if (data.tipoClase === 'practica') {
      const nd = parseNumDoc(body.numDoc);
      if (nd) {
        pendientes.push({
          numDoc: nd,
          origenHoras: body.origenHoras || null,
          horasAsignadas: body.horasAsignadas ?? data.horasDescuento ?? null,
        });
      }
    }
    if (Array.isArray(body.inscripciones)) {
      for (const ins of body.inscripciones) {
        const nd = parseNumDoc(ins?.numDoc);
        if (nd) {
          pendientes.push({
            numDoc: nd,
            origenHoras: ins.origenHoras || null,
            horasAsignadas: ins.horasAsignadas ?? data.horasDescuento ?? null,
          });
        }
      }
    }

    const errores = [];
    for (const ins of pendientes) {
      const r = await inscribirAlumnoInterno(clase, ins, req);
      if (r.error) errores.push(r.error);
    }

    const doc = await ClaseProgramadaCea.findById(clase._id);
    const dto = await dtoClase(doc);
    if (errores.length && pendientes.length > 0 && errores.length >= pendientes.length) {
      await ClaseProgramadaCea.deleteOne({ _id: clase._id });
      await InscripcionClaseCea.deleteMany({ idClase: clase._id });
      const e = err(errores.join(' · '));
      e.status = 400;
      throw e;
    }
    if (errores.length) dto.advertenciasInscripcion = errores;
    return dto;
  } catch (e) {
    if (e.conflictos) {
      return { error: e.message, status: e.status || 409, conflictos: e.conflictos };
    }
    throw e;
  }
}

async function actualizarClase(id, body, req) {
  const clase = await ClaseProgramadaCea.findById(id);
  if (!clase) return { error: 'Clase no encontrada', status: 404 };
  if (clase.estado === 'FINALIZADO') return { error: 'No se puede editar una clase finalizada', status: 409 };
  if (clase.estado === 'EN PROCESO') return { error: 'No se puede editar una clase en curso', status: 409 };

  if (!puedeGestionarCea(req)) {
    if (clase.estado !== 'PROGRAMADA' && clase.estado !== 'CREADO') {
      return { error: 'Solo puede editar clases programadas', status: 409 };
    }
    body = bodyEdicionOperar(body || {}, clase);
  }

  if (clase.estado === 'CREADO') {
    const { claseListaParaProgramar } = require('./programacionCeaAuto');

    if (body.idProg != null) clase.idProg = String(body.idProg).trim();
    if (body.tipoClase != null) clase.tipoClase = String(body.tipoClase).trim();
    if (body.idTema !== undefined) clase.idTema = body.idTema || null;
    if (body.fechaClase != null) {
      const fc = parseFechaYmd(body.fechaClase);
      if (fc) clase.fechaClase = fc;
    }
    if (body.horaDesde !== undefined) clase.horaDesde = String(body.horaDesde || '').trim();
    if (body.horaHasta !== undefined) clase.horaHasta = String(body.horaHasta || '').trim();
    if (body.duracionHoras !== undefined) {
      clase.duracionHoras =
        body.duracionHoras != null && body.duracionHoras !== '' ? Number(body.duracionHoras) : null;
    }
    if (body.idAula !== undefined) clase.idAula = String(body.idAula || '').trim();
    if (body.idTaller !== undefined) clase.idTaller = String(body.idTaller || '').trim();
    if (body.idVehiculo !== undefined) clase.idVehiculo = String(body.idVehiculo || '').trim();
    if (body.cupoMaximo !== undefined) {
      clase.cupoMaximo = body.cupoMaximo != null && body.cupoMaximo !== '' ? Number(body.cupoMaximo) : null;
    }
    if (body.observaciones !== undefined) clase.observaciones = String(body.observaciones || '').trim();

    if (body.idEmpleadoInstructor !== undefined || body.idEmpleado !== undefined) {
      const idEmp = body.idEmpleadoInstructor ?? body.idEmpleado;
      if (idEmp != null && idEmp !== '') {
        const emp = await Empleado.findOne({ idEmpleado: Number(idEmp) }).lean();
        if (!emp) return { error: 'Empleado instructor no encontrado', status: 404 };
        clase.idEmpleadoInstructor = emp.idEmpleado;
        clase.idUsuarioInstructor = emp.idUsuario ? String(emp.idUsuario) : '';
      } else {
        clase.idEmpleadoInstructor = null;
        clase.idUsuarioInstructor = '';
      }
    }

    if (clase.tipoClase === 'practica' && clase.horaDesde && clase.duracionHoras > 0) {
      clase.horaHasta = calcularHoraHasta(clase.horaDesde, clase.duracionHoras);
    } else if (clase.horaDesde && clase.horaHasta) {
      const hdAuto = horasEntreHoras(clase.horaDesde, clase.horaHasta);
      if (hdAuto != null && hdAuto > 0) clase.horasDescuento = hdAuto;
    }

    clase.userChangeRecord = req.user?.username || 'sistema';

    if (claseListaParaProgramar(clase)) {
      const merged = {
        idProg: clase.idProg,
        tipoClase: clase.tipoClase,
        idTema: clase.idTema,
        fechaClase: clase.fechaClase,
        horaDesde: clase.horaDesde,
        horaHasta: clase.horaHasta,
        duracionHoras: clase.duracionHoras,
        idAula: clase.idAula,
        idTaller: clase.idTaller,
        idVehiculo: clase.idVehiculo,
        idEmpleadoInstructor: clase.idEmpleadoInstructor,
        cupoMaximo: clase.cupoMaximo,
        observaciones: clase.observaciones,
      };
      try {
        const data = await armarDatosClase(merged, req, { excludeId: id });
        Object.assign(clase, data);
        clase.estado = 'PROGRAMADA';
      } catch (e) {
        if (e.conflictos) return { error: e.message, status: e.status || 409, conflictos: e.conflictos };
        throw e;
      }
    }

    await clase.save();
    return { doc: await dtoClase(clase) };
  }

  const merged = {
    idProg: body.idProg ?? clase.idProg,
    tipoClase: body.tipoClase ?? clase.tipoClase,
    idTema: body.idTema ?? clase.idTema,
    fechaClase: body.fechaClase ?? clase.fechaClase,
    horaDesde: body.horaDesde ?? clase.horaDesde,
    horaHasta: body.horaHasta ?? clase.horaHasta,
    duracionHoras: body.duracionHoras ?? clase.duracionHoras,
    idAula: body.idAula ?? clase.idAula,
    idTaller: body.idTaller ?? clase.idTaller,
    idVehiculo: body.idVehiculo ?? clase.idVehiculo,
    idEmpleadoInstructor: body.idEmpleadoInstructor ?? clase.idEmpleadoInstructor,
    cupoMaximo: body.cupoMaximo ?? clase.cupoMaximo,
    observaciones: body.observaciones ?? clase.observaciones,
  };

  try {
    const data = await armarDatosClase(merged, req, { excludeId: id });
    Object.assign(clase, data);
    clase.userChangeRecord = req.user?.username || 'sistema';
    await clase.save();
    return { doc: await dtoClase(clase) };
  } catch (e) {
    if (e.conflictos) return { error: e.message, status: e.status || 409, conflictos: e.conflictos };
    throw e;
  }
}

async function cancelarClase(id, req) {
  const clase = await ClaseProgramadaCea.findById(id);
  if (!clase) return { error: 'Clase no encontrada', status: 404 };
  if (clase.estado === 'EN PROCESO') return { error: 'Finalice la clase antes de cancelarla', status: 409 };
  if (clase.estado === 'FINALIZADO') return { error: 'La clase ya está finalizada', status: 409 };
  clase.estado = 'CANCELADA';
  clase.userChangeRecord = req.user?.username || 'sistema';
  await clase.save();
  return { doc: await dtoClase(clase) };
}

/** Elimina la clase e inscripciones de la base de datos (solo admin / gestionar). */
async function eliminarClase(id, req) {
  const clase = await ClaseProgramadaCea.findById(id);
  if (!clase) return { error: 'Clase no encontrada', status: 404 };
  if (clase.estado === 'EN PROCESO') {
    return { error: 'Finalice la clase antes de borrarla', status: 409 };
  }
  if (clase.estado === 'FINALIZADO') {
    return {
      error: 'No se puede borrar una clase finalizada (conserva el historial de horas ejecutadas)',
      status: 409,
    };
  }
  await InscripcionClaseCea.deleteMany({ idClase: clase._id });
  await ClaseProgramadaCea.deleteOne({ _id: clase._id });
  return { ok: true, id: String(clase._id) };
}

async function verificarConflictos(body, req, excludeId = null) {
  try {
    const data = await armarDatosClase(body, req, { excludeId });
    return { ok: true, conflictos: [], horaDesde: data.horaDesde, horaHasta: data.horaHasta };
  } catch (e) {
    if (e.conflictos) {
      return {
        ok: false,
        conflictos: e.conflictos,
        message: mensajePrincipalConflictos(e.conflictos),
      };
    }
    throw e;
  }
}

async function iniciarClase(id, req) {
  const clase = await ClaseProgramadaCea.findById(id);
  if (!clase) return { error: 'Clase no encontrada', status: 404 };
  if (clase.estado === 'FINALIZADO') return { error: 'La clase ya está finalizada', status: 409 };
  if (clase.estado === 'CANCELADA') return { error: 'La clase está cancelada', status: 409 };
  if (clase.estado === 'CREADO') {
    return { error: 'Programe la clase (fecha, hora e instructor) antes de iniciarla', status: 409 };
  }
  if (clase.estado === 'EN PROCESO' && clase.horaInicio) {
    return { doc: await dtoClase(clase) };
  }
  if (!clase.idEmpleadoInstructor) return { error: 'La clase no tiene instructor asignado', status: 400 };

  const fc = parseFechaCalendario(clase.fechaClase);
  const hoy = hoyCalendario();
  if (!fc || !hoy || fc.getTime() !== hoy.getTime()) {
    return { error: 'Solo puede iniciar la clase el día programado (hoy).', status: 409 };
  }

  const bloqueoInsp = await bloqueoInspeccionParaIniciarClase(clase);
  if (bloqueoInsp) {
    return {
      error: bloqueoInsp.message,
      status: 409,
      codigo: bloqueoInsp.codigo,
      placa: bloqueoInsp.placa,
      vehiculoId: bloqueoInsp.vehiculoId,
    };
  }

  clase.horaInicio = new Date();
  clase.horaFin = null;
  clase.duracionSegundos = null;
  clase.estado = 'EN PROCESO';
  clase.userChangeRecord = req.user?.username || 'sistema';
  await clase.save();

  await InscripcionClaseCea.updateMany(
    { idClase: clase._id, estado: 'INSCRITO' },
    { $set: { estado: 'EN_CLASE' } },
  );

  return { doc: await dtoClase(clase) };
}

async function finalizarClase(id, req) {
  const clase = await ClaseProgramadaCea.findById(id);
  if (!clase) return { error: 'Clase no encontrada', status: 404 };
  if (clase.estado === 'FINALIZADO') return { doc: await dtoClase(clase) };
  if (clase.estado !== 'EN PROCESO' || !clase.horaInicio) {
    return { error: 'Inicie la clase antes de finalizarla', status: 409 };
  }

  clase.horaFin = new Date();
  clase.duracionSegundos = Math.max(0, Math.round((clase.horaFin - clase.horaInicio) / 1000));
  clase.estado = 'FINALIZADO';
  clase.userChangeRecord = req.user?.username || 'sistema';
  await clase.save();

  await InscripcionClaseCea.updateMany(
    { idClase: clase._id, estado: { $in: ['INSCRITO', 'EN_CLASE'] } },
    { $set: { estado: 'ASISTIO' } },
  );

  return { doc: await dtoClase(clase) };
}

/**
 * Cierra una clase no finalizada usando el horario programado (fechaClase + horaDesde/horaHasta).
 * Para admin/cajeros cuando el instructor no inició o finalizó la clase.
 */
async function finalizarClaseRetroactiva(id, req) {
  const clase = await ClaseProgramadaCea.findById(id);
  if (!clase) return { error: 'Clase no encontrada', status: 404 };
  if (clase.estado === 'FINALIZADO') return { doc: await dtoClase(clase) };
  if (clase.estado === 'CANCELADA') return { error: 'La clase está cancelada', status: 409 };

  if (!esFechaClaseNoFutura(clase.fechaClase)) {
    return { error: 'Solo puede cerrar clases de hoy o de fechas anteriores (no futuras).', status: 409 };
  }

  const horario = horarioProgramadoCompleto(clase);
  if (!horario) {
    return {
      error: 'La clase debe tener fecha y horario programados (desde y hasta, o duración) para cerrarla.',
      status: 409,
    };
  }

  clase.horaInicio = horario.horaInicio;
  clase.horaFin = horario.horaFin;
  if (!clase.horaHasta) clase.horaHasta = horario.horaHasta;
  clase.duracionSegundos = Math.max(0, Math.round((clase.horaFin - clase.horaInicio) / 1000));
  clase.estado = 'FINALIZADO';
  clase.userChangeRecord = req.user?.username || 'sistema';
  await clase.save();

  await InscripcionClaseCea.updateMany(
    { idClase: clase._id, estado: { $in: ['INSCRITO', 'EN_CLASE'] } },
    { $set: { estado: 'ASISTIO' } },
  );

  return { doc: await dtoClase(clase) };
}

function tipoHorasDesdeClase(tipoClase) {
  if (tipoClase === 'teoria') return 'teoria';
  if (tipoClase === 'taller') return 'taller';
  return 'practica';
}

async function elegirOrigenInscripcion(numDoc, idProg, tipoHoras, origenPreferido) {
  const rastreo = await rastreoAlumno(numDoc);
  const prog = String(idProg || '').trim();
  const filas = (rastreo.filas || []).filter(
    (f) =>
      f.tipoHoras === tipoHoras &&
      f.pendientes > 0 &&
      (!prog || String(f.idProg) === prog),
  );
  if (!filas.length) return null;

  if (origenPreferido) {
    const f = filas.find((x) => x.origenHoras === origenPreferido);
    if (f) return f;
  }
  if (tipoHoras === 'practica') {
    const mat = filas.find((x) => x.origenHoras === 'matricula');
    if (mat) return mat;
    return filas.find((x) => x.origenHoras === 'hora_practica_extra') || filas[0];
  }
  return filas.find((x) => x.origenHoras === 'matricula') || filas[0];
}

async function inscribirAlumnoInterno(clase, body, req) {
  if (clase.estado === 'FINALIZADO' || clase.estado === 'CANCELADA') {
    return { error: 'No se puede inscribir en esta clase' };
  }
  if (clase.estado !== 'CREADO' && clase.estado !== 'PROGRAMADA' && clase.estado !== 'EN PROCESO') {
    return { error: 'No se puede inscribir en esta clase' };
  }

  const numDoc = Number(body.numDoc);
  if (!Number.isFinite(numDoc)) return { error: 'numDoc inválido' };

  const existe = await InscripcionClaseCea.findOne({ idClase: clase._id, numDoc });
  if (existe) return { error: `El alumno ${numDoc} ya está inscrito` };

  const inscritos = await InscripcionClaseCea.countDocuments({ idClase: clase._id });
  if (clase.cupoMaximo != null && inscritos >= clase.cupoMaximo) {
    return { error: 'Cupo de la clase completo' };
  }

  const tipoHoras = tipoHorasDesdeClase(clase.tipoClase);
  const origenPreferido = body.origenHoras || null;
  const fila = await elegirOrigenInscripcion(numDoc, clase.idProg, tipoHoras, origenPreferido);
  if (!fila) {
    return { error: `El alumno ${numDoc} no tiene horas pendientes para ${tipoHoras}` };
  }

  let horasAsignadas =
    body.horasAsignadas != null && body.horasAsignadas !== '' ? Number(body.horasAsignadas) : horasClase(clase);
  if (!Number.isFinite(horasAsignadas) || horasAsignadas <= 0) {
    horasAsignadas = horasClase(clase);
  }
  if (fila.pendientes < horasAsignadas) {
    return {
      error: `Horas insuficientes para ${numDoc} (${fila.pendientes} h pendientes, la clase requiere ${horasAsignadas} h)`,
    };
  }

  const alumno = await DatosAlumno.findOne({ numDoc }).lean();
  if (!alumno) return { error: `Alumno ${numDoc} no encontrado` };

  const ins = await InscripcionClaseCea.create({
    idClase: clase._id,
    numDoc,
    idMat: fila.idMat || null,
    idLiq: fila.idLiq || null,
    idServ: fila.idServ,
    idProg: clase.idProg,
    origenHoras: fila.origenHoras,
    tipoHoras,
    horasAsignadas,
    estado: 'INSCRITO',
    userAddReg: req.user?.username || 'sistema',
  });

  await ClaseProgramadaCea.updateOne({ _id: clase._id }, { $set: { inscritos: inscritos + 1 } });
  clase.inscritos = inscritos + 1;

  return {
    inscripcion: ins.toObject(),
    alumnoNombre: concatNombreAlumno(alumno),
    clase: await dtoClase(clase),
  };
}

async function inscribirAlumno(idClase, body, req) {
  const clase = await ClaseProgramadaCea.findById(idClase);
  if (!clase) return { error: 'Clase no encontrada', status: 404 };

  const r = await inscribirAlumnoInterno(clase, body, req);
  if (r.error) return { error: r.error, status: 400 };
  return r;
}

async function listarInscripciones(idClase) {
  const rows = await InscripcionClaseCea.find({ idClase }).sort({ createdAt: 1 }).lean();
  const out = [];
  for (const r of rows) {
    const alumno = await DatosAlumno.findOne({ numDoc: r.numDoc }).lean();
    out.push({
      ...r,
      alumnoNombre: alumno
        ? [alumno.apellido1, alumno.apellido2, alumno.nombre1, alumno.nombre2].filter(Boolean).join(' ')
        : String(r.numDoc),
    });
  }
  return out;
}

async function quitarInscripcion(idClase, numDoc, req) {
  const clase = await ClaseProgramadaCea.findById(idClase);
  if (!clase) return { error: 'Clase no encontrada', status: 404 };
  if (clase.estado === 'FINALIZADO') return { error: 'No se puede modificar inscripciones de clase finalizada', status: 409 };
  if (clase.estado === 'EN PROCESO') return { error: 'No se puede quitar inscripciones con la clase en curso', status: 409 };

  const n = Number(numDoc);
  const ins = await InscripcionClaseCea.findOneAndDelete({ idClase, numDoc: n });
  if (!ins) return { error: 'Inscripción no encontrada', status: 404 };

  const inscritos = await InscripcionClaseCea.countDocuments({ idClase });
  await ClaseProgramadaCea.updateOne({ _id: idClase }, { $set: { inscritos } });
  return { ok: true, clase: await dtoClase(clase) };
}

async function alumnosElegiblesPrograma(idProg, tipoHoras, q = '') {
  return alumnosElegiblesDesdeRastreo(idProg, tipoHoras, q);
}

async function alumnosElegibles(idClase, q = '') {
  const clase = await ClaseProgramadaCea.findById(idClase).lean();
  if (!clase) return null;
  const ya = new Set(
    (await InscripcionClaseCea.find({ idClase }).select('numDoc').lean()).map((i) => i.numDoc),
  );
  return alumnosElegiblesDesdeRastreo(
    clase.idProg,
    tipoHorasDesdeClase(clase.tipoClase),
    q,
    ya,
  );
}

/** Alumnos con horas pendientes (matrícula o liquidación) en programas de licencia de conducción. */
async function alumnosElegiblesDesdeRastreo(idProg, tipoHoras, q = '', excludeNumDocs = null) {
  const prog = String(idProg || '').trim();
  const tipo = String(tipoHoras || '').trim();
  if (!prog || !tipo) return [];

  const { rastreoGlobal } = require('./programacionCeaRastreo');
  const { filas } = await rastreoGlobal({ soloPendientes: true });
  const excl = excludeNumDocs || new Set();

  const porClave = new Map();
  for (const f of filas) {
    if (String(f.idProg) !== prog || f.tipoHoras !== tipo || f.pendientes <= 0) continue;
    if (excl.has(f.numDoc)) continue;
    if (q) {
      const alumno = await DatosAlumno.findOne({ numDoc: f.numDoc }).lean();
      if (!coincideBusquedaAlumno(alumno || { numDoc: f.numDoc }, q)) continue;
    }
    const servicioLabel = f.servicioLabel || '';
    const key = `${f.numDoc}|${f.origenHoras}|${servicioLabel}`;
    const prev = porClave.get(key);
    if (prev) {
      prev.pendientes += f.pendientes;
    } else {
      porClave.set(key, {
        numDoc: f.numDoc,
        alumnoNombre: f.alumnoNombre,
        pendientes: f.pendientes,
        origenHoras: f.origenHoras,
        servicioLabel,
      });
    }
  }
  return [...porClave.values()].sort((a, b) => a.alumnoNombre.localeCompare(b.alumnoNombre, 'es'));
}

async function recursosProgramacion(opts = {}) {
  const sid = normalizarIdSede(opts.idSede);
  const filtroSede = sid ? { idSede: sid } : {};
  const aulas = await cat.aulas.find(filtroSede).limit(500).lean();
  const talleres = await cat.talleres.find(filtroSede).limit(500).lean();
  let vehiculos = await Vehiculo.find({ estado: { $ne: 'Baja' }, ...filtroSede })
    .select('placa nombreMarca nombreLinea modelo estado idClase claseVehiculo')
    .lean();
  const instructores = await listarInstructoresConUsuario();

  const {
    categoriaLicenciaDesdePrograma,
    filtrarVehiculosPorCategoriaLicencia,
    extraerCategoriaLicencia,
  } = require('./categoriaLicenciaVehiculo');

  let categoriaLicencia = null;
  if (opts.categoriaLicencia) {
    categoriaLicencia = extraerCategoriaLicencia(opts.categoriaLicencia);
  } else if (opts.idProg) {
    categoriaLicencia = await categoriaLicenciaDesdePrograma(opts.idProg);
  }

  const totalVehiculos = vehiculos.length;
  const filtrado = await filtrarVehiculosPorCategoriaLicencia(vehiculos, categoriaLicencia);
  vehiculos = filtrado.vehiculos;
  categoriaLicencia = filtrado.categoriaLicencia;

  return {
    aulas: aulas.map((a) => ({ id: String(a.idAula ?? a._id), nombre: a.nombre || a.descrAula || a.idAula })),
    talleres: talleres.map((t) => ({ id: String(t.idTaller ?? t._id), nombre: t.nombre || t.ubicacion || t.idTaller })),
    vehiculos: vehiculos.map((v) => ({
      id: v.placa,
      placa: v.placa,
      label: [v.placa, v.nombreMarca, v.modelo].filter(Boolean).join(' · '),
      estado: v.estado,
      idClase: v.idClase,
      claseVehiculo: v.claseVehiculo,
    })),
    instructores,
    categoriaLicencia,
    vehiculosTotal: totalVehiculos,
    vehiculosFiltrados: vehiculos.length,
  };
}

/** Clases PROGRAMADA de hoy que inician en los próximos N minutos (ventana configurable). */
async function alertasClasesProximas(req, minutosVentana = 15) {
  const ventana = Math.min(120, Math.max(1, Number(minutosVentana) || 15));
  const rolFiltro = await filtroClasesPorRol(req);
  const now = new Date();
  const nowMins = minutosEnZona(now);

  const hoyBase = parseFechaYmd(ymdEnZona(now)) || inicioDia(now);
  const desde = new Date(hoyBase);
  desde.setDate(desde.getDate() - 1);
  const hasta = new Date(hoyBase);
  hasta.setDate(hasta.getDate() + 2);

  const q = {
    fechaClase: { $gte: desde, $lt: hasta },
    estado: 'PROGRAMADA',
  };
  if (rolFiltro) Object.assign(q, rolFiltro);

  const rows = await ClaseProgramadaCea.find(q).sort({ horaDesde: 1 }).lean();

  const clases = [];
  for (const r of rows) {
    if (!esFechaClaseHoy(r.fechaClase, now)) continue;
    const startMins = parseHoraMinutos(r.horaDesde);
    if (startMins == null) continue;
    const diff = startMins - nowMins;
    // Ventana: desde N min antes hasta 5 min después del inicio (aún PROGRAMADA)
    if (diff > ventana || diff < -5) continue;
    const dto = await dtoClase(r);
    clases.push({
      ...dto,
      minutosRestantes: Math.max(0, diff),
      minutosHastaInicio: diff,
    });
  }

  return { minutosVentana: ventana, total: clases.length, clases };
}

/** Clases en las que está inscrito el alumno (todas las modalidades). */
async function listarClasesAlumno(numDoc, query = {}) {
  const n = parseNumDoc(numDoc);
  if (!n) return [];

  const inscripciones = await InscripcionClaseCea.find({ numDoc: n }).lean();
  if (!inscripciones.length) return [];

  const insPorClase = new Map();
  for (const ins of inscripciones) {
    insPorClase.set(String(ins.idClase), ins);
  }

  const q = {
    _id: { $in: [...insPorClase.keys()] },
    estado: { $ne: 'CANCELADA' },
  };

  const { desde, hasta, todas } = query || {};
  const incluirTodas = todas === '1' || todas === true || todas === 'true';

  if (!incluirTodas && (desde || hasta)) {
    const rango = {};
    if (desde) rango.$gte = parseFechaYmd(desde) || new Date(desde);
    if (hasta) {
      const h = parseFechaYmd(hasta) || new Date(hasta);
      h.setDate(h.getDate() + 1);
      rango.$lt = h;
    }
    q.$or = [{ estado: 'CREADO' }, { fechaClase: rango }];
  }

  const rows = await ClaseProgramadaCea.find(q).sort({ fechaClase: 1, horaDesde: 1 }).lean();
  const out = [];
  for (const r of rows) {
    const dto = await dtoClase(r);
    const ins = insPorClase.get(String(r._id));
    if (ins) {
      dto.origenHorasInscripcion = ins.origenHoras || null;
      dto.horasAsignadasInscripcion = ins.horasAsignadas ?? null;
      dto.estadoInscripcion = ins.estado || null;
    }
    out.push(dto);
  }
  return out;
}

module.exports = {
  listarClases,
  listarClasesAlumno,
  obtenerClase,
  dtoClase,
  crearClase,
  actualizarClase,
  cancelarClase,
  eliminarClase,
  verificarConflictos,
  iniciarClase,
  finalizarClase,
  finalizarClaseRetroactiva,
  listarInscripciones,
  inscribirAlumno,
  inscribirAlumnoInterno,
  quitarInscripcion,
  alumnosElegibles,
  alumnosElegiblesPrograma,
  recursosProgramacion,
  listarInstructoresConUsuario,
  alertasClasesProximas,
};
