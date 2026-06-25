const { registrarAuditoria, rutaBase } = require('../services/auditoria');

const METODOS_MUTACION = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const RUTAS_EXCLUIDAS = [
  /^\/api\/health/i,
  /^\/api\/auth\/login/i,
  /^\/api\/auditoria/i,
];

function excluirRuta(ruta) {
  return RUTAS_EXCLUIDAS.some((re) => re.test(ruta));
}

function inferirAccion(metodo, statusCode) {
  if (metodo === 'POST') return statusCode === 201 ? 'crear' : 'otro';
  if (metodo === 'PUT' || metodo === 'PATCH') return 'modificar';
  if (metodo === 'DELETE') return 'eliminar';
  return 'otro';
}

function inferirEntidad(ruta) {
  const base = rutaBase(ruta);
  const m = base.match(/^\/api\/([^/]+)/);
  return m ? m[1] : 'api';
}

/**
 * Registra automáticamente peticiones mutantes (complementa logs explícitos en controladores).
 */
function auditoriaHttpMiddleware(req, res, next) {
  if (!METODOS_MUTACION.has(req.method) || excluirRuta(req.originalUrl || req.url || '')) {
    return next();
  }

  const inicio = Date.now();
  const originalJson = res.json.bind(res);

  res.json = function auditJson(body) {
    const status = res.statusCode;
    if (status >= 200 && status < 300 && req.user) {
      const ruta = req.originalUrl || req.url || '';
      setImmediate(() => {
        registrarAuditoria({
          req,
          accion: inferirAccion(req.method, status),
          entidad: inferirEntidad(ruta),
          resumen: `${req.method} ${rutaBase(ruta)} (${status}) en ${Date.now() - inicio}ms`,
          payload: req.body,
          datosDespues: body?.documento ?? body?.programa ?? body?.servicio ?? body?.egreso ?? body?.ingreso ?? body,
          codigoHttp: status,
          metodo: req.method,
          ruta,
        }).catch(() => {});
      });
    }
    return originalJson(body);
  };

  next();
}

module.exports = { auditoriaHttpMiddleware };
