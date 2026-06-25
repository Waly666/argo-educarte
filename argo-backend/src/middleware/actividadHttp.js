const { registrarPeticion } = require('../services/actividadHttp');

const RUTAS_EXCLUIDAS = [
  /^\/api\/health/i,
  /^\/api\/actividad\/monitor/i,
  /^\/api\/actividad/i,
  /^\/uploads/i,
];

function excluirRuta(ruta) {
  return RUTAS_EXCLUIDAS.some((re) => re.test(ruta));
}

/**
 * Registra cada petición API autenticada (incluye GET) para monitoreo en tiempo real.
 */
function actividadHttpMiddleware(req, res, next) {
  const ruta = req.originalUrl || req.url || '';
  if (excluirRuta(ruta)) return next();

  const inicio = Date.now();

  res.on('finish', () => {
    setImmediate(() => {
      const bytesEntrada = parseInt(String(req.headers['content-length'] || ''), 10) || 0;
      let bytesSalida = 0;
      const cl = res.getHeader('content-length');
      if (cl != null) bytesSalida = parseInt(String(cl), 10) || 0;
      registrarPeticion({
        req,
        statusCode: res.statusCode,
        duracionMs: Date.now() - inicio,
        bytesEntrada,
        bytesSalida,
      }).catch(() => {});
    });
  });

  next();
}

module.exports = { actividadHttpMiddleware };
