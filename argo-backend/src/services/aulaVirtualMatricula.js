const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const DatosAlumno = require('../models/DatosAlumno');
const Liquidacion = require('../models/Liquidacion');
const UsuarioPortal = require('../models/UsuarioPortal');
const { parseNumDoc, numDocQuery } = require('../utils/numDoc');
const { TARIFA_VIRTUAL } = require('../constants/tarifa');
const { crearMatriculaDesdeBody } = require('./matriculaCreator');
const { asegurarSedePrincipal } = require('./sedeContext');
const { asegurarProgramaVirtual, puedeCursarVirtual, requierePagoParaCursar } = require('./aulaVirtualConfig');
const { obtenerCursoVirtual, configPorPrograma } = require('./aulaVirtualCatalogo');
const Matricula = require('../models/Matricula');
const {
  buscarPrograma,
  num,
  esCapacitacionVirtualServicio,
} = require('./programaServicio');
const { servicioMatriculaPrograma } = require('./aulaVirtualCatalogo');

const QUERY_MATRICULA_ACTIVA = { estado: { $regex: /^activo?a?$/i } };

async function buscarMatriculaVirtual(numDoc, idPrograma) {
  const idProg = String(idPrograma);
  const mats = await Matricula.find({
    ...numDocQuery(numDoc),
    idProg,
    ...QUERY_MATRICULA_ACTIVA,
  })
    .sort({ fechaMat: -1 })
    .lean();

  for (const m of mats) {
    if (Number(m.tarifa) === TARIFA_VIRTUAL) return m;
    const prog = await buscarPrograma(idProg);
    if (!prog) continue;
    const serv = await servicioMatriculaPrograma(prog);
    if (esCapacitacionVirtualServicio(serv)) return m;
  }
  return null;
}

function generarPasswordPortal() {
  return crypto.randomBytes(4).toString('hex');
}

async function resolverIdSedeVirtual() {
  const env = String(process.env.AULA_VIRTUAL_ID_SEDE || '').trim();
  if (env) return env;
  const sede = await asegurarSedePrincipal();
  return sede?.idSede || 'PRINCIPAL';
}

async function buscarLiquidacionVirtual(numDoc, idPrograma) {
  const idProg = String(idPrograma);
  const mats = await Matricula.find({
    ...numDocQuery(numDoc),
    idProg,
    estado: { $regex: /^activo?a?$/i },
  })
    .sort({ fechaMat: -1 })
    .lean();

  for (const m of mats) {
    const liq = await Liquidacion.findOne({ idMat: m._id, idProg }).sort({ fechaCreacion: -1 }).lean();
    if (liq) return liq;
  }
  return Liquidacion.findOne({ ...numDocQuery(numDoc), idProg })
    .sort({ fechaCreacion: -1 })
    .lean();
}

async function estadoPagoVirtual(numDoc, idPrograma) {
  const liq = await buscarLiquidacionVirtual(numDoc, idPrograma);
  if (!liq) {
    return {
      tieneLiquidacion: false,
      pagado: false,
      saldo: null,
      valor: null,
      estado: 'sin_liquidacion',
    };
  }
  const saldo = num(liq.saldo);
  const valor = num(liq.valor);
  const pagado = saldo <= 0.0001;
  let recibo = null;
  if (pagado) {
    const { reciboResumenPorLiquidacion } = require('./aulaVirtualRecibos');
    recibo = await reciboResumenPorLiquidacion(numDoc, liq._id);
  }
  return {
    tieneLiquidacion: true,
    pagado,
    saldo,
    valor,
    abonado: num(liq.abonado),
    estado: pagado ? 'pagado' : liq.estado || 'pendiente',
    idLiquidacion: String(liq._id),
    recibo,
  };
}

async function crearUsuarioPortalAlumno({ numDoc: numDocRaw, email, password }) {
  const numDoc = parseNumDoc(numDocRaw);
  if (numDoc == null) {
    const err = new Error('Documento inválido');
    err.status = 400;
    throw err;
  }

  const alumno = await DatosAlumno.findOne(numDocQuery(numDoc)).lean();
  if (!alumno) {
    const err = new Error('Alumno no encontrado en ARGO');
    err.status = 404;
    throw err;
  }

  const mail = String(email || alumno.correo || '').trim().toLowerCase();
  if (!mail) {
    const err = new Error('Indique el correo del alumno para crear acceso al portal');
    err.status = 400;
    throw err;
  }

  const existenteMail = await UsuarioPortal.findOne({ email: mail }).lean();
  if (existenteMail && Number(existenteMail.numDoc) !== numDoc) {
    const err = new Error('Ese correo ya está asociado a otro usuario del portal');
    err.status = 409;
    throw err;
  }

  const existenteDoc = await UsuarioPortal.findOne({ numDoc }).lean();
  if (existenteDoc && existenteMail && String(existenteDoc._id) !== String(existenteMail._id)) {
    const err = new Error('Conflicto de cuentas del portal para este documento');
    err.status = 409;
    throw err;
  }

  const pass = String(password || '').trim() || generarPasswordPortal();
  if (pass.length < 6) {
    const err = new Error('La contraseña debe tener al menos 6 caracteres');
    err.status = 400;
    throw err;
  }

  const passwordHash = await bcrypt.hash(pass, 10);
  let portal;
  let creado = false;
  const existente = existenteMail || existenteDoc;

  if (existente) {
    portal = await UsuarioPortal.findOneAndUpdate(
      { _id: existente._id },
      { $set: { email: mail, passwordHash, activo: true, numDoc } },
      { new: true },
    );
  } else {
    portal = await UsuarioPortal.create({ email: mail, passwordHash, numDoc });
    creado = true;
  }

  if (!alumno.correo) {
    await DatosAlumno.updateOne({ _id: alumno._id }, { $set: { correo: mail } });
  }

  return {
    creado,
    actualizado: !creado,
    email: portal.email,
    numDoc: portal.numDoc,
    passwordTemporal: password ? null : pass,
  };
}

