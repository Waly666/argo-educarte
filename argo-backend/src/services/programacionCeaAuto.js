const Matricula = require('../models/Matricula');
const Liquidacion = require('../models/Liquidacion');
const DatosAlumno = require('../models/DatosAlumno');
const ClaseProgramadaCea = require('../models/ClaseProgramadaCea');
const InscripcionClaseCea = require('../models/InscripcionClaseCea');
const TemaProgramaCea = require('../models/TemaProgramaCea');
const { models: cat } = require('../models/catalogos');
const { obtenerConfig } = require('./configProgramacionCea');
const { buscarProgramaCea, labelPrograma } = require('./programacionCeaRastreo');
const {
  esServicioHoraPractica,
  esServicioMatricula,
  idProgDePrograma,
} = require('./programaServicio');
const { parseNumDoc } = require('../utils/numDoc');

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

/** Fecha placeholder para clases CREADO (sin día real asignado). */
function fechaPlaceholderCreado() {
  const d = inicioDia();
  d.setDate(d.getDate() + 1);
  return d;
}

function reqSistema() {
  return {
    user: { username: 'sistema', sub: 'sistema' },
    permisos: ['programacion_cea.gestionar'],
  };
}

function partirHorasPractica(total, preferidas = [2, 3, 4, 1]) {
  const bloques = [];
  let rest = Math.round(Number(total) * 100) / 100;
  if (!(rest > 0)) return bloques;
  while (rest > 0.001) {
    const pick = preferidas.find((d) => d <= rest + 0.001) || 1;
    bloques.push(pick);
    rest = Math.round((rest - pick) * 100) / 100;
  }
  return bloques;
}

/** Sesiones de práctica con duración fija por alumno (ej. todas de 1 h o de 2 h). */
function partirHorasPracticaFijo(total, duracionSesion) {
  const d = Math.round(Number(duracionSesion) * 100) / 100;
  if (!(d > 0)) return [];
  const bloques = [];
  let rest = Math.round(Number(total) * 100) / 100;
  while (rest > 0.001) {
    const h = Math.min(d, rest);
    bloques.push(Math.round(h * 100) / 100);
    rest = Math.round((rest - h) * 100) / 100;
  }
  return bloques;
}

async function resolverParticionPractica(numDoc, config) {
  const permitidas = (config?.vehiculo?.duracionesPermitidas || [1, 2, 3, 4])
    .map((n) => Number(n))
    .filter((n) => n >= 1 && n <= 8);
  const preferidasGlobal = permitidas.length ? [...permitidas].sort((a, b) => {
    if (a === 2) return -1;
    if (b === 2) return 1;
    return b - a;
  }) : [2, 3, 4, 1];

  const alumno = await DatosAlumno.findOne({ numDoc: Number(numDoc) }).lean();
  const prefRaw = alumno?.duracionSesionPracticaCea;
  if (prefRaw != null && prefRaw !== '') {
    const fija = Number(prefRaw);
    if (Number.isFinite(fija) && fija >= 1 && (!permitidas.length || permitidas.includes(fija))) {
      return { fija, preferidas: preferidasGlobal };
    }
  }
  return { fija: null, preferidas: preferidasGlobal };
}

function partirHorasPracticaAlumno(total, { fija, preferidas }) {
  if (fija > 0) return partirHorasPracticaFijo(total, fija);
  return partirHorasPractica(total, preferidas);
}

function partirHorasGrupal(total, horasPorBloque = 2) {
  const bloques = [];
  let rest = Math.round(Number(total) * 100) / 100;
  if (!(rest > 0)) return bloques;
  while (rest > 0.001) {
    const h = Math.min(horasPorBloque, rest);
    bloques.push(Math.round(h * 100) / 100);
    rest = Math.round((rest - h) * 100) / 100;
  }
  return bloques;
}

async function resolverServicio(idServ) {
  if (idServ == null || idServ === '') return null;
  const idServStr = String(idServ);
  const n = Number(idServ);
  return cat.servicios
    .findOne({ $or: [{ idServ: idServStr }, ...(Number.isFinite(n) ? [{ idServ: n }] : [])] })
    .lean();
}

