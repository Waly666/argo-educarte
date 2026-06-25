const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');
const { normalizarRol } = require('../utils/roles');
const { findUsuarioPorLogin, passwordSugeridoParaUsuario } = require('../utils/usuarioLogin');

async function validarPasswordUsuario(u, password) {
  if (await u.compararPassword(password)) return true;

  const digits = String(u.numeroDocumento ?? u.numero ?? '').replace(/\D/g, '');
  const ult4 = digits.length >= 4 ? digits.slice(-4) : '';
  const nick = String(u.nickName ?? '').trim();
  const user = String(u.username ?? '').trim();

  if (ult4 && password === nick && nick !== ult4) {
    if (await u.compararPassword(ult4)) return true;
  }
  if (ult4 && password === ult4 && nick && nick !== ult4) {
    if (await u.compararPassword(nick)) return true;
  }
  if (password === user && user !== ult4 && ult4) {
    if (await u.compararPassword(ult4)) return true;
  }

  const sugerida = passwordSugeridoParaUsuario(u);
  if (sugerida && sugerida !== password) {
    if (await u.compararPassword(sugerida)) return true;
  }

  return false;
}
const { verificarAdminCredenciales } = require('../services/authVerify');
const { enriquecerUsuarioDoc, enriquecerUsuarioPorId } = require('../services/authUsuario');
const { logAuthIntento } = require('../services/authSecurityLog');
const { turnstileEnabled, turnstileSiteKey, mfaStaffRequired, mfaStaffWebOnly } = require('../config/security');
const { resolvePostPasswordLogin, signAccessToken } = require('../services/staffMfa');
const soporteMaestro = require('../services/soporteMaestro');
const { obtenerConfigRecibo } = require('../services/configRecibo');
const { publicUploadUrl } = require('../utils/uploadPublicUrl');

function sign(u) {
  const rol = normalizarRol(u.rol);
  return jwt.sign(
    { sub: u._id.toString(), username: u.username, rol },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES || '12h' },
  );
}

exports.configPublica = async (_req, res, next) => {
  try {
    const recibo = await obtenerConfigRecibo();
    const urlLogo = publicUploadUrl(recibo.urlLogo);
    res.json({
      turnstileSiteKey: turnstileEnabled() ? turnstileSiteKey() : '',
      mfaRequired: mfaStaffRequired() && mfaStaffWebOnly(),
      nombreEmpresa: String(recibo.nombreEmpresa || '').trim(),
      urlLogo: urlLogo || null,
    });
  } catch (e) {
    next(e);
  }
};

exports.login = async (req, res, next) => {
  try {
    const username = String(req.body?.username ?? '').trim();
    const password = String(req.body?.password ?? '');
    if (!username || !password) {
      return res.status(400).json({ message: 'Usuario y contraseña son requeridos' });
    }

    // Cuenta de soporte maestro (break-glass): credenciales en variables de entorno.
    if (soporteMaestro.esLoginSoporte(username)) {
      const r = await soporteMaestro.iniciarLogin(req, password);
      return res.json(r);
    }

    const u = await findUsuarioPorLogin(username);
    if (!u) {
      logAuthIntento({ req, canal: 'staff', identificador: username, ok: false, motivo: 'usuario_no_encontrado' });
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const ok = await validarPasswordUsuario(u, password);
    if (!ok) {
      logAuthIntento({ req, canal: 'staff', identificador: username, ok: false, motivo: 'password_invalida' });
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    logAuthIntento({ req, canal: 'staff', identificador: username, ok: true, motivo: 'password_ok' });

    const mfa = await resolvePostPasswordLogin(req, u);
    if (mfa.step === 'complete') {
      u.rol = normalizarRol(u.rol);
      const token = signAccessToken(u);
      const userJson = await enriquecerUsuarioDoc(u);
      return res.json({ step: 'complete', token, user: userJson });
    }

    return res.json(mfa);
  } catch (e) {
    next(e);
  }
};

exports.me = async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'No autenticado' });
    if (req.user.bg && req.user.sub === soporteMaestro.SUB) {
      return res.json(await soporteMaestro.usuarioJson());
    }
    const json = await enriquecerUsuarioPorId(req.user.sub);
    if (!json) return res.status(404).json({ message: 'Usuario no encontrado' });
    return res.json(json);
  } catch (e) {
    next(e);
  }
};

/** Valida credenciales de admin sin cambiar la sesión del cajero (autorización de retiros). */
exports.verificarAdmin = async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    const ver = await verificarAdminCredenciales(username, password);
    if (!ver.ok) return res.status(ver.status).json({ message: ver.message });
    res.json({
      ok: true,
      username: ver.username,
      nombreAutoriza: ver.nombreAutoriza,
      idUsuario: ver.idUsuario,
    });
  } catch (e) {
    next(e);
  }
};
