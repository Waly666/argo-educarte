const ClaseProgramadaCea = require('../models/ClaseProgramadaCea');
const TemaProgramaCea = require('../models/TemaProgramaCea');
const { models: cat } = require('../models/catalogos');
const { obtenerConfig } = require('./configProgramacionCea');
const { buscarProgramaCea, labelPrograma } = require('./programacionCeaRastreo');
const { idProgDePrograma } = require('./programaServicio');
const { diaProgramable, horarioParaDia } = require('./festivosColombia');

function num(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'object' && v.$numberDecimal != null) return Number(v.$numberDecimal) || 0;
  return Number(v) || 0;
}

function inicioDia(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function parseYmd(s) {
  const raw = String(s || '').trim();
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return inicioDia(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function ymdFromDate(d) {
  const x = inicioDia(d);
  const y = x.getFullYear();
  const mo = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

function addDays(date, n) {
  const d = inicioDia(date);
  d.setDate(d.getDate() + n);
  return d;
}

function parseHoraMinutos(horaStr) {
  const m = String(horaStr ?? '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

function formatMinutos(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function partirHoras(total, horasPorBloque) {
  const bloque = Math.max(1, Number(horasPorBloque) || 2);
  const bloques = [];
  let rest = Math.round(Number(total) * 100) / 100;
  if (!(rest > 0)) return bloques;
  while (rest > 0.001) {
    const h = Math.min(bloque, rest);
    bloques.push(Math.round(h * 100) / 100);
    rest = Math.round((rest - h) * 100) / 100;
  }
  return bloques;
}

function ymdFechaClase(fechaClase) {
  if (fechaClase == null) return '';
  const raw = String(fechaClase);
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const d = fechaClase instanceof Date ? fechaClase : new Date(fechaClase);
  if (Number.isNaN(d.getTime())) return '';
  return ymdFromDate(d);
}

function solapa(iniA, finA, iniB, finB) {
  return iniA < finB && iniB < finA;
}

function normalizarIdSede(req) {
  const raw = req?.idSede ?? req?.body?.idSede ?? '';
  return raw != null && String(raw).trim() ? String(raw).trim() : '';
}

function programasPorPeriodoPara(idProg, config, override) {
  if (override != null && override !== '') {
    const n = Number(override);
    if (Number.isFinite(n) && n >= 1) return Math.floor(n);
  }
  const map = config?.planificacion?.programasPorPeriodo || {};
  const n = Number(map[String(idProg)]);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

async function listarTemasActivos(idProg, tipo) {
  return TemaProgramaCea.find({
    idProg: String(idProg),
    tipo,
    activo: { $ne: false },
  })
    .sort({ orden: 1, nombre: 1 })
    .lean();
}

function armarSesionesPrograma({
  prog,
  temasTeoria,
  temasTaller,
  programasPorPeriodo,
  duracionTeoria,
  duracionTaller,
  incluirTeoria,
  incluirTaller,
}) {
  const sesiones = [];
  const ciclos = Math.max(1, programasPorPeriodo);

  for (let ciclo = 1; ciclo <= ciclos; ciclo++) {
    if (incluirTeoria) {
      if (temasTeoria.length) {
        for (const tema of temasTeoria) {
          const horas = num(tema.horasTema);
          if (!(horas > 0)) continue;
          for (const h of partirHoras(horas, duracionTeoria)) {
            sesiones.push({
              tipoClase: 'teoria',
              idTema: tema._id,
              temaNombre: tema.nombre,
              horas: h,
              ciclo,
            });
          }
        }
      } else {
        const horas = num(prog.horasTeoria);
        for (const h of partirHoras(horas, duracionTeoria)) {
          sesiones.push({ tipoClase: 'teoria', idTema: null, temaNombre: '', horas: h, ciclo });
        }
      }
    }

    if (incluirTaller) {
      if (temasTaller.length) {
        for (const tema of temasTaller) {
          const horas = num(tema.horasTema);
          if (!(horas > 0)) continue;
          for (const h of partirHoras(horas, duracionTaller)) {
            sesiones.push({
              tipoClase: 'taller',
              idTema: tema._id,
              temaNombre: tema.nombre,
              horas: h,
              ciclo,
            });
          }
        }
      } else {
        const horas = num(prog.horasTaller);
        for (const h of partirHoras(horas, duracionTaller)) {
          sesiones.push({ tipoClase: 'taller', idTema: null, temaNombre: '', horas: h, ciclo });
        }
      }
    }
  }

  return sesiones;
}

function diasProgramablesEnRango(desde, hasta, bloque) {
  const out = [];
  let d = inicioDia(desde);
  const fin = inicioDia(hasta);
  while (d <= fin) {
    if (diaProgramable(d, bloque)) out.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

function slotsDelDia(fecha, bloque, duracionHoras) {
  if (!diaProgramable(fecha, bloque)) return [];
  const horario = horarioParaDia(bloque, fecha);
  const hIni = parseHoraMinutos(horario?.horaDesde || bloque.horaDesde);
  const hFin = parseHoraMinutos(horario?.horaHasta || bloque.horaHasta);
  if (hIni == null || hFin == null) return [];
  const durMin = Math.round(Number(duracionHoras) * 60);
  if (!(durMin > 0)) return [];

  const slots = [];
  let cur = hIni;
  while (cur + durMin <= hFin) {
    slots.push({
      horaDesde: formatMinutos(cur),
      horaHasta: formatMinutos(cur + durMin),
    });
    cur += durMin;
  }
  return slots;
}

function intervaloOcupado(registros, fechaYmd, horaDesde, horaHasta, idRecurso = null, campo = null) {
  const ini = parseHoraMinutos(horaDesde);
  const fin = parseHoraMinutos(horaHasta);
  if (ini == null || fin == null) return false;
  for (const o of registros) {
    if (idRecurso != null && campo) {
      const idO = String(o[campo] || o.idRecurso || '');
      if (idO !== String(idRecurso)) continue;
    }
    if (ymdFechaClase(o.fechaClase || o.fecha) !== fechaYmd) continue;
    const oIni = parseHoraMinutos(o.horaDesde);
    const oFin = parseHoraMinutos(o.horaHasta);
    if (oIni != null && oFin != null && solapa(ini, fin, oIni, oFin)) return true;
  }
  return false;
}

function shuffleIds(ids) {
  const arr = [...ids];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function listarIdsAulas(idSede, idAulaFija = '') {
  if (idAulaFija) return [String(idAulaFija)];
  let rows = [];
  if (idSede) {
    rows = await cat.aulas.find({ idSede: String(idSede) }).limit(500).lean();
  }
  if (!rows.length) {
    rows = await cat.aulas.find({}).limit(500).lean();
  }
  const ids = rows.map((a) => String(a.idAula ?? a._id)).filter(Boolean);
  return [...new Set(ids)];
}

async function cargarOcupacionRecurso(campo, idRecurso, desde, hasta) {
  if (!idRecurso) return [];
  return cargarOcupacionCampoEnPeriodo(campo, [idRecurso], desde, hasta);
}

async function cargarOcupacionCampoEnPeriodo(campo, ids, desde, hasta) {
  const lista = [...new Set((ids || []).map(String).filter(Boolean))];
  if (!lista.length) return [];
  return ClaseProgramadaCea.find({
    [campo]: { $in: lista },
    fechaClase: { $gte: inicioDia(desde), $lte: inicioDia(hasta) },
    estado: { $nin: ['CANCELADA'] },
    horaDesde: { $ne: '' },
  })
    .select(`fechaClase horaDesde horaHasta ${campo}`)
    .lean();
}

function asignarSesionesEnPeriodo({
  sesiones,
  dias,
  bloque,
  idRecurso,
  recursosIds,
  campoRecurso,
  ocupadosDb,
  reservasBatch,
}) {
  const asignadas = [];
  const sinCupos = [];
  const pool = recursosIds?.length ? recursosIds : idRecurso ? [idRecurso] : [];
  if (!pool.length || !dias.length) return { asignadas, sinCupos: [...sesiones] };

  let dayIdx = 0;
  for (const ses of sesiones) {
    let placed = false;
    let attempts = 0;
    const maxAttempts = Math.max(dias.length * 48, 48);

    while (!placed && attempts < maxAttempts) {
      const fecha = dias[dayIdx % dias.length];
      const ymd = ymdFromDate(fecha);
      const slots = slotsDelDia(fecha, bloque, ses.horas);
      const recursosOrden = shuffleIds(pool);

      for (const slot of slots) {
        for (const idRec of recursosOrden) {
          if (intervaloOcupado(ocupadosDb, ymd, slot.horaDesde, slot.horaHasta, idRec, campoRecurso)) {
            continue;
          }
          if (intervaloOcupado(reservasBatch, ymd, slot.horaDesde, slot.horaHasta, idRec, campoRecurso)) {
            continue;
          }

          const reserva = {
            fechaClase: ymd,
            horaDesde: slot.horaDesde,
            horaHasta: slot.horaHasta,
          };
          if (campoRecurso) reserva[campoRecurso] = idRec;

          reservasBatch.push(reserva);
          asignadas.push({
            ...ses,
            fechaClase: ymd,
            horaDesde: slot.horaDesde,
            horaHasta: slot.horaHasta,
            idRecurso: idRec,
        idAula: campoRecurso === 'idAula' ? idRec : undefined,
        idTaller: campoRecurso === 'idTaller' ? idRec : undefined,
          });
          placed = true;
          dayIdx++;
          break;
        }
        if (placed) break;
      }

      if (!placed) {
        dayIdx++;
        attempts++;
      }
    }

    if (!placed) sinCupos.push(ses);
  }

  return { asignadas, sinCupos };
}

function mapFilaPlan(p, extra = {}) {
  return {
    tipoClase: p.tipoClase,
    temaNombre: p.temaNombre || '',
    fechaClase: p.fechaClase,
    horaDesde: p.horaDesde,
    horaHasta: p.horaHasta,
    horas: p.horas,
    ciclo: p.ciclo,
    idAula: p.tipoClase === 'teoria' ? p.idRecurso || p.idAula : undefined,
    idTaller: p.tipoClase === 'taller' ? p.idRecurso || p.idTaller : undefined,
    ...extra,
  };
}

async function resolverParametrosPlanificacion(body, req) {
  const config = await obtenerConfig();
  const idProg = String(body?.idProg || '').trim();
  if (!idProg) return { error: 'Seleccione un programa', status: 400 };

  const prog = await buscarProgramaCea(idProg);
  if (!prog) return { error: 'Programa CEA no encontrado', status: 404 };

  const idProgCanon = String(idProgDePrograma(prog));
  const fechaDesde = parseYmd(body?.fechaDesde);
  const fechaHasta = parseYmd(body?.fechaHasta);
  if (!fechaDesde || !fechaHasta) return { error: 'Indique fechaDesde y fechaHasta (YYYY-MM-DD)', status: 400 };
  if (fechaHasta < fechaDesde) return { error: 'La fecha final debe ser posterior a la inicial', status: 400 };

  const diasInicio = body?.diasInicioDesdeGeneracion != null
    ? Math.max(0, Number(body.diasInicioDesdeGeneracion) || 0)
    : Math.max(0, Number(config.planificacion?.diasInicioDesdeGeneracion) || 5);

  const hoy = inicioDia(new Date());
  const minInicio = addDays(hoy, diasInicio);
  const fechaInicioEfectiva = fechaDesde > minInicio ? fechaDesde : minInicio;
  if (fechaInicioEfectiva > fechaHasta) {
    return {
      error: `El periodo es muy corto: la primera clase debe ser al menos ${diasInicio} día(s) después de hoy.`,
      status: 400,
    };
  }

  const idAula = String(body?.idAula || '').trim();
  const idTaller = String(body?.idTaller || '').trim();
  const incluirTeoria = body?.incluirTeoria !== false;
  const incluirTaller = body?.incluirTaller !== false;

  const idSede = normalizarIdSede(req);
  if (!idSede) return { error: 'Debe seleccionar la sede activa', status: 428 };

  const idsAulas = incluirTeoria ? await listarIdsAulas(idSede, idAula) : [];
  if (incluirTeoria && !idsAulas.length) {
    return { error: 'No hay aulas configuradas en catálogo para esta sede', status: 400 };
  }
  if (incluirTaller && !idTaller) {
    return { error: 'Seleccione un taller/patio para clases de taller', status: 400 };
  }

  const duracionTeoria = num(body?.duracionTeoria) || num(config.aula?.duracionSesionHoras) || 2;
  const duracionTaller = num(body?.duracionTaller) || num(config.taller?.duracionSesionHoras) || 2;
  const cupoTeoria = num(body?.cupoTeoria) || num(config.aula?.cupoMaximoDefault) || 10;
  const cupoTaller = num(body?.cupoTaller) || num(config.taller?.cupoMaximoDefault) || 10;
  const programasPorPeriodo = programasPorPeriodoPara(idProgCanon, config, body?.programasPorPeriodo);

  const temasTeoria = incluirTeoria ? await listarTemasActivos(idProgCanon, 'teoria') : [];
  const temasTaller = incluirTaller ? await listarTemasActivos(idProgCanon, 'taller') : [];

  const sesiones = armarSesionesPrograma({
    prog,
    temasTeoria,
    temasTaller,
    programasPorPeriodo,
    duracionTeoria,
    duracionTaller,
    incluirTeoria,
    incluirTaller,
  });

  if (!sesiones.length) {
    return { error: 'No hay horas de teoría/taller para generar en este programa', status: 400 };
  }

  return {
    config,
    prog,
    idProg: idProgCanon,
    fechaDesde,
    fechaHasta,
    fechaInicioEfectiva,
    diasInicio,
    idAula,
    idsAulas,
    idTaller,
    idSede,
    duracionTeoria,
    duracionTaller,
    cupoTeoria,
    cupoTaller,
    programasPorPeriodo,
    incluirTeoria,
    incluirTaller,
    sesiones,
  };
}

async function planificarClases(body, req, { persistir = false } = {}) {
  const params = await resolverParametrosPlanificacion(body, req);
  if (params.error) return params;

  const {
    config,
    prog,
    idProg,
    fechaInicioEfectiva,
    fechaHasta,
    idAula,
    idsAulas,
    idTaller,
    idSede,
    cupoTeoria,
    cupoTaller,
    programasPorPeriodo,
    sesiones,
  } = params;

  const sesionesTeoria = sesiones.filter((s) => s.tipoClase === 'teoria');
  const sesionesTaller = sesiones.filter((s) => s.tipoClase === 'taller');

  const diasTeoria = diasProgramablesEnRango(fechaInicioEfectiva, fechaHasta, config.aula);
  const diasTaller = diasProgramablesEnRango(fechaInicioEfectiva, fechaHasta, config.taller);

  const ocupAula = params.incluirTeoria
    ? await cargarOcupacionCampoEnPeriodo('idAula', idsAulas, fechaInicioEfectiva, fechaHasta)
    : [];
  const ocupTaller = params.incluirTaller
    ? await cargarOcupacionRecurso('idTaller', idTaller, fechaInicioEfectiva, fechaHasta)
    : [];

  const reservas = [];
  const asigTeoria = params.incluirTeoria
    ? asignarSesionesEnPeriodo({
        sesiones: sesionesTeoria,
        dias: diasTeoria,
        bloque: config.aula,
        recursosIds: idsAulas,
        campoRecurso: 'idAula',
        ocupadosDb: ocupAula,
        reservasBatch: reservas,
      })
    : { asignadas: [], sinCupos: [] };

  const asigTaller = params.incluirTaller
    ? asignarSesionesEnPeriodo({
        sesiones: sesionesTaller,
        dias: diasTaller,
        bloque: config.taller,
        idRecurso: idTaller,
        campoRecurso: 'idTaller',
        ocupadosDb: ocupTaller,
        reservasBatch: reservas,
      })
    : { asignadas: [], sinCupos: [] };

  const plan = [...asigTeoria.asignadas, ...asigTaller.asignadas].sort((a, b) => {
    const fa = `${a.fechaClase} ${a.horaDesde}`;
    const fb = `${b.fechaClase} ${b.horaDesde}`;
    return fa.localeCompare(fb);
  });

  const sinCupos = [...asigTeoria.sinCupos, ...asigTaller.sinCupos];
  const advertencias = [];
  if (sinCupos.length) {
    advertencias.push(
      `${sinCupos.length} sesión(es) no cupieron en el periodo. Amplíe fechas, ajuste horarios o revise disponibilidad de aulas/taller.`,
    );
  }

  const resumen = {
    teoria: asigTeoria.asignadas.length,
    taller: asigTaller.asignadas.length,
    total: plan.length,
    sinCupos: sinCupos.length,
    programasPorPeriodo,
    aulasUsadas: params.incluirTeoria
      ? [...new Set(asigTeoria.asignadas.map((a) => a.idRecurso).filter(Boolean))].length
      : 0,
    aulasDisponibles: idsAulas.length,
    diasTeoriaDisponibles: diasTeoria.length,
    diasTallerDisponibles: diasTaller.length,
  };

  if (!persistir) {
    return {
      preview: true,
      idProg,
      programaLabel: labelPrograma(prog),
      fechaDesde: ymdFromDate(params.fechaDesde),
      fechaHasta: ymdFromDate(fechaHasta),
      fechaInicioEfectiva: ymdFromDate(fechaInicioEfectiva),
      diasInicio: params.diasInicio,
      resumen,
      advertencias,
      clases: plan.map((p) => mapFilaPlan(p)),
      sinCupos: sinCupos.map((p) => mapFilaPlan(p)),
    };
  }

  const clases = [];
  for (const item of plan) {
    const doc = await ClaseProgramadaCea.create({
      idProg,
      idSede,
      tipoClase: item.tipoClase,
      idTema: item.idTema || null,
      fechaClase: parseYmd(item.fechaClase),
      horaDesde: item.horaDesde,
      horaHasta: item.horaHasta,
      horasDescuento: item.horas,
      idAula: item.tipoClase === 'teoria' ? String(item.idRecurso || '') : '',
      idTaller: item.tipoClase === 'taller' ? String(item.idRecurso || idTaller || '') : '',
      idVehiculo: '',
      idEmpleadoInstructor: null,
      idUsuarioInstructor: '',
      cupoMaximo: item.tipoClase === 'teoria' ? cupoTeoria : cupoTaller,
      inscritos: 0,
      estado: 'PROGRAMADA',
      observaciones: `Planificación ${ymdFromDate(params.fechaDesde)}–${ymdFromDate(fechaHasta)} · ciclo ${item.ciclo}`,
      userAddReg: req?.user?.username || 'sistema',
    });
    clases.push(
      mapFilaPlan(item, {
        _id: String(doc._id),
        estado: 'PROGRAMADA',
        cupoMaximo: item.tipoClase === 'teoria' ? cupoTeoria : cupoTaller,
      }),
    );
  }

  return {
    preview: false,
    idProg,
    programaLabel: labelPrograma(prog),
    fechaDesde: ymdFromDate(params.fechaDesde),
    fechaHasta: ymdFromDate(fechaHasta),
    fechaInicioEfectiva: ymdFromDate(fechaInicioEfectiva),
    clasesGeneradas: clases.length,
    clases,
    resumen,
    advertencias,
    sinCupos: sinCupos.map((p) => mapFilaPlan(p)),
    message:
      clases.length > 0
        ? `Se generaron ${clases.length} clase(s) vacías (teoría/taller) distribuidas en el periodo.`
        : 'No se generó ninguna clase.',
  };
}

async function previewPlanificacion(body, req) {
  return planificarClases(body, req, { persistir: false });
}

async function generarClasesPlanificadas(body, req) {
  return planificarClases(body, req, { persistir: true });
}

module.exports = {
  previewPlanificacion,
  generarClasesPlanificadas,
  armarSesionesPrograma,
  programasPorPeriodoPara,
};