async function yaGeneradoParaMatricula(idMat) {
  const id = String(idMat);
  const mat = await Matricula.findById(idMat).lean();
  if (mat?.clasesCeaAutoGeneradas) return true;
  const count = await InscripcionClaseCea.countDocuments({ idMat: id });
  return count > 0;
}

async function yaGeneradoParaLiquidacion(idLiq) {
  const id = String(idLiq);
  const count = await InscripcionClaseCea.countDocuments({ idLiq: id });
  return count > 0;
}

async function buscarClaseGrupalReutilizable(idProg, tipoClase, idTema, horasDescuento, opts = {}) {
  const { numDoc, excluirIds = [] } = opts;
  const excluir = new Set(excluirIds.map(String));
  const q = {
    idProg: String(idProg),
    tipoClase,
    estado: { $in: ['PROGRAMADA', 'CREADO'] },
  };
  if (idTema) q.idTema = idTema;
  else q.idTema = null;

  const clases = await ClaseProgramadaCea.find(q).lean();
  const candidatas = [];

  for (const c of clases) {
    if (excluir.has(String(c._id))) continue;

    const inscritos = await InscripcionClaseCea.countDocuments({ idClase: c._id });
    if (c.cupoMaximo != null && inscritos >= c.cupoMaximo) continue;

    if (numDoc != null) {
      const yaAlumno = await InscripcionClaseCea.exists({ idClase: c._id, numDoc: Number(numDoc) });
      if (yaAlumno) continue;
    }

    const hd = Number(c.horasDescuento) || 0;
    const tieneHorario = Boolean(String(c.horaDesde || '').trim() && String(c.horaHasta || '').trim());

    // CREADO sin horario: exigir mismas horas; PROGRAMADA ya programada: priorizar por tema/cupo
    if (c.estado === 'CREADO' && horasDescuento > 0 && hd > 0 && hd !== horasDescuento) continue;

    let prio = 3;
    if (c.estado === 'PROGRAMADA' && tieneHorario) prio = 0;
    else if (c.estado === 'PROGRAMADA') prio = 1;
    else if (c.estado === 'CREADO') prio = 2;

    candidatas.push({ c, prio, fecha: c.fechaClase ? new Date(c.fechaClase).getTime() : 0, inscritos });
  }

  candidatas.sort((a, b) => {
    if (a.prio !== b.prio) return a.prio - b.prio;
    if (a.inscritos !== b.inscritos) return a.inscritos - b.inscritos;
    return a.fecha - b.fecha;
  });

  if (!candidatas.length) return null;
  return ClaseProgramadaCea.findById(candidatas[0].c._id);
}

async function crearClaseCreado({
  idProg,
  tipoClase,
  idTema = null,
  duracionHoras = null,
  horasDescuento = null,
  cupoMaximo,
  observaciones = '',
}) {
  const hd = horasDescuento != null && horasDescuento > 0 ? horasDescuento : duracionHoras;
  return ClaseProgramadaCea.create({
    idProg: String(idProg),
    tipoClase,
    idTema: idTema || null,
    fechaClase: fechaPlaceholderCreado(),
    horaDesde: '',
    horaHasta: '',
    duracionHoras: tipoClase === 'practica' ? duracionHoras || hd || 2 : null,
    horasDescuento: hd,
    idAula: '',
    idTaller: '',
    idVehiculo: '',
    idEmpleadoInstructor: null,
    idUsuarioInstructor: '',
    cupoMaximo,
    inscritos: 0,
    estado: 'CREADO',
    observaciones: observaciones || 'Generada automáticamente al primer abono',
    userAddReg: 'sistema-auto',
  });
}

async function inscribirEnClase(clase, numDoc, ctx) {
  const { inscribirAlumnoInterno } = require('./programacionCeaClases');
  const req = reqSistema();
  const body = {
    numDoc,
    origenHoras: ctx.origenHoras,
    horasAsignadas: ctx.horasAsignadas,
  };
  const r = await inscribirAlumnoInterno(clase, body, req);
  if (r.error) throw new Error(r.error);
  return r;
}

