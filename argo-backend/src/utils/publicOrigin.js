/** Origen público para URLs absolutas (uploads, etc.) cuando PUBLIC_URL no está definido. */
function publicOriginFromReq(req) {
  const env = (process.env.PUBLIC_URL || '').trim().replace(/\/$/, '');
  if (env) return env;

  const proto = (req.get('x-forwarded-proto') || req.protocol || 'http').split(',')[0].trim();
  const host = (req.get('x-forwarded-host') || req.get('host') || '').split(',')[0].trim();
  if (!host) return null;
  return `${proto}://${host}`;
}

module.exports = { publicOriginFromReq };
