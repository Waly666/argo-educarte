const { turnstileEnabled } = require('../config/security');

async function verifyTurnstileToken(token, remoteip) {
  const secret = String(process.env.TURNSTILE_SECRET_KEY || '').trim();
  if (!secret) return true;

  const body = new URLSearchParams({
    secret,
    response: String(token || ''),
  });
  if (remoteip) body.set('remoteip', remoteip);

  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await res.json();
  return data?.success === true;
}

/** Clientes nativos (móvil) sin widget Turnstile — solo rate limit. */
function isClienteNativo(req) {
  const c = String(req.get('X-ARGO-Cliente') || '').toLowerCase();
  return c === 'cajero' || c === 'mobile';
}

/** Exige token Turnstile en body (turnstileToken) o header X-Turnstile-Token. */
function requireTurnstile(opts = {}) {
  const { allowNativeClients = false } = opts;
  return async (req, res, next) => {
    if (!turnstileEnabled()) return next();
    if (allowNativeClients && isClienteNativo(req)) return next();

    const token =
      req.body?.turnstileToken ||
      req.query?.turnstileToken ||
      req.get('X-Turnstile-Token');

    try {
      const ok = await verifyTurnstileToken(token, req.ip);
      if (!ok) {
        return res.status(403).json({ message: 'Verificación anti-bot fallida. Recargue e intente de nuevo.' });
      }
      return next();
    } catch (e) {
      console.warn('[ARGO Turnstile]', e.message);
      return res.status(503).json({ message: 'No se pudo verificar el captcha. Intente más tarde.' });
    }
  };
}

module.exports = { requireTurnstile, verifyTurnstileToken, isClienteNativo };
