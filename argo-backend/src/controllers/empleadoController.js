const mongoose = require('mongoose');
const Empleado = require('../models/Empleado');
const Egreso = require('../models/Egreso');
const Cargo = require('../models/Cargo');
const DepartamentoEmpresa = require('../models/DepartamentoEmpresa');
const Eps = require('../models/Eps');
const Afp = require('../models/Afp');
const Arl = require('../models/Arl');
const CajaCompensacion = require('../models/CajaCompensacion');
const Usuario = require('../models/Usuario');
const Sede = require('../models/Sede');
const { maxNumericId, insertarCatalogo } = require('../services/programaServicio');
const { pickFields, num } = require('../services/rrhhCatalogo');
const {
  numeroDocumentoQuery,
  normalizarEmpleadoLegacy,
  nombreCompletoEmpleado,
} = require('../utils/empleadoDoc');
const { procesarUsuarioEmpleado, rolDesdeCargoNombre, desvincularUsuariosDeEmpleadoEliminado } = require('../services/empleadoUsuario');
const { normalizarIdSede, asegurarSedePrincipal } = require('../services/sedeContext');
const upload = require('../middleware/upload');

const EMPLEADO_FIELDS = [
  'tipoDocumento',
  'numeroDocumento',
  'primerNombre',
  'segundoNombre',
  'primerApellido',
  'segundoApellido',
  'fechaNacimiento',
  'sexo',
  'correoPersonal',
  'correoCorporativo',
  'telefono',
  'celular',
  'direccion',
  'ciudad',
  'departamento',
  'estadoCivil',
  'fechaIngreso',
  'fechaRetiro',
  'tipoContrato',
  'salario',
  'epsId',
  'afpId',
  'arlId',
  'cajaCompensacionId',
  'cargoId',
  'departamentoId',
  'idSede',
  'estado',
];

const DATE_FIELDS = ['fechaNacimiento', 'fechaIngreso', 'fechaRetiro'];
const UPPER_FIELDS = ['primerNombre', 'segundoNombre', 'primerApellido', 'segundoApellido'];

function toDec(n) {
  return mongoose.Types.Decimal128.fromString(String(Number(n) || 0));
}

function aplicarFoto(dto, files) {
  if (files?.foto?.[0]) {
    dto.urlFoto = upload.publicUrl('empleados', files.foto[0].filename);
  }
}

function pickEmpleado(body) {
  const dto = pickFields(body, EMPLEADO_FIELDS);
  if (dto.numeroDocumento != null) dto.numeroDocumento = String(dto.numeroDocumento).trim();
  if (dto.tipoDocumento) dto.tipoDocumento = String(dto.tipoDocumento).trim().toUpperCase();
  for (const k of UPPER_FIELDS) {
    if (dto[k]) dto[k] = String(dto[k]).trim().toUpperCase();
  }
  for (const k of ['correoPersonal', 'correoCorporativo']) {
    if (dto[k]) dto[k] = String(dto[k]).trim().toLowerCase();
  }
  for (const k of DATE_FIELDS) {
    if (dto[k]) dto[k] = new Date(dto[k]);
  }
  if (dto.salario != null) dto.salario = toDec(dto.salario);
  for (const k of ['epsId', 'afpId', 'arlId', 'cajaCompensacionId', 'cargoId', 'departamentoId']) {
    if (dto[k] != null && dto[k] !== '') dto[k] = Number(dto[k]);
  }
  return dto;
}

async function normalizarIdSedeEmpleado(dto) {
  if (dto.idSede === undefined) return;
  const id = normalizarIdSede(dto.idSede);
  if (!id) {
    dto.idSede = null;
    return;
  }
  await asegurarSedePrincipal();
  const sede = await Sede.findOne({ idSede: id, activa: true }).lean();
  if (!sede) {
    throw Object.assign(new Error('La sede seleccionada no existe o está inactiva'), { status: 400 });
  }
  dto.idSede = id;
}

async function buscarEmpleado(id) {
  const q = String(id);
  const n = Number(q);
  return Empleado.findOne({
    $or: [{ idEmpleado: q }, ...(Number.isFinite(n) ? [{ idEmpleado: n }] : [])],
  }).lean();
}