async function generarClasesPractica({ numDoc, idProg, horasTotal, origenHoras, idMat, idLiq, idServ }) {
  const config = await obtenerConfig();
  const particion = await resolverParticionPractica(numDoc, config);
  const bloques = partirHorasPracticaAlumno(horasTotal, particion);
  const creadas = [];

  for (const h of bloques) {
    const clase = await crearClaseCreado({
      idProg,
      tipoClase: 'practica',
      duracionHoras: h,
      horasDescuento: h,
      cupoMaximo: 1,
    });
    await inscribirEnClase(clase, numDoc, {
      origenHoras,
      horasAsignadas: h,
      idMat,
      idLiq,
      idServ,
    });
    creadas.push(clase._id);
  }
  return creadas;
}

function armarPlanGrupal({ idProg, tipoClase, horasPrograma, temas, horasPorBloque = 2 }) {
  const plan = [];
  if (temas.length) {
    const sumTema = temas.reduce((acc, t) => acc + (num(t.horasTema) > 0 ? num(t.horasTema) : 0), 0);
    for (const tema of temas) {
      let horas = num(tema.horasTema);
      if (!(horas > 0)) {
        horas = sumTema > 0 ? 0 : horasPrograma / temas.length;
      }
      if (!(horas > 0)) continue;
      for (const h of partirHorasGrupal(horas, horasPorBloque)) {
        plan.push({ idTema: tema._id, horas: h });
      }
    }
  }
  if (!plan.length && horasPrograma > 0) {
    for (const h of partirHorasGrupal(horasPrograma, horasPorBloque)) {
      plan.push({ idTema: null, horas: h });
    }
  }
  return plan;
}

async function bloquesGrupalesInscritos(numDoc, idProg, tipoClase) {
  const inscripciones = await InscripcionClaseCea.find({ numDoc: Number(numDoc) }).lean();
  if (!inscripciones.length) return [];

  const ids = inscripciones.map((i) => i.idClase);
  const clases = await ClaseProgramadaCea.find({
    _id: { $in: ids },
    idProg: String(idProg),
    tipoClase,
  }).lean();
  const mapClase = new Map(clases.map((c) => [String(c._id), c]));

  const bloques = [];
  for (const ins of inscripciones) {
    const clase = mapClase.get(String(ins.idClase));
    if (!clase) continue;
    bloques.push({
      idTema: String(clase.idTema || ''),
      horas: Number(ins.horasAsignadas) || Number(clase.horasDescuento) || 0,
    });
  }
  return bloques;
}

function consumirBloqueInscrito(bloques, item) {
  const idTema = String(item.idTema || '');
  const idx = bloques.findIndex((b) => b.idTema === idTema && b.horas === item.horas);
  if (idx < 0) return false;
  bloques.splice(idx, 1);
  return true;
}

async function generarClasesGrupales({
  numDoc,
  idProg,
  idMat,
  tipoClase,
  horasPrograma,
  config,
  soloFaltantes = false,
}) {
  const cupoDefault =
    tipoClase === 'teoria'
      ? config.aula?.cupoMaximoDefault || 10
      : config.taller?.cupoMaximoDefault || 10;

  const temas = await TemaProgramaCea.find({
    idProg: String(idProg),
    tipo: tipoClase,
    activo: { $ne: false },
  })
    .sort({ orden: 1, nombre: 1 })
    .lean();

  const horasPorBloque =
    tipoClase === 'teoria'
      ? num(config.aula?.duracionSesionHoras) || 2
      : num(config.taller?.duracionSesionHoras) || 2;
  const plan = armarPlanGrupal({ idProg, tipoClase, horasPrograma, temas, horasPorBloque });
  const yaInscritos = soloFaltantes ? await bloquesGrupalesInscritos(numDoc, idProg, tipoClase) : [];

  const creadas = [];
  for (const item of plan) {
    if (soloFaltantes && consumirBloqueInscrito(yaInscritos, item)) continue;

    let clase = await buscarClaseGrupalReutilizable(idProg, tipoClase, item.idTema, item.horas, {
      numDoc,
    });
    if (!clase) {
      clase = await crearClaseCreado({
        idProg,
        tipoClase,
        idTema: item.idTema,
        horasDescuento: item.horas,
        cupoMaximo: cupoDefault,
      });
    }
    await inscribirEnClase(clase, numDoc, {
      origenHoras: 'matricula',
      horasAsignadas: item.horas,
      idMat,
    });
    creadas.push(clase._id);
  }
  return creadas;
}

