const { models: cat } = require('../models/catalogos');
const Matricula = require('../models/Matricula');
const Liquidacion = require('../models/Liquidacion');
const DatosAlumno = require('../models/DatosAlumno');
const TemaProgramaCea = require('../models/TemaProgramaCea');
const ClaseProgramadaCea = require('../models/ClaseProgramadaCea');
const InscripcionClaseCea = require('../models/InscripcionClaseCea');
const {
  esProgramaLicenciaConduccion,
  esServicioHoraPractica,
  idProgDePrograma,
  filtroIdProg,
} = require('./programaServicio');
const { obtenerConfig } = require('./configProgramacionCea');

function num(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'object' && v.$numberDecimal != null) return Number(v.$numberDecimal) || 0;
  return Number(v) || 0;
}

function nombreAlumno(a) {
  if (!a) return '';
  return [a.apellido1, a.apellido2, a.nombre1, a.nombre2].filter(Boolean).join(' ').trim();
}

function labelPrograma(prog) {
  return String(prog?.nomCert || prog?.nombreProg || prog?.codigoProg || prog?.idProg || '').trim();
}

function horasClase(clase) {
  if (clase?.horasDescuento != null && Number(clase.horasDescuento) > 0) {
    return Number(clase.horasDescuento);
  }
  if (clase?.duracionSegundos > 0) return clase.duracionSegundos / 3600;
  if (clase?.duracionHoras > 0) return Number(clase.duracionHoras);
  const desde = String(clase?.horaDesde || '');
  const hasta = String(clase?.horaHasta || '');
  const m1 = desde.match(/^(\d{1,2}):(\d{2})$/);
  const m2 = hasta.match(/^(\d{1,2}):(\d{2})$/);
  if (m1 && m2) {
    const mins = Number(m2[1]) * 60 + Number(m2[2]) - (Number(m1[1]) * 60 + Number(m1[2]));
    if (mins > 0) return mins / 60;
  }
  return Number(clase?.horasAsignadasDefault) || 1;
}

