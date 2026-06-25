const mongoose = require('mongoose');
const Egreso = require('../models/Egreso');
const Empleado = require('../models/Empleado');
const Vehiculo = require('../models/Vehiculo');
const { FORMAS_PAGO } = require('../models/Egreso');
const { models: cat } = require('../models/catalogos');
const upload = require('../middleware/upload');
const { esAdmin } = require('../utils/roles');
const {
  numeroDocumentoQuery,
  nombreCompletoEmpleado,
  normalizarEmpleadoLegacy,
} = require('../utils/empleadoDoc');
const {
  registrarAnticipoDesdeEgreso,
  eliminarNovedadPorEgreso,
} = require('../services/nominaAnticipo');
const { siguienteNumComprobanteEgreso } = require('../services/configRecibo');
const { configDesdeTipoDoc, resolverTipoEgresoDoc, esRetiroCajaTipo } = require('../services/tipoEgresoNomina');
const { normalizarPlaca } = require('../constants/vehiculo');
const {
  exigirSesionAbierta,
  verificarMovimientoSesionCajero,
} = require('../services/cajaSesion');
const { exigirAdminOSupervisor } = require('../services/authVerify');
const {
  autorizarAnulacionComprobante,
  metadatosAnulacion,
  sufijoAutoriza,
} = require('../services/anulacionComprobante');
const { esComprobanteAnulado } = require('../utils/comprobanteEstado');
const { validarPagoIntangibleEgreso } = require('../utils/referenciaPago');
const {
  registrarCreacion,
  registrarModificacion,
  registrarEliminacion,
} = require('../services/auditoria');

function num(v) {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'object' && v.$numberDecimal != null) return Number(v.$numberDecimal) || 0;
  return Number(v) || 0;
}

function toDec(n) {
  return mongoose.Types.Decimal128.fromString(String(Number(n) || 0));
}

function normalizarDoc(raw) {
  if (!raw) return raw;
  const e = { ...raw };
  if (e.fechaEgreso == null && e.fecha != null) e.fechaEgreso = e.fecha;
  if (e.valorEgreso == null && e.valor != null) e.valorEgreso = e.valor;
  if (!e.tipoEgreso && e.idTipoEgreso != null) e.tipoEgreso = String(e.idTipoEgreso);
  if (!e.formaPago && e.idTipoPago) e.formaPago = String(e.idTipoPago);
  if (!e.numTransferencia && e.numComprobante) e.numTransferencia = e.numComprobante;
  if (!e.bancoDestino && e.idBanco) e.bancoDestino = String(e.idBanco);
  if (!e.numeroDocumento && e.numDoc != null) e.numeroDocumento = String(e.numDoc);
  return e;
}

async function resolverEmpleadoPorDocumento(numeroDocumento) {
  if (!numeroDocumento) return null;
  const q = numeroDocumentoQuery(numeroDocumento);
  return q ? Empleado.findOne(q).lean() : null;
}

async function validarBeneficiarioEgreso(dto) {
  const tipoDoc = dto.tipoEgreso ? await resolverTipoEgresoDoc(dto.tipoEgreso) : null;
  const cfg = configDesdeTipoDoc(tipoDoc);

  if (!dto.pagueA?.trim()) {
    return {
      ok: false,
      status: 400,
      message: 'Indique a quién se pagó (beneficiario / pagueA)',
    };
  }
  dto.pagueA = String(dto.pagueA).trim();

  const doc = dto.numeroDocumento != null ? String(dto.numeroDocumento).trim() : '';
  if (!doc) {
    return {
      ok: false,
      status: 400,
      message: 'El número de identificación del beneficiario es obligatorio.',
    };
  }
  dto.numeroDocumento = doc;

  const emp = await resolverEmpleadoPorDocumento(doc);

  if (cfg.requiereEmpleado || cfg.generaDeduccionNomina) {
    if (!emp) {
      return {
        ok: false,
        status: 400,
        message: 'No hay empleado con ese numeroDocumento. Regístrelo en RRHH → Empleados.',
      };
    }
    if (!dto.pagueA) dto.pagueA = nombreCompletoEmpleado(emp);
  }

  if (cfg.requiereVehiculo) {
    const placa = normalizarPlaca(dto.placa);
    if (!placa) {
      return {
        ok: false,
        status: 400,
        message: 'La placa del vehículo es obligatoria para este tipo de egreso.',
      };
    }
    const veh = await Vehiculo.findOne({ placa }).lean();
    if (!veh) {
      return {
        ok: false,
        status: 400,
        message: 'No hay vehículo registrado con esa placa. Regístrelo en Vehículos.',
      };
    }
    dto.placa = placa;
    return { ok: true, empleado: emp, cfg, tipoDoc, vehiculo: veh };
  }

  dto.placa = null;
  return { ok: true, empleado: emp, cfg, tipoDoc };
}