async function cargoPorId(cargoId) {
  if (!cargoId) return null;
  return Cargo.findOne({ idCargo: cargoId }).lean();
}

async function idsCargosInstructor() {
  const cargos = await Cargo.find({ nombre: /\binstructor/i }).select('idCargo').lean();
  return cargos.map((c) => c.idCargo).filter((id) => id != null);
}

async function resolverFk(emp) {
  const e = normalizarEmpleadoLegacy(emp);
  const [cargo, depto, eps, afp, arl, caja, usuario, sede] = await Promise.all([
    e.cargoId ? Cargo.findOne({ idCargo: e.cargoId }).lean() : null,
    e.departamentoId ? DepartamentoEmpresa.findOne({ idDepartamento: e.departamentoId }).lean() : null,
    e.epsId ? Eps.findOne({ idEps: e.epsId }).lean() : null,
    e.afpId ? Afp.findOne({ idAfp: e.afpId }).lean() : null,
    e.arlId ? Arl.findOne({ idArl: e.arlId }).lean() : null,
    e.cajaCompensacionId
      ? CajaCompensacion.findOne({ idCajaCompensacion: e.cajaCompensacionId }).lean()
      : null,
    e.idUsuario ? Usuario.findById(e.idUsuario).lean() : null,
    e.idSede ? Sede.findOne({ idSede: e.idSede }).lean() : null,
  ]);
  return {
    ...e,
    salario: num(e.salario),
    nombreCompleto: nombreCompletoEmpleado(e),
    cargoNombre: cargo?.nombre || null,
    departamentoNombre: depto?.nombre || null,
    epsNombre: eps?.nombre || null,
    afpNombre: afp?.nombre || null,
    arlNombre: arl?.nombre || null,
    cajaNombre: caja?.nombre || null,
    sedeNombre: sede?.nombre || null,
    idUsuario: e.idUsuario ? String(e.idUsuario) : null,
    usuarioLogin: usuario?.username || null,
    usuarioRol: usuario?.rol || null,
  };
}

async function vincularUsuarioEmpleado(idEmpleado, idUsuario) {
  if (!idUsuario) return;
  await Empleado.updateOne(
    { idEmpleado },
    { $set: { idUsuario, updatedAt: new Date() } },
  );
}

exports.listarInstructores = async (req, res, next) => {
  try {
    const q = (req.query.q || '').toString().trim();
    const soloActivos = req.query.activos !== 'false';
    const cargoIds = await idsCargosInstructor();
    if (!cargoIds.length) return res.json([]);

    const filter = { cargoId: { $in: cargoIds } };
    if (soloActivos) filter.estado = { $in: [/^activo$/i, 'activo', 'ACTIVO', null] };
    if (q.length >= 2) {
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { primerNombre: re },
        { segundoNombre: re },
        { primerApellido: re },
        { segundoApellido: re },
        { numeroDocumento: re },
        { nombre1: re },
        { apellido1: re },
      ];
    }
    const rows = await Empleado.find(filter).sort({ primerApellido: 1, primerNombre: 1 }).lean();
    const out = await Promise.all(rows.map((r) => resolverFk(r)));
    res.json(out);
  } catch (e) {
    next(e);
  }
};

exports.obtenerInstructor = async (req, res, next) => {
  try {
    const emp = await buscarEmpleado(req.params.id);
    if (!emp) return res.status(404).json({ message: 'Instructor no encontrado' });
    const cargoIds = await idsCargosInstructor();
    const esInstructor = cargoIds.some((id) => Number(id) === Number(emp.cargoId));
    if (!emp.cargoId || !esInstructor) {
      return res.status(404).json({ message: 'El empleado no tiene cargo de instructor' });
    }
    res.json(await resolverFk(emp));
  } catch (e) {
    next(e);
  }
};

