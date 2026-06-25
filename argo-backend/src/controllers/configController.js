const Config = require('../models/Config');
const { CLAVE, DEFAULTS, obtenerConfigRecibo } = require('../services/configRecibo');
const { FORMATOS_VALIDOS, normalizarFormatoComprobante } = require('../services/comprobanteFormato');
const { normalizarIdSede, sedesPermitidasUsuario } = require('../services/sedeContext');
const { esAdmin } = require('../utils/roles');

const CAMPOS = [
  'nombreEmpresa',
  'nit',
  'direccion',
  'ciudad',
  'telefono',
  'email',
  'urlLogo',
  'prefijoFactura',
  'consecutivoFactura',
  'prefijoComprobanteIngreso',
  'consecutivoComprobanteIngreso',
  'usarPrefijoComprobanteIngreso',
  'usarSegundoPrefijoComprobanteIngreso',
  'segundoPrefijoComprobanteIngreso',
  'prefijoComprobanteEgreso',
  'consecutivoComprobanteEgreso',
  'usarPrefijoComprobanteEgreso',
  'usarSegundoPrefijoComprobanteEgreso',
  'segundoPrefijoComprobanteEgreso',
  'slogan1',
  'mensajeEncabezado',
  'mensajeEncabezadoEgreso',
  'mensajePie',
  'mensajePieEgreso',
  'mensajeCreacionAlumnoTitulo',
  'mensajeCreacionAlumno',
  'anchoReciboMm',
  'mostrarQr',
  'formatoComprobanteIngreso',
  'formatoComprobanteEgreso',
  'permitirAjusteValorMatricula',
  'permitirAjusteCuotasSemestre',
];

exports.obtenerReciboEncabezado = async (req, res, next) => {
  try {
    const solicitada = normalizarIdSede(req.query.idSede);
    let idSede = solicitada || req.sedeActiva?.idSede;
    if (!idSede) {
      return res.status(428).json({ message: 'SEDE_REQUERIDA', code: 'SEDE_REQUERIDA' });
    }
    if (solicitada && solicitada !== req.sedeActiva?.idSede && !esAdmin(req.user?.rol)) {
      const permitidas = await sedesPermitidasUsuario(req.user.sub, req.user.rol);
      const ok = permitidas.some((s) => s.idSede === solicitada);
      if (!ok) {
        return res.status(403).json({ message: 'Sin acceso a la sede solicitada' });
      }
    }
    res.json(await obtenerConfigRecibo(idSede));
  } catch (e) {
    next(e);
  }
};

exports.obtenerRecibo = async (_req, res, next) => {
  try {
    const doc = await obtenerConfigRecibo();
    res.json(doc);
  } catch (e) {
    next(e);
  }
};

exports.obtenerReciboOpcionesMatricula = async (_req, res, next) => {
  try {
    const doc = await obtenerConfigRecibo();
    res.set('Cache-Control', 'no-store');
    res.json({
      permitirAjusteValorMatricula: doc.permitirAjusteValorMatricula !== false,
      permitirAjusteCuotasSemestre: doc.permitirAjusteCuotasSemestre === true,
    });
  } catch (e) {
    next(e);
  }
};

exports.actualizarRecibo = async (req, res, next) => {
  try {
    const dto = {};
    for (const k of CAMPOS) {
      if (req.body[k] !== undefined) dto[k] = req.body[k];
    }
    for (const k of [
      'consecutivoFactura',
      'consecutivoComprobanteIngreso',
      'consecutivoComprobanteEgreso',
    ]) {
      if (dto[k] != null) dto[k] = Math.max(0, parseInt(dto[k], 10) || 0);
    }
    if (dto.anchoReciboMm != null) {
      dto.anchoReciboMm = Math.min(120, Math.max(58, parseInt(dto.anchoReciboMm, 10) || 80));
    }
    for (const k of ['formatoComprobanteIngreso', 'formatoComprobanteEgreso']) {
      if (dto[k] !== undefined) {
        const norm = normalizarFormatoComprobante(dto[k]);
        if (!FORMATOS_VALIDOS.includes(norm)) {
          return res.status(400).json({ message: `Formato inválido: ${k}` });
        }
        dto[k] = norm;
      }
    }
    for (const k of [
      'usarSegundoPrefijoComprobanteIngreso',
      'usarSegundoPrefijoComprobanteEgreso',
    ]) {
      if (dto[k] !== undefined) dto[k] = !!dto[k];
    }
    for (const k of ['mostrarQr', 'permitirAjusteValorMatricula', 'permitirAjusteCuotasSemestre']) {
      if (dto[k] !== undefined) dto[k] = dto[k] === true || dto[k] === 'true';
    }
    for (const k of [
      'usarPrefijoComprobanteIngreso',
      'usarPrefijoComprobanteEgreso',
    ]) {
      if (dto[k] !== undefined) dto[k] = dto[k] !== false;
    }
    for (const k of [
      'segundoPrefijoComprobanteIngreso',
      'segundoPrefijoComprobanteEgreso',
    ]) {
      if (dto[k] !== undefined) dto[k] = String(dto[k] ?? '').trim();
    }
    const existe = await Config.findOne({ clave: CLAVE });
    if (existe) {
      await Config.findOneAndUpdate(
        { clave: CLAVE },
        { $set: { ...dto, clave: CLAVE } },
      );
    } else {
      await Config.create({ ...DEFAULTS, ...dto, clave: CLAVE });
    }
    res.json(await obtenerConfigRecibo());
  } catch (e) {
    next(e);
  }
};
