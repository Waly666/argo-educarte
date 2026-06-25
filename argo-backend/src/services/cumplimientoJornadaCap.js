const mongoose = require('mongoose');
const Certificado = require('../models/Certificado');

function oid(v) {
  if (!v) return null;
  if (v instanceof mongoose.Types.ObjectId) return v;
  try {
    return new mongoose.Types.ObjectId(String(v));
  } catch {
    return null;
  }
}

/** Alumnos distintos con certificado vigente en el contrato. */
async function contarCertificadosVigentesContrato(idContratoRaw) {
  const idContrato = oid(idContratoRaw);
  if (!idContrato) return 0;
  const nums = await Certificado.distinct('numDoc', {
    idContrato,
    estado: { $ne: 'anulado' },
  });
  return nums.length;
}

/** Alumnos distintos certificados atribuidos a la jornada (idJornada al emitir). */
async function contarCertificadosVigentesJornada(idJornadaRaw) {
  const idJornada = oid(idJornadaRaw);
  if (!idJornada) return 0;
  const nums = await Certificado.distinct('numDoc', {
    idJornada,
    estado: { $ne: 'anulado' },
  });
  return nums.length;
}

async function cumplimientoParaJornada(jornada, contrato) {
  const metaContrato = Math.max(0, parseInt(contrato?.numeroAlumnos, 10) || 0);
  const metaJornada = Math.max(0, parseInt(jornada?.numeObjeJornada, 10) || 0);
  const certificadosContrato = await contarCertificadosVigentesContrato(jornada?.idContrato);
  const certificadosJornada = await contarCertificadosVigentesJornada(jornada?._id);

  return {
    numeroAlumnos: metaContrato,
    certificadosContrato,
    cumplidoContrato: metaContrato > 0 && certificadosContrato >= metaContrato,
    certificadosJornada,
    cumplidoJornada: metaJornada > 0 && certificadosJornada >= metaJornada,
  };
}

module.exports = {
  contarCertificadosVigentesContrato,
  contarCertificadosVigentesJornada,
  cumplimientoParaJornada,
};
