const AsisClasJorCap = require('../models/AsisClasJorCap');
const InscripcionClase = require('../models/InscripcionClase');
const DatosAlumno = require('../models/DatosAlumno');
const Matricula = require('../models/Matricula');
const Certificado = require('../models/Certificado');
const { parseNumDoc, numDocQuery } = require('../utils/numDoc');
const { asegurarTipoAlumnoJornada, auditoriaUsuario } = require('./jornadaCapacitacion');
const { sincronizarEstadoJornada, mensajeSiJornadaNoOperable } = require('./estadoJornadaCap');
const {
  intentarCertificadoJornadaAuto,
  progresoCertificacion,
  validarAlumnoSinCertificadoContrato,
  crearContextoCertificadoContrato,
} = require('./certificadoJornadaAuto');
const { tieneAlguno, permisosParaRol } = require('./rolesPermisos');

const QUERY_MATRICULA_ACTIVA = { estado: { $regex: /^activo?a?$/i } };

function progresoDesdeResultadoCert(resultadoCert, idContrato, numDoc, ctxCert) {
  if (resultadoCert?.sesiones != null) {
    return {
      sesiones: resultadoCert.sesiones,
      numSesCert: resultadoCert.numSesCert,
      cumplio: resultadoCert.cumplio,
      faltan: resultadoCert.faltan,
      certificado: resultadoCert.certificado || null,
    };
  }
  return progresoCertificacion(numDoc, idContrato, ctxCert);
}

/**
 * Registra asistencia de un alumno en una clase y evalúa certificado automático.
 * @returns {Promise<object>} payload con sesiones, certificadoGenerado, motivoCertificado, etc.
 */
async function registrarAsistenciaAlumnoEnClase(req, clase, numDocRaw, opts = {}) {
  const {
    omitirValidacionJornada = false,
    jornada: jornadaPrecargada = null,
    ctxCert = null,
    skipAsistenciaExistente = false,
  } = opts;
  const numDoc = parseNumDoc(numDocRaw);
  if (numDoc == null) {
    const err = new Error('numDoc inválido');
    err.status = 400;
    throw err;
  }

  let alumno = await DatosAlumno.findOne(numDocQuery(numDoc)).lean();
  if (!alumno) {
    const err = new Error('Alumno no encontrado');
    err.status = 404;
    throw err;
  }
  alumno = (await asegurarTipoAlumnoJornada(numDoc)) || alumno;

  const progId = String(clase.idPrograma);
  const mat = await Matricula.findOne({ numDoc, idProg: progId, ...QUERY_MATRICULA_ACTIVA }).lean();
  if (!mat) {
    const err = new Error('El alumno no está matriculado en el programa de esta clase');
    err.status = 400;
    throw err;
  }

  const jornada = jornadaPrecargada || (await sincronizarEstadoJornada(clase.idJornada));
  if (!omitirValidacionJornada) {
    const permisos = req.permisos || (await permisosParaRol(req.user?.rol));
    const esAdminJornadas = tieneAlguno(permisos, ['jornadas.gestionar']);
    if (!esAdminJornadas) {
      const bloqueoAsis = mensajeSiJornadaNoOperable(jornada);
      if (bloqueoAsis) {
        const err = new Error(bloqueoAsis);
        err.status = 400;
        throw err;
      }
    }
  }

  const idContrato = jornada?.idContrato;
  const auditor = req?.user ? auditoriaUsuario(req) : 'sistema';

  if (idContrato) {
    const bloqueo = await validarAlumnoSinCertificadoContrato(numDoc, idContrato);
    if (bloqueo) {
      const yaAsis = skipAsistenciaExistente
        ? null
        : await AsisClasJorCap.findOne({
            idclaseJornada: clase._id,
            numDocAlumno: numDoc,
          }).lean();
      if (!yaAsis) {
        const err = new Error(bloqueo.message);
        err.status = 409;
        err.codigo = 'ya_certificado_contrato';
        err.certificado = bloqueo.certificado;
        throw err;
      }
    }
  }

  let asis = null;
  let duplicada = false;
  if (skipAsistenciaExistente) {
    try {
      asis = await AsisClasJorCap.create({
        idclaseJornada: clase._id,
        numDocAlumno: numDoc,
        userAddReg: auditor,
      });
    } catch (e) {
      if (e.code === 11000) {
        duplicada = true;
        asis = await AsisClasJorCap.findOne({
          idclaseJornada: clase._id,
          numDocAlumno: numDoc,
        }).lean();
      } else {
        throw e;
      }
    }
  } else {
    try {
      asis = await AsisClasJorCap.create({
        idclaseJornada: clase._id,
        numDocAlumno: numDoc,
        userAddReg: auditor,
      });
    } catch (e) {
      if (e.code === 11000) {
        duplicada = true;
        asis = await AsisClasJorCap.findOne({
          idclaseJornada: clase._id,
          numDocAlumno: numDoc,
        }).lean();
      } else {
        throw e;
      }
    }
  }

  try {
    await InscripcionClase.updateOne(
      { idClase: clase._id, numDoc },
      { $setOnInsert: { userAddReg: auditor } },
      { upsert: true },
    );
  } catch (_) {
    /* ignore */
  }

  let resultadoCert = { creado: false, motivo: null };
  if (idContrato) {
    resultadoCert = await intentarCertificadoJornadaAuto(
      numDoc,
      progId,
      idContrato,
      clase.idJornada,
      ctxCert,
    );
  } else {
    resultadoCert = { creado: false, motivo: 'sin_contrato_jornada' };
  }

  const progreso = idContrato
    ? await progresoDesdeResultadoCert(resultadoCert, idContrato, numDoc, ctxCert)
    : { sesiones: 0, numSesCert: 1, cumplio: false };

  return {
    asistencia: asis,
    duplicada,
    sesiones: progreso.sesiones,
    numSesCert: progreso.numSesCert,
    faltan: progreso.faltan,
    cumplioSesiones: progreso.cumplio,
    certificadoGenerado: !!resultadoCert.creado,
    certificado: resultadoCert.certificado || progreso.certificado || null,
    motivoCertificado: resultadoCert.motivo || null,
    mensajeCertificado: resultadoCert.mensaje || null,
    nombreAlumno: [alumno.nombre1, alumno.nombre2, alumno.apellido1, alumno.apellido2]
      .filter(Boolean)
      .join(' '),
    numDoc,
  };
}