async function matricularVirtual({
  numDoc: numDocRaw,
  idPrograma,
  observaciones,
  crearUsuarioPortal = false,
  email,
  password,
}) {
  const numDoc = parseNumDoc(numDocRaw);
  if (numDoc == null) {
    const err = new Error('Documento inválido');
    err.status = 400;
    throw err;
  }

  await asegurarProgramaVirtual(idPrograma);
  const curso = await obtenerCursoVirtual(idPrograma, { requierePublicado: false });
  if (!curso) {
    const err = new Error('Programa virtual no encontrado');
    err.status = 404;
    throw err;
  }

  const matriculaExistente = await buscarMatriculaVirtual(numDoc, idPrograma);
  if (matriculaExistente) {
    const pago = await estadoPagoVirtual(numDoc, idPrograma);
    return {
      yaMatriculado: true,
      matricula: matriculaExistente,
      pago,
      curso: { idPrograma: curso.idPrograma, nombreProg: curso.nombreProg },
      message: 'El alumno ya está matriculado en este curso',
    };
  }

  const alumno = await DatosAlumno.findOne(numDocQuery(numDoc)).lean();
  if (!alumno) {
    const err = new Error('El alumno debe existir en ARGO (regístrelo en Alumnos o en el portal)');
    err.status = 404;
    throw err;
  }

  const idSede = await resolverIdSedeVirtual();
  const result = await crearMatriculaDesdeBody(
    {
      numDoc,
      idPrograma,
      tarifa: TARIFA_VIRTUAL,
      idSede,
      observaciones: observaciones || 'Matrícula virtual — portal aula',
      origenMatricula: 'portal',
    },
    idSede,
    { desdePortal: true },
  );

  let usuarioPortal = null;
  if (crearUsuarioPortal) {
    usuarioPortal = await crearUsuarioPortalAlumno({
      numDoc,
      email: email || alumno.correo,
      password,
    });
  }

  const pago = await estadoPagoVirtual(numDoc, idPrograma);
  const cfg = (await configPorPrograma(idPrograma)) || {};
  const exigePago = requierePagoParaCursar(cfg);

  return {
    yaMatriculado: false,
    matricula: result.matricula,
    liquidacion: result.liquidacion,
    liquidaciones: result.liquidaciones,
    pago,
    usuarioPortal,
    curso: {
      idPrograma: curso.idPrograma,
      nombreProg: curso.nombreProg,
      requierePagoParaCursar: exigePago,
    },
    message: exigePago
      ? 'Matrícula creada. Complete el pago para acceder al contenido del curso.'
      : 'Matrícula virtual creada. El alumno puede cursar; el certificado requiere pago.',
  };
}

async function estadoInscripcionVirtual(numDoc, idPrograma) {
  const curso = await obtenerCursoVirtual(idPrograma, { requierePublicado: true });
  if (!curso) {
    const err = new Error('Curso no encontrado o no publicado');
    err.status = 404;
    throw err;
  }

  const matricula = await buscarMatriculaVirtual(numDoc, idPrograma);
  const pago = matricula ? await estadoPagoVirtual(numDoc, idPrograma) : null;
  const cfg = (await configPorPrograma(idPrograma)) || {};
  const exigePago = requierePagoParaCursar(cfg);
  const puedeCursar = puedeCursarVirtual({
    cfg,
    tienePaquete: !!curso.tienePaquete,
    matriculado: !!matricula,
    pago,
  });

  return {
    matriculado: !!matricula,
    matricula: matricula
      ? {
          fechaMat: matricula.fechaMat,
          pagada: matricula.pagada,
          tarifa: matricula.tarifa,
        }
      : null,
    pago,
    puedeCursar,
    accesoBloqueadoPago: !!(matricula && exigePago && pago && !pago.pagado),
    puedeCertificarse: !!(matricula && pago?.pagado),
    certificadoPendientePago: !!(matricula && pago && !pago.pagado),
    curso: {
      idPrograma: curso.idPrograma,
      nombreProg: curso.nombreProg,
      tarifaVirtual: curso.tarifaVirtual,
      modoCertificado: curso.modoCertificado,
      requierePagoParaCursar: exigePago,
      tienePaquete: curso.tienePaquete,
    },
  };
}

module.exports = {
  generarPasswordPortal,
  resolverIdSedeVirtual,
  buscarLiquidacionVirtual,
  estadoPagoVirtual,
  crearUsuarioPortalAlumno,
  matricularVirtual,
  estadoInscripcionVirtual,
  buscarMatriculaVirtual,
};
