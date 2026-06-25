const Contratacion = require('../models/Contratacion');
const Cliente = require('../models/Cliente');
const fs = require('fs');
const path = require('path');
const upload = require('../middleware/upload');
const Supervisor = require('../models/Supervisor');
const JornadaCap = require('../models/JornadaCap');
const ClaseJornadaCap = require('../models/ClaseJornadaCap');
const AsisClasJorCap = require('../models/AsisClasJorCap');
const InscripcionClase = require('../models/InscripcionClase');
const Certificado = require('../models/Certificado');
const DatosAlumno = require('../models/DatosAlumno');
const Matricula = require('../models/Matricula');
const { parseNumDoc, numDocQuery } = require('../utils/numDoc');
const { filtroBusquedaAlumno, coincideBusquedaAlumno, coincideBusquedaTexto, coincideBusquedaDocumento } = require('../utils/busquedaAlumnoNombre');
const { parseFechaCalendario, fechaCalendarioParaGuardar, fechaCalendarioIso } = require('../utils/fechaCalendario');
const { calcNumeObjeJornada, generarJornadasContrato } = require('../services/programacionJornadas');
const { cumplimientoParaJornada } = require('../services/cumplimientoJornadaCap');
const {
  auditoriaUsuario,
  asegurarTipoAlumnoJornada,
  esProgramaJornadasCap,
  TIPO_JORNADAS_CAPACITACION,
} = require('../services/jornadaCapacitacion');
const {
  registrarAsistenciaAlumnoEnClase,
  registrarAsistenciasInscritosPendientes,
} = require('../services/asistenciaJornadaCap');
const {
  MOTIVOS_CERT,
  progresoCertificacion,
  validarAlumnoSinCertificadoContrato,
  crearContextoCertificadoContrato,
} = require('../services/certificadoJornadaAuto');
const { buscarPrograma } = require('../services/programaServicio');
const { crearMatriculaDesdeBody } = require('../services/matriculaCreator');
const { ESTADOS_CLASE, UBICACIONES_CLASE, DETE_GEOREFE_VALORES, ESTADO_JORNADA_EN_PROCESO } = require('../constants/jornadaCapacitacion');
const {
  sincronizarEstadoJornada,
  sincronizarEstadosJornadas,
  inicioDia,
  mensajeSiJornadaNoOperable,
  mensajeSiJornadaNoIniciableClase,
  mensajeSiJornadaNoDisponibleParaClase,
} = require('../services/estadoJornadaCap');
const { municipioPorCoords } = require('../services/georefMunicipio');
const {
  normalizarEstadoContrato,
  contratoEstaEnEjecucion,
  cerrarJornadasActivasContrato,
  finalizarContratoCap,
} = require('../services/contratoFinalizacionCap');
const {
  resolverInstructorParaClase,
  listarInstructoresConUsuario,
  enriquecerClases,
  aplicarFiltroClasesQueryPorRol,
} = require('../services/instructorJornada');
const { tieneAlguno, permisosParaRol } = require('../services/rolesPermisos');

async function dtoClaseConJornada(claseDoc) {
  const plain = claseDoc?.toObject ? claseDoc.toObject() : { ...claseDoc };
  const j = await sincronizarEstadoJornada(plain.idJornada);
  if (!plain.fechaClase && j?.fechaProgramacion) {
    plain.fechaClase = inicioDia(j.fechaProgramacion);
  }
  let codContrato = '';
  let contratoLabel = '';
  if (j?.idContrato) {
    const contrato = await Contratacion.findById(j.idContrato)
      .select('codContrato nombreComercial razoSocial')
      .lean();
    if (contrato) {
      codContrato = String(contrato.codContrato || '').trim();
      const cliente = String(contrato.nombreComercial || contrato.razoSocial || '').trim();
      contratoLabel = codContrato
        ? `${codContrato} — ${cliente || 'Contrato'}`
        : cliente || '';
    }
  }
  const [enriched] = await enriquecerClases([
    {
      ...plain,
      fechaJornada: j?.fechaProgramacion,
      jornadaEstado: j?.estado,
      idContrato: j?.idContrato,
      municipioJornada: j?.municipio,
      indiceEnDia: j?.indiceEnDia,
      codContrato,
      contratoLabel,
    },
  ]);
  return enriched;
}
const { normalizarTipoRegularJornada } = require('../constants/tipoRegularJornada');

