const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const DatosAlumno = require('../models/DatosAlumno');
const UsuarioPortal = require('../models/UsuarioPortal');
const { parseNumDoc, numDocQuery } = require('../utils/numDoc');
const { TIPO_VIRTUAL } = require('../constants/tipoAlumno');

const PORTAL_TIPO = 'portal';

function jwtSecret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET no configurado');
  return s;
}

function signPortalToken(user) {
  return jwt.sign(
    {
      sub: String(user.numDoc),
      email: user.email,
      tipo: PORTAL_TIPO,
    },
    jwtSecret(),
    { expiresIn: process.env.JWT_PORTAL_EXPIRES || process.env.JWT_EXPIRES || '7d' },
  );
}

function verifyPortalToken(token) {
  const payload = jwt.verify(token, jwtSecret());
  if (payload.tipo !== PORTAL_TIPO) {
    const err = new Error('Token no válido para portal');
    err.status = 401;
    throw err;
  }
  return payload;
}

function nombreCompletoAlumno(da) {
  if (!da) return '';
  return [da.apellido1, da.apellido2, da.nombre1, da.nombre2].filter(Boolean).join(' ').trim();
}

function maskEmail(email) {
  const mail = String(email || '').trim().toLowerCase();
  if (!mail || !mail.includes('@')) return null;
  const [user, domain] = mail.split('@');
  if (!domain) return null;
  if (user.length <= 1) return `*@${domain}`;
  if (user.length === 2) return `${user[0]}*@${domain}`;
  return `${user[0]}***${user.slice(-1)}@${domain}`;
}

/** Datos mínimos expuestos al registrar (sin PII de contacto). */
function mapAlumnoPublico(da) {
  if (!da) return null;
  return {
    numDoc: da.numDoc,
    tipoDoc: da.tipoDoc || '1',
    expedida: da.expedida || '',
    apellido1: da.apellido1 || '',
    apellido2: da.apellido2 || '',
    nombre1: da.nombre1 || '',
    nombre2: da.nombre2 || '',
    genero: da.genero || '',
    fechaNac: da.fechaNac ? new Date(da.fechaNac).toISOString().slice(0, 10) : '',
    codMunicipio: da.codMunicipio || da.munOrigen || '',
    munOrigen: da.munOrigen || da.codMunicipio || '',
    nombreCompleto: nombreCompletoAlumno(da),
    tieneCorreoEnArgo: !!String(da.correo || '').trim(),
  };
}

/** Consulta ficha ARGO por documento (para registro en portal). */
async function buscarAlumnoRegistro(numDocRaw) {
  const numDoc = parseNumDoc(numDocRaw);
  if (numDoc == null) {
    const err = new Error('Número de documento inválido');
    err.status = 400;
    throw err;
  }
  const [da, portal] = await Promise.all([
    DatosAlumno.findOne(numDocQuery(numDoc)).lean(),
    UsuarioPortal.findOne({ numDoc }).lean(),
  ]);
  return {
    numDoc,
    existeEnArgo: !!da,
    tieneCuentaPortal: !!portal,
    emailPortal: maskEmail(portal?.email),
    alumno: mapAlumnoPublico(da),
  };
}