exports.listar = async (req, res, next) => {
  try {
    const q = (req.query.q || '').toString().trim();
    const soloActivos = req.query.activos !== 'false';
    const filter = {};
    if (soloActivos) filter.estado = { $in: [/^activo$/i, 'activo', 'ACTIVO', null] };
    if (q.length >= 2) {
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { primerNombre: re },
        { segundoNombre: re },
        { primerApellido: re },
        { segundoApellido: re },
        { numeroDocumento: re },
        { nombre1: re },
        { apellido1: re },
      ];
    }
    const rows = await Empleado.find(filter).sort({ primerApellido: 1, primerNombre: 1 }).lean();
    const counts = await Promise.all(
      rows.map((r) => {
        const e = normalizarEmpleadoLegacy(r);
        const qd = numeroDocumentoQuery(e.numeroDocumento);
        return qd
          ? Egreso.countDocuments({ $or: [{ numeroDocumento: e.numeroDocumento }, ...(qd.$or || [])] })
          : Promise.resolve(0);
      }),
    );
    const out = await Promise.all(rows.map((r, i) => resolverFk(r)));
    res.json(out.map((r, i) => ({ ...r, totalEgresos: counts[i] || 0 })));
  } catch (e) {
    next(e);
  }
};

exports.obtener = async (req, res, next) => {
  try {
    const emp = await buscarEmpleado(req.params.id);
    if (!emp) return res.status(404).json({ message: 'Empleado no encontrado' });
    res.json(await resolverFk(emp));
  } catch (e) {
    next(e);
  }
};

function opcionesUsuarioDesdeBody(body) {
  let modoAcceso = 'auto';
  if (['auto', 'ninguno', 'vincular'].includes(String(body?.modoAcceso || '').toLowerCase())) {
    modoAcceso = String(body.modoAcceso).toLowerCase();
  } else if (body?.crearUsuario === false || body?.crearUsuario === 'false') {
    modoAcceso = 'ninguno';
  } else if (body?.idUsuarioExistente || body?.idUsuarioVincular) {
    modoAcceso = 'vincular';
  }
  const idUsuarioExistente = body?.idUsuarioExistente || body?.idUsuarioVincular || null;
  return { modoAcceso, idUsuarioExistente };
}

async function aplicarUsuarioEmpleado(emp, body, cargo, user) {
  const { modoAcceso, idUsuarioExistente } = opcionesUsuarioDesdeBody(body);
  const cargoNombre = cargo?.nombre;
  const rolCargo = rolDesdeCargoNombre(cargoNombre);

  if (modoAcceso === 'auto' && !rolCargo) {
    return null;
  }
  if (modoAcceso === 'vincular' && !idUsuarioExistente) {
    throw Object.assign(new Error('Seleccione el usuario a vincular'), { status: 400 });
  }

  return procesarUsuarioEmpleado(emp, {
    cargoNombre,
    creadoPor: user,
    modoAcceso,
    idUsuarioExistente,
  });
}

function respuestaUsuarioGenerado(usuarioGenerado) {
  if (!usuarioGenerado) return null;
  return {
    username: usuarioGenerado.username,
    passwordInicial: usuarioGenerado.passwordInicial || undefined,
    rol: usuarioGenerado.rol,
    existente: !!usuarioGenerado.existente,
    vinculado: !!usuarioGenerado.vinculado,
  };
}

exports.crear = async (req, res, next) => {
  try {
    const dto = pickEmpleado(req.body);
    aplicarFoto(dto, req.files);
    await normalizarIdSedeEmpleado(dto);
    if (!dto.primerNombre || !dto.primerApellido) {
      return res.status(400).json({ message: 'primerNombre y primerApellido son obligatorios' });
    }
    if (!dto.numeroDocumento) {
      return res.status(400).json({ message: 'numeroDocumento es obligatorio' });
    }
    const dup = await Empleado.findOne(numeroDocumentoQuery(dto.numeroDocumento));
    if (dup) {
      return res.status(409).json({
        message: 'Ya existe un empleado con ese número de documento',
        existingId: dup.idEmpleado,
      });
    }
    const idEmpleado = await maxNumericId(Empleado, 'idEmpleado');
    const user = req.user?.username || 'sistema';
    const now = new Date();
    const doc = {
      idEmpleado,
      ...dto,
      estado: dto.estado || 'activo',
      createdAt: now,
      updatedAt: now,
      userAddReg: user,
      userChangeRecord: user,
    };
    const emp = await insertarCatalogo(Empleado, doc);
    const cargo = await cargoPorId(emp.cargoId);
    const { modoAcceso } = opcionesUsuarioDesdeBody(req.body);
    let usuarioGenerado = null;
    try {
      usuarioGenerado = await aplicarUsuarioEmpleado(emp, req.body, cargo, user);
      if (usuarioGenerado?.idUsuario) {
        await vincularUsuarioEmpleado(emp.idEmpleado, usuarioGenerado.idUsuario);
        emp.idUsuario = usuarioGenerado.idUsuario;
      } else if (usuarioGenerado?.existente && usuarioGenerado.usuario?._id) {
        await vincularUsuarioEmpleado(emp.idEmpleado, usuarioGenerado.usuario._id);
      }
    } catch (err) {
      if (modoAcceso !== 'ninguno') {
        await Empleado.deleteOne({ idEmpleado: emp.idEmpleado });
      }
      const status = err.status || 500;
      if (err.code === 11000) {
        return res.status(409).json({
          message:
            'No se pudo crear el usuario: documento o login duplicado en usuarios. Revise Configuración → Usuarios.',
        });
      }
      return res.status(status).json({ message: err.message });
    }
    const out = await resolverFk(emp);
    res.status(201).json({
      ...out,
      usuarioGenerado: respuestaUsuarioGenerado(usuarioGenerado),
    });
  } catch (e) {
    next(e);
  }
};

