const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const {
  loginRateLimit,
  buscarAlumnoRateLimit,
  authApiRateLimit,
} = require('../config/security');

function createHelmetMiddleware() {
  return helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });
}

function rateLimitHandler(_req, res) {
  res.status(429).json({
    message: 'Demasiados intentos. Espere unos minutos e intente de nuevo.',
  });
}

function createRateLimiter({ windowMs, max, message }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitHandler,
    message: { message: message || 'Demasiados intentos.' },
  });
}

const staffLoginLimiter = createRateLimiter({
  ...loginRateLimit,
  message: 'Demasiados intentos de inicio de sesión.',
});

const portalAuthLimiter = createRateLimiter({
  ...authApiRateLimit,
  message: 'Demasiados intentos en el portal.',
});

const buscarAlumnoLimiter = createRateLimiter({
  ...buscarAlumnoRateLimit,
  message: 'Demasiadas consultas de documento. Intente más tarde.',
});

module.exports = {
  createHelmetMiddleware,
  staffLoginLimiter,
  portalAuthLimiter,
  buscarAlumnoLimiter,
};
