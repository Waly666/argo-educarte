const {
  resolverEmpleadoInstructor,
  resolverEmpleadoInstructorOpcional,
  obtenerInspeccionDelDia,
  guardarInspeccion,
  listarInspecciones,
  obtenerVehiculoPorId,
  fechaHoyStr,
} = require('../services/inspeccionVehiculo');
const { renderInspeccionVehiculoHtml } = require('../services/inspeccionVehiculoHtml');
const { calcularAlertasInspeccionPendiente } = require('../services/vehiculoAlertasInspeccion');

function userLogin(req) {
  return String(req.user?.username || req.user?.login || req.user?.documento || req.user?.sub || '').trim();
}

function userId(req) {
  return req.user?.sub || req.user?.id || req.user?._id;
}

exports.alertasInspeccionPendiente = async (_req, res, next) => {
  try {
    res.json(await calcularAlertasInspeccionPendiente());
  } catch (e) {
    next(e);
  }
};

exports.listar = async (req, res, next) => {
  try {
    const vehiculo = await obtenerVehiculoPorId(req.params.id);
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const skip = Math.max(Number(req.query.skip) || 0, 0);
    res.json(await listarInspecciones(vehiculo, { limit, skip }));
  } catch (e) {
    next(e);
  }
};

exports.obtenerDelDia = async (req, res, next) => {
  try {
    const vehiculo = await obtenerVehiculoPorId(req.params.id);
    const empleado = await resolverEmpleadoInstructorOpcional(userId(req));
    const fecha = String(req.query.fecha || fechaHoyStr()).trim();
    const dto = await obtenerInspeccionDelDia(vehiculo, empleado, fecha, req.user);
    res.json(dto);
  } catch (e) {
    next(e);
  }
};

exports.guardar = async (req, res, next) => {
  try {
    const vehiculo = await obtenerVehiculoPorId(req.params.id);
    const empleado = await resolverEmpleadoInstructor(userId(req));
    const saved = await guardarInspeccion(vehiculo, empleado, req.body || {}, userLogin(req), req.user);
    res.json(saved);
  } catch (e) {
    next(e);
  }
};

exports.imprimir = async (req, res, next) => {
  try {
    const vehiculo = await obtenerVehiculoPorId(req.params.id);
    const empleado = await resolverEmpleadoInstructorOpcional(userId(req));
    const fecha = String(req.query.fecha || fechaHoyStr()).trim();
    const inspeccion = await obtenerInspeccionDelDia(vehiculo, empleado, fecha, req.user);
    const html = await renderInspeccionVehiculoHtml(inspeccion, vehiculo);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (e) {
    next(e);
  }
};
