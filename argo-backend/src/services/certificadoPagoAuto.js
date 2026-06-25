const Certificado = require('../models/Certificado');
const DatosAlumno = require('../models/DatosAlumno');
const Cliente     = require('../models/Cliente');
const { models: cat } = require('../models/catalogos');
const { normalizarTipoRegularJornada } = require('../constants/tipoRegularJornada');
const { parseNumDoc, numDocQuery } = require('../utils/numDoc');
const { buscarPrograma, esCapacitacionVirtualServicio } = require('./programaServicio');
const { configPorPrograma, servicioMatriculaPrograma } = require('./aulaVirtualCatalogo');
const { obtenerConfigCertificado, siguienteCodigoCertificado } = require('./configCertificado');
const {
  clasificarProgramaAsync,
  etiquetaIdTipCap,
  TIPOS,
  TIPOS_LABEL,
} = require('./clasificacionCertificado');
const { resolverPlantillaImpresion } = require('./plantillaCertificado');
const { esProgramaJornadasCap } = require('./jornadaCapacitacion');

function num(v) {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'object' && v.$numberDecimal != null) return Number(v.$numberDecimal) || 0;
  return Number(String(v)) || 0;
}

function encabezadoCurso(prog) {
  return (prog?.nomCert || prog?.descripcion || prog?.nombreProg || '').trim();
}

function norm(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim();
}

/** ¿El tipo de capacitación del programa está en la lista de excluidos de la config? */
async function tipoCapExcluido(prog, excluidos) {
  if (!Array.isArray(excluidos) || !excluidos.length) return false;
  const set = new Set(excluidos.map(norm).filter(Boolean));
  if (!set.size) return false;
  const rawTip = norm(prog?.idTipCap);
  if (rawTip && set.has(rawTip)) return true;
  const label = norm(await etiquetaIdTipCap(prog?.idTipCap, cat.catTipoCapacitacion));
  if (label && set.has(label)) return true;
  return false;
}

/**
 * Emite un certificado automáticamente cuando la liquidación de un programa queda en saldo 0,
 * según la configuración (autoCertificadoAlPagar + autoCertificadoPorTipo + tipos excluidos).
 *
 * Nunca lanza: ante cualquier condición no cumplida devuelve { creado:false, motivo }.
 *
 * @param {{ numDoc:any, liq:object, saldo?:number }} params
 * @returns {Promise<{creado:boolean, motivo?:string, certificado?:object}>}
 */
