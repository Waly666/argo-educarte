const Certificado = require('../models/Certificado');
const Liquidacion = require('../models/Liquidacion');
const DatosAlumno = require('../models/DatosAlumno');
const Cliente     = require('../models/Cliente');
const { models: cat } = require('../models/catalogos');
const { normalizarTipoRegularJornada } = require('../constants/tipoRegularJornada');
const { parseNumDoc, numDocQuery } = require('../utils/numDoc');
const { buscarPrograma } = require('./programaServicio');
const { obtenerConfigCertificado, siguienteCodigoCertificado } = require('./configCertificado');
const {
  clasificarProgramaAsync,
  etiquetaIdTipCap,
  TIPOS_LABEL,
} = require('./clasificacionCertificado');
const { resolverPlantillaImpresion } = require('./plantillaCertificado');
const { configPorPrograma } = require('./aulaVirtualCatalogo');

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

async function buscarLiquidacionPagada(numDoc, idProg) {
  const q = { ...numDocQuery(numDoc), idProg: String(idProg) };
  const liqs = await Liquidacion.find(q).sort({ fechaCreacion: -1 }).lean();
  return liqs.find((l) => num(l.saldo) <= 0.0001) || null;
}

/**
 * Emite certificado al aprobar curso virtual (modoCertificado = al_aprobar).
 * Reutiliza plantillas y numeración de ARGO; nunca lanza.
 */
async function intentarCertificadoVirtualAprobar({ numDoc: numDocRaw, idPrograma } = {}) {
  const numDoc = parseNumDoc(numDocRaw);
  const idProg = String(idPrograma || '').trim();
  if (numDoc == null) return { creado: false, motivo: 'numDoc_invalido' };
  if (!idProg) return { creado: false, motivo: 'sin_programa' };

  const cfgVirtual = await configPorPrograma(idProg);
  if (!cfgVirtual || cfgVirtual.modoCertificado !== 'al_aprobar') {
    return { creado: false, motivo: 'modo_no_al_aprobar' };
  }

  const { evaluarAprobacion } = require('./aulaVirtualProgreso');
  const estado = await evaluarAprobacion(numDoc, idProg);
  if (!estado.aprobado) return { creado: false, motivo: 'no_aprobado', estado };

  const liq = await buscarLiquidacionPagada(numDoc, idProg);
  if (!liq) return { creado: false, motivo: 'sin_liquidacion_pagada' };

  const prog = await buscarPrograma(idProg);
  if (!prog) return { creado: false, motivo: 'programa_no_encontrado' };

  const tipoFormato = await clasificarProgramaAsync(prog, cat.catTipoCapacitacion);
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

  const dupProg = await Certificado.findOne({
    ...numDocQuery(numDoc),
    idProg,
    estado: { $ne: 'anulado' },
    generadoAutoVirtual: true,
  }).lean();
  if (dupProg) return { creado: false, motivo: 'ya_certificado', certificado: dupProg };

  const plantilla = await resolverPlantillaImpresion(cfg, tipoFormato, null);
  if (!plantilla) {
    console.warn(
      `[certificadoVirtualAuto] Sin plantilla para «${TIPOS_LABEL[tipoFormato]}»; configúrela en Config. Certificados.`,
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
    idProg,
    codigoCert,
    encabezado,
    idPlantilla: plantilla._id,
    orientacion: plantilla.orientacion || 'vertical',
    tipoFormatoCert: tipoFormato,
    tipoCertificado: tipoCert,
    generadoAutoVirtual: true,
    observaciones: `Certificado emitido automáticamente al aprobar el curso virtual (nota ${estado.mejorNotaEval}%, completitud ${estado.pctCompletitud}%).`,
    fechaEmision: fechaEm,
    fechaVencimiento: fechaVe,
    empresaId,
    empresaNombre,
  });

  const ProgresoVirtualCurso = require('../models/ProgresoVirtualCurso');
  await ProgresoVirtualCurso.updateOne(
    { numDoc, idPrograma: idProg },
    { $set: { certificadoEmitido: true } },
  );

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

module.exports = { intentarCertificadoVirtualAprobar, buscarLiquidacionPagada };
