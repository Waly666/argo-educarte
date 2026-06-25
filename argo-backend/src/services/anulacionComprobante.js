const { esAdmin } = require('../utils/roles');
const { exigirAdminOSupervisor, verificarAdminCredenciales } = require('./authVerify');
const { requiereAutorizacionAnularMovimiento } = require('./cajaSesion');

/**
 * Gate unificado para anular comprobantes (ingresos, egresos, certificados, etc.).
 *
 * Reglas:
 * - Administrador en su sesión de caja abierta: autoriza directo.
 * - Administrador fuera de su sesión / sin caja abierta: re-autenticación admin
 *   (usuario + contraseña en el body), igual que antes.
 * - Usuario NO administrador (cajero): SIEMPRE requiere credenciales de un
 *   administrador. La autorización del admin habilita la anulación aunque el
 *   comprobante pertenezca a otra sesión de caja: por eso ya NO se bloquea por
 *   propiedad de sesión (esa verificación devolvía 403 antes de validar la
 *   contraseña del admin).
 *
 * Devuelve `{ ok: true, supervisor }` o `{ ok:false, status, message, code }`.
 */
async function autorizarAnulacionComprobante(req, idSesion, mensaje) {
  if (!esAdmin(req.user?.rol)) {
    const auth = await exigirAdminOSupervisor(
      req,
      mensaje || 'Anular este comprobante requiere autorización de un administrador.',
    );
    if (!auth.ok) {
      return {
        ok: false,
        status: auth.status,
        message: auth.message,
        code: auth.code || 'SUPERVISOR_AUTH_REQUIRED',
      };
    }
    return { ok: true, supervisor: auth.supervisor };
  }

  // Administrador: solo re-autentica si el movimiento es de otra sesión o no tiene caja abierta.
  if (await requiereAutorizacionAnularMovimiento(req, idSesion)) {
    const { autorizadoUsername, autorizadoPassword } = req.body || {};
    const ver = await verificarAdminCredenciales(autorizadoUsername, autorizadoPassword);
    if (!ver.ok) {
      return {
        ok: false,
        status: ver.status,
        message:
          ver.message ||
          'Anular movimientos de otra sesión o sin caja abierta requiere usuario y contraseña de administrador.',
        code: 'SUPERVISOR_AUTH_REQUIRED',
      };
    }
    return {
      ok: true,
      supervisor: {
        autorizadoPor: ver.username,
        idUsuarioAutoriza: ver.idUsuario,
        nombreAutoriza: ver.nombreAutoriza,
        autorizadoEn: new Date(),
      },
    };
  }

  return { ok: true, supervisor: null };
}

/**
 * Gate de anulación para comprobantes que NO son movimientos de caja
 * (certificados, facturas). El administrador autoriza directo; cualquier otro
 * rol debe aportar usuario y contraseña de un administrador.
 */
async function autorizarAnulacionSimple(req, mensaje) {
  if (esAdmin(req.user?.rol)) {
    return { ok: true, supervisor: null };
  }
  const auth = await exigirAdminOSupervisor(
    req,
    mensaje || 'Anular este comprobante requiere autorización de un administrador.',
  );
  if (!auth.ok) {
    return {
      ok: false,
      status: auth.status,
      message: auth.message,
      code: auth.code || 'SUPERVISOR_AUTH_REQUIRED',
    };
  }
  return { ok: true, supervisor: auth.supervisor };
}

/**
 * Metadatos estándar que se graban al anular un comprobante (sin borrarlo).
 * El comprobante persiste en estado ANULADO conservando su consecutivo para
 * auditoría; los valores monetarios se ponen en cero por separado.
 */
function metadatosAnulacion(req, supervisor, { valorOriginal = 0, motivo = null } = {}) {
  const user = req.user?.username || 'sistema';
  const meta = {
    estado: 'ANULADO',
    anulado: true,
    anuladoEn: new Date(),
    anuladoPor: user,
    valorAnulado: Number(valorOriginal) || 0,
    motivoAnulacion: motivo || null,
  };
  if (supervisor && supervisor.autorizadoPor) {
    meta.autorizadoPor = supervisor.autorizadoPor;
    if (supervisor.idUsuarioAutoriza) meta.idUsuarioAutoriza = supervisor.idUsuarioAutoriza;
    meta.nombreAutoriza = supervisor.nombreAutoriza;
    meta.autorizadoEn = supervisor.autorizadoEn || new Date();
  }
  return meta;
}

/** Texto " (autorizó X)" para resúmenes de auditoría. */
function sufijoAutoriza(supervisor) {
  return supervisor?.autorizadoPor ? ` (autorizó ${supervisor.autorizadoPor})` : '';
}

module.exports = {
  autorizarAnulacionComprobante,
  autorizarAnulacionSimple,
  metadatosAnulacion,
  sufijoAutoriza,
};