function pickBody(body) {
  const dto = {};
  for (const k of [
    'fechaEgreso',
    'valorEgreso',
    'pagueA',
    'numeroDocumento',
    'concepto',
    'tipoEgreso',
    'formaPago',
    'numTransferencia',
    'fechaTransferencia',
    'cuentaOrigen',
    'cuentaDestino',
    'bancoDestino',
    'idPeriodo',
    'idEmpleado',
    'placa',
  ]) {
    if (body[k] !== undefined && body[k] !== '') dto[k] = body[k];
  }
  if (dto.idPeriodo != null && dto.idPeriodo !== '') dto.idPeriodo = Number(dto.idPeriodo);
  if (dto.idEmpleado != null && dto.idEmpleado !== '') dto.idEmpleado = Number(dto.idEmpleado);
  if (dto.numeroDocumento != null) dto.numeroDocumento = String(dto.numeroDocumento).trim();
  if (dto.pagueA) dto.pagueA = String(dto.pagueA).trim();
  if (dto.placa != null && dto.placa !== '') dto.placa = normalizarPlaca(dto.placa);
  if (dto.concepto) dto.concepto = String(dto.concepto).trim();
  if (dto.tipoEgreso != null) dto.tipoEgreso = String(dto.tipoEgreso);
  if (dto.formaPago && !FORMAS_PAGO.includes(dto.formaPago)) {
    const match = FORMAS_PAGO.find((f) => f.toLowerCase() === String(dto.formaPago).toLowerCase());
    if (match) dto.formaPago = match;
  }
  if (dto.fechaEgreso) {
    const raw = dto.fechaEgreso;
    if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(String(raw).trim())) {
      const [y, m, d] = String(raw).trim().split('-').map(Number);
      dto.fechaEgreso = new Date(y, m - 1, d, 12, 0, 0, 0);
    } else {
      dto.fechaEgreso = new Date(raw);
    }
  }
  return dto;
}

async function resolverAutorizacionRetiro(req, tipoDoc) {
  if (!esRetiroCajaTipo(tipoDoc)) return { ok: true, datos: null };
  const auth = await exigirAdminOSupervisor(
    req,
    'Los retiros de caja requieren autorización de un administrador (usuario y contraseña).',
  );
  if (!auth.ok) return auth;
  return { ok: true, datos: auth.supervisor };
}

async function resolverTipoEgreso(tipoEgreso) {
  return resolverTipoEgresoDoc(tipoEgreso);
}

async function resolverCuentaOrigen(cuentaOrigen) {
  if (!cuentaOrigen) return null;
  const n = Number(cuentaOrigen);
  return cat.cuentasBancarias
    .findOne({
      $or: [
        { idCuentaBancaria: cuentaOrigen },
        ...(Number.isFinite(n) ? [{ idCuentaBancaria: n }] : []),
        { numCuenta: cuentaOrigen },
        { numCuenta: n },
      ],
    })
    .lean();
}

async function resolverBancoDestino(bancoDestino) {
  if (!bancoDestino) return null;
  const n = Number(bancoDestino);
  return cat.bancos
    .findOne({
      $or: [
        { idBanco: bancoDestino },
        { idbanco: bancoDestino },
        ...(Number.isFinite(n) ? [{ idBanco: n }, { idbanco: n }] : []),
        { banco: new RegExp(String(bancoDestino).trim(), 'i') },
      ],
    })
    .lean();
}