exports.actualizar = async (req, res, next) => {
  try {
    const emp = await buscarEmpleado(req.params.id);
    if (!emp) return res.status(404).json({ message: 'Empleado no encontrado' });
    const dto = pickEmpleado(req.body);
    aplicarFoto(dto, req.files);
    await normalizarIdSedeEmpleado(dto);
    const prev = normalizarEmpleadoLegacy(emp);
    if (dto.numeroDocumento) {
      const dup = await Empleado.findOne({
        $and: [numeroDocumentoQuery(dto.numeroDocumento), { idEmpleado: { $ne: emp.idEmpleado } }],
      });
      if (dup) return res.status(409).json({ message: 'Otro empleado ya usa ese documento' });
      const egresos = await Egreso.countDocuments(
        numeroDocumentoQuery(prev.numeroDocumento) || { numeroDocumento: prev.numeroDocumento },
      );
      if (egresos > 0 && dto.numeroDocumento !== prev.numeroDocumento) {
        return res.status(409).json({
          message: 'No puede cambiar numeroDocumento: hay egresos vinculados.',
        });
      }
    }
    const user = req.user?.username || 'sistema';
    await Empleado.updateOne(
      { idEmpleado: emp.idEmpleado },
      { $set: { ...dto, updatedAt: new Date(), userChangeRecord: user } },
    );
    const actualizado = await Empleado.findOne({ idEmpleado: emp.idEmpleado }).lean();
    const cargo = await cargoPorId(actualizado.cargoId ?? dto.cargoId);
    let usuarioGenerado = null;
    try {
      usuarioGenerado = await aplicarUsuarioEmpleado(actualizado, req.body, cargo, user);
      if (usuarioGenerado?.idUsuario) {
        await vincularUsuarioEmpleado(actualizado.idEmpleado, usuarioGenerado.idUsuario);
        actualizado.idUsuario = usuarioGenerado.idUsuario;
      } else if (usuarioGenerado?.existente && usuarioGenerado.usuario?._id) {
        await vincularUsuarioEmpleado(actualizado.idEmpleado, usuarioGenerado.usuario._id);
      }
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({ message: err.message });
    }
    const out = await resolverFk(actualizado);
    res.json({
      ...out,
      usuarioGenerado: respuestaUsuarioGenerado(usuarioGenerado),
    });
  } catch (e) {
    next(e);
  }
};

exports.eliminar = async (req, res, next) => {
  try {
    const emp = await buscarEmpleado(req.params.id);
    if (!emp) return res.status(404).json({ message: 'Empleado no encontrado' });
    const prev = normalizarEmpleadoLegacy(emp);
    const usado = prev.numeroDocumento
      ? await Egreso.countDocuments(
          numeroDocumentoQuery(prev.numeroDocumento) || { numeroDocumento: prev.numeroDocumento },
        )
      : 0;
    if (usado > 0) {
      return res.status(409).json({
        message: 'No se puede eliminar: tiene egresos. Cambie estado a retirado.',
      });
    }
    await desvincularUsuariosDeEmpleadoEliminado(emp.idEmpleado);
    await Empleado.deleteOne({ idEmpleado: emp.idEmpleado });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};