async function generarClasesMatricula({ numDoc, idMat, prog }) {
  if (await yaGeneradoParaMatricula(idMat)) {
    return { skipped: true, motivo: 'clases_ya_generadas' };
  }

  const idProg = String(idProgDePrograma(prog));
  const config = await obtenerConfig();
  const ids = [];

  const horasTeoria = num(prog.horasTeoria);
  const horasTaller = num(prog.horasTaller);
  const horasPractica = num(prog.horasPractica);

  if (horasTeoria > 0) {
    ids.push(
      ...(await generarClasesGrupales({
        numDoc,
        idProg,
        idMat: String(idMat),
        tipoClase: 'teoria',
        horasPrograma: horasTeoria,
        config,
      })),
    );
  }
  if (horasTaller > 0) {
    ids.push(
      ...(await generarClasesGrupales({
        numDoc,
        idProg,
        idMat: String(idMat),
        tipoClase: 'taller',
        horasPrograma: horasTaller,
        config,
      })),
    );
  }
  if (horasPractica > 0) {
    ids.push(
      ...(await generarClasesPractica({
        numDoc,
        idProg,
        horasTotal: horasPractica,
        origenHoras: 'matricula',
        idMat: String(idMat),
      })),
    );
  }

  await Matricula.updateOne({ _id: idMat }, { $set: { clasesCeaAutoGeneradas: true } });
  return { skipped: false, clases: ids.length, ids };
}

/** Completa clases teóricas/taller faltantes tras matrícula ya generada (reparación). */
async function completarClasesGrupalesMatricula({ numDoc, idMat, prog }) {
  const idProg = String(idProgDePrograma(prog));
  const config = await obtenerConfig();
  const ids = [];

  const horasTeoria = num(prog.horasTeoria);
  const horasTaller = num(prog.horasTaller);

  if (horasTeoria > 0) {
    ids.push(
      ...(await generarClasesGrupales({
        numDoc,
        idProg,
        idMat: String(idMat),
        tipoClase: 'teoria',
        horasPrograma: horasTeoria,
        config,
        soloFaltantes: true,
      })),
    );
  }
  if (horasTaller > 0) {
    ids.push(
      ...(await generarClasesGrupales({
        numDoc,
        idProg,
        idMat: String(idMat),
        tipoClase: 'taller',
        horasPrograma: horasTaller,
        config,
        soloFaltantes: true,
      })),
    );
  }

  return { clases: ids.length, ids };
}

async function sumHorasPracticaInscritasMatricula(numDoc, idMat) {
  const inscripciones = await InscripcionClaseCea.find({
    numDoc: Number(numDoc),
    idMat: String(idMat),
    tipoHoras: 'practica',
    origenHoras: 'matricula',
  }).lean();
  return inscripciones.reduce((acc, i) => acc + (Number(i.horasAsignadas) || 0), 0);
}

/** Genera clases de práctica faltantes en una matrícula ya procesada. */
async function completarClasesPracticaMatricula({ numDoc, idMat, prog }) {
  const horasRequeridas = num(prog.horasPractica);
  if (horasRequeridas <= 0) return { clases: 0, ids: [] };

  const inscritas = await sumHorasPracticaInscritasMatricula(numDoc, idMat);
  const faltantes = Math.max(0, Math.round((horasRequeridas - inscritas) * 100) / 100);
  if (faltantes <= 0.001) return { clases: 0, ids: [] };

  const ids = await generarClasesPractica({
    numDoc,
    idProg: String(idProgDePrograma(prog)),
    horasTotal: faltantes,
    origenHoras: 'matricula',
    idMat: String(idMat),
  });
  return { clases: ids.length, ids };
}

/**
 * Genera o completa clases CEA pendientes para todos los alumnos del rastreo global,
 * usando la configuración y reglas de auto-generación ya establecidas.
 */
