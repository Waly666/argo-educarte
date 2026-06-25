const {
  obtenerConfigMigracion,
  actualizarConfigMigracion,
} = require('../services/configMigracion');
const {
  puedeUsarMigracionMovimientos,
  crearMatriculaHistorica,
  registrarPagoMigracion,
} = require('../services/migracionMovimientos');
const { registrarAuditoria } = require('../services/auditoria');
const { esAdmin } = require('../utils/roles');

exports.estado = async (req, res, next) => {
  try {
    res.json(await puedeUsarMigracionMovimientos(req.user));
  } catch (e) {
    next(e);
  }
};

exports.obtenerConfig = async (req, res, next) => {
  try {
    res.json(await obtenerConfigMigracion());
  } catch (e) {
    next(e);
  }
};

exports.actualizarConfig = async (req, res, next) => {
  try {
    if (!esAdmin(req.user?.rol)) {
      return res.status(403).json({ message: 'Solo administradores pueden cambiar la configuración de migración' });
    }
    const antes = await obtenerConfigMigracion();
    const cfg = await actualizarConfigMigracion(req.body || {});
    registrarAuditoria({
      req,
      accion: 'migracion_config',
      entidad: 'migracion',
      resumen: `Config migración: movimientos ${cfg.movimientosHabilitados ? 'habilitados' : 'deshabilitados'}`,
      datosAntes: antes,
      datosDespues: cfg,
    }).catch(() => {});
    res.json(cfg);
  } catch (e) {
    next(e);
  }
};

exports.matriculaHistorica = async (req, res, next) => {
  try {
    const result = await crearMatriculaHistorica(req.body, req.idSede, { usuario: req.user });
    registrarAuditoria({
      req,
      accion: 'migracion_matricula',
      entidad: 'matricula',
      idEntidad: result.matricula?._id ? String(result.matricula._id) : null,
      resumen: `Matrícula histórica numDoc ${req.body?.numDoc} programa ${req.body?.idPrograma || req.body?.idProg}`,
      datosDespues: {
        numDoc: req.body?.numDoc,
        fechaMat: req.body?.fechaMat,
        liquidaciones: result.liquidaciones?.length,
      },
    }).catch(() => {});
    res.status(201).json(result);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message, code: e.code });
    next(e);
  }
};

exports.pagoMigracion = async (req, res, next) => {
  try {
    const result = await registrarPagoMigracion(req.body, req.idSede, { usuario: req.user });
    registrarAuditoria({
      req,
      accion: 'migracion_pago',
      entidad: 'ingreso',
      idEntidad: result.ingreso?._id ? String(result.ingreso._id) : null,
      resumen: `Recibo migración #${result.numRecibo} por ${result.total}`,
      datosDespues: { numRecibo: result.numRecibo, total: result.total },
    }).catch(() => {});
    res.status(201).json(result);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message, code: e.code });
    next(e);
  }
};