function parseCoord(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseDeteGeorefe(v) {
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim().toUpperCase();
  if (!s) return '';
  if (!DETE_GEOREFE_VALORES.includes(s)) {
    const err = new Error(`deteGeorefe inválido. Use: ${DETE_GEOREFE_VALORES.join(', ')}`);
    err.status = 400;
    throw err;
  }
  return s;
}

const ESTADOS_CONTRATO = ['En Ejecución', 'Ejecutado'];

const TIPO_ID_DESDE_CLIENTE = {
  '31': 'NIT',
  '13': 'CC',
  '22': 'CE',
  '12': 'TI',
  '41': 'PP',
};

async function syncContratoDesdeCliente(dto) {
  const cli = await Cliente.findById(dto.idClienteFacturacion).lean();
  if (!cli) {
    const err = new Error('Cliente no encontrado. Créelo en Configuración → Clientes.');
    err.status = 400;
    throw err;
  }
  if (cli.activo === false) {
    const err = new Error('El cliente seleccionado está inactivo.');
    err.status = 400;
    throw err;
  }
  dto.numeroIdentificacion = String(cli.identificacion || '').trim();
  dto.tipoIdentificacion =
    TIPO_ID_DESDE_CLIENTE[String(cli.identificationDocumentCode || '').trim()] ||
    String(cli.identificationDocumentCode || 'NIT').trim() ||
    'NIT';
  dto.razoSocial = String(cli.razonSocial || cli.nombres || '').trim();
  dto.nombreComercial = String(cli.nombreComercial || '').trim();
  dto.email = String(cli.correo || '').trim();
  dto.telefono = String(cli.telefono || '').trim();
  if (!String(dto.direccion || '').trim() && cli.direccion) {
    dto.direccion = String(cli.direccion).trim();
  }
  if (!String(dto.codMunicipio || '').trim() && cli.municipioCodigo) {
    dto.codMunicipio = String(cli.municipioCodigo).trim();
  }
  if (!String(dto.ciudad || '').trim() && cli.municipioNombre) {
    dto.ciudad = String(cli.municipioNombre).trim();
  }
  return dto;
}

function enrichContratoRespuesta(c, clienteMap) {
  const cli = c.idClienteFacturacion ? clienteMap.get(String(c.idClienteFacturacion)) : null;
  const base = { ...c, estado: normalizarEstadoContrato(c.estado) };
  if (!cli) return base;
  const nombre = String(cli.nombreComercial || cli.razonSocial || cli.nombres || '').trim();
  return {
    ...base,
    clienteNombre: nombre,
    clienteIdentificacion: cli.identificacion || null,
    razoSocial: String(cli.razonSocial || cli.nombres || base.razoSocial || '').trim(),
    nombreComercial: String(cli.nombreComercial || base.nombreComercial || '').trim(),
    numeroIdentificacion: String(cli.identificacion || base.numeroIdentificacion || '').trim(),
  };
}

async function enrichContratosRespuesta(rows) {
  const ids = [
    ...new Set(
      rows.map((r) => r.idClienteFacturacion).filter(Boolean).map((id) => String(id)),
    ),
  ];
  const clientes = ids.length ? await Cliente.find({ _id: { $in: ids } }).lean() : [];
  const map = new Map(clientes.map((cl) => [String(cl._id), cl]));
  return rows.map((c) => enrichContratoRespuesta(c, map));
}

function pickContrato(body) {
  const fields = [
    'tipoIdentificacion',
    'numeroIdentificacion',
    'codContrato',
    'razoSocial',
    'nombreComercial',
    'email',
    'telefono',
    'direccion',
    'codMunicipio',
    'ciudad',
    'departamento',
    'pais',
    'codigoPostal',
    'estado',
    'fechacontrato',
    'objeto',
    'objetoContrato',
    'supervisor',
    'idSupervisor',
    'numerojornadas',
    'jornadasPorDia',
    'numeroAlumnos',
    'nombreCertificacion',
    'numeroHorascert',
    'incluiSab',
    'incluiDom',
    'incluiFest',
    'fechaInicJornadas',
    'numSesCert',
    'idClienteFacturacion',
    'valorContrato',
  ];
  const dto = {};
  for (const k of fields) {
    if (body[k] !== undefined) dto[k] = body[k];
  }
  if (dto.codContrato != null) dto.codContrato = String(dto.codContrato).trim();
  if (dto.estado != null) dto.estado = normalizarEstadoContrato(dto.estado);
  if (dto.numerojornadas != null) dto.numerojornadas = Math.max(0, parseInt(dto.numerojornadas, 10) || 0);
  if (dto.jornadasPorDia != null) {
    dto.jornadasPorDia = Math.max(1, Math.min(20, parseInt(dto.jornadasPorDia, 10) || 1));
  }
  if (dto.numeroAlumnos != null) dto.numeroAlumnos = Math.max(0, parseInt(dto.numeroAlumnos, 10) || 0);
  if (dto.numSesCert != null) dto.numSesCert = Math.max(1, parseInt(dto.numSesCert, 10) || 1);
  if (dto.valorContrato != null) dto.valorContrato = Math.max(0, Number(dto.valorContrato) || 0);
  if (dto.idClienteFacturacion === '' || dto.idClienteFacturacion == null) {
    dto.idClienteFacturacion = null;
  }
  if (dto.fechaInicJornadas != null && dto.fechaInicJornadas !== '') {
    dto.fechaInicJornadas = fechaCalendarioParaGuardar(dto.fechaInicJornadas);
  }
  dto.numeObjeJornada = calcNumeObjeJornada(dto.numeroAlumnos, dto.numerojornadas);
  return dto;
}

async function enrichContratoDto(dto, prev = null) {
  const clienteId =
    dto.idClienteFacturacion !== undefined
      ? dto.idClienteFacturacion
      : prev?.idClienteFacturacion || null;
  if (!clienteId) {
    const err = new Error(
      'Seleccione la empresa desde el catálogo de clientes (Configuración → Clientes).',
    );
    err.status = 400;
    throw err;
  }
  dto.idClienteFacturacion = clienteId;
  await syncContratoDesdeCliente(dto);
  if (dto.idSupervisor) {
    const sup = await Supervisor.findById(dto.idSupervisor).lean();
    if (sup?.nombre) dto.supervisor = sup.nombre;
  }
  return dto;
}

exports.listarContratos = async (_req, res, next) => {
  try {
    const rows = await Contratacion.find().sort({ createdAt: -1 }).lean();
    res.json(await enrichContratosRespuesta(rows));
  } catch (e) {
    next(e);
  }
};

exports.obtenerContrato = async (req, res, next) => {
  try {
    const c = await Contratacion.findById(req.params.id).lean();
    if (!c) return res.status(404).json({ message: 'Contrato no encontrado' });
    const [enriched] = await enrichContratosRespuesta([c]);
    res.json(enriched);
  } catch (e) {
    next(e);
  }
};

exports.crearContrato = async (req, res, next) => {
  try {
    const dto = await enrichContratoDto(pickContrato(req.body || {}));
    dto.userAddReg = auditoriaUsuario(req);
    const c = await Contratacion.create(dto);
    const [enriched] = await enrichContratosRespuesta([c.toObject ? c.toObject() : c]);
    res.status(201).json(enriched);
  } catch (e) {
    next(e);
  }
};

exports.actualizarContrato = async (req, res, next) => {
  try {
    const prev = await Contratacion.findById(req.params.id).lean();
    if (!prev) return res.status(404).json({ message: 'Contrato no encontrado' });
    const dto = await enrichContratoDto(pickContrato(req.body || {}), prev);
    dto.userChangeRecord = auditoriaUsuario(req);
    const pasoAEjecutado =
      dto.estado === 'Ejecutado' && normalizarEstadoContrato(prev.estado) !== 'Ejecutado';
    if (pasoAEjecutado) {
      dto.fechaFinalizacion = fechaCalendarioParaGuardar(new Date());
    }
    const c = await Contratacion.findByIdAndUpdate(req.params.id, { $set: dto }, { new: true }).lean();
    if (!c) return res.status(404).json({ message: 'Contrato no encontrado' });
    if (pasoAEjecutado) {
      await cerrarJornadasActivasContrato(c._id);
    }
    const [enriched] = await enrichContratosRespuesta([c]);
    res.json(enriched);
  } catch (e) {
    next(e);
  }
};

exports.finalizarContrato = async (req, res, next) => {
  try {
    const c = await Contratacion.findById(req.params.id);
    if (!c) return res.status(404).json({ message: 'Contrato no encontrado' });
    const { contrato, jornadasCerradas } = await finalizarContratoCap(c, {
      fechaFinalizacion: req.body?.fechaFinalizacion,
      userChangeRecord: auditoriaUsuario(req),
    });
    const fechaTxt = contrato.fechaFinalizacion
      ? fechaCalendarioIso(contrato.fechaFinalizacion)
      : fechaCalendarioIso(new Date());
    res.json({
      ok: true,
      contrato: { ...contrato, estado: normalizarEstadoContrato(contrato.estado) },
      jornadasCerradas,
      message: `Contrato finalizado el ${fechaTxt}. ${jornadasCerradas} jornada(s) cerrada(s).`,
    });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};

exports.eliminarContrato = async (req, res, next) => {
  try {
    const c = await Contratacion.findById(req.params.id);
    if (!c) return res.status(404).json({ message: 'Contrato no encontrado' });

    const jornadasIds = await JornadaCap.find({ idContrato: c._id }).distinct('_id');
    const totalJornadas = jornadasIds.length;
    const totalClases = totalJornadas
      ? await ClaseJornadaCap.countDocuments({ idJornada: { $in: jornadasIds } })
      : 0;
    const clasesIds = totalClases
      ? await ClaseJornadaCap.find({ idJornada: { $in: jornadasIds } }).distinct('_id')
      : [];
    const totalAsis = clasesIds.length
      ? await AsisClasJorCap.countDocuments({ idclaseJornada: { $in: clasesIds } })
      : 0;

    if (totalAsis > 0 || totalClases > 0) {
      return res.status(400).json({
        message: `No se puede eliminar: el contrato tiene ${totalJornadas} jornada(s), ${totalClases} clase(s) y ${totalAsis} asistencia(s) relacionadas.`,
        relaciones: { jornadas: totalJornadas, clases: totalClases, asistencias: totalAsis },
      });
    }

    if (totalJornadas > 0) {
      await JornadaCap.deleteMany({ _id: { $in: jornadasIds } });
    }
    await Contratacion.deleteOne({ _id: c._id });

    res.json({
      ok: true,
      message: totalJornadas > 0
        ? `Contrato eliminado junto a ${totalJornadas} jornada(s) sin clases.`
        : 'Contrato eliminado.',
      jornadasEliminadas: totalJornadas,
    });
  } catch (e) {
    next(e);
  }
};

exports.generarJornadas = async (req, res, next) => {
  try {
    const c = await Contratacion.findById(req.params.id);
    if (!c) return res.status(404).json({ message: 'Contrato no encontrado' });
    const result = await generarJornadasContrato(c, auditoriaUsuario(req));
    c.numeObjeJornada = result.numeObjeJornada;
    c.jornadasGeneradas = true;
    c.userChangeRecord = auditoriaUsuario(req);
    await c.save();
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(400).json({ message: e.message || 'Error generando jornadas' });
  }
};

/** Jornadas de un día (p. ej. operación en carpa). */
exports.jornadasDelDia = async (req, res, next) => {
  try {
    const base = req.query.fecha ? parseFechaCalendario(req.query.fecha) : parseFechaCalendario(new Date());
    if (!base) return res.status(400).json({ message: 'Fecha inválida' });
    const start = new Date(base.getTime());
    const end = new Date(base.getTime());
    end.setHours(23, 59, 59, 999);
    const q = { fechaProgramacion: { $gte: start, $lte: end } };
    if (req.query.idContrato) q.idContrato = req.query.idContrato;
    const rows = await JornadaCap.find(q).sort({ fechaProgramacion: 1, indiceEnDia: 1 }).lean();
    const synced = await sincronizarEstadosJornadas(rows);
    const out = [];
    for (const j of synced) {
      const c = await Contratacion.findById(j.idContrato).lean();
      out.push({
        ...j,
        contratoLabel: c?.codContrato
          ? `${c.codContrato} — ${c?.nombreComercial || c?.razoSocial || ''}`
          : c?.nombreComercial || c?.razoSocial || '',
        codContrato: c?.codContrato || '',
        numSesCert: c?.numSesCert,
      });
    }
    res.json(out);
  } catch (e) {
    next(e);
  }
};

async function enrichJornadaConContrato(j) {
  const c = await Contratacion.findById(j.idContrato).lean();
  const cliente = String(c?.nombreComercial || c?.razoSocial || '').trim();
  return {
    ...j,
    contratoLabel: c?.codContrato
      ? `${c.codContrato} — ${cliente || 'Contrato'}`
      : cliente || '',
    codContrato: c?.codContrato || '',
    clienteNombre: cliente,
    numeroAlumnos: Math.max(0, parseInt(c?.numeroAlumnos, 10) || 0),
    numSesCert: c?.numSesCert,
  };
}

async function enrichJornadaEnProceso(j) {
  const c = await Contratacion.findById(j.idContrato).lean();
  const base = await enrichJornadaConContrato(j);
  const cumpl = await cumplimientoParaJornada(j, c);
  return { ...base, ...cumpl };
}

/** Todas las jornadas EN PROCESO hoy, solo contratos en ejecución. */
exports.jornadasEnProceso = async (_req, res, next) => {
  try {
    const rows = await JornadaCap.find({}).sort({ fechaProgramacion: 1, indiceEnDia: 1 }).lean();
    const synced = await sincronizarEstadosJornadas(rows);
    const enProceso = synced.filter((j) => j && j.estado === ESTADO_JORNADA_EN_PROCESO);
    const out = [];
    for (const j of enProceso) {
      const c = await Contratacion.findById(j.idContrato).select('estado').lean();
      if (!contratoEstaEnEjecucion(c?.estado)) continue;
      out.push(await enrichJornadaEnProceso(j));
    }
    res.json(out);
  } catch (e) {
    next(e);
  }
};

exports.listarJornadas = async (req, res, next) => {
  try {
    const q = {};
    if (req.query.idContrato) q.idContrato = req.query.idContrato;
    if (req.query.desde || req.query.hasta) {
      q.fechaProgramacion = {};
      if (req.query.desde) {
        const d = parseFechaCalendario(req.query.desde);
        if (d) q.fechaProgramacion.$gte = d;
      }
      if (req.query.hasta) {
        const h = parseFechaCalendario(req.query.hasta);
        if (h) {
          h.setHours(23, 59, 59, 999);
          q.fechaProgramacion.$lte = h;
        }
      }
    }
    if (req.query.creadoDesde) {
      const d = new Date(String(req.query.creadoDesde));
      if (!Number.isNaN(d.getTime())) q.createdAt = { $gte: d };
    }
    const rows = await JornadaCap.find(q).sort({ fechaProgramacion: 1, indiceEnDia: 1 }).lean();
    res.json(await sincronizarEstadosJornadas(rows));
  } catch (e) {
    next(e);
  }
};

exports.resolverMunicipioGeoref = async (req, res, next) => {
  try {
    const lat = parseCoord(req.query.lat);
    const lng = parseCoord(req.query.lng);
    if (lat == null || lng == null) {
      return res.status(400).json({ message: 'lat y lng son obligatorios' });
    }
    const geo = await municipioPorCoords(lat, lng);
    res.json(geo);
  } catch (e) {
    next(e);
  }
};

exports.actualizarJornada = async (req, res, next) => {
  try {
    const actual = await JornadaCap.findById(req.params.id).lean();
    if (!actual) return res.status(404).json({ message: 'Jornada no encontrada' });

    const { supervisor, municipio, depto, codMunicipio, direccion, lat, lng, deteGeorefe, fechaProgramacion } =
      req.body || {};
    const dto = { userChangeRecord: auditoriaUsuario(req) };
    if (supervisor != null) dto.supervisor = String(supervisor).trim();
    if (direccion != null) dto.direccion = String(direccion).trim();
    if (lat !== undefined) dto.lat = parseCoord(lat);
    if (lng !== undefined) dto.lng = parseCoord(lng);
    if (deteGeorefe !== undefined) dto.deteGeorefe = parseDeteGeorefe(deteGeorefe);
    if (municipio != null) dto.municipio = String(municipio).trim();
    if (depto != null) dto.depto = String(depto).trim();
    if (codMunicipio != null) dto.codMunicipio = String(codMunicipio).trim();

    if (fechaProgramacion != null && fechaProgramacion !== '') {
      const nuevaFecha = fechaCalendarioParaGuardar(fechaProgramacion);
      if (!nuevaFecha) {
        return res.status(400).json({ message: 'Fecha de programación inválida' });
      }
      const mismaFecha =
        fechaCalendarioIso(actual.fechaProgramacion) === fechaCalendarioIso(nuevaFecha);
      if (!mismaFecha) {
        const dup = await JornadaCap.findOne({
          idContrato: actual.idContrato,
          fechaProgramacion: nuevaFecha,
          indiceEnDia: actual.indiceEnDia || 1,
          _id: { $ne: actual._id },
        }).lean();
        if (dup) {
          return res.status(400).json({
            message: `Ya existe otra jornada del contrato en esa fecha (carpa #${actual.indiceEnDia || 1}).`,
          });
        }
        dto.fechaProgramacion = nuevaFecha;
      }
    }

    const coordsEnviadas = lat !== undefined || lng !== undefined;
    if (coordsEnviadas) {
      if (dto.lat != null && dto.lng != null) {
        const georefActivo =
          dto.deteGeorefe === 'MAPA' || dto.deteGeorefe === 'DISPOSITIVO_MOVIL';
        const faltaUbicacion = !dto.municipio || !dto.depto;
        if (georefActivo && faltaUbicacion) {
          try {
            const geo = await municipioPorCoords(dto.lat, dto.lng);
            dto.municipio = geo.municipio || dto.municipio || '';
            dto.depto = geo.depto || dto.depto || '';
            if (geo.codMunicipio) dto.codMunicipio = geo.codMunicipio;
          } catch (err) {
            console.warn('[georef] No se pudo resolver municipio:', err.message);
          }
        }
      } else {
        dto.municipio = '';
        dto.depto = '';
        dto.codMunicipio = '';
        dto.deteGeorefe = '';
      }
    }

    const j = await JornadaCap.findByIdAndUpdate(req.params.id, { $set: dto }, { new: true }).lean();
    if (!j) return res.status(404).json({ message: 'Jornada no encontrada' });

    if (dto.fechaProgramacion) {
      await ClaseJornadaCap.updateMany(
        { idJornada: j._id },
        { $set: { fechaClase: parseFechaCalendario(dto.fechaProgramacion) } },
      );
    }

    res.json(await sincronizarEstadoJornada(j));
  } catch (e) {
    next(e);
  }
};

exports.eliminarJornada = async (req, res, next) => {
  try {
    const jornada = await JornadaCap.findById(req.params.id).lean();
    if (!jornada) return res.status(404).json({ message: 'Jornada no encontrada' });

    const clases = await ClaseJornadaCap.find({ idJornada: jornada._id }).lean();
    for (const c of clases) {
      const nAsis = await AsisClasJorCap.countDocuments({ idclaseJornada: c._id });
      if (nAsis > 0) {
        return res.status(400).json({
          message: `No se puede eliminar: una clase de esta jornada tiene ${nAsis} asistencia(s)`,
        });
      }
    }

    await ClaseJornadaCap.deleteMany({ idJornada: jornada._id });
    await JornadaCap.deleteOne({ _id: jornada._id });

    const restantes = await JornadaCap.countDocuments({ idContrato: jornada.idContrato });
    await Contratacion.updateOne(
      { _id: jornada.idContrato },
      { $set: { jornadasGeneradas: restantes > 0 } },
    );

    res.json({
      ok: true,
      message: 'Jornada eliminada',
      restantes,
    });
  } catch (e) {
    next(e);
  }
};

exports.listarClases = async (req, res, next) => {
  try {
    const q = {};
    if (req.query.idJornada) q.idJornada = req.query.idJornada;
    if (req.query.idContrato) {
      const jornadaIds = await JornadaCap.find({ idContrato: req.query.idContrato }).distinct('_id');
      q.idJornada = { $in: jornadaIds };
    }
    if (req.query.creadoDesde) {
      const d = new Date(String(req.query.creadoDesde));
      if (!Number.isNaN(d.getTime())) q.createdAt = { $gte: d };
    }

    const { vacio } = await aplicarFiltroClasesQueryPorRol(q, req);
    if (vacio) return res.json([]);

    const rows = await ClaseJornadaCap.find(q).sort({ createdAt: -1 }).lean();
    const out = [];
    for (const c of rows) {
      const j = await sincronizarEstadoJornada(c.idJornada);
      out.push({
        ...c,
        fechaJornada: j?.fechaProgramacion,
        jornadaEstado: j?.estado,
        idContrato: j?.idContrato,
        municipioJornada: j?.municipio,
      });
    }
    res.json(await enriquecerClases(out));
  } catch (e) {
    next(e);
  }
};

exports.obtenerClase = async (req, res, next) => {
  try {
    const q = { _id: req.params.id };
    const { vacio } = await aplicarFiltroClasesQueryPorRol(q, req);
    if (vacio) return res.status(404).json({ message: 'Clase no encontrada' });
    const clase = await ClaseJornadaCap.findOne(q).lean();
    if (!clase) return res.status(404).json({ message: 'Clase no encontrada' });
    res.json(await dtoClaseConJornada(clase));
  } catch (e) {
    next(e);
  }
};

/** Clases del día calendario (por defecto hoy): PROGRAMADA, EN PROCESO y FINALIZADO. Admin/ver: todas; instructor: solo las suyas. */
exports.clasesDelDia = async (req, res, next) => {
  try {
    const base = req.query.fecha ? parseFechaCalendario(req.query.fecha) : parseFechaCalendario(new Date());
    if (!base) return res.status(400).json({ message: 'Fecha inválida' });
    const start = inicioDia(base);
    const end = new Date(start.getTime());
    end.setHours(23, 59, 59, 999);

    const q = {
      fechaClase: { $gte: start, $lte: end },
      estado: { $in: ['PROGRAMADA', 'EN PROCESO', 'FINALIZADO'] },
    };

    const permisos = req.permisos || (await permisosParaRol(req.user?.rol));
    const esAdminJornadas = tieneAlguno(permisos, ['jornadas.gestionar']);
    const esInstructorOperar =
      !esAdminJornadas && tieneAlguno(permisos, ['jornadas.operar']);
    if (esInstructorOperar) {
      const { vacio } = await aplicarFiltroClasesQueryPorRol(q, req);
      if (vacio) return res.json([]);
    }

    const rows = await ClaseJornadaCap.find(q).sort({ horaInicio: 1, createdAt: 1 }).lean();
    const raw = [];
    for (const c of rows) {
      const j = await sincronizarEstadoJornada(c.idJornada);
      if (!j) continue;
      const contrato = j.idContrato
        ? await Contratacion.findById(j.idContrato)
            .select('codContrato estado nombreComercial razoSocial')
            .lean()
        : null;
      if (!contratoEstaEnEjecucion(contrato?.estado)) continue;
      const cliente = String(contrato?.nombreComercial || contrato?.razoSocial || '').trim();
      raw.push({
        ...c,
        fechaJornada: j.fechaProgramacion,
        jornadaEstado: j.estado,
        idContrato: j.idContrato,
        municipioJornada: j.municipio,
        direccionJornada: j.direccion,
        indiceEnDia: j.indiceEnDia,
        codContrato: contrato?.codContrato || '',
        contratoLabel: contrato?.codContrato
          ? `${contrato.codContrato} — ${cliente || 'Contrato'}`
          : cliente || '',
      });
    }

    const enriched = await enriquecerClases(raw);
    enriched.sort((a, b) => {
      const prio = (est) => {
        if (est === 'EN PROCESO') return 0;
        if (est === 'PROGRAMADA') return 1;
        if (est === 'FINALIZADO') return 2;
        return 3;
      };
      const pa = prio(a.estado);
      const pb = prio(b.estado);
      if (pa !== pb) return pa - pb;
      const ha = a.horaInicio ? new Date(a.horaInicio).getTime() : 0;
      const hb = b.horaInicio ? new Date(b.horaInicio).getTime() : 0;
      return ha - hb;
    });
    res.json(enriched);
  } catch (e) {
    next(e);
  }
};

exports.listarInstructores = async (req, res, next) => {
  try {
    res.json(await listarInstructoresConUsuario());
  } catch (e) {
    next(e);
  }
};

exports.crearClase = async (req, res, next) => {
  try {
    const { idJornada, idPrograma, ubicacion } = req.body || {};
    if (!idJornada || !idPrograma) {
      return res.status(400).json({ message: 'idJornada e idPrograma son obligatorios' });
    }
    const jornada = await sincronizarEstadoJornada(idJornada);
    if (!jornada) return res.status(404).json({ message: 'Jornada no encontrada' });
    const bloqueo = mensajeSiJornadaNoDisponibleParaClase(jornada);
    if (bloqueo) return res.status(400).json({ message: bloqueo });
    const prog = await buscarPrograma(idPrograma);
    if (!prog) return res.status(404).json({ message: 'Programa no encontrado' });
    if (!(await esProgramaJornadasCap(prog))) {
      return res.status(400).json({ message: 'El programa no es de Jornadas de Capacitación' });
    }
    const instructor = await resolverInstructorParaClase(req, req.body || {});
    const ubi = UBICACIONES_CLASE.includes(ubicacion) ? ubicacion : 'Carpa';
    const clase = await ClaseJornadaCap.create({
      idJornada,
      fechaClase: inicioDia(jornada.fechaProgramacion),
      idPrograma: String(prog.idPrograma ?? prog._id ?? idPrograma),
      ubicacion: ubi,
      estado: 'PROGRAMADA',
      horaInicio: null,
      horaFin: null,
      duracionSegundos: null,
      idinstructor: instructor.idinstructor,
      idEmpleadoInstructor: instructor.idEmpleadoInstructor,
      idUsuarioInstructor: instructor.idUsuarioInstructor,
      userAddReg: auditoriaUsuario(req),
    });
    res.status(201).json(await dtoClaseConJornada(clase));
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};

function parseHoraClase(fechaClase, horaStr) {
  const m = String(horaStr ?? '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) {
    const err = new Error('Formato de hora inválido. Use HH:mm (ej. 08:30).');
    err.status = 400;
    throw err;
  }
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) {
    const err = new Error('Hora fuera de rango.');
    err.status = 400;
    throw err;
  }
  const base = fechaClase ? inicioDia(fechaClase) : inicioDia(new Date());
  base.setHours(h, min, 0, 0);
  return base;
}

exports.actualizarClase = async (req, res, next) => {
  try {
    const clase = await ClaseJornadaCap.findById(req.params.id);
    if (!clase) return res.status(404).json({ message: 'Clase no encontrada' });

    const { idPrograma, ubicacion, idEmpleadoInstructor, horaInicio, horaFin } = req.body || {};
    const dto = { userChangeRecord: auditoriaUsuario(req) };
    const permisos = req.permisos || (await permisosParaRol(req.user?.rol));
    const esAdminJornadas = tieneAlguno(permisos, ['jornadas.gestionar']);

    if (ubicacion != null) {
      dto.ubicacion = UBICACIONES_CLASE.includes(ubicacion) ? ubicacion : clase.ubicacion;
    }

    if (idEmpleadoInstructor != null && esAdminJornadas) {
      const instructor = await resolverInstructorParaClase(req, { idEmpleadoInstructor });
      dto.idinstructor = instructor.idinstructor;
      dto.idEmpleadoInstructor = instructor.idEmpleadoInstructor;
      dto.idUsuarioInstructor = instructor.idUsuarioInstructor;
    }

    if (idPrograma != null && String(idPrograma) !== String(clase.idPrograma)) {
      const nAsis = await AsisClasJorCap.countDocuments({ idclaseJornada: clase._id });
      if (nAsis > 0) {
        return res.status(400).json({
          message: 'No puede cambiar el programa: la clase ya tiene asistencias registradas',
        });
      }
      const prog = await buscarPrograma(idPrograma);
      if (!prog) return res.status(404).json({ message: 'Programa no encontrado' });
      if (!(await esProgramaJornadasCap(prog))) {
        return res.status(400).json({ message: 'El programa no es de Jornadas de Capacitación' });
      }
      dto.idPrograma = String(prog.idPrograma ?? prog._id ?? idPrograma);
    }

    if (esAdminJornadas && (horaInicio !== undefined || horaFin !== undefined)) {
      let fechaRef = clase.fechaClase;
      if (!fechaRef) {
        const j = await JornadaCap.findById(clase.idJornada).select('fechaProgramacion').lean();
        fechaRef = j?.fechaProgramacion ? inicioDia(j.fechaProgramacion) : null;
      }

      if (horaInicio !== undefined) {
        dto.horaInicio =
          horaInicio === null || String(horaInicio).trim() === ''
            ? null
            : parseHoraClase(fechaRef, horaInicio);
      }
      if (horaFin !== undefined) {
        dto.horaFin =
          horaFin === null || String(horaFin).trim() === ''
            ? null
            : parseHoraClase(fechaRef, horaFin);
      }

      const hi = dto.horaInicio !== undefined ? dto.horaInicio : clase.horaInicio;
      const hf = dto.horaFin !== undefined ? dto.horaFin : clase.horaFin;
      if (hf && !hi) {
        return res.status(400).json({ message: 'Indique la hora de inicio antes de la hora de fin.' });
      }
      if (hi && hf && hf.getTime() <= hi.getTime()) {
        return res.status(400).json({ message: 'La hora de fin debe ser posterior a la de inicio.' });
      }
      if (hi && hf) {
        dto.duracionSegundos = Math.max(0, Math.round((hf.getTime() - hi.getTime()) / 1000));
        dto.estado = 'FINALIZADO';
      } else if (hi && !hf) {
        dto.duracionSegundos = null;
        if (clase.estado !== 'FINALIZADO') dto.estado = 'EN PROCESO';
      } else if (!hi) {
        dto.duracionSegundos = null;
        if (dto.horaFin === null && clase.estado === 'FINALIZADO') {
          dto.estado = 'EN PROCESO';
        }
      }
    }

    Object.assign(clase, dto);
    await clase.save();
    res.json(await dtoClaseConJornada(clase));
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};

exports.eliminarClase = async (req, res, next) => {
  try {
    const clase = await ClaseJornadaCap.findById(req.params.id);
    if (!clase) return res.status(404).json({ message: 'Clase no encontrada' });

    if (String(clase.estado || '').toUpperCase() === 'FINALIZADO') {
      return res.status(409).json({
        message:
          'No se puede eliminar una clase finalizada. Conserva historial, asistencias y certificados emitidos.',
      });
    }

    const asistencias = await AsisClasJorCap.deleteMany({ idclaseJornada: clase._id });
    const inscritos = await InscripcionClase.deleteMany({ idClase: clase._id });
    if (clase.urlforo) {
      const fotoPath = upload.resolvePath(clase.urlforo);
      if (fotoPath && fs.existsSync(fotoPath)) {
        try {
          fs.unlinkSync(fotoPath);
        } catch (_) {
          /* ignore */
        }
      }
    }
    await ClaseJornadaCap.deleteOne({ _id: clase._id });
    res.json({
      ok: true,
      message: 'Clase eliminada',
      asistenciasEliminadas: asistencias.deletedCount || 0,
      inscripcionesEliminadas: inscritos.deletedCount || 0,
    });
  } catch (e) {
    next(e);
  }
};

exports.iniciarClase = async (req, res, next) => {
  try {
    const clase = await ClaseJornadaCap.findById(req.params.id);
    if (!clase) return res.status(404).json({ message: 'Clase no encontrada' });
    if (clase.estado === 'FINALIZADO') {
      return res.status(409).json({ message: 'La clase ya está finalizada.' });
    }
    if (clase.estado === 'EN PROCESO' && clase.horaInicio) {
      return res.status(409).json({ message: 'La clase ya está EN PROCESO.' });
    }
    const jornada = await sincronizarEstadoJornada(clase.idJornada);
    if (!jornada) return res.status(404).json({ message: 'Jornada no encontrada' });
    const bloqueo = mensajeSiJornadaNoIniciableClase(jornada);
    if (bloqueo) return res.status(400).json({ message: bloqueo });
    clase.horaInicio = new Date();
    clase.horaFin = null;
    clase.duracionSegundos = null;
    clase.estado = 'EN PROCESO';
    clase.userChangeRecord = auditoriaUsuario(req);
    await clase.save();
    res.json(await dtoClaseConJornada(clase));
  } catch (e) {
    next(e);
  }
};

exports.finalizarClase = async (req, res, next) => {
  try {
    const clase = await ClaseJornadaCap.findById(req.params.id);
    if (!clase) return res.status(404).json({ message: 'Clase no encontrada' });
    if (clase.estado === 'FINALIZADO') {
      return res.status(409).json({ message: 'La clase ya está finalizada.' });
    }
    if (clase.estado !== 'EN PROCESO' || !clase.horaInicio) {
      return res.status(409).json({ message: 'Inicie la clase antes de finalizarla.' });
    }
    clase.horaFin = new Date();
    clase.duracionSegundos = Math.max(
      0,
      Math.round((clase.horaFin.getTime() - clase.horaInicio.getTime()) / 1000),
    );
    clase.estado = 'FINALIZADO';
    clase.userChangeRecord = auditoriaUsuario(req);
    await clase.save();

    const syncAsis = await registrarAsistenciasInscritosPendientes(req, clase, {
      omitirValidacionJornada: true,
    });

    const jornada = await JornadaCap.findById(clase.idJornada).lean();
    res.json({
      clase: await dtoClaseConJornada(clase),
      idContrato: jornada?.idContrato,
      asistenciasRegistradas: syncAsis.registradas,
      certificadosGenerados: syncAsis.certificadosNuevos,
      certificadosEmitidos: syncAsis.certificadosEmitidos || [],
      mensajeAsistencias:
        syncAsis.registradas > 0
          ? `Se registró asistencia de ${syncAsis.registradas} alumno(s) al finalizar la clase.`
          : null,
    });
  } catch (e) {
    next(e);
  }
};

/** Registra asistencia de todos los inscritos pendientes (clases ya finalizadas). */
exports.sincronizarAsistenciasInscritos = async (req, res, next) => {
  try {
    const clase = await ClaseJornadaCap.findById(req.params.id);
    if (!clase) return res.status(404).json({ message: 'Clase no encontrada' });

    const syncAsis = await registrarAsistenciasInscritosPendientes(req, clase, {
      omitirValidacionJornada: true,
    });

    res.json({
      ...syncAsis,
      message:
        syncAsis.registradas > 0
          ? `Asistencia registrada para ${syncAsis.registradas} alumno(s). Certificados nuevos: ${syncAsis.certificadosNuevos}.`
          : syncAsis.omitidosCertificados > 0
            ? 'Todos los inscritos pendientes ya tienen certificado vigente en el contrato o asistencia registrada.'
            : 'No había inscritos pendientes de asistencia.',
    });
  } catch (e) {
    next(e);
  }
};

/** Sube foto de evidencia a uploads/evidenciascap/{codContrato}/fotos/ y guarda urlforo. */
exports.subirFotoEvidenciaClase = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Debe enviar una imagen (campo foto)' });
    const clase = req.claseEvidencia;
    if (!clase) return res.status(404).json({ message: 'Clase no encontrada' });

    const rel = path.relative(upload.baseDir, req.file.path).replace(/\\/g, '/');
    const prev = clase.urlforo;
    if (prev && prev !== rel) {
      const prevPath = upload.resolvePath(prev);
      if (prevPath && fs.existsSync(prevPath)) {
        try {
          fs.unlinkSync(prevPath);
        } catch (_) {
          /* ignore */
        }
      }
    }

    clase.urlforo = rel;
    clase.userChangeRecord = auditoriaUsuario(req);
    await clase.save();
    res.json(await dtoClaseConJornada(clase));
  } catch (e) {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (_) {
        /* ignore */
      }
    }
    next(e);
  }
};