async function generarClasesPendientesGlobales() {
  const { rastreoGlobal } = require('./programacionCeaRastreo');
  const data = await rastreoGlobal({ soloPendientes: true });
  const filas = data.filas || [];

  if (!filas.length) {
    return {
      alumnos: 0,
      clasesGeneradas: 0,
      omitidos: 0,
      pendientesAntes: 0,
      reporte: [],
      message: 'No hay registros pendientes de programación.',
    };
  }

  const matsProcesadas = new Set();
  const liqsProcesadas = new Set();
  const reporte = [];
  let clasesGeneradas = 0;
  let alumnos = 0;
  let omitidos = 0;

  for (const f of filas) {
    if (f.origenHoras !== 'matricula' || !f.idMat) continue;
    const key = String(f.idMat);
    if (matsProcesadas.has(key)) continue;
    matsProcesadas.add(key);

    const mat = await Matricula.findById(f.idMat).lean();
    if (!mat || mat.estado === 'anulada') {
      omitidos += 1;
      continue;
    }

    const prog = await buscarProgramaCea(mat.idProg);
    if (!prog) {
      omitidos += 1;
      continue;
    }

    let clases = 0;
    const yaGenerada = mat.clasesCeaAutoGeneradas || (await yaGeneradoParaMatricula(f.idMat));

    if (!yaGenerada) {
      const r = await generarClasesMatricula({ numDoc: mat.numDoc, idMat: mat._id, prog });
      if (r.skipped) {
        omitidos += 1;
        continue;
      }
      clases = r.clases || 0;
    } else {
      const rGrupal = await completarClasesGrupalesMatricula({
        numDoc: mat.numDoc,
        idMat: mat._id,
        prog,
      });
      const rPractica = await completarClasesPracticaMatricula({
        numDoc: mat.numDoc,
        idMat: mat._id,
        prog,
      });
      clases = (rGrupal.clases || 0) + (rPractica.clases || 0);
    }

    if (clases <= 0) {
      omitidos += 1;
      continue;
    }

    clasesGeneradas += clases;
    alumnos += 1;
    reporte.push({
      numDoc: mat.numDoc,
      alumnoNombre: f.alumnoNombre || String(mat.numDoc),
      clases,
      origen: 'matricula',
    });
  }

  for (const f of filas) {
    if (f.origenHoras !== 'hora_practica_extra' || !f.idLiq) continue;
    const key = String(f.idLiq);
    if (liqsProcesadas.has(key)) continue;
    liqsProcesadas.add(key);

    const liq = await Liquidacion.findById(f.idLiq).lean();
    if (!liq) {
      omitidos += 1;
      continue;
    }

    const serv = liq.idServ ? await resolverServicio(liq.idServ) : null;
    if (!serv) {
      omitidos += 1;
      continue;
    }

    const r = await generarClasesHoraPracticaExtra({ numDoc: f.numDoc, liq, serv });
    if (r.skipped) {
      omitidos += 1;
      continue;
    }

    const clases = r.clases || 0;
    if (clases <= 0) {
      omitidos += 1;
      continue;
    }

    clasesGeneradas += clases;
    alumnos += 1;
    reporte.push({
      numDoc: f.numDoc,
      alumnoNombre: f.alumnoNombre || String(f.numDoc),
      clases,
      origen: 'hora_practica_extra',
    });
  }

  const message =
    clasesGeneradas > 0
      ? `Se generaron o inscribieron ${clasesGeneradas} clase(s) para ${alumnos} alumno(s).`
      : 'No se generaron clases nuevas. Revise que existan temas del programa y liquidaciones con abono.';

  return {
    alumnos,
    clasesGeneradas,
    omitidos,
    pendientesAntes: filas.length,
    reporte,
    message,
  };
}

async function contarFaltantesGrupales({ numDoc, idProg, tipoClase, horasPrograma, config }) {
  const cfg = config || (await obtenerConfig());
  const temas = await TemaProgramaCea.find({
    idProg: String(idProg),
    tipo: tipoClase,
    activo: { $ne: false },
  })
    .sort({ orden: 1, nombre: 1 })
    .lean();

  const horasPorBloque =
    tipoClase === 'teoria'
      ? num(cfg.aula?.duracionSesionHoras) || 2
      : num(cfg.taller?.duracionSesionHoras) || 2;
  const plan = armarPlanGrupal({ idProg, tipoClase, horasPrograma, temas, horasPorBloque });
  const yaInscritos = await bloquesGrupalesInscritos(numDoc, idProg, tipoClase);
  let faltantes = 0;
  for (const item of plan) {
    if (!consumirBloqueInscrito(yaInscritos, item)) faltantes++;
  }
  return faltantes;
}