function nombreMayusculas(v) {
  return String(v || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

function buildAlumnoPayload(alumno, numDoc) {
  return {
    numDoc,
    tipoDoc: alumno?.tipoDoc || '1',
    expedida: alumno?.expedida || '',
    empresaId: alumno?.empresaId || null,
    apellido1: nombreMayusculas(alumno?.apellido1),
    apellido2: nombreMayusculas(alumno?.apellido2),
    nombre1: nombreMayusculas(alumno?.nombre1),
    nombre2: nombreMayusculas(alumno?.nombre2),
    fechaNac: alumno?.fechaNac || '',
    genero: alumno?.genero || '',
    celular: alumno?.celular || '',
    direccion: alumno?.direccion || '',
    munOrigen: alumno?.munOrigen || '',
    codMunicipio: alumno?.codMunicipio || '',
  };
}

/** Valida email, contraseña y documento antes de crear cuenta o enviar código. */
async function validarDatosRegistroPortal({ email, password, alumno }) {
  const mail = String(email || '').trim().toLowerCase();
  const pass = String(password || '');
  if (!mail || !pass || pass.length < 6) {
    const err = new Error('Email y contraseña (mín. 6 caracteres) son obligatorios');
    err.status = 400;
    throw err;
  }

  const numDoc = parseNumDoc(alumno?.numDoc);
  if (numDoc == null) {
    const err = new Error('Número de documento inválido');
    err.status = 400;
    throw err;
  }

  const portalDoc = await UsuarioPortal.findOne({ numDoc }).lean();
  if (portalDoc) {
    const err = new Error(
      'Este documento ya tiene cuenta en el portal. Use «Acceder» con su correo o solicite restablecer contraseña.',
    );
    err.status = 409;
    throw err;
  }

  const dupMail = await UsuarioPortal.findOne({ email: mail }).lean();
  if (dupMail) {
    const err = new Error('Ya existe una cuenta con ese correo');
    err.status = 409;
    throw err;
  }

  const da = await DatosAlumno.findOne(numDocQuery(numDoc)).lean();
  if (!da) {
    const payload = buildAlumnoPayload(alumno, numDoc);
    if (!payload.apellido1 || !payload.nombre1) {
      const err = new Error('Apellido y nombre son obligatorios para alumnos nuevos');
      err.status = 400;
      throw err;
    }
    return { mail, pass, numDoc, alumnoPayload: payload, alumnoExistente: false };
  }

  return {
    mail,
    pass,
    numDoc,
    alumnoPayload: buildAlumnoPayload(alumno, numDoc),
    alumnoExistente: true,
  };
}

/** Crea ficha alumno (si aplica) y cuenta portal. passwordHash ya hasheado. */
async function crearCuentaPortal({ email, passwordHash, alumno }) {
  const mail = String(email || '').trim().toLowerCase();
  const numDoc = parseNumDoc(alumno?.numDoc);
  if (numDoc == null) {
    const err = new Error('Número de documento inválido');
    err.status = 400;
    throw err;
  }

  let da = await DatosAlumno.findOne(numDocQuery(numDoc)).lean();
  let alumnoExistente = !!da;

  const empresaIdValido = alumno.empresaId && mongoose.isValidObjectId(alumno.empresaId)
    ? alumno.empresaId
    : null;

  if (!da) {
    da = await DatosAlumno.create({
      tipoAlumno: TIPO_VIRTUAL,
      tipoDoc: alumno.tipoDoc || '1',
      numDoc,
      expedida: alumno.expedida || '',
      apellido1: nombreMayusculas(alumno.apellido1),
      apellido2: nombreMayusculas(alumno.apellido2),
      nombre1: nombreMayusculas(alumno.nombre1),
      nombre2: nombreMayusculas(alumno.nombre2),
      fechaNac: alumno.fechaNac ? new Date(alumno.fechaNac) : null,
      genero: alumno.genero || '',
      correo: mail,
      celular: alumno.celular || '',
      direccion: alumno.direccion || '',
      munOrigen: alumno.munOrigen || '',
      codMunicipio: alumno.codMunicipio || '',
      empresaId: empresaIdValido,
      userAddReg: 'portal',
    });
    da = da.toObject();
    alumnoExistente = false;
  } else {
    const patch = {};
    if (!da.correo) patch.correo = mail;
    if (!da.celular && alumno.celular) patch.celular = String(alumno.celular).trim();
    if (!da.direccion && alumno.direccion) patch.direccion = String(alumno.direccion).trim();
    if (empresaIdValido && !da.empresaId) patch.empresaId = empresaIdValido;
    if (Object.keys(patch).length) {
      await DatosAlumno.updateOne({ _id: da._id }, { $set: patch });
      da = { ...da, ...patch };
    }
  }

  const portal = await UsuarioPortal.create({
    email: mail,
    passwordHash,
    numDoc,
  });

  const token = signPortalToken(portal);

  let regEmpresaId = null;
  let regEmpresaNombre = null;
  if (da?.empresaId) {
    const Cliente = require('../models/Cliente');
    regEmpresaId = String(da.empresaId);
    const cli = await Cliente.findById(da.empresaId, { razonSocial: 1, nombres: 1, nombreComercial: 1, identificacion: 1 }).lean();
    if (cli) regEmpresaNombre = cli.razonSocial?.trim() || cli.nombreComercial?.trim() || cli.nombres?.trim() || cli.identificacion || null;
  }

  return {
    token,
    usuario: { email: portal.email, numDoc: portal.numDoc },
    alumno: {
      numDoc,
      nombreCompleto: nombreCompletoAlumno(da),
      empresaId: regEmpresaId,
      empresaNombre: regEmpresaNombre,
    },
    alumnoExistente,
    message: alumnoExistente
      ? 'Cuenta del portal creada con los datos ya registrados en ARGO'
      : 'Cuenta y ficha de alumno creadas',
  };
}

async function registrarPortal({ email, password, alumno }) {
  const datos = await validarDatosRegistroPortal({ email, password, alumno });
  const passwordHash = await bcrypt.hash(datos.pass, 10);
  return crearCuentaPortal({
    email: datos.mail,
    passwordHash,
    alumno: datos.alumnoPayload,
  });
}

async function loginPortal({ email, password }) {
  const mail = String(email || '').trim().toLowerCase();
  const pass = String(password || '');
  if (!mail || !pass) {
    const err = new Error('Email y contraseña son obligatorios');
    err.status = 400;
    throw err;
  }

  const portal = await UsuarioPortal.findOne({ email: mail });
  if (!portal || !portal.activo) {
    const err = new Error('Credenciales inválidas');
    err.status = 401;
    throw err;
  }

  const ok = await bcrypt.compare(pass, portal.passwordHash);
  if (!ok) {
    const err = new Error('Credenciales inválidas');
    err.status = 401;
    throw err;
  }

  portal.ultimoAcceso = new Date();
  await portal.save();

  const da = await DatosAlumno.findOne(numDocQuery(portal.numDoc)).lean();
  const token = signPortalToken(portal);

  let empresaId = null;
  let empresaNombre = null;
  if (da?.empresaId) {
    const Cliente = require('../models/Cliente');
    empresaId = String(da.empresaId);
    const cli = await Cliente.findById(da.empresaId, { razonSocial: 1, nombres: 1, nombreComercial: 1, identificacion: 1 }).lean();
    if (cli) empresaNombre = cli.razonSocial?.trim() || cli.nombreComercial?.trim() || cli.nombres?.trim() || cli.identificacion || null;
  }

  return {
    token,
    usuario: { email: portal.email, numDoc: portal.numDoc },
    alumno: da
      ? {
          numDoc: portal.numDoc,
          nombreCompleto: [da.apellido1, da.apellido2, da.nombre1, da.nombre2].filter(Boolean).join(' '),
          empresaId,
          empresaNombre,
        }
      : { numDoc: portal.numDoc, nombreCompleto: '' },
  };
}

module.exports = {
  PORTAL_TIPO,
  signPortalToken,
  verifyPortalToken,
  maskEmail,
  buscarAlumnoRegistro,
  validarDatosRegistroPortal,
  crearCuentaPortal,
  registrarPortal,
  loginPortal,
};
