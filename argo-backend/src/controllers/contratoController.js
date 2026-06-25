const mongoose = require('mongoose');
const Contrato = require('../models/Contrato');
const Empleado = require('../models/Empleado');
const { maxNumericId, insertarCatalogo } = require('../services/programaServicio');
const { pickFields, num } = require('../services/rrhhCatalogo');
const { nombreCompletoEmpleado, normalizarEmpleadoLegacy } = require('../utils/empleadoDoc');

const FIELDS = [
  'empleadoId',
  'numeroContrato',
  'tipoContrato',
  'fechaInicio',
  'fechaFin',
  'salario',
  'auxilioTransporte',
  'horasSemanales',
  'estado',
];

function pick(body) {
  const dto = pickFields(body, FIELDS);
  if (dto.empleadoId != null) dto.empleadoId = Number(dto.empleadoId);
  if (dto.horasSemanales != null) dto.horasSemanales = Number(dto.horasSemanales);
  if (dto.auxilioTransporte != null) dto.auxilioTransporte = dto.auxilioTransporte === true || dto.auxilioTransporte === 'true';
  if (dto.fechaInicio) dto.fechaInicio = new Date(dto.fechaInicio);
  if (dto.fechaFin) dto.fechaFin = new Date(dto.fechaFin);
  if (dto.salario != null) dto.salario = mongoose.Types.Decimal128.fromString(String(Number(dto.salario) || 0));
  return dto;
}

async function buscar(id) {
  const n = Number(id);
  return Contrato.findOne({
    $or: [{ idContrato: id }, ...(Number.isFinite(n) ? [{ idContrato: n }] : [])],
  }).lean();
}

async function enrich(row) {
  const emp = row.empleadoId
    ? await Empleado.findOne({ idEmpleado: row.empleadoId }).lean()
    : null;
  return {
    ...row,
    salario: num(row.salario),
    empleadoNombre: emp ? nombreCompletoEmpleado(emp) : null,
    empleadoDocumento: emp ? normalizarEmpleadoLegacy(emp).numeroDocumento : null,
  };
}

exports.listar = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.empleadoId) filter.empleadoId = Number(req.query.empleadoId);
    const rows = await Contrato.find(filter).sort({ fechaInicio: -1 }).limit(500).lean();
    res.json(await Promise.all(rows.map(enrich)));
  } catch (e) {
    next(e);
  }
};

exports.obtener = async (req, res, next) => {
  try {
    const row = await buscar(req.params.id);
    if (!row) return res.status(404).json({ message: 'Contrato no encontrado' });
    res.json(await enrich(row));
  } catch (e) {
    next(e);
  }
};

exports.crear = async (req, res, next) => {
  try {
    const dto = pick(req.body);
    if (!dto.empleadoId) return res.status(400).json({ message: 'empleadoId es obligatorio' });
    const emp = await Empleado.findOne({ idEmpleado: dto.empleadoId }).lean();
    if (!emp) return res.status(400).json({ message: 'Empleado no encontrado' });
    const idContrato = await maxNumericId(Contrato, 'idContrato');
    const user = req.user?.username || 'sistema';
    const now = new Date();
    const doc = {
      idContrato,
      ...dto,
      estado: dto.estado || 'activo',
      createdAt: now,
      updatedAt: now,
      userAddReg: user,
      userChangeRecord: user,
    };
    const row = await insertarCatalogo(Contrato, doc);
    res.status(201).json(await enrich(row));
  } catch (e) {
    next(e);
  }
};

exports.actualizar = async (req, res, next) => {
  try {
    const row = await buscar(req.params.id);
    if (!row) return res.status(404).json({ message: 'Contrato no encontrado' });
    const dto = pick(req.body);
    const user = req.user?.username || 'sistema';
    await Contrato.updateOne(
      { idContrato: row.idContrato },
      { $set: { ...dto, updatedAt: new Date(), userChangeRecord: user } },
    );
    const actualizado = await Contrato.findOne({ idContrato: row.idContrato }).lean();
    res.json(await enrich(actualizado));
  } catch (e) {
    next(e);
  }
};

exports.eliminar = async (req, res, next) => {
  try {
    const row = await buscar(req.params.id);
    if (!row) return res.status(404).json({ message: 'Contrato no encontrado' });
    await Contrato.deleteOne({ idContrato: row.idContrato });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};
