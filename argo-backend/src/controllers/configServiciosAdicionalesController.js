const {
  obtenerConfigServiciosAdicionales,
  guardarConfigServiciosAdicionales,
} = require('../services/configServiciosAdicionales');
const { models: cat } = require('../models/catalogos');
const { buscarPrograma, listarServiciosMatricula } = require('../services/programaServicio');
const {
  resolverServiciosAdicionalesMatricula,
  resolverServiciosAdicionalesPago,
} = require('../services/serviciosAdicionalesResolver');
const Liquidacion = require('../models/Liquidacion');

async function enriquecerReglas(reglas) {
  const out = [];
  for (const r of reglas || []) {
    let servicio = null;
    if (r.idServ) {
      const id = String(r.idServ);
      const n = Number(id);
      servicio = await cat.servicios
        .findOne({
          $or: [{ idServ: id }, ...(Number.isFinite(n) ? [{ idServ: n }] : [])],
        })
        .lean();
    }
    out.push({
      ...r,
      servicioNombre: servicio?.descrServicio || servicio?.descripcion || null,
      servicioValor: servicio?.tarifa1 != null ? Number(servicio.tarifa1) : null,
      servicioSinPrograma:
        servicio != null &&
        (servicio.idProg == null || String(servicio.idProg).trim() === ''),
    });
  }
  return out;
}

exports.obtener = async (_req, res, next) => {
  try {
    const cfg = await obtenerConfigServiciosAdicionales();
    res.json({
      ...cfg,
      reglas: await enriquecerReglas(cfg.reglas),
    });
  } catch (e) {
    next(e);
  }
};

exports.actualizar = async (req, res, next) => {
  try {
    const saved = await guardarConfigServiciosAdicionales(req.body || {});
    res.json({
      ...saved,
      reglas: await enriquecerReglas(saved.reglas),
    });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};

exports.previewMatricula = async (req, res, next) => {
  try {
    const idPrograma = req.query.idPrograma || req.query.idProg;
    const tarifa = Number(req.query.tarifa) || 1;
    if (!idPrograma) {
      return res.status(400).json({ message: 'idPrograma es obligatorio' });
    }
    const prog = await buscarPrograma(idPrograma);
    if (!prog) return res.status(404).json({ message: 'Programa no encontrado' });
    const serviciosProg = await listarServiciosMatricula(prog);
    const items = await resolverServiciosAdicionalesMatricula(prog, { tarifa, serviciosProg });
    res.json({
      items: items.map((i) => ({
        reglaId: i.reglaId,
        idServ: i.idServ,
        descripcion: i.descripcion,
        valor: i.valor,
        repartirSemestres: i.repartirSemestres,
      })),
      totalExtras: items.filter((i) => !i.repartirSemestres).reduce((a, i) => a + i.valor, 0),
    });
  } catch (e) {
    next(e);
  }
};

exports.previewPago = async (req, res, next) => {
  try {
    const body = req.body || {};
    const idTipoPago = body.idTipoPago;
    const ids = Array.isArray(body.idLiquidaciones) ? body.idLiquidaciones : [];
    if (!idTipoPago) {
      return res.status(400).json({ message: 'idTipoPago es obligatorio' });
    }
    if (!ids.length) {
      return res.json({ items: [], totalExtras: 0 });
    }
    const liquidaciones = [];
    for (const id of ids) {
      const liq = await Liquidacion.findById(id).lean();
      if (liq) liquidaciones.push(liq);
    }
    const items = await resolverServiciosAdicionalesPago({
      idTipoPago,
      liquidaciones,
    });
    res.json({
      items: items.map((i) => ({
        reglaId: i.reglaId,
        idServ: i.idServ,
        descripcion: i.descripcion,
        valor: i.valor,
      })),
      totalExtras: items.reduce((a, i) => a + i.valor, 0),
    });
  } catch (e) {
    next(e);
  }
};