async function contarClasesGrupalesFaltantesAlumno(numDoc) {
  const nd = Number(numDoc);
  if (!Number.isFinite(nd)) return { total: 0, teoria: 0, taller: 0 };

  const mats = await Matricula.find({ numDoc: nd, clasesCeaAutoGeneradas: true }).lean();
  let teoria = 0;
  let taller = 0;
  const config = await obtenerConfig();

  for (const mat of mats) {
    const prog = await buscarProgramaCea(mat.idProg);
    if (!prog) continue;
    const idProg = String(idProgDePrograma(prog));
    const horasTeoria = num(prog.horasTeoria);
    const horasTaller = num(prog.horasTaller);
    if (horasTeoria > 0) {
      teoria += await contarFaltantesGrupales({
        numDoc: nd,
        idProg,
        tipoClase: 'teoria',
        horasPrograma: horasTeoria,
        config,
      });
    }
    if (horasTaller > 0) {
      taller += await contarFaltantesGrupales({
        numDoc: nd,
        idProg,
        tipoClase: 'taller',
        horasPrograma: horasTaller,
        config,
      });
    }
  }

  return { total: teoria + taller, teoria, taller };
}

async function completarClasesGrupalesAlumno(numDoc) {
  const nd = Number(numDoc);
  if (!Number.isFinite(nd)) return { skipped: true, motivo: 'numDoc_invalido' };

  const mats = await Matricula.find({ numDoc: nd, clasesCeaAutoGeneradas: true }).lean();
  if (!mats.length) return { skipped: true, motivo: 'sin_matricula_generada' };

  const resultados = [];
  for (const mat of mats) {
    const prog = await buscarProgramaCea(mat.idProg);
    if (!prog) continue;
    const r = await completarClasesGrupalesMatricula({ numDoc: nd, idMat: mat._id, prog });
    resultados.push({ idMat: String(mat._id), idProg: String(mat.idProg), ...r });
  }

  if (!resultados.length) return { skipped: true, motivo: 'sin_programa_cea' };
  const clases = resultados.reduce((acc, r) => acc + (r.clases || 0), 0);
  return { skipped: false, clases, resultados };
}

/** Repara clases teóricas/taller faltantes en todos los alumnos con matrícula CEA generada. */
async function completarClasesGrupalesTodos({ soloConFaltantes = true } = {}) {
  const mats = await Matricula.find({ clasesCeaAutoGeneradas: true }).select('numDoc').lean();
  const numDocs = [...new Set(mats.map((m) => Number(m.numDoc)).filter((n) => Number.isFinite(n)))];

  const reporte = [];
  for (const numDoc of numDocs) {
    const faltantes = await contarClasesGrupalesFaltantesAlumno(numDoc);
    if (soloConFaltantes && faltantes.total <= 0) continue;

    const r = await completarClasesGrupalesAlumno(numDoc);
    if (r.skipped) continue;

    const alumno = await DatosAlumno.findOne({ numDoc }).select('nombre1 apellido1').lean();
    const nombre = alumno
      ? [alumno.nombre1, alumno.apellido1].filter(Boolean).join(' ').trim()
      : String(numDoc);

    reporte.push({
      numDoc,
      alumnoNombre: nombre,
      faltantesAntes: faltantes,
      clasesGeneradas: r.clases || 0,
      resultados: r.resultados || [],
    });
  }

  return {
    alumnos: reporte.length,
    clasesGeneradas: reporte.reduce((acc, r) => acc + (r.clasesGeneradas || 0), 0),
    reporte,
  };
}