async function enriquecer(raw) {
  const e = normalizarDoc(raw);
  const tipo = await resolverTipoEgreso(e.tipoEgreso);
  const tipoCfg = configDesdeTipoDoc(tipo);
  const cuenta = await resolverCuentaOrigen(e.cuentaOrigen);
  const banco = await resolverBancoDestino(e.bancoDestino);
  const emp = e.numeroDocumento ? await resolverEmpleadoPorDocumento(e.numeroDocumento) : null;
  const empN = emp ? normalizarEmpleadoLegacy(emp) : null;
  const veh = e.placa ? await Vehiculo.findOne({ placa: normalizarPlaca(e.placa) }).lean() : null;
  const anticipo =
    e.anticipoNomina || tipoCfg.anticipoNomina || null;
  return {
    idEgreso: String(e._id),
    numRecibo: e.numRecibo || null,
    fechaEgreso: e.fechaEgreso,
    valorEgreso: num(e.valorEgreso),
    pagueA: e.pagueA || (emp ? nombreCompletoEmpleado(emp) : null) || null,
    numeroDocumento: e.numeroDocumento ?? null,
    idEmpleado: emp?.idEmpleado ?? null,
    empleadoNombre: emp ? nombreCompletoEmpleado(emp) : null,
    empleadoCargo: empN?.cargoNombre || null,
    anticipoNomina: anticipo,
    idPeriodo: e.idPeriodo ?? null,
    idNovedadGenerada: e.idNovedadGenerada ?? null,
    concepto: e.concepto,
    tipoEgreso: e.tipoEgreso || null,
    tipoEgresoDescr: tipo?.tipo || null,
    tipoRequiereEmpleado: tipoCfg.requiereEmpleado,
    tipoRequiereVehiculo: tipoCfg.requiereVehiculo,
    tipoEfectoNomina: tipoCfg.efectoNomina || null,
    placa: e.placa || null,
    vehiculoMarca: veh?.nombreMarca || null,
    vehiculoLinea: veh?.nombreLinea || null,
    vehiculoClase: veh?.claseVehiculo || null,
    formaPago: e.formaPago || null,
    numTransferencia: e.numTransferencia || null,
    fechaTransferencia: e.fechaTransferencia || null,
    cuentaOrigen: e.cuentaOrigen || null,
    cuentaOrigenDescr: cuenta
      ? `${cuenta.banco || ''} ${cuenta.numCuenta || ''}`.trim()
      : null,
    cuentaDestino: e.cuentaDestino || null,
    bancoDestino: e.bancoDestino || null,
    bancoDestinoDescr: banco?.banco || banco?.descripcion || banco?.nombre || null,
    urlSoporte: e.urlSoporte || null,
    fechaAudi: e.fechaAudi,
    userAddReg: e.userAddReg,
    userChangeRecord: e.userChangeRecord,
    fechaMod: e.fechaMod,
    idSesion: e.idSesion ?? null,
    autorizadoPor: e.autorizadoPor || null,
    nombreAutoriza: e.nombreAutoriza || null,
    autorizadoEn: e.autorizadoEn || null,
    estado: e.estado || (e.anulado ? 'ANULADO' : 'ACTIVO'),
    anulado: esComprobanteAnulado(e),
    anuladoEn: e.anuladoEn || null,
    anuladoPor: e.anuladoPor || null,
    valorAnulado: e.valorAnulado != null ? num(e.valorAnulado) : null,
    motivoAnulacion: e.motivoAnulacion || null,
  };
}

exports.formasPago = (_req, res) => {
  res.json(FORMAS_PAGO);
};

/** Opciones de vehículos para egresos (caja) — búsqueda por placa, marca, línea, etc. */
exports.opcionesVehiculos = async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 40));
    const filter = {};
    if (q.length >= 1) {
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { placa: re },
        { nombreMarca: re },
        { nombreLinea: re },
        { claseVehiculo: re },
        { modelo: re },
      ];
    }
    const rows = await Vehiculo.find(filter)
      .select('placa nombreMarca nombreLinea claseVehiculo modelo tipoServicio')
      .sort({ placa: 1 })
      .limit(limit)
      .lean();
    res.json(
      rows.map((v) => ({
        placa: v.placa,
        nombreMarca: v.nombreMarca || '',
        nombreLinea: v.nombreLinea || '',
        claseVehiculo: v.claseVehiculo || '',
        modelo: v.modelo || '',
        tipoServicio: v.tipoServicio || '',
      })),
    );
  } catch (e) {
    next(e);
  }
};

/** Verifica placa exacta contra vehículos registrados (egresos / caja). */
exports.verificarPlacaVehiculo = async (req, res, next) => {
  try {
    const placa = normalizarPlaca(req.params.placa);
    if (!placa) return res.status(400).json({ message: 'Placa inválida' });
    const v = await Vehiculo.findOne({ placa })
      .select('placa nombreMarca nombreLinea claseVehiculo modelo tipoServicio')
      .lean();
    if (!v) return res.json({ existe: false, vehiculo: null });
    res.json({
      existe: true,
      vehiculo: {
        placa: v.placa,
        nombreMarca: v.nombreMarca || '',
        nombreLinea: v.nombreLinea || '',
        claseVehiculo: v.claseVehiculo || '',
        modelo: v.modelo || '',
        tipoServicio: v.tipoServicio || '',
      },
    });
  } catch (e) {
    next(e);
  }
};