async function intentarCertificadoPagoAuto({ numDoc: numDocRaw, liq, saldo } = {}) {
  const numDoc = parseNumDoc(numDocRaw);
  if (numDoc == null) return { creado: false, motivo: 'numDoc_invalido' };
  if (!liq || !liq.idProg) return { creado: false, motivo: 'sin_programa' };

  const saldoNum = saldo != null ? num(saldo) : num(liq.saldo);
  if (saldoNum > 0.0001) return { creado: false, motivo: 'saldo_pendiente' };

  const prog = await buscarPrograma(liq.idProg);
  if (!prog) return { creado: false, motivo: 'programa_no_encontrado' };

  const serv = await servicioMatriculaPrograma(prog);
  if (esCapacitacionVirtualServicio(serv)) {
    const cfgVirtual = await configPorPrograma(liq.idProg);
    if (cfgVirtual?.modoCertificado === 'al_aprobar') {
      return { creado: false, motivo: 'virtual_certificado_al_aprobar' };
    }
  }

  const tipoFormato = await clasificarProgramaAsync(prog, cat.catTipoCapacitacion);

  // Jornadas de capacitación certifican por asistencia, no por pago.
  if (tipoFormato === TIPOS.JORNADA_CAPACITACION) {
    return { creado: false, motivo: 'jornada_capacitacion' };
  }
  if (await esProgramaJornadasCap(prog)) {
    return { creado: false, motivo: 'jornada_capacitacion' };
  }

  const cfg = await obtenerConfigCertificado();
  if (!cfg.autoCertificadoAlPagar) return { creado: false, motivo: 'auto_desactivado' };
  if (!cfg.autoCertificadoPorTipo?.[tipoFormato]) {
    return { creado: false, motivo: 'formato_desactivado' };
  }
  if (await tipoCapExcluido(prog, cfg.autoCertificadoTiposCapExcluidos)) {
    return { creado: false, motivo: 'tipo_capacitacion_excluido' };
  }

  const dup = await Certificado.findOne({
    idLiquidacion: liq._id,
    estado: { $ne: 'anulado' },
  }).lean();
  if (dup) return { creado: false, motivo: 'ya_certificado', certificado: dup };

  const plantilla = await resolverPlantillaImpresion(cfg, tipoFormato, null);
  if (!plantilla) {
    console.warn(
      `[certificadoPagoAuto] Sin plantilla para «${TIPOS_LABEL[tipoFormato]}»; configúrela en Config. Certificados.`,
    );
    return { creado: false, motivo: 'sin_plantilla' };
  }

  const alumno = await DatosAlumno.findOne(numDocQuery(numDoc)).lean();
  const tipoCert = normalizarTipoRegularJornada(alumno?.tipoAlumno);

  const fechaEm = new Date();
  let fechaVe = null;
  const dias = Number(prog?.diasVencimiento || prog?.vigenciaDias || 0);
  if (dias > 0) fechaVe = new Date(fechaEm.getTime() + dias * 24 * 60 * 60 * 1000);

  let empresaId = null;
  let empresaNombre = null;
  if (alumno?.empresaId) {
    empresaId = alumno.empresaId;
    const cli = await Cliente.findById(empresaId, { razonSocial: 1, nombres: 1, nombreComercial: 1, identificacion: 1 }).lean();
    if (cli) empresaNombre = cli.razonSocial?.trim() || cli.nombreComercial?.trim() || cli.nombres?.trim() || cli.identificacion || null;
  }

  const codigoCert = await siguienteCodigoCertificado();
  const encabezado = encabezadoCurso(prog);

  const cert = await Certificado.create({
    numDoc,
    idLiquidacion: liq._id,
    idProg: liq.idProg,
    codigoCert,
    encabezado,
    idPlantilla: plantilla._id,
    orientacion: plantilla.orientacion || 'vertical',
    tipoFormatoCert: tipoFormato,
    tipoCertificado: tipoCert,
    generadoAutoPago: true,
    observaciones: 'Certificado emitido automáticamente al completar el pago del programa.',
    fechaEmision: fechaEm,
    fechaVencimiento: fechaVe,
    empresaId,
    empresaNombre,
  });

  return {
    creado: true,
    certificado: {
      ...cert.toObject(),
      programaDescr: prog?.descripcion || prog?.nombreProg || prog?.nomCert || null,
      nomCert: prog?.nomCert || null,
      tipoFormatoCert: tipoFormato,
      tipoFormatoCertLabel: TIPOS_LABEL[tipoFormato],
    },
  };
}

/**
 * Al anular un ingreso, los certificados vigentes ligados a esas liquidaciones
 * pasan a anulado para que el servicio pueda cobrarse y certificarse de nuevo.
 */
async function revertirCertificadosPorAnulacionIngreso({
  idsLiquidacion = [],
  req,
  supervisor = null,
  numDoc = null,
} = {}) {
  const ids = [...new Set((idsLiquidacion || []).map(String).filter(Boolean))];
  if (!ids.length) return { anulados: 0 };

  const { metadatosAnulacion } = require('./anulacionComprobante');
  const certs = await Certificado.find({
    idLiquidacion: { $in: ids },
    estado: { $ne: 'anulado' },
  });

  let anulados = 0;
  for (const c of certs) {
    c.set(
      metadatosAnulacion(req, supervisor, {
        motivo: `Anulado automáticamente por reversión del pago del alumno ${numDoc || ''}`.trim(),
      }),
    );
    c.estado = 'anulado';
    await c.save();
    anulados += 1;
  }
  return { anulados };
}

module.exports = { intentarCertificadoPagoAuto, revertirCertificadosPorAnulacionIngreso };
