const { getLanIpv4 } = require('../utils/networkHosts');

/** 3000: iframe del curso (/uploads) reporta progreso al API en el mismo backend. */
const DEV_PORTS = new Set(['3000', '4200', '4201', '4202', '']);

function isPrivateIpv4(host) {
  if (host === 'localhost' || host === '127.0.0.1') return true;
  const parts = host.split('.').map((n) => parseInt(n, 10));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return false;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

function buildAllowedOrigins() {
  const fromEnv = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const allowed = new Set(fromEnv);

  allowed.add('http://localhost:3000');
  allowed.add('http://127.0.0.1:3000');
  allowed.add('http://localhost:4200');
  allowed.add('http://127.0.0.1:4200');
  allowed.add('http://localhost:4202');
  allowed.add('http://127.0.0.1:4202');

  for (const { address } of getLanIpv4()) {
    allowed.add(`http://${address}:3000`);
    allowed.add(`http://${address}:4200`);
    allowed.add(`http://${address}:4201`);
    allowed.add(`http://${address}:4202`);
  }

  return allowed;
}

function createCorsOptions() {
  const allowed = buildAllowedOrigins();
  const allowAll =
    process.env.CORS_ALLOW_ALL === '1' ||
    process.env.CORS_ALLOW_ALL === 'true';

  return {
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowAll || allowed.has(origin)) return callback(null, true);

      if (process.env.NODE_ENV !== 'production') {
        try {
          const u = new URL(origin);
          if (DEV_PORTS.has(u.port) && isPrivateIpv4(u.hostname)) {
            return callback(null, true);
          }
        } catch {
          /* ignore */
        }
      }

      console.warn(`[ARGO CORS] Origen rechazado: ${origin}`);
      callback(new Error(`CORS: origen no permitido (${origin})`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-ARGO-Pantalla', 'X-ARGO-Sede'],
    optionsSuccessStatus: 204,
  };
}

function logCorsOnStartup() {
  const allowed = buildAllowedOrigins();
  const allowAll =
    process.env.CORS_ALLOW_ALL === '1' ||
    process.env.CORS_ALLOW_ALL === 'true';

  console.log('[ARGO CORS] Orígenes permitidos (explícitos):');
  for (const o of allowed) console.log(`  - ${o}`);
  if (allowAll) console.log('  + CORS_ALLOW_ALL activo (cualquier origen)');
  else if (process.env.NODE_ENV !== 'production') {
    console.log('  + En desarrollo: cualquier IP privada en puerto 3000/4200/4201/4202');
  }
}

module.exports = { createCorsOptions, logCorsOnStartup, buildAllowedOrigins };
