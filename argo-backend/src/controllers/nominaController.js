const mongoose = require('mongoose');
const PeriodoNomina = require('../models/PeriodoNomina');
const LiquidacionNomina = require('../models/LiquidacionNomina');
const Egreso = require('../models/Egreso');
const Empleado = require('../models/Empleado');
const { maxNumericId, insertarCatalogo } = require('../services/programaServicio');
const { generarNovedadesDescuadrePorPeriodo, marcarDescuadresPagadosEnPeriodo } = require('../services/descuadreCaja');
const { generarNovedadesAutomaticas } = require('../services/nominaNovedades');
const { liquidarPeriodo } = require('../services/nominaCalculo');
const { exportarPilaCsv } = require('../services/nominaPilaExport');
const { exportarPilaTxt } = require('../services/nominaPilaArchivo');
const { generarReciboHtml } = require('../services/nominaRecibo');
const { obtenerConfigNomina, serializarParaApi } = require('../services/configNomina');
const { nombreCompletoEmpleado, normalizarEmpleadoLegacy } = require('../utils/empleadoDoc');
const {
  esPeriodoFuturo,
  mensajePeriodoFuturo,
  sincronizarEstadoPeriodo,
} = require('../services/nominaPeriodo');

function finMes(ano, mes) {
  return new Date(ano, mes, 0, 23, 59, 59, 999);
}

function inicioMes(ano, mes) {
  return new Date(ano, mes - 1, 1, 0, 0, 0, 0);
}

async function buscarPeriodo(id) {
  const n = Number(id);
  return PeriodoNomina.findOne({
    $or: [{ idPeriodo: id }, ...(Number.isFinite(n) ? [{ idPeriodo: n }] : [])],
  }).lean();
}

async function resumenPeriodo(periodo) {
  const NovedadNomina = require('../models/NovedadNomina');
  const alineado = await sincronizarEstadoPeriodo(periodo);
  const [novedades, liquidacion] = await Promise.all([
    NovedadNomina.countDocuments({ idPeriodo: alineado.idPeriodo }),
    LiquidacionNomina.findOne({ idPeriodo: alineado.idPeriodo }).lean(),
  ]);
  return {
    ...alineado,
    totalNovedades: novedades,
    liquidacion: liquidacion || null,
    esFuturo: esPeriodoFuturo(alineado),
    avisoFuturo: esPeriodoFuturo(alineado) ? mensajePeriodoFuturo(alineado) : null,
  };
}

exports.config = async (_req, res, next) => {
  try {
    const c = await obtenerConfigNomina();
    res.json(serializarParaApi(c));
  } catch (e) {
    next(e);
  }
};

exports.listarPeriodos = async (_req, res, next) => {
  try {
    const rows = await PeriodoNomina.find({}).sort({ ano: -1, mes: -1 }).lean();
    const out = await Promise.all(rows.map(resumenPeriodo));
    res.json(out);
  } catch (e) {
    next(e);
  }
};

exports.crearPeriodo = async (req, res, next) => {
  try {
    const ano = Number(req.body.ano);
    const mes = Number(req.body.mes);
    if (!Number.isFinite(ano) || !Number.isFinite(mes) || mes < 1 || mes > 12) {
      return res.status(400).json({ message: 'ano y mes válidos son obligatorios' });
    }
    const dup = await PeriodoNomina.findOne({ ano, mes }).lean();
    if (dup) return res.status(409).json({ message: 'Ya existe un período para ese mes', idPeriodo: dup.idPeriodo });

    const idPeriodo = await maxNumericId(PeriodoNomina, 'idPeriodo');
    const user = req.user?.username || 'sistema';
    const now = new Date();
    const nombre = `${ano}-${String(mes).padStart(2, '0')}`;
    const doc = {
      idPeriodo,
      ano,
      mes,
      nombre,
      fechaInicio: inicioMes(ano, mes),
      fechaFin: finMes(ano, mes),
      estado: 'abierto',
      createdAt: now,
      updatedAt: now,
      userAddReg: user,
      userChangeRecord: user,
    };
    const row = await insertarCatalogo(PeriodoNomina, doc);
    res.status(201).json(await resumenPeriodo(row));
  } catch (e) {
    next(e);
  }
};

exports.obtenerPeriodo = async (req, res, next) => {
  try {
    const p = await buscarPeriodo(req.params.id);
    if (!p) return res.status(404).json({ message: 'Período no encontrado' });
    res.json(await resumenPeriodo(p));
  } catch (e) {
    next(e);
  }
};