async function generarClasesHoraPracticaExtra({ numDoc, liq, serv }) {
  if (await yaGeneradoParaLiquidacion(liq._id)) {
    return { skipped: true, motivo: 'clases_ya_generadas' };
  }

  const cant = Math.max(0, Math.floor(num(liq.cantidad) || 0));
  if (cant <= 0) return { skipped: true, motivo: 'sin_horas' };

  const idProg = String(serv.idProg ?? liq.idProg ?? '');
  const prog = idProg ? await buscarProgramaCea(idProg) : null;
  if (!prog) return { skipped: true, motivo: 'programa_no_cea' };

  const ids = await generarClasesPractica({
    numDoc,
    idProg: String(idProgDePrograma(prog)),
    horasTotal: cant,
    origenHoras: 'hora_practica_extra',
    idLiq: String(liq._id),
    idServ: serv.idServ != null ? String(serv.idServ) : '',
  });

  return { skipped: false, clases: ids.length, ids };
}

/**
 * Tras el primer abono de un servicio CEA, genera clases en estado CREADO e inscribe al alumno.
 */
async function onPrimerAbonoIngreso({ numDoc, liq, req: _req }) {
  if (!liq || numDoc == null) return { skipped: true, motivo: 'datos_incompletos' };

  const serv = liq.idServ ? await resolverServicio(liq.idServ) : null;

  if (serv && esServicioHoraPractica(serv)) {
    return generarClasesHoraPracticaExtra({ numDoc, liq, serv });
  }

  if (!liq.idMat) return { skipped: true, motivo: 'sin_matricula' };

  const mat = await Matricula.findById(liq.idMat).lean();
  if (!mat) return { skipped: true, motivo: 'matricula_no_encontrada' };

  const prog = await buscarProgramaCea(mat.idProg);
  if (!prog) return { skipped: true, motivo: 'programa_no_cea' };

  if (serv && !esServicioMatricula(serv)) {
    return { skipped: true, motivo: 'servicio_no_matricula' };
  }

  return generarClasesMatricula({ numDoc, idMat: mat._id, prog });
}

function claseListaParaProgramar(clase) {
  if (!clase || clase.estado !== 'CREADO') return false;
  const tieneHorario = Boolean(String(clase.horaDesde || '').trim() && String(clase.horaHasta || '').trim());
  const tieneInstructor = clase.idEmpleadoInstructor != null && clase.idEmpleadoInstructor !== '';
  if (!tieneHorario || !tieneInstructor) return false;

  if (clase.tipoClase === 'practica') {
    return Boolean(clase.idVehiculo && Number(clase.duracionHoras) > 0);
  }
  if (clase.tipoClase === 'teoria') {
    return Boolean(clase.idAula && clase.idTema);
  }
  if (clase.tipoClase === 'taller') {
    return Boolean(clase.idTaller && clase.idTema);
  }
  return false;
}

/** Resumen de clases CEA en estado CREADO por alumno (para lista de alumnos). */
async function indicadoresClasesCeaCreadoPorAlumnos(numDocs) {
  const out = new Map();
  if (!numDocs?.length) return out;

  const valores = [];
  const seen = new Set();
  for (const raw of numDocs) {
    const n = parseNumDoc(raw);
    if (n == null) continue;
    for (const v of [n, String(n)]) {
      const key = `${typeof v}:${v}`;
      if (!seen.has(key)) {
        seen.add(key);
        valores.push(v);
      }
    }
  }
  if (!valores.length) return out;

  const inscripciones = await InscripcionClaseCea.find({ numDoc: { $in: valores } }).lean();
  if (!inscripciones.length) return out;

  const idsClase = [...new Set(inscripciones.map((i) => String(i.idClase)))];
  const clases = await ClaseProgramadaCea.find({
    _id: { $in: idsClase },
    estado: 'CREADO',
  })
    .select('_id idProg')
    .lean();

  const creadoIds = new Set(clases.map((c) => String(c._id)));
  const claseProg = new Map(clases.map((c) => [String(c._id), c.idProg]));
  const progCache = new Map();
  const acum = new Map();

  for (const ins of inscripciones) {
    if (!creadoIds.has(String(ins.idClase))) continue;
    const nd = parseNumDoc(ins.numDoc);
    if (nd == null) continue;
    if (!acum.has(nd)) acum.set(nd, { clasesCeaCreado: 0, programas: new Map() });
    const entry = acum.get(nd);
    entry.clasesCeaCreado += 1;

    const idProg = claseProg.get(String(ins.idClase)) || ins.idProg || '';
    let label = progCache.get(idProg);
    if (label === undefined) {
      const prog = idProg ? await buscarProgramaCea(idProg) : null;
      label = prog ? labelPrograma(prog) : idProg || 'Licencia';
      progCache.set(idProg, label);
    }
    entry.programas.set(label, (entry.programas.get(label) || 0) + 1);
  }

  for (const [nd, entry] of acum) {
    out.set(nd, {
      clasesCeaCreado: entry.clasesCeaCreado,
      programasCeaCreado: [...entry.programas.entries()]
        .map(([programaLabel, cantidad]) => ({ programaLabel, cantidad }))
        .sort((a, b) => a.programaLabel.localeCompare(b.programaLabel, 'es')),
    });
  }
  return out;
}