exports.listar = async (req, res, next) => {
  try {
    const idSesion = req.query.idSesion != null ? Number(req.query.idSesion) : null;
    if (idSesion != null && Number.isFinite(idSesion)) {
      const rows = await Egreso.find({ idSesion }).sort({ fechaEgreso: -1, fechaAudi: -1 }).lean();
      const out = await Promise.all(rows.map((r) => enriquecer(r)));
      return res.json(out);
    }
    const q = (req.query.q || '').toString().trim();
    const docQ = (req.query.numeroDocumento || req.query.numDoc || '').toString().trim();
    const and = [];
    if (docQ) {
      const qd = numeroDocumentoQuery(docQ);
      and.push(qd || { numeroDocumento: docQ });
    }
    if (q.length >= 2) {
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      and.push({
        $or: [
          { concepto: re },
          { pagueA: re },
          { numTransferencia: re },
          { formaPago: re },
          { numeroDocumento: re },
        ],
      });
    }
    const filter = and.length ? { $and: and } : {};
    const rows = await Egreso.find(filter).sort({ fechaEgreso: -1, fechaAudi: -1 }).limit(500).lean();
    const out = await Promise.all(rows.map((r) => enriquecer(r)));
    res.json(out);
  } catch (e) {
    next(e);
  }
};

function rangoFechaEgresoQuery(desde, hasta) {
  const f = {};
  if (desde) {
    const d = new Date(String(desde).trim());
    if (!Number.isNaN(d.getTime())) f.$gte = d;
  }
  if (hasta) {
    const h = new Date(String(hasta).trim());
    if (!Number.isNaN(h.getTime())) {
      h.setHours(23, 59, 59, 999);
      f.$lte = h;
    }
  }
  return Object.keys(f).length ? { fechaEgreso: f } : null;
}

exports.listarTodos = async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const docQ = String(req.query.numeroDocumento || req.query.numDoc || req.query.doc || '').trim();
    const idSesionQ = req.query.idSesion;
    const skip = Math.max(0, Number(req.query.skip) || 0);
    const limit = Math.min(2000, Math.max(1, Number(req.query.limit) || 500));
    const and = [];

    const rango = rangoFechaEgresoQuery(req.query.desde, req.query.hasta);
    if (rango) and.push(rango);

    if (req.idSede) and.push({ idSede: req.idSede });

    if (idSesionQ != null && idSesionQ !== '') {
      const sid = Number(idSesionQ);
      if (Number.isFinite(sid)) and.push({ idSesion: sid });
    }

    if (docQ) {
      const qd = numeroDocumentoQuery(docQ);
      and.push(qd || { numeroDocumento: docQ });
    }

    if (q.length >= 2) {
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      and.push({
        $or: [
          { concepto: re },
          { pagueA: re },
          { numRecibo: re },
          { numTransferencia: re },
          { formaPago: re },
          { numeroDocumento: re },
          { tipoEgreso: re },
        ],
      });
    }

    const filter = and.length ? { $and: and } : {};
    const [total, rows] = await Promise.all([
      Egreso.countDocuments(filter),
      Egreso.find(filter).sort({ fechaEgreso: -1, fechaAudi: -1 }).skip(skip).limit(limit).lean(),
    ]);
    const items = await Promise.all(rows.map((r) => enriquecer(r)));
    const totalValor = items.reduce((a, e) => a + num(e.valorEgreso), 0);
    res.json({ items, total, skip, limit, totalValor });
  } catch (e) {
    next(e);
  }
};

exports.obtener = async (req, res, next) => {
  try {
    const e = await Egreso.findById(req.params.id).lean();
    if (!e) return res.status(404).json({ message: 'Egreso no encontrado' });
    res.json(await enriquecer(e));
  } catch (e) {
    next(e);
  }
};

