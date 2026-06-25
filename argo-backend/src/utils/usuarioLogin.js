const Usuario = require('../models/Usuario');

function escaparRegex(texto) {
  return String(texto).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function filtroActivo() {
  return { $or: [{ activo: true }, { activo: { $exists: false } }, { activo: null }] };
}

/**
 * Busca usuario activo por username, nickName, número de documento o campo numero.
 * Acepta documento completo, nick (jose, waly666) o login (jose.sanchez).
 */
async function findUsuarioPorLogin(login) {
  const raw = String(login ?? '').trim();
  const key = raw.toLowerCase();
  if (!key) return null;

  const or = [
    { username: key },
    { username: new RegExp(`^${escaparRegex(key)}$`, 'i') },
    { nickName: key },
    { nickName: new RegExp(`^${escaparRegex(key)}$`, 'i') },
    { loginAliases: key },
    { numeroDocumento: raw },
    { numeroDocumento: key },
  ];

  const soloDigitos = key.replace(/\D/g, '');
  if (soloDigitos) {
    or.push({ username: soloDigitos });
    or.push({ numeroDocumento: soloDigitos });
    const num = Number(soloDigitos);
    if (Number.isFinite(num)) {
      or.push({ numero: num });
    }
    if (soloDigitos !== key) {
      or.push({ nickName: new RegExp(`^${escaparRegex(soloDigitos)}$`, 'i') });
    }
  }

  const u = await Usuario.findOne({
    $and: [filtroActivo(), { $or: or }],
  });

  return u;
}

/** Contraseña legible para entregar al usuario (últimos 4 del doc, o nick, o username). */
function passwordSugeridoParaUsuario(u) {
  const o = u?.toObject ? u.toObject() : u || {};
  if (String(o.username || '').toLowerCase() === 'admin') return 'admin123';
  if (String(o.username || '').toLowerCase() === 'waly') return 'waly666';
  const digits = String(o.numeroDocumento ?? o.numero ?? '').replace(/\D/g, '');
  if (digits.length >= 4) return digits.slice(-4);
  const nick = String(o.nickName ?? '').trim();
  if (nick) return nick;
  return String(o.username ?? '').trim() || 'argo1';
}

module.exports = { findUsuarioPorLogin, passwordSugeridoParaUsuario, filtroActivo };
