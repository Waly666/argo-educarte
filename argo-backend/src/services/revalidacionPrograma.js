const Certificado = require('../models/Certificado');
const { parseNumDoc, numDocQuery } = require('../utils/numDoc');
const { num, valorTarifaServicio, listarServiciosMatricula, programaUsaSemestres } = require('./programaServicio');
const { esProgramaJornadasCap } = require('./jornadaCapacitacion');
const {
  normalizarTipoRegularJornada,
  TIPO_JORNADAS_CAPACITACION,
} = require('../constants/tipoRegularJornada');
const { TARIFA_REVALIDACION, SUFIJO_DESCRIPCION_REVALIDACION } = require('../constants/revalidacion');
const { esTarifaVirtual } = require('../constants/tarifa');

function programaAdmiteRevalidacion(prog) {
  const dias = Number(prog?.diasVencimiento);
  if (!Number.isFinite(dias) || dias <= 0) return false;
  return prog?.admiteRevalidacion === true;
}

function programaAplicaTarifaRevalidacionAuto(prog) {
  return programaAdmiteRevalidacion(prog) && prog?.aplicarTarifaRevalidacionAuto === true;
}

function esCertificadoJornadaCap(cert) {
  if (!cert) return false;
  if (cert.idJornada || cert.idContrato || cert.generadoAutoJornada) return true;
  return normalizarTipoRegularJornada(cert.tipoCertificado) === TIPO_JORNADAS_CAPACITACION;
}

function idProgramaCanonico(progOrId) {
  if (progOrId == null) return '';
  if (typeof progOrId === 'object') return String(progOrId.idPrograma ?? progOrId.idProg ?? progOrId._id ?? '').trim();
  return String(progOrId).trim();
}

async function buscarCertificadoRevalidacion(numDoc, prog) {
  const nd = parseNumDoc(numDoc);
  if (nd == null) return null;
  const idProg = idProgramaCanonico(prog);
  if (!idProg) return null;

  const rows = await Certificado.find({
    ...numDocQuery(nd),
    idProg,
    estado: { $nin: ['anulado'] },
  })
    .sort({ fechaEmision: -1 })
    .lean();

  return rows.find((c) => !esCertificadoJornadaCap(c)) || null;
}

async function alumnoCalificaRevalidacion(numDoc, prog) {
  if (!prog || (await esProgramaJornadasCap(prog))) {
    return { califica: false, certificado: null, motivo: 'programa_no_aplica' };
  }
  if (!programaAdmiteRevalidacion(prog)) {
    return { califica: false, certificado: null, motivo: 'programa_sin_revalidacion' };
  }
  const cert = await buscarCertificadoRevalidacion(numDoc, prog);
  if (!cert) {
    return { califica: false, certificado: null, motivo: 'sin_certificado_previo' };
  }
  return { califica: true, certificado: cert, motivo: 'certificado_previo' };
}

async function valorMatriculaConTarifa(prog, serviciosProg, tarifa) {
  const usaSem = programaUsaSemestres(prog) && serviciosProg.length > 0;
  if (usaSem) {
    return serviciosProg.reduce((acc, s) => acc + valorTarifaServicio(s, tarifa, prog), 0);
  }
  const serv = serviciosProg[0] || null;
  return valorTarifaServicio(serv, tarifa, prog);
}

async function tarifa3Disponible(prog, serviciosProg) {
  const v = await valorMatriculaConTarifa(prog, serviciosProg, TARIFA_REVALIDACION);
  return v > 0;
}

/**
 * Resuelve tarifa y flags de revalidación al matricular.
 * @param {{ numDoc, prog, tarifa?: number, tarifaManual?: boolean }} opts
 */