exports.registrarAsistencia = async (req, res, next) => {
  try {
    const { numDoc: numDocRaw } = req.body || {};
    const clase = await ClaseJornadaCap.findById(req.params.id).lean();
    if (!clase) return res.status(404).json({ message: 'Clase no encontrada' });

    const jornada = await sincronizarEstadoJornada(clase.idJornada);
    const ctxCert = jornada?.idContrato
      ? await crearContextoCertificadoContrato(jornada.idContrato)
      : null;
    const payload = await registrarAsistenciaAlumnoEnClase(req, clase, numDocRaw, {
      jornada,
      ctxCert,
    });

    if (payload.duplicada) {
      return res.status(409).json({
        message: 'El alumno ya tiene asistencia registrada en esta clase',
        ...payload,
      });
    }

    let message = `Asistencia registrada (${payload.sesiones}/${payload.numSesCert} sesiones del contrato)`;
    if (payload.certificadoGenerado) {
      message = payload.mensajeCertificado || 'Certificado emitido automáticamente.';
    } else if (payload.cumplioSesiones && payload.motivoCertificado === 'ya_certificado') {
      message = 'Asistencia registrada. El alumno ya tiene certificado para este contrato.';
    } else if (payload.motivoCertificado && MOTIVOS_CERT[payload.motivoCertificado]) {
      message = `${message}. Certificado: ${MOTIVOS_CERT[payload.motivoCertificado]}`;
    }

    res.status(201).json({ ...payload, message });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};

/** Borra la asistencia de un alumno en una clase. Instructor: solo EN PROCESO. Admin: siempre. */
exports.eliminarAsistenciaAlumno = async (req, res, next) => {
  try {
    const numDoc = parseNumDoc(req.params.numDoc);
    if (numDoc == null) return res.status(400).json({ message: 'numDoc inválido' });

    const clase = await ClaseJornadaCap.findById(req.params.id).lean();
    if (!clase) return res.status(404).json({ message: 'Clase no encontrada' });

    const permisos = req.permisos || (await permisosParaRol(req.user?.rol));
    const esAdminJornadas = tieneAlguno(permisos, ['jornadas.gestionar']);
    if (!esAdminJornadas) {
      if (clase.estado === 'FINALIZADO') {
        return res.status(400).json({
          message: 'La clase ya está finalizada. Solo un administrador puede borrar asistencias.',
        });
      }
      if (clase.estado !== 'EN PROCESO') {
        return res.status(400).json({
          message: 'Solo puede borrar asistencias cuando la clase está EN PROCESO.',
        });
      }
    }

    const eliminado = await AsisClasJorCap.findOneAndDelete({
      idclaseJornada: clase._id,
      numDocAlumno: numDoc,
    });
    if (!eliminado) {
      return res.status(404).json({ message: 'El alumno no tenía asistencia registrada en esta clase.' });
    }

    res.json({ ok: true, numDoc });
  } catch (e) {
    next(e);
  }
};

/** Quita la inscripción de un alumno en una clase (no afecta la matrícula al programa). */
exports.quitarInscripcionClase = async (req, res, next) => {
  try {
    const numDoc = parseNumDoc(req.params.numDoc);
    if (numDoc == null) return res.status(400).json({ message: 'numDoc inválido' });

    const clase = await ClaseJornadaCap.findById(req.params.id).lean();
    if (!clase) return res.status(404).json({ message: 'Clase no encontrada' });

    const permisos = req.permisos || (await permisosParaRol(req.user?.rol));
    const esAdminJornadas = tieneAlguno(permisos, ['jornadas.gestionar']);
    if (clase.estado === 'FINALIZADO' && !esAdminJornadas) {
      return res.status(400).json({
        message: 'La clase ya está finalizada. Solo un administrador puede quitar alumnos.',
      });
    }

    const asistenciaEliminada = await AsisClasJorCap.findOneAndDelete({
      idclaseJornada: clase._id,
      numDocAlumno: numDoc,
    });

    const eliminado = await InscripcionClase.findOneAndDelete({
      idClase: clase._id,
      numDoc,
    });
    if (!eliminado) {
      return res.status(404).json({ message: 'El alumno no estaba inscrito en esta clase.' });
    }

    res.json({ ok: true, numDoc, asistenciaEliminada: !!asistenciaEliminada });
  } catch (e) {
    next(e);
  }
};

/** Alumnos matriculados al programa de la clase, con bandera de asistencia en ella. */
exports.inscritosClase = async (req, res, next) => {
  try {
    const clase = await ClaseJornadaCap.findById(req.params.id).lean();
    if (!clase) return res.status(404).json({ message: 'Clase no encontrada' });

    const jornada = await JornadaCap.findById(clase.idJornada).lean();
    const inscripciones = await InscripcionClase.find({ idClase: clase._id })
      .sort({ createdAt: 1 })
      .lean();
    const docs = inscripciones
      .map((i) => Number(i.numDoc))
      .filter((n) => Number.isFinite(n));
    const alumnos = docs.length
      ? await DatosAlumno.find({ numDoc: { $in: docs } }).lean()
      : [];
    const mapAlu = new Map(alumnos.map((a) => [Number(a.numDoc), a]));
    const asistencias = await AsisClasJorCap.find({ idclaseJornada: clase._id }).lean();
    const mapAsis = new Map(asistencias.map((a) => [Number(a.numDocAlumno), a]));
    let mapCert = new Map();
    if (jornada?.idContrato && docs.length) {
      const certs = await Certificado.find({
        numDoc: { $in: docs },
        idContrato: jornada.idContrato,
        estado: { $ne: 'anulado' },
      }).lean();
      mapCert = new Map(certs.map((c) => [Number(c.numDoc), c]));
    }
    const out = inscripciones.map((ins) => {
      const nd = Number(ins.numDoc);
      const al = mapAlu.get(nd);
      const asis = mapAsis.get(nd);
      const cert = mapCert.get(nd);
      return {
        numDoc: nd,
        nombreCompleto: al
          ? [al.nombre1, al.nombre2, al.apellido1, al.apellido2].filter(Boolean).join(' ')
          : '',
        tieneAsistencia: !!asis,
        asistenciaAt: asis?.createdAt || null,
        fechaInscripcion: ins.createdAt,
        yaCertificadoContrato: !!cert,
        certificadoCodigo: cert?.codigoCert || null,
        certificadoId: cert?._id ? String(cert._id) : null,
      };
    });
    res.json(out);
  } catch (e) {
    next(e);
  }
};

exports.listarAsistenciasClase = async (req, res, next) => {
  try {
    const rows = await AsisClasJorCap.find({ idclaseJornada: req.params.id })
      .sort({ createdAt: -1 })
      .lean();
    const out = [];
    for (const a of rows) {
      const al = await DatosAlumno.findOne(numDocQuery(a.numDocAlumno)).lean();
      out.push({
        ...a,
        nombreCompleto: al
          ? [al.nombre1, al.nombre2, al.apellido1, al.apellido2].filter(Boolean).join(' ')
          : '',
      });
    }
    res.json(out);
  } catch (e) {
    next(e);
  }
};

exports.certificadosGenerados = async (req, res, next) => {
  try {
    const q = { generadoAutoJornada: true };
    if (req.query.idContrato) q.idContrato = req.query.idContrato;
    if (req.query.desde) {
      const d = new Date(String(req.query.desde));
      if (!Number.isNaN(d.getTime())) q.fechaEmision = { $gte: d };
    }
    const rows = await Certificado.find(q).sort({ fechaEmision: -1 }).limit(500).lean();
    const qRaw = String(req.query.q || '').trim();

    const jornadaIds = [...new Set(rows.map((c) => String(c.idJornada || '')).filter(Boolean))];
    const contratoIds = new Set(rows.map((c) => String(c.idContrato || '')).filter(Boolean));

    const jornadas = jornadaIds.length
      ? await JornadaCap.find({ _id: { $in: jornadaIds } }).select('municipio direccion idContrato').lean()
      : [];
    for (const j of jornadas) {
      if (j.idContrato) contratoIds.add(String(j.idContrato));
    }

    const numDocs = [...new Set(rows.map((c) => c.numDoc).filter((n) => n != null))];

    const [contratos, alumnosRows] = await Promise.all([
      contratoIds.size
        ? Contratacion.find({ _id: { $in: [...contratoIds] } }).select('codContrato').lean()
        : [],
      numDocs.length ? DatosAlumno.find({ numDoc: { $in: numDocs } }).lean() : [],
    ]);

    const jornById = new Map(jornadas.map((j) => [String(j._id), j]));
    const contrById = new Map(contratos.map((c) => [String(c._id), c]));
    const alByDoc = new Map(alumnosRows.map((a) => [a.numDoc, a]));

    const out = [];
    for (const c of rows) {
      const al = alByDoc.get(c.numDoc);
      const nombreCompleto = al
        ? [al.nombre1, al.nombre2, al.apellido1, al.apellido2].filter(Boolean).join(' ')
        : '';
      const jornada = c.idJornada ? jornById.get(String(c.idJornada)) : null;
      const idContrato = c.idContrato || jornada?.idContrato;
      const codContrato = (contrById.get(String(idContrato || ''))?.codContrato || '').trim();
      const municipio = (jornada?.municipio || '').trim();
      const direccion = (jornada?.direccion || '').trim();
      const ubicacionJornada =
        municipio && direccion ? `${municipio} — ${direccion}` : municipio || direccion || '';

      if (qRaw) {
        const hay =
          (al && coincideBusquedaAlumno(al, qRaw)) ||
          coincideBusquedaTexto(nombreCompleto, qRaw) ||
          coincideBusquedaTexto(String(c.encabezado || ''), qRaw) ||
          coincideBusquedaTexto(String(c.codigoCert || ''), qRaw) ||
          coincideBusquedaDocumento(c.numDoc, qRaw) ||
          coincideBusquedaTexto(codContrato, qRaw) ||
          coincideBusquedaTexto(municipio, qRaw) ||
          coincideBusquedaTexto(direccion, qRaw) ||
          coincideBusquedaTexto(ubicacionJornada, qRaw);
        if (!hay) continue;
      }
      out.push({ ...c, nombreCompleto, municipio, direccion, ubicacionJornada, codContrato });
    }
    res.json(out);
  } catch (e) {
    next(e);
  }
};

exports.progresoAlumnoContrato = async (req, res, next) => {
  try {
    const numDoc = parseNumDoc(req.params.numDoc);
    const { idContrato } = req.query || {};
    if (numDoc == null || !idContrato) {
      return res.status(400).json({ message: 'numDoc e idContrato son obligatorios' });
    }
    const progreso = await progresoCertificacion(numDoc, idContrato);
    res.json(progreso);
  } catch (e) {
    next(e);
  }
};

exports.buscarAlumnoDoc = async (req, res, next) => {
  try {
    const numDoc = parseNumDoc(req.params.numDoc);
    if (numDoc == null) return res.status(400).json({ message: 'numDoc inválido' });
    const al = await DatosAlumno.findOne(numDocQuery(numDoc)).lean();
    if (!al) return res.status(404).json({ message: 'Alumno no encontrado' });
    res.json({
      ...al,
      tipoAlumno: normalizarTipoRegularJornada(al.tipoAlumno),
    });
  } catch (e) {
    next(e);
  }
};

/** Búsqueda ligera de alumnos (nombre o cédula) para operadores de jornada. */
exports.buscarAlumnos = async (req, res, next) => {
  try {
    const q = (req.query.q || '').toString().trim();
    const limit = Math.min(parseInt(req.query.limit, 10) || 12, 30);
    const filter = {};
    if (q) {
      Object.assign(filter, filtroBusquedaAlumno(q));
    }
    const docs = await DatosAlumno.find(filter)
      .sort({ apellido1: 1, nombre1: 1 })
      .limit(limit)
      .lean();
    res.json(
      docs.map((al) => ({
        _id: String(al._id),
        numDoc: al.numDoc,
        tipoDoc: al.tipoDoc,
        nombre1: al.nombre1,
        nombre2: al.nombre2,
        apellido1: al.apellido1,
        apellido2: al.apellido2,
        nombreCompleto: [al.nombre1, al.nombre2, al.apellido1, al.apellido2].filter(Boolean).join(' '),
      })),
    );
  } catch (e) {
    next(e);
  }
};

/** Matrícula al programa de jornada (permiso jornadas.operar). */
exports.matricularAlumnoJornada = async (req, res, next) => {
  try {
    const { numDoc, idPrograma, idProg, idClase } = req.body || {};
    const progId = idPrograma || idProg;
    const prog = await buscarPrograma(progId);
    if (!prog) return res.status(404).json({ message: 'Programa no encontrado' });
    if (!(await esProgramaJornadasCap(prog))) {
      return res.status(400).json({ message: 'El programa no es de Jornadas de Capacitación' });
    }
    const nd = parseNumDoc(numDoc);
    if (nd == null) return res.status(400).json({ message: 'numDoc inválido' });
    const alumno = await DatosAlumno.findOne(numDocQuery(nd)).lean();
    if (!alumno) return res.status(404).json({ message: 'Alumno no encontrado' });
    const idProgramaVal = String(prog.idPrograma ?? prog._id);

    let matriculaResult = null;
    const ya = await Matricula.findOne({ numDoc: nd, idProg: idProgramaVal, estado: /^activo$/i }).lean();
    if (!ya) {
      matriculaResult = await crearMatriculaDesdeBody({ numDoc: nd, idPrograma: idProgramaVal });
    } else {
      matriculaResult = { matricula: ya, yaExistia: true };
    }

    let inscripcion = null;
    let inscripcionDuplicada = false;
    if (idClase) {
      const clase = await ClaseJornadaCap.findById(idClase).lean();
      if (!clase) return res.status(404).json({ message: 'Clase no encontrada' });
      if (String(clase.idPrograma) !== idProgramaVal) {
        return res.status(400).json({
          message: 'La clase no pertenece al programa indicado.',
        });
      }
      const jornada = await JornadaCap.findById(clase.idJornada).lean();
      if (jornada?.idContrato) {
        const bloqueo = await validarAlumnoSinCertificadoContrato(nd, jornada.idContrato);
        if (bloqueo) {
          return res.status(409).json({
            message: bloqueo.message,
            codigo: 'ya_certificado_contrato',
            certificado: bloqueo.certificado,
          });
        }
      }
      try {
        inscripcion = await InscripcionClase.create({
          idClase: clase._id,
          numDoc: nd,
          userAddReg: auditoriaUsuario(req),
        });
      } catch (e) {
        if (e.code === 11000) {
          inscripcionDuplicada = true;
          inscripcion = await InscripcionClase.findOne({
            idClase: clase._id,
            numDoc: nd,
          }).lean();
        } else {
          throw e;
        }
      }
    }

    res.status(201).json({
      ...matriculaResult,
      inscripcion,
      inscripcionDuplicada,
    });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};

/** Programas tipo Jornadas de Capacitación (sin vínculo a contratación). */
exports.programasJornadaCap = async (_req, res, next) => {
  try {
    const { models: cat } = require('../models/catalogos');
    const rows = await cat.programas.find({}).lean();
    const out = [];
    for (const p of rows) {
      if (await esProgramaJornadasCap(p)) out.push(p);
    }
    res.json(out);
  } catch (e) {
    next(e);
  }
};