exports.crear = async (req, res, next) => {
  try {
    const dto = pickBody(req.body || {});
    if (!dto.concepto) return res.status(400).json({ message: 'El concepto es obligatorio' });
    const v = Number(dto.valorEgreso);
    if (!(v > 0)) return res.status(400).json({ message: 'valorEgreso inválido' });
    if (dto.formaPago && !FORMAS_PAGO.includes(dto.formaPago)) {
      return res.status(400).json({ message: 'formaPago no válida', formasPago: FORMAS_PAGO });
    }
    const vinc = await validarBeneficiarioEgreso(dto);
    if (!vinc.ok) return res.status(vinc.status).json({ message: vinc.message });
    let urlSoporte = null;
    if (req.file?.filename) urlSoporte = upload.publicUrl('egresos', req.file.filename);
    const intangibleVal = validarPagoIntangibleEgreso(dto, urlSoporte);
    if (!intangibleVal.ok) return res.status(intangibleVal.status).json({ message: intangibleVal.message });

    const authRet = await resolverAutorizacionRetiro(req, vinc.tipoDoc);
    if (!authRet.ok) return res.status(authRet.status).json({ message: authRet.message });

    const anticipoNomina = vinc.cfg?.anticipoNomina || null;
    if (anticipoNomina && !vinc.empleado) {
      return res.status(400).json({ message: 'Este tipo de egreso requiere empleado en RRHH' });
    }

    const sesion = await exigirSesionAbierta(req.user?.sub, req.idSede);

    const user = req.user?.username || 'sistema';
    const now = new Date();
    const numRecibo = await siguienteNumComprobanteEgreso(req.idSede);
    const doc = {
      ...dto,
      numRecibo,
      idSede: req.idSede,
      valorEgreso: toDec(v),
      urlSoporte,
      fechaEgreso: dto.fechaEgreso || now,
      fechaAudi: now,
      fechaMod: now,
      userAddReg: user,
      userChangeRecord: user,
    };

    if (anticipoNomina && !dto.idPeriodo) {
      const PeriodoNomina = require('../models/PeriodoNomina');
      const abierto = await PeriodoNomina.findOne({
        estado: { $in: ['abierto', 'novedades', 'liquidado'] },
      })
        .sort({ ano: -1, mes: -1 })
        .lean();
      if (abierto) dto.idPeriodo = abierto.idPeriodo;
    }

    const eg = await Egreso.create({
      ...doc,
      ...(authRet.datos || {}),
      numeroDocumento: dto.numeroDocumento || null,
      idEmpleado: vinc.empleado?.idEmpleado ?? null,
      anticipoNomina,
      idPeriodo: anticipoNomina ? dto.idPeriodo || null : null,
      idSesion: sesion.idSesion,
    });

    let novedadAnticipo = null;
    if (anticipoNomina) {
      try {
        novedadAnticipo = await registrarAnticipoDesdeEgreso({
          anticipoNomina,
          idPeriodo: dto.idPeriodo,
          empleado: vinc.empleado,
          egresoId: eg._id,
          valor: v,
          concepto: dto.concepto,
          user,
        });
        if (novedadAnticipo?.idNovedad) {
          eg.idNovedadGenerada = novedadAnticipo.idNovedad;
          await eg.save();
        }
      } catch (err) {
        await Egreso.deleteOne({ _id: eg._id });
        const status = err.status || 400;
        return res.status(status).json({ message: err.message });
      }
    }

    const out = await enriquecer(eg.toObject());
    registrarCreacion(req, 'egreso', eg, {
      resumen: `Egreso #${numRecibo} ${dto.concepto} por ${v}`,
    });
    res.status(201).json({ ...out, numRecibo, novedadAnticipo });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message, code: e.code });
    next(e);
  }
};