/** Registra asistencia de todos los inscritos que aún no tienen asistencia en la clase. */
async function registrarAsistenciasInscritosPendientes(req, claseDoc, opts = {}) {
  const clase = claseDoc?.toObject ? claseDoc.toObject() : { ...claseDoc };
  const inscripciones = await InscripcionClase.find({ idClase: clase._id }).lean();
  const asistenciasExistentes = await AsisClasJorCap.find({ idclaseJornada: clase._id })
    .select('numDocAlumno')
    .lean();
  const yaAsistio = new Set(asistenciasExistentes.map((a) => Number(a.numDocAlumno)));

  const pendientes = inscripciones.filter((ins) => !yaAsistio.has(Number(ins.numDoc)));
  const resultados = [];
  let certificadosNuevos = 0;
  const certificadosEmitidos = [];

  if (!pendientes.length) {
    return {
      ok: true,
      registradas: 0,
      omitidas: inscripciones.length,
      omitidosCertificados: 0,
      certificadosNuevos: 0,
      certificadosEmitidos: [],
      resultados: [],
    };
  }

  const jornada = await sincronizarEstadoJornada(clase.idJornada);
  let aProcesar = pendientes;
  let omitidosCertificados = 0;
  if (jornada?.idContrato) {
    const docsPend = pendientes.map((i) => Number(i.numDoc)).filter((n) => Number.isFinite(n));
    const certs = docsPend.length
      ? await Certificado.find({
          numDoc: { $in: docsPend },
          idContrato: jornada.idContrato,
          estado: { $ne: 'anulado' },
        })
          .select('numDoc')
          .lean()
      : [];
    const certificados = new Set(certs.map((c) => Number(c.numDoc)));
    aProcesar = pendientes.filter((ins) => !certificados.has(Number(ins.numDoc)));
    omitidosCertificados = pendientes.length - aProcesar.length;
  }

  if (!aProcesar.length) {
    return {
      ok: true,
      registradas: 0,
      omitidas: inscripciones.length - pendientes.length + omitidosCertificados,
      omitidosCertificados,
      certificadosNuevos: 0,
      certificadosEmitidos: [],
      resultados: [],
    };
  }

  const ctxCert = jornada?.idContrato
    ? await crearContextoCertificadoContrato(jornada.idContrato)
    : null;

  for (const ins of aProcesar) {
    try {
      const r = await registrarAsistenciaAlumnoEnClase(req, clase, ins.numDoc, {
        ...opts,
        jornada,
        ctxCert,
        skipAsistenciaExistente: true,
      });
      if (r.certificadoGenerado) {
        certificadosNuevos += 1;
        if (r.certificado) {
          certificadosEmitidos.push({
            certificado: r.certificado,
            nombreAlumno: r.nombreAlumno,
            numDoc: r.numDoc,
          });
        }
      }
      resultados.push(r);
    } catch (e) {
      resultados.push({
        numDoc: ins.numDoc,
        error: e.message || 'Error registrando asistencia',
      });
    }
  }

  return {
    ok: true,
    registradas: resultados.filter((r) => !r.error && !r.duplicada).length,
    omitidas: inscripciones.length - pendientes.length + omitidosCertificados,
    omitidosCertificados,
    certificadosNuevos,
    certificadosEmitidos,
    resultados,
  };
}

module.exports = {
  QUERY_MATRICULA_ACTIVA,
  registrarAsistenciaAlumnoEnClase,
  registrarAsistenciasInscritosPendientes,
};