function nombreAlumnoCea(a) {
  if (!a) return '';
  return [a.apellido1, a.apellido2, a.nombre1, a.nombre2].filter(Boolean).join(' ').trim();
}

/** Resumen global de clases CEA en estado CREADO (banner / alertas). */
async function alertasClasesCreado() {
  const clases = await ClaseProgramadaCea.find({ estado: 'CREADO' }).select('_id idProg').lean();
  if (!clases.length) {
    return { total: 0, totalClases: 0, items: [] };
  }

  const idsClase = clases.map((c) => c._id);
  const claseProg = new Map(clases.map((c) => [String(c._id), c.idProg]));
  const creadoIds = new Set(clases.map((c) => String(c._id)));

  const inscripciones = await InscripcionClaseCea.find({ idClase: { $in: idsClase } }).lean();
  const progCache = new Map();
  const acum = new Map();

  for (const ins of inscripciones) {
    if (!creadoIds.has(String(ins.idClase))) continue;
    const nd = parseNumDoc(ins.numDoc);
    if (nd == null) continue;
    if (!acum.has(nd)) acum.set(nd, { clasesCeaCreado: 0, programas: new Map() });
    const entry = acum.get(nd);
    entry.clasesCeaCreado += 1;

    const idProg = claseProg.get(String(ins.idClase)) || ins.idProg || '';
    let label = progCache.get(idProg);
    if (label === undefined) {
      const prog = idProg ? await buscarProgramaCea(idProg) : null;
      label = prog ? labelPrograma(prog) : idProg || 'Licencia';
      progCache.set(idProg, label);
    }
    entry.programas.set(label, (entry.programas.get(label) || 0) + 1);
  }

  if (!acum.size) {
    return { total: 0, totalClases: 0, items: [] };
  }

  const numDocs = [...acum.keys()];
  const alumnos = await DatosAlumno.find({ numDoc: { $in: numDocs } })
    .select('_id numDoc nombre1 nombre2 apellido1 apellido2')
    .lean();
  const alumnoPorDoc = new Map();
  for (const a of alumnos) {
    const nd = parseNumDoc(a.numDoc);
    if (nd != null) alumnoPorDoc.set(nd, a);
  }

  const items = [];
  let totalClases = 0;
  for (const [nd, entry] of acum) {
    totalClases += entry.clasesCeaCreado;
    const a = alumnoPorDoc.get(nd);
    items.push({
      numDoc: nd,
      alumnoId: a?._id ? String(a._id) : null,
      alumnoNombre: nombreAlumnoCea(a) || `Doc ${nd}`,
      clasesCeaCreado: entry.clasesCeaCreado,
      programasCeaCreado: [...entry.programas.entries()]
        .map(([programaLabel, cantidad]) => ({ programaLabel, cantidad }))
        .sort((x, y) => x.programaLabel.localeCompare(y.programaLabel, 'es')),
    });
  }

  items.sort((a, b) => a.alumnoNombre.localeCompare(b.alumnoNombre, 'es'));

  return {
    total: items.length,
    totalClases,
    items: items.slice(0, 100),
  };
}

module.exports = {
  onPrimerAbonoIngreso,
  completarClasesGrupalesAlumno,
  completarClasesGrupalesMatricula,
  completarClasesGrupalesTodos,
  completarClasesPracticaMatricula,
  generarClasesPendientesGlobales,
  contarClasesGrupalesFaltantesAlumno,
  fechaPlaceholderCreado,
  claseListaParaProgramar,
  indicadoresClasesCeaCreadoPorAlumnos,
  alertasClasesCreado,
};
