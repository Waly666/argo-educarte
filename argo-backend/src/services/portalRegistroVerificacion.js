const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const RegistroPortalPendiente = require('../models/RegistroPortalPendiente');
const { sendMail } = require('./mail');
const { validarDatosRegistroPortal, crearCuentaPortal, maskEmail } = require('./aulaVirtualAuth');
const { portalEmailVerifyEnabled } = require('../config/security');
const { obtenerConfigAula } = require('./aulaVirtualPortal');

const CODE_TTL_MS = 15 * 60 * 1000;
const MAX_INTENTOS = 5;

function generarCodigo() {
  return String(crypto.randomInt(100000, 999999));
}

function ttlMinutos() {
  return Math.round(CODE_TTL_MS / 60000);
}

async function enviarCodigoRegistro({ email, codigo, nombreCea }) {
  const cea = nombreCea || 'Finstruvial';
  const subject = `${cea} — Código para confirmar su registro`;
  const text = [
    `Hola,`,
    ``,
    `Su código para confirmar el registro en el aula virtual de ${cea} es:`,
    ``,
    `  ${codigo}`,
    ``,
    `El código vence en ${ttlMinutos()} minutos. Si no solicitó este registro, ignore este mensaje.`,
  ].join('\n');
  const html = `
    <p>Hola,</p>
    <p>Su código para confirmar el registro en el aula virtual de <strong>${cea}</strong> es:</p>
    <p style="font-size:1.5rem;font-weight:bold;letter-spacing:0.2em">${codigo}</p>
    <p>El código vence en ${ttlMinutos()} minutos. Si no solicitó este registro, ignore este mensaje.</p>
  `.trim();

  const aula = await obtenerConfigAula().catch(() => null);
  const fromCustom = aula?.emailConfirmacion?.trim() || null;
  const fromHeader = fromCustom ? `"${cea}" <${fromCustom}>` : undefined;

  await sendMail({ to: email, subject, text, html, from: fromHeader });
}

async function solicitarRegistroPortal({ email, password, alumno, nombreCea }) {
  if (!portalEmailVerifyEnabled()) {
    const err = new Error('Verificación de correo desactivada');
    err.status = 400;
    throw err;
  }

  const datos = await validarDatosRegistroPortal({ email, password, alumno });
  const codigo = generarCodigo();
  const codeHash = await bcrypt.hash(codigo, 10);
  const passwordHash = await bcrypt.hash(datos.pass, 10);
  const pendingId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);

  await RegistroPortalPendiente.deleteMany({
    $or: [{ email: datos.mail }, { numDoc: datos.numDoc }],
  });

  await RegistroPortalPendiente.create({
    pendingId,
    email: datos.mail,
    passwordHash,
    numDoc: datos.numDoc,
    alumno: datos.alumnoPayload,
    codeHash,
    expiresAt,
  });

  await enviarCodigoRegistro({ email: datos.mail, codigo, nombreCea });

  return {
    step: 'verify_email',
    pendingId,
    email: maskEmail(datos.mail),
    expiresInMinutes: ttlMinutos(),
    message: `Enviamos un código de verificación a ${maskEmail(datos.mail)}. Revise su bandeja de entrada y spam.`,
  };
}

async function confirmarRegistroPortal({ pendingId, codigo }) {
  const id = String(pendingId || '').trim();
  const code = String(codigo || '').trim();
  if (!id || !/^\d{6}$/.test(code)) {
    const err = new Error('Código de verificación inválido');
    err.status = 400;
    throw err;
  }

  const pending = await RegistroPortalPendiente.findOne({ pendingId: id });
  if (!pending) {
    const err = new Error('Solicitud de registro expirada o no encontrada. Vuelva a iniciar el registro.');
    err.status = 404;
    throw err;
  }

  if (pending.expiresAt.getTime() < Date.now()) {
    await RegistroPortalPendiente.deleteOne({ _id: pending._id });
    const err = new Error('El código expiró. Solicite uno nuevo.');
    err.status = 410;
    throw err;
  }

  if (pending.intentosConfirmacion >= MAX_INTENTOS) {
    await RegistroPortalPendiente.deleteOne({ _id: pending._id });
    const err = new Error('Demasiados intentos fallidos. Inicie el registro de nuevo.');
    err.status = 429;
    throw err;
  }

  const ok = await bcrypt.compare(code, pending.codeHash);
  if (!ok) {
    pending.intentosConfirmacion += 1;
    await pending.save();
    const err = new Error('Código incorrecto');
    err.status = 400;
    throw err;
  }

  const out = await crearCuentaPortal({
    email: pending.email,
    passwordHash: pending.passwordHash,
    alumno: pending.alumno,
  });

  await RegistroPortalPendiente.deleteOne({ _id: pending._id });
  return out;
}

async function reenviarCodigoRegistro({ pendingId, nombreCea }) {
  const id = String(pendingId || '').trim();
  if (!id) {
    const err = new Error('Solicitud de registro no válida');
    err.status = 400;
    throw err;
  }

  const pending = await RegistroPortalPendiente.findOne({ pendingId: id });
  if (!pending) {
    const err = new Error('Solicitud de registro expirada. Inicie el registro de nuevo.');
    err.status = 404;
    throw err;
  }

  const codigo = generarCodigo();
  pending.codeHash = await bcrypt.hash(codigo, 10);
  pending.expiresAt = new Date(Date.now() + CODE_TTL_MS);
  pending.intentosConfirmacion = 0;
  await pending.save();

  await enviarCodigoRegistro({ email: pending.email, codigo, nombreCea });

  return {
    step: 'verify_email',
    pendingId: pending.pendingId,
    email: maskEmail(pending.email),
    expiresInMinutes: ttlMinutos(),
    message: `Nuevo código enviado a ${maskEmail(pending.email)}.`,
  };
}

module.exports = {
  solicitarRegistroPortal,
  confirmarRegistroPortal,
  reenviarCodigoRegistro,
};
