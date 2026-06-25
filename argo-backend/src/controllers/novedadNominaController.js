const mongoose = require('mongoose');
const NovedadNomina = require('../models/NovedadNomina');
const Empleado = require('../models/Empleado');
const { maxNumericId, insertarCatalogo } = require('../services/programaServicio');
const { pickFields, num } = require('../services/rrhhCatalogo');
const { nombreCompletoEmpleado, normalizarEmpleadoLegacy } = require('../utils/empleadoDoc');

const FIELDS = [
  'empleadoId',
  'idPeriodo',
  'tipoNovedad',
  'codigoConcepto',
  'codigoPila',
  'diasNovedad',
  'fechaInicioNovedad',
  'fechaFinNovedad',
  'subtipoVacLic',
  'naturaleza',
  'descripcion',
  'valor',
  'fecha',
  'estado',
];

function pick(body) {
  const dto = pickFields(body, FIELDS);
  if (dto.empleadoId != null) dto.empleadoId = Number(dto.empleadoId);
  if (dto.idPeriodo != null && dto.idPeriodo !== '') dto.idPeriodo = Number(dto.idPeriodo);
  if (dto.fecha) dto.fecha = new Date(dto.fecha);
  if (dto.fechaInicioNovedad) dto.fechaInicioNovedad = new Date(dto.fechaInicioNovedad);
  if (dto.fechaFinNovedad) dto.fechaFinNovedad = new Date(dto.fechaFinNovedad);
  if (dto.diasNovedad != null && dto.diasNovedad !== '') dto.diasNovedad = Number(dto.diasNovedad);
  if (dto.valor != null) dto.valor = mongoose.Types.Decimal128.fromString(String(Number(dto.valor) || 0));
  if (dto.naturaleza) dto.naturaleza = String(dto.naturaleza).toLowerCase();
  if (dto.codigoPila) {
    dto.codigoPila = String(dto.codigoPila).toUpperCase();
    if (!dto.tipoNovedad) dto.tipoNovedad = dto.codigoPila;
    if (!dto.codigoConcepto) dto.codigoConcepto = dto.codigoPila;
    if (!dto.naturaleza) dto.naturaleza = 'devengo';
    if (dto.valor == null || Number(dto.valor) === 0) {
      dto.valor = mongoose.Types.Decimal128.fromString('0');
    }
  }
  dto.autoGenerada = false;
  return dto;
}

async function buscar(id) {
  const n = Number(id);
  return NovedadNomina.findOne({
    $or: [{ idNovedad: id }, ...(Number.isFinite(n) ? [{ idNovedad: n }] : [])],
  }).lean();
}

async function enrich(row) {
  const emp = row.empleadoId
    ? await Empleado.findOne({ idEmpleado: row.empleadoId }).lean()
    : null;
  return {
    ...row,
    valor: num(row.valor),
    empleadoNombre: emp ? nombreCompletoEmpleado(emp) : null,
    empleadoDocumento: emp ? normalizarEmpleadoLegacy(emp).numeroDocumento : null,
  };
}

exports.listar = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.empleadoId) filter.empleadoId = Number(req.query.empleadoId);
    if (req.query.idPeriodo) filter.idPeriodo = Number(req.query.idPeriodo);
    const rows = await NovedadNomina.find(filter).sort({ fecha: -1 }).limit(500).lean();
    res.json(await Promise.all(rows.map(enrich)));
  } catch (e) {
    next(e);
  }
};

exports.obtener = async (req, res, next) => {
  try {
    const row = await buscar(req.params.id);
    if (!row) return res.status(404).json({ message: 'Novedad no encontrada' });
    res.json(await enrich(row));
  } catch (e) {
    next(e);
  }
};

exports.crear = async (req, res, next) => {
  try {
    const dto = pick(req.body);
    if (!dto.empleadoId || !dto.tipoNovedad) {
      return res.status(400).json({ message: 'empleadoId y tipoNovedad son obligatorios' });
    }
    if (!dto.idPeriodo) {
      return res.status(400).json({ message: 'idPeriodo es obligatorio (seleccione el período de nómina)' });
    }
    if (!dto.naturaleza) {
      const { clasificarNovedadManual } = require('../services/nominaNovedades');
      dto.naturaleza = clasificarNovedadManual(dto);
    }
    const emp = await Empleado.findOne({ idEmpleado: dto.empleadoId }).lean();
    if (!emp) return res.status(400).json({ message: 'Empleado no encontrado' });
    const idNovedad = await maxNumericId(NovedadNomina, 'idNovedad');
    const user = req.user?.username || 'sistema';
    const now = new Date();
    const doc = {
      idNovedad,
      ...dto,
      estado: dto.estado || 'activo',
      createdAt: now,
      updatedAt: now,
      userAddReg: user,
      userChangeRecord: user,
    };
    const row = await insertarCatalogo(NovedadNomina, doc);
    res.status(201).json(await enrich(row));
  } catch (e) {
    next(e);
  }
};

exports.actualizar = async (req, res, next) => {
  try {
    const row = await buscar(req.params.id);
    if (!row) return res.status(404).json({ message: 'Novedad no encontrada' });
    const dto = pick(req.body);
    const user = req.user?.username || 'sistema';
    await NovedadNomina.updateOne(
      { idNovedad: row.idNovedad },
      { $set: { ...dto, updatedAt: new Date(), userChangeRecord: user } },
    );
    const actualizado = await NovedadNomina.findOne({ idNovedad: row.idNovedad }).lean();
    res.json(await enrich(actualizado));
  } catch (e) {
    next(e);
  }
};

exports.eliminar = async (req, res, next) => {
  try {
    const row = await buscar(req.params.id);
    if (!row) return res.status(404).json({ message: 'Novedad no encontrada' });
    if (row.autoGenerada) {
      return res.status(409).json({
        message: 'No puede eliminar novedades automáticas. Regeneré novedades desde Nómina.',
      });
    }
    await NovedadNomina.deleteOne({ idNovedad: row.idNovedad });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};