async function resolverTarifaMatricula({ numDoc, prog, tarifa: tarifaBody = 1, tarifaManual = false }) {
  const serviciosProg = await listarServiciosMatricula(prog);
  const evaluacion = await alumnoCalificaRevalidacion(numDoc, prog);
  const tarifaSolicitada = Number(tarifaBody) || 1;
  const base = {
    califica: evaluacion.califica,
    admiteRevalidacion: programaAdmiteRevalidacion(prog),
    aplicarAuto: programaAplicaTarifaRevalidacionAuto(prog),
    certificado: evaluacion.certificado,
    motivo: evaluacion.motivo,
    tarifaRevalidacion: TARIFA_REVALIDACION,
    tarifa3Disponible: await tarifa3Disponible(prog, serviciosProg),
  };

  if (esTarifaVirtual(tarifaSolicitada)) {
    return {
      ...base,
      tarifa: tarifaSolicitada,
      revalidacion: false,
      aplicadaAuto: false,
      mensaje: null,
    };
  }

  if (!evaluacion.califica) {
    return {
      ...base,
      tarifa: tarifaSolicitada,
      revalidacion: false,
      aplicadaAuto: false,
      mensaje: null,
    };
  }

  const auto = programaAplicaTarifaRevalidacionAuto(prog);
  if (auto && !tarifaManual) {
    if (!(await tarifa3Disponible(prog, serviciosProg))) {
      const err = new Error(
        'El programa admite refrendación automática pero no tiene tarifa 3 configurada. Configure tarifa 3 (refrendación) en Programas.',
      );
      err.status = 400;
      err.code = 'TARIFA3_REVALIDACION_FALTANTE';
      throw err;
    }
    return {
      ...base,
      tarifa: TARIFA_REVALIDACION,
      revalidacion: true,
      aplicadaAuto: true,
      mensaje: 'Refrendación: se aplicó tarifa 3 (renovación de certificado previo).',
    };
  }

  if (tarifaSolicitada === TARIFA_REVALIDACION) {
    if (!(await tarifa3Disponible(prog, serviciosProg))) {
      const err = new Error('Tarifa 3 (refrendación) no configurada o es cero en este programa.');
      err.status = 400;
      throw err;
    }
    return {
      ...base,
      tarifa: TARIFA_REVALIDACION,
      revalidacion: true,
      aplicadaAuto: false,
      mensaje: 'Matrícula con tarifa 3 (refrendación).',
    };
  }

  return {
    ...base,
    tarifa: tarifaSolicitada,
    revalidacion: false,
    aplicadaAuto: false,
    mensaje:
      auto && tarifaManual
        ? 'El alumno califica para refrendación; usted eligió otra tarifa manualmente.'
        : evaluacion.califica && !auto
          ? 'El alumno tiene certificado previo: puede usar tarifa 3 (refrendación).'
          : null,
  };
}

async function previewRevalidacionMatricula(numDoc, prog) {
  const serviciosProg = await listarServiciosMatricula(prog);
  const evaluacion = await alumnoCalificaRevalidacion(numDoc, prog);
  const admite = programaAdmiteRevalidacion(prog);
  const auto = programaAplicaTarifaRevalidacionAuto(prog);
  const t3Ok = await tarifa3Disponible(prog, serviciosProg);

  let tarifaSugerida = 1;
  let aplicadaAuto = false;
  let mensaje = null;

  if (evaluacion.califica) {
    tarifaSugerida = TARIFA_REVALIDACION;
    if (auto) {
      if (t3Ok) {
        aplicadaAuto = true;
        mensaje = 'Refrendación: se aplicará tarifa 3 automáticamente al matricular.';
      } else {
        mensaje =
          'El alumno califica para refrendación, pero falta configurar tarifa 3 en el programa.';
      }
    } else {
      mensaje = 'El alumno tiene certificado previo: puede usar tarifa 3 (refrendación).';
    }
  }

  const tarifaPreview = evaluacion.califica && auto && t3Ok ? TARIFA_REVALIDACION : tarifaSugerida;
  const valorSugerido =
    evaluacion.califica && t3Ok
      ? await valorMatriculaConTarifa(prog, serviciosProg, TARIFA_REVALIDACION)
      : await valorMatriculaConTarifa(prog, serviciosProg, 1);

  return {
    califica: evaluacion.califica,
    admiteRevalidacion: admite,
    aplicarAuto: auto,
    tarifaSugerida: evaluacion.califica ? TARIFA_REVALIDACION : 1,
    tarifaAplicada: tarifaPreview,
    aplicadaAuto,
    tarifa3Disponible: t3Ok,
    valorSugerido,
    mensaje,
    certificado: evaluacion.certificado
      ? {
          codigoCert: evaluacion.certificado.codigoCert,
          fechaEmision: evaluacion.certificado.fechaEmision,
          fechaVencimiento: evaluacion.certificado.fechaVencimiento,
          estado: evaluacion.certificado.estado,
        }
      : null,
  };
}

function descripcionConRevalidacion(descripcion, esRevalidacion) {
  const base = String(descripcion || '').trim();
  if (!esRevalidacion) return base;
  if (base.toLowerCase().includes('refrend')) return base;
  return `${base}${SUFIJO_DESCRIPCION_REVALIDACION}`;
}

module.exports = {
  TARIFA_REVALIDACION,
  SUFIJO_DESCRIPCION_REVALIDACION,
  programaAdmiteRevalidacion,
  programaAplicaTarifaRevalidacionAuto,
  esCertificadoJornadaCap,
  buscarCertificadoRevalidacion,
  alumnoCalificaRevalidacion,
  resolverTarifaMatricula,
  previewRevalidacionMatricula,
  descripcionConRevalidacion,
};