exports.actualizar = async (req, res, next) => {
  try {
    const eg = await Egreso.findById(req.params.id);
    if (!eg) return res.status(404).json({ message: 'Egreso no encontrado' });
    const antes = eg.toObject();

    let supervisor = null;
    if (!esAdmin(req.user?.rol)) {
      const sesOk = await verificarMovimientoSesionCajero(req, eg.idSesion);
      if (!sesOk.ok) return res.status(sesOk.status).json({ message: sesOk.message, code: sesOk.code });
      const auth = await exigirAdminOSupervisor(
        req,
        'Modificar egresos requiere autorización de un administrador.',
      );
      if (!auth.ok) return res.status(auth.status).json({ message: auth.message });
      supervisor = auth.supervisor;
    }

    const dto = pickBody(req.body || {});
    if (dto.concepto !== undefined && !dto.concepto) {
      return res.status(400).json({ message: 'El concepto no puede quedar vacío' });
    }
    if (dto.valorEgreso != null) {
      const v = Number(dto.valorEgreso);
      if (!(v > 0)) return res.status(400).json({ message: 'valorEgreso inválido' });
      dto.valorEgreso = toDec(v);
    }
    if (dto.formaPago && !FORMAS_PAGO.includes(dto.formaPago)) {
      return res.status(400).json({ message: 'formaPago no válida', formasPago: FORMAS_PAGO });
    }
    const merged = {
      tipoEgreso: eg.tipoEgreso,
      numeroDocumento: eg.numeroDocumento,
      pagueA: eg.pagueA,
      formaPago: dto.formaPago ?? eg.formaPago,
      placa: dto.placa !== undefined ? dto.placa : eg.placa,
      ...dto,
    };
    const vinc = await validarBeneficiarioEgreso(merged);
    if (!vinc.ok) return res.status(vinc.status).json({ message: vinc.message });
    if (req.file?.filename) dto.urlSoporte = upload.publicUrl('egresos', req.file.filename);
    const urlSoporteFinal = dto.urlSoporte || eg.urlSoporte;
    const intangibleVal = validarPagoIntangibleEgreso(
      { ...merged, numTransferencia: merged.numTransferencia ?? dto.numTransferencia ?? eg.numTransferencia },
      urlSoporteFinal,
    );
    if (!intangibleVal.ok) return res.status(intangibleVal.status).json({ message: intangibleVal.message });
    if (vinc.empleado) {
      dto.idEmpleado = vinc.empleado.idEmpleado;
      dto.numeroDocumento = merged.numeroDocumento;
      dto.pagueA = merged.pagueA;
    } else {
      dto.numeroDocumento = merged.numeroDocumento || null;
      dto.idEmpleado = null;
    }
    dto.placa = merged.placa ?? null;
    if (eg.anticipoNomina || eg.idNovedadGenerada) {
      return res.status(409).json({
        message: 'No se puede modificar un egreso de préstamo/adelanto vinculado a nómina',
      });
    }
    delete dto.idPeriodo;
    delete dto.idEmpleado;
    delete dto.idNovedadGenerada;

    const user = req.user?.username || 'sistema';
    Object.assign(eg, dto, { fechaMod: new Date(), userChangeRecord: user });
    if (supervisor) {
      Object.assign(eg, supervisor);
    }
    await eg.save();
    if (eg.idSesion) {
      const { sincronizarDescuadreSesion } = require('../services/descuadreCaja');
      await sincronizarDescuadreSesion(eg.idSesion).catch(() => null);
    }
    const out = await enriquecer(eg.toObject());
    const authTxt = supervisor?.autorizadoPor ? ` (autorizó ${supervisor.autorizadoPor})` : '';
    registrarModificacion(req, 'egreso', antes, eg.toObject(), {
      resumen: `Modificación egreso ${eg._id}${authTxt}`,
    });
    res.json(out);
  } catch (e) {
    next(e);
  }
};

exports.eliminar = async (req, res, next) => {
  try {
    const eg = await Egreso.findById(req.params.id);
    if (!eg) return res.status(404).json({ message: 'Egreso no encontrado' });
    if (esComprobanteAnulado(eg)) {
      return res.status(409).json({ message: 'Este egreso ya está anulado.' });
    }
    const antes = eg.toObject();

    const auth = await autorizarAnulacionComprobante(
      req,
      eg.idSesion,
      'Anular egresos requiere autorización de un administrador.',
    );
    if (!auth.ok) {
      return res.status(auth.status).json({ message: auth.message, code: auth.code });
    }
    const supervisor = auth.supervisor;

    // No se borra: pasa a estado ANULADO con valor en cero conservando consecutivo.
    const motivo = String(req.body?.motivo || req.body?.motivoAnulacion || '').trim() || null;
    eg.set(metadatosAnulacion(req, supervisor, { valorOriginal: num(eg.valorEgreso), motivo }));
    eg.valorEgreso = toDec(0);
    eg.userChangeRecord = req.user?.username || 'sistema';
    eg.fechaMod = new Date();
    await eg.save();

    if (antes.idSesion) {
      const { sincronizarDescuadreSesion } = require('../services/descuadreCaja');
      await sincronizarDescuadreSesion(antes.idSesion).catch(() => null);
    }
    if (antes.anticipoNomina) {
      await eliminarNovedadPorEgreso(antes._id);
    }
    registrarEliminacion(req, 'egreso', antes, {
      resumen: `Anulación egreso ${antes.numRecibo || req.params.id}${sufijoAutoriza(supervisor)}`,
    });
    res.json({ ok: true, estado: 'ANULADO' });
  } catch (e) {
    next(e);
  }
};