async function listarProgramasCea() {
  const rows = await cat.programas.find({}).lean();
  const out = [];
  for (const p of rows) {
    if (await esProgramaLicenciaConduccion(p)) {
      out.push({
        idProg: String(idProgDePrograma(p)),
        codigoProg: p.codigoProg,
        nombre: labelPrograma(p),
        horasTeoria: num(p.horasTeoria),
        horasPractica: num(p.horasPractica),
        horasTaller: num(p.horasTaller),
      });
    }
  }
  return out.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

async function buscarProgramaCea(idProg) {
  const q = String(idProg ?? '').trim();
  if (!q) return null;
  const n = Number(q);
  const prog = await cat.programas
    .findOne({
      $or: [
        { idProg: q },
        ...(Number.isFinite(n) ? [{ idProg: n }] : []),
        { idPrograma: q },
        ...(Number.isFinite(n) ? [{ idPrograma: n }] : []),
        { codigoProg: q },
      ],
    })
    .lean();
  if (!prog || !(await esProgramaLicenciaConduccion(prog))) return null;
  return prog;
}

async function contarHorasInscripciones(numDoc, filtrosExtra = {}) {
  const inscripciones = await InscripcionClaseCea.find({ numDoc, ...filtrosExtra }).lean();
  if (!inscripciones.length) return { programadas: 0, ejecutadas: 0, inscritas: 0 };

  const ids = [...new Set(inscripciones.map((i) => String(i.idClase)))];
  const clases = await ClaseProgramadaCea.find({ _id: { $in: ids } }).lean();
  const mapClase = new Map(clases.map((c) => [String(c._id), c]));

  let programadas = 0;
  let ejecutadas = 0;
  let inscritas = 0;
  for (const ins of inscripciones) {
    const clase = mapClase.get(String(ins.idClase));
    if (!clase) continue;
    /** Siempre horas programadas de la clase, nunca la duración real */
    const h = ins.horasAsignadas > 0 ? Number(ins.horasAsignadas) : horasClase(clase);
    if (clase.estado === 'FINALIZADO' && ins.estado === 'ASISTIO') {
      ejecutadas += h;
    } else if (clase.estado === 'EN PROCESO') {
      programadas += h;
    } else if (clase.estado === 'PROGRAMADA') {
      inscritas += h;
    }
    /** CREADO sin horario: no descuenta saldo hasta asignar fecha/hora e iniciar */
  }
  return { programadas, ejecutadas, inscritas };
}

function filaRastreo({
  numDoc,
  alumnoNombre,
  idProg,
  programaLabel,
  origenHoras,
  idServ,
  idMat,
  idLiq,
  servicioLabel,
  tipoHoras,
  requeridas,
  programadas,
  ejecutadas,
  inscritas,
}) {
  const cubiertas = programadas + ejecutadas + inscritas;
  const pendientes = Math.max(0, requeridas - cubiertas);
  return {
    numDoc,
    alumnoNombre,
    idProg: String(idProg),
    programaLabel,
    origenHoras,
    idServ: idServ != null ? String(idServ) : '',
    idMat: idMat ? String(idMat) : '',
    idLiq: idLiq ? String(idLiq) : '',
    servicioLabel,
    tipoHoras,
    requeridas,
    programadas,
    ejecutadas,
    inscritas,
    pendientes,
    completo: pendientes <= 0,
  };
}

async function filasMatriculaAlumno(mat, prog, alumno) {
  const idProg = String(idProgDePrograma(prog));
  const programaLabel = labelPrograma(prog);
  const servicios = await cat.servicios.find(filtroIdProg(idProg)).lean();
  const servMat = servicios.find((s) => !esServicioHoraPractica(s));
  const servicioLabel = servMat?.descrServicio || `Matrícula ${programaLabel}`;
  const idServ = servMat?.idServ != null ? String(servMat.idServ) : '';

  const filas = [];
  const tipos = [
    { tipo: 'teoria', horas: num(prog.horasTeoria) },
    { tipo: 'taller', horas: num(prog.horasTaller) },
    { tipo: 'practica', horas: num(prog.horasPractica) },
  ];

  for (const t of tipos) {
    if (t.horas <= 0) continue;
    const { programadas, ejecutadas, inscritas } = await contarHorasInscripciones(mat.numDoc, {
      idProg,
      origenHoras: 'matricula',
      tipoHoras: t.tipo,
      idMat: mat._id,
    });
    filas.push(
      filaRastreo({
        numDoc: mat.numDoc,
        alumnoNombre: nombreAlumno(alumno),
        idProg,
        programaLabel,
        origenHoras: 'matricula',
        idServ,
        idMat: mat._id,
        servicioLabel,
        tipoHoras: t.tipo,
        requeridas: t.horas,
        programadas,
        ejecutadas,
        inscritas,
      }),
    );
  }
  return filas;
}

async function filasHorasPracticaExtra(numDoc, alumno) {
  const liqs = await Liquidacion.find({ numDoc }).lean();
  const filas = [];
  for (const liq of liqs) {
    if (!liq.idServ) continue;
    const idServStr = String(liq.idServ);
    const n = Number(liq.idServ);
    const serv = await cat.servicios
      .findOne({ $or: [{ idServ: idServStr }, ...(Number.isFinite(n) ? [{ idServ: n }] : [])] })
      .lean();
    if (!serv || !esServicioHoraPractica(serv)) continue;
    const cant = Math.max(0, Math.floor(num(liq.cantidad) || 0));
    if (cant <= 0) continue;

    const idProg = String(serv.idProg ?? liq.idProg ?? '');
    const prog = idProg ? await buscarProgramaCea(idProg) : null;
    const { programadas, ejecutadas, inscritas } = await contarHorasInscripciones(numDoc, {
      origenHoras: 'hora_practica_extra',
      tipoHoras: 'practica',
      idLiq: liq._id,
    });
    filas.push(
      filaRastreo({
        numDoc,
        alumnoNombre: nombreAlumno(alumno),
        idProg,
        programaLabel: prog ? labelPrograma(prog) : idProg,
        origenHoras: 'hora_practica_extra',
        idServ: serv.idServ,
        idLiq: liq._id,
        servicioLabel: liq.descripcion || serv.descrServicio || 'Hora clase práctica',
        tipoHoras: 'practica',
        requeridas: cant,
        programadas,
        ejecutadas,
        inscritas,
      }),
    );
  }
  return filas;
}

async function rastreoAlumno(numDoc) {
  const n = Number(numDoc);
  if (!Number.isFinite(n)) {
    return {
      numDoc: null,
      filas: [],
      alertasPrograma: [],
      duracionSesionPracticaCea: null,
      duracionesPermitidas: [1, 2, 3, 4],
      duracionSesionPracticaDefault: 2,
      clasesCeaGeneradas: false,
      clasesGrupalesFaltantes: { total: 0, teoria: 0, taller: 0 },
    };
  }

  const alumno = await DatosAlumno.findOne({ numDoc: n }).lean();
  const config = await obtenerConfig();
  const permitidas = (config?.vehiculo?.duracionesPermitidas || [1, 2, 3, 4])
    .map((x) => Number(x))
    .filter((x) => x >= 1 && x <= 8);
  const clasesCeaGeneradas = (await InscripcionClaseCea.countDocuments({ numDoc: n })) > 0;

  const mats = await Matricula.find({ numDoc: n, estado: { $ne: 'anulada' } }).lean();
  const filas = [];

  for (const mat of mats) {
    const prog = await buscarProgramaCea(mat.idProg);
    if (!prog) continue;
    filas.push(...(await filasMatriculaAlumno(mat, prog, alumno)));
  }
  filas.push(...(await filasHorasPracticaExtra(n, alumno)));

  const alertasPrograma = await alertasTemasPrograma(filas.map((f) => f.idProg));
  const prefAlumno =
    alumno?.duracionSesionPracticaCea != null && alumno.duracionSesionPracticaCea !== ''
      ? Number(alumno.duracionSesionPracticaCea)
      : null;

  let clasesGrupalesFaltantes = { total: 0, teoria: 0, taller: 0 };
  if (clasesCeaGeneradas) {
    try {
      const { contarClasesGrupalesFaltantesAlumno } = require('./programacionCeaAuto');
      clasesGrupalesFaltantes = await contarClasesGrupalesFaltantesAlumno(n);
    } catch {
      /* no bloquear rastreo */
    }
  }

  return {
    numDoc: n,
    alumnoNombre: nombreAlumno(alumno),
    filas,
    alertasPrograma,
    duracionSesionPracticaCea: Number.isFinite(prefAlumno) && prefAlumno >= 1 ? prefAlumno : null,
    duracionesPermitidas: permitidas.length ? permitidas : [1, 2, 3, 4],
    duracionSesionPracticaDefault: 2,
    clasesCeaGeneradas,
    clasesGrupalesFaltantes,
  };
}

async function alertasTemasPrograma(idProgs) {
  const unicos = [...new Set((idProgs || []).filter(Boolean))];
  const out = [];
  for (const idProg of unicos) {
    const prog = await buscarProgramaCea(idProg);
    if (!prog) continue;
    const teoria = num(prog.horasTeoria);
    const taller = num(prog.horasTaller);
    const temas = await TemaProgramaCea.find({ idProg: String(idProg), activo: { $ne: false } }).lean();
    const nTeoria = temas.filter((t) => t.tipo === 'teoria').length;
    const nTaller = temas.filter((t) => t.tipo === 'taller').length;
    if (teoria > 0 && nTeoria === 0) {
      out.push({
        idProg: String(idProg),
        programaLabel: labelPrograma(prog),
        tipo: 'sin_temas_teoria',
        mensaje: 'El programa requiere horas de teoría pero no tiene temas definidos.',
      });
    }
    if (taller > 0 && nTaller === 0) {
      out.push({
        idProg: String(idProg),
        programaLabel: labelPrograma(prog),
        tipo: 'sin_temas_taller',
        mensaje: 'El programa requiere horas de taller pero no tiene temas definidos.',
      });
    }
  }
  return out;
}

async function rastreoGlobal({ soloPendientes = false } = {}) {
  const programas = await listarProgramasCea();
  const idProgsCea = new Set(programas.map((p) => p.idProg));
  const mats = await Matricula.find({ estado: { $ne: 'anulada' } }).lean();
  const filas = [];
  const numDocs = new Set();

  for (const mat of mats) {
    const prog = await buscarProgramaCea(mat.idProg);
    if (!prog) continue;
    numDocs.add(mat.numDoc);
    const alumno = await DatosAlumno.findOne({ numDoc: mat.numDoc }).lean();
    filas.push(...(await filasMatriculaAlumno(mat, prog, alumno)));
  }

  const liqs = await Liquidacion.find({}).lean();
  const extrasPorDoc = new Map();
  for (const liq of liqs) {
    if (!liq.idServ || liq.numDoc == null) continue;
    const idServStr = String(liq.idServ);
    const n = Number(liq.idServ);
    const serv = await cat.servicios
      .findOne({ $or: [{ idServ: idServStr }, ...(Number.isFinite(n) ? [{ idServ: n }] : [])] })
      .lean();
    if (!serv || !esServicioHoraPractica(serv)) continue;
    if (Math.floor(num(liq.cantidad) || 0) <= 0) continue;
    if (!extrasPorDoc.has(liq.numDoc)) extrasPorDoc.set(liq.numDoc, []);
    extrasPorDoc.get(liq.numDoc).push(liq);
  }

  for (const [nd] of extrasPorDoc) {
    numDocs.add(nd);
    const alumno = await DatosAlumno.findOne({ numDoc: nd }).lean();
    const extras = await filasHorasPracticaExtra(nd, alumno);
    for (const ex of extras) {
      if (!filas.some((f) => f.idLiq && ex.idLiq && f.idLiq === ex.idLiq)) filas.push(ex);
    }
  }

  const alertasPrograma = await alertasTemasPrograma([...idProgsCea]);
  const pendientes = filas.filter((f) => f.pendientes > 0);
  const resultado = soloPendientes ? pendientes : filas;
  return {
    total: resultado.length,
    totalPendientes: pendientes.length,
    filas: resultado,
    alertasPrograma,
  };
}

async function alertasPendientes() {
  const data = await rastreoGlobal({ soloPendientes: true });
  return {
    total: data.totalPendientes,
    alertasPrograma: data.alertasPrograma,
    items: data.filas.slice(0, 100),
  };
}

async function guardarPreferenciasAlumno(numDoc, body, usuario) {
  const n = Number(numDoc);
  if (!Number.isFinite(n)) return { error: 'Documento inválido', status: 400 };

  const alumno = await DatosAlumno.findOne({ numDoc: n });
  if (!alumno) return { error: 'Alumno no encontrado', status: 404 };

  const config = await obtenerConfig();
  const permitidas = (config?.vehiculo?.duracionesPermitidas || [1, 2, 3, 4])
    .map((x) => Number(x))
    .filter((x) => x >= 1 && x <= 8);

  if (body?.duracionSesionPracticaCea !== undefined) {
    const raw = body.duracionSesionPracticaCea;
    if (raw === null || raw === '' || raw === 'auto' || raw === 0 || raw === '0') {
      alumno.duracionSesionPracticaCea = null;
    } else {
      const val = Number(raw);
      if (!Number.isFinite(val) || val < 1) {
        return { error: 'Duración de sesión inválida', status: 400 };
      }
      if (permitidas.length && !permitidas.includes(val)) {
        return {
          error: `Duración no permitida. Opciones: ${permitidas.join(', ')} h`,
          status: 400,
        };
      }
      alumno.duracionSesionPracticaCea = val;
    }
    alumno.userChangeRecord = usuario?.username || 'sistema';
    alumno.fechaMod = new Date();
    await alumno.save();
  }

  const pref =
    alumno.duracionSesionPracticaCea != null && alumno.duracionSesionPracticaCea !== ''
      ? Number(alumno.duracionSesionPracticaCea)
      : null;

  return {
    numDoc: n,
    duracionSesionPracticaCea: Number.isFinite(pref) && pref >= 1 ? pref : null,
    duracionesPermitidas: permitidas.length ? permitidas : [1, 2, 3, 4],
    duracionSesionPracticaDefault: 2,
    clasesCeaGeneradas: (await InscripcionClaseCea.countDocuments({ numDoc: n })) > 0,
  };
}

module.exports = {
  listarProgramasCea,
  buscarProgramaCea,
  rastreoAlumno,
  rastreoGlobal,
  alertasPendientes,
  alertasTemasPrograma,
  guardarPreferenciasAlumno,
  labelPrograma,
  horasClase,
};