exports.generarNovedadesDescuadreCaja = async (req, res, next) => {
  try {
    const p = await buscarPeriodo(req.params.id);
    if (!p) return res.status(404).json({ message: 'Período no encontrado' });
    const user = req.user?.username || 'sistema';
    const result = await generarNovedadesDescuadrePorPeriodo(p.idPeriodo, user);
    res.json({ ok: true, ...result, periodo: await resumenPeriodo(await buscarPeriodo(p.idPeriodo)) });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};

exports.generarNovedades = async (req, res, next) => {
  try {
    const p = await buscarPeriodo(req.params.id);
    if (!p) return res.status(404).json({ message: 'Período no encontrado' });
    const user = req.user?.username || 'sistema';
    const result = await generarNovedadesAutomaticas(p.idPeriodo, user);
    res.json({ ok: true, ...result, periodo: await resumenPeriodo(await buscarPeriodo(p.idPeriodo)) });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};

exports.liquidar = async (req, res, next) => {
  try {
    const p = await buscarPeriodo(req.params.id);
    if (!p) return res.status(404).json({ message: 'Período no encontrado' });
    const user = req.user?.username || 'sistema';
    const liq = await liquidarPeriodo(p.idPeriodo, user);
    res.json(liq);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};

exports.obtenerLiquidacion = async (req, res, next) => {
  try {
    const p = await buscarPeriodo(req.params.id);
    if (!p) return res.status(404).json({ message: 'Período no encontrado' });
    const liq = await LiquidacionNomina.findOne({ idPeriodo: p.idPeriodo }).lean();
    if (!liq) return res.status(404).json({ message: 'Aún no hay liquidación para este período' });
    res.json(liq);
  } catch (e) {
    next(e);
  }
};

/** Deshace liquidación errónea (vuelve a novedades o abierto). */
exports.reabrirPeriodo = async (req, res, next) => {
  try {
    const p = await buscarPeriodo(req.params.id);
    if (!p) return res.status(404).json({ message: 'Período no encontrado' });
    if (p.estado === 'pagado') {
      return res.status(400).json({ message: 'El período ya fue pagado en caja; no se puede reabrir' });
    }
    if (!['liquidado', 'cerrado'].includes(p.estado)) {
      return res.status(400).json({ message: 'Solo se puede reabrir un período liquidado o cerrado' });
    }
    const NovedadNomina = require('../models/NovedadNomina');
    const novedades = await NovedadNomina.countDocuments({ idPeriodo: p.idPeriodo });
    await LiquidacionNomina.deleteOne({ idPeriodo: p.idPeriodo });
    const nuevoEstado = novedades > 0 ? 'novedades' : 'abierto';
    const user = req.user?.username || 'sistema';
    await PeriodoNomina.updateOne(
      { idPeriodo: p.idPeriodo },
      { $set: { estado: nuevoEstado, updatedAt: new Date(), userChangeRecord: user } },
    );
    res.json({ ok: true, estado: nuevoEstado, periodo: await resumenPeriodo(await buscarPeriodo(p.idPeriodo)) });
  } catch (e) {
    next(e);
  }
};

exports.cerrarPeriodo = async (req, res, next) => {
  try {
    const p = await buscarPeriodo(req.params.id);
    if (!p) return res.status(404).json({ message: 'Período no encontrado' });
    const liq = await LiquidacionNomina.findOne({ idPeriodo: p.idPeriodo }).lean();
    if (!liq) return res.status(400).json({ message: 'Debe liquidar el período antes de cerrarlo' });
    const user = req.user?.username || 'sistema';
    await PeriodoNomina.updateOne(
      { idPeriodo: p.idPeriodo },
      { $set: { estado: 'cerrado', updatedAt: new Date(), userChangeRecord: user } },
    );
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};

/** Registra egresos de nómina (neto a pagar) en caja. */
exports.exportarPila = async (req, res, next) => {
  try {
    const p = await buscarPeriodo(req.params.id);
    if (!p) return res.status(404).json({ message: 'Período no encontrado' });
    const out = await exportarPilaCsv(p.idPeriodo);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${out.filename}"`);
    res.send(out.content);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};

/** Planilla integrada Res. 2388/2016 — archivo posicional (.txt) */
exports.exportarPilaTxt = async (req, res, next) => {
  try {
    const p = await buscarPeriodo(req.params.id);
    if (!p) return res.status(404).json({ message: 'Período no encontrado' });
    const out = await exportarPilaTxt(p.idPeriodo);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${out.filename}"`);
    res.setHeader('X-Pila-Advertencia', out.advertencia || '');
    res.send(out.content);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};

exports.reciboHtml = async (req, res, next) => {
  try {
    const p = await buscarPeriodo(req.params.id);
    if (!p) return res.status(404).json({ message: 'Período no encontrado' });
    const empleadoId = Number(req.params.empleadoId);
    const html = await generarReciboHtml(p.idPeriodo, empleadoId);
    if (!html) return res.status(404).json({ message: 'Liquidación o empleado no encontrado' });
    res.type('html').send(html);
  } catch (e) {
    next(e);
  }
};

exports.pagarNomina = async (req, res, next) => {
  try {
    const p = await buscarPeriodo(req.params.id);
    if (!p) return res.status(404).json({ message: 'Período no encontrado' });
    const liq = await LiquidacionNomina.findOne({ idPeriodo: p.idPeriodo }).lean();
    if (!liq?.detalle?.length) {
      return res.status(400).json({ message: 'No hay liquidación para pagar' });
    }

    const user = req.user?.username || 'sistema';
    const now = new Date();
    const creados = [];

    for (const d of liq.detalle) {
      if (d.netoPagar <= 0) continue;
      const emp = await Empleado.findOne({ idEmpleado: d.empleadoId }).lean();
      if (!emp) continue;
      const doc = normalizarEmpleadoLegacy(emp);
      const eg = await Egreso.create({
        fechaEgreso: now,
        valorEgreso: mongoose.Types.Decimal128.fromString(String(d.netoPagar)),
        pagueA: d.empleadoNombre || nombreCompletoEmpleado(emp),
        numeroDocumento: doc.numeroDocumento,
        concepto: `Pago nómina ${p.nombre}`,
        tipoEgreso: '2',
        formaPago: req.body.formaPago || 'Transferencia',
        fechaAudi: now,
        userAddReg: user,
        userChangeRecord: user,
      });
      creados.push({ idEgreso: String(eg._id), empleadoId: d.empleadoId, netoPagar: d.netoPagar });
    }

    await PeriodoNomina.updateOne(
      { idPeriodo: p.idPeriodo },
      { $set: { estado: 'pagado', updatedAt: now, userChangeRecord: user } },
    );

    await marcarDescuadresPagadosEnPeriodo(p.idPeriodo);

    res.json({ ok: true, egresosCreados: creados.length, egresos: creados });
  } catch (e) {
    next(e);
  }
};
