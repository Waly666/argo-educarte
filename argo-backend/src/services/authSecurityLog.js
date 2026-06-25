const fs = require('fs');
const path = require('path');
const { registrarAuditoria } = require('./auditoria');

function clientIp(req) {
  const xf = req?.get?.('x-forwarded-for') || req?.headers?.['x-forwarded-for'];
  if (xf) return String(xf).split(',')[0].trim();
  return req?.ip || null;
}

function maskId(value) {
  const v = String(value || '').trim();
  if (!v) return '';
  if (v.length <= 2) return '**';
  if (v.includes('@')) {
    const [u, d] = v.split('@');
    return `${u.slice(0, 1)}***@${d}`;
  }
  return `${v.slice(0, 2)}***`;
}

/**
 * Registra intentos de login (éxito/fallo) en consola, archivo y auditoría.
 * @param {'staff'|'portal'} canal
 */
function logAuthIntento({ req, canal, identificador, ok, motivo }) {
  const ip = clientIp(req);
  const masked = maskId(identificador);
  const resumen = ok
    ? `Login ${canal} exitoso (${masked})`
    : `Login ${canal} fallido (${masked})${motivo ? `: ${motivo}` : ''}`;

  console.warn(`[ARGO AUTH] ${resumen} ip=${ip || '?'}`);

  try {
    const logsDir = path.join(__dirname, '..', '..', 'logs', 'auth');
    fs.mkdirSync(logsDir, { recursive: true });
    const dia = new Date().toISOString().slice(0, 10);
    fs.appendFileSync(
      path.join(logsDir, `auth-${dia}.log`),
      `${JSON.stringify({ ts: new Date().toISOString(), canal, identificador: masked, ok, ip, motivo: motivo || null })}\n`,
    );
  } catch {
    /* ignore */
  }

  if (!ok && req) {
    setImmediate(() => {
      registrarAuditoria({
        req: { ...req, user: { username: 'anon', sub: null, rol: null } },
        accion: 'login_fallido',
        entidad: canal === 'portal' ? 'aula_virtual' : 'auth',
        resumen,
        payload: { identificador: masked },
        codigoHttp: 401,
        metodo: 'POST',
        ruta: req.originalUrl || req.url,
      }).catch(() => {});
    });
  }
}

module.exports = { logAuthIntento, maskId, clientIp };
