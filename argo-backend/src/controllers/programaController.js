const { models: cat } = require('../models/catalogos');
const {
  num,
  maxNumericId,
  insertarCatalogo,
  generarCodigoProg,
  buscarPrograma,
  buscarServicioDePrograma,
  listarServiciosDePrograma,
  listarServiciosMatricula,
  programaUsaSemestres,
  sincronizarServicioPrograma,
  serviciosTienenLiquidaciones,
  esCapacitacionVirtualServicio,
  adjuntarVirtualidadProgramas,
} = require('../services/programaServicio');
const { normalizarTipoCertificado, esCapJornadaCapacitacion } = require('../services/clasificacionCertificado');
const { esProgramaJornadasCap } = require('../services/jornadaCapacitacion');
const { filtrarProgramas } = require('../services/sedeOferta');
const { cargarIndiceTipCap, resolverIdTipCapCanonico } = require('../services/tipoCapacitacionMatch');
const { publicUrl } = require('../middleware/upload');
const { listarMatriculasPrograma } = require('../services/programaMatriculas');
const {
  validarModalidadesParaPrograma,
  esSoloVirtual,
  admiteModalidadPresencial,
  enriquecerProgramaModalidad,
  valorMatriculaPrograma,
} = require('../services/programaModalidad');
const { MODALIDAD_PRESENCIAL } = require('../constants/modalidadPrograma');

function refsRevalidacionPrograma(diasVencimiento, admiteRevRaw, autoRevRaw) {
  const dias = Number(diasVencimiento);
  const vigenciaOk = Number.isFinite(dias) && dias > 0;
  const admiteRevalidacion = vigenciaOk && admiteRevRaw === true;
  const aplicarTarifaRevalidacionAuto = admiteRevalidacion && autoRevRaw === true;
  return { admiteRevalidacion, aplicarTarifaRevalidacionAuto };
}

function idTipCapJornadaDesdeIndice(indice) {
  for (const r of indice.rows) {
    const label = String(r.tipoCap || r.descripcion || r.nombre || '').trim();
    if (esCapJornadaCapacitacion(label)) {
      const idRaw = r.idTipCap ?? r.id;
      const idStr = String(idRaw ?? '').trim();
      if (!idStr) continue;
      return idStr.match(/^(\d+)/) ? idStr.match(/^(\d+)/)[1] : idStr;
    }
  }
  return null;
}

async function idTipCapCanonico(raw, fallback, opts = {}) {
  const src = raw !== undefined && raw !== '' && raw != null ? raw : fallback;
  if (src === undefined || src === '' || src == null) return src;
  const indice = await cargarIndiceTipCap();
  const rawStr = String(src).trim();
  if (opts.forzarJornada || esCapJornadaCapacitacion(rawStr)) {
    const jid = idTipCapJornadaDesdeIndice(indice);
    if (jid) return jid;
  }
  const canon = resolverIdTipCapCanonico(src, indice);
  return canon || src;
}

function usuario(req) {
  return req.user || {};
}

function bodyServicio(body) {
  return {
    descrServicio: body.descrServicio,
    tipoServ: body.tipoServ,
    facturar: body.facturar,
    iva: body.iva,
    tarifa1: body.tarifa1,
    tarifa2: body.tarifa2,
    tarifa3: body.tarifa3,
    tarifaVirtual: body.tarifaVirtual,
    valorMatricula: body.valorMatricula,
    tarifaHoraPractica: body.tarifaHoraPractica,
  };
}

function escRegexPrograma(s) {
  return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

exports.listar = async (req, res, next) => {
  try {
    const q = (req.query.q || '').toString().trim();
    const esCatalogo = req.query.catalogo === '1';
    const soloActivos = req.query.activos !== 'false';
    const minQ = esCatalogo ? 1 : 2;
    const filter = {};
    if (soloActivos) filter.estado = { $in: [/^activo$/i, 'ACTIVO', 'Activo', null] };
    if (q.length >= minQ) {
      const re = new RegExp(escRegexPrograma(q), 'i');
      filter.$or = [{ nombreProg: re }, { codigoProg: re }, { nomCert: re }, { descripcion: re }];
    }
    const limitRaw = Number(req.query.limit);
    let limit = limitRaw > 0 ? limitRaw : 0;
    if (!limit && esCatalogo) limit = q.length >= 1 ? 35 : 40;
    let query = cat.programas.find(filter).sort({ idPrograma: 1, nombreProg: 1 });
    if (limit > 0) query = query.limit(limit);
    let rows = await query.lean();
    if (req.idSede && req.query.catalogo !== '1') {
      rows = await filtrarProgramas(rows, req.idSede);
    }
    rows = await adjuntarVirtualidadProgramas(rows);
    res.json(rows);
  } catch (e) {
    next(e);
  }
};

exports.obtener = async (req, res, next) => {
  try {
    const prog = await buscarPrograma(req.params.id);
    if (!prog) return res.status(404).json({ message: 'Programa no encontrado' });
    const servicios = await listarServiciosDePrograma(prog);
    const matricula = await listarServiciosMatricula(prog);
    const servicio = matricula[0] || null;
    const tarifaVirtual = servicio ? num(servicio.tarifaVirtual) : 0;
    const programa = enriquecerProgramaModalidad(
      {
        ...prog,
        tarifaVirtual,
      },
      matricula,
    );
    res.json({
      programa,
      servicio,
      servicios,
    });
  } catch (e) {
    next(e);
  }
};

exports.matriculas = async (req, res, next) => {
  try {
    const prog = await buscarPrograma(req.params.id);
    if (!prog) return res.status(404).json({ message: 'Programa no encontrado' });
    const idProg = String(prog.idPrograma ?? prog.idProg ?? '');
    const data = await listarMatriculasPrograma(idProg, req.query, { idSede: req.idSede });
    res.json(data);
  } catch (e) {
    next(e);
  }
};

exports.crear = async (req, res, next) => {
  try {
    const body = req.body || {};
    const nombreProg = (body.nombreProg || '').trim();
    if (!nombreProg) return res.status(400).json({ message: 'nombreProg es obligatorio' });
    if (body.idTipCap === '' || body.idTipCap == null) {
      return res.status(400).json({ message: 'idTipCap (tipo de capacitación) es obligatorio' });
    }

    let codigoProg = (body.codigoProg || '').trim();
    const idTipCap = await idTipCapCanonico(body.idTipCap, undefined, {
      forzarJornada:
        esCapJornadaCapacitacion(String(body.idTipCap ?? '')) ||
        normalizarTipoCertificado(body.tipoCertificado) === 'jornada_capacitacion',
    });
    if (!codigoProg) codigoProg = await generarCodigoProg(idTipCap);
    const dup = await cat.programas.findOne({ codigoProg }).lean();
    if (dup) return res.status(409).json({ message: `Ya existe el código ${codigoProg}` });

    const idPrograma = await maxNumericId(cat.programas, 'idPrograma');
    const borradorTip = {
      idTipCap,
      tipoCertificado: normalizarTipoCertificado(body.tipoCertificado),
      nombreProg,
    };
    const esJornada = await esProgramaJornadasCap(borradorTip);
    const modalidadesInput = body.modalidades ?? [MODALIDAD_PRESENCIAL];
    const modalidades = esJornada
      ? []
      : validarModalidadesParaPrograma(modalidadesInput, body, { esJornada: false });
    const soloVirtual = !esJornada && esSoloVirtual(modalidades);
    let valorMatricula = esJornada
      ? 0
      : valorMatriculaPrograma({ ...borradorTip, modalidades }, [], {
          tarifa1: body.tarifa1 ?? body.valorMatricula,
          tarifaVirtual: body.tarifaVirtual,
          valorMatricula: body.valorMatricula,
        });
    if (!esJornada && !soloVirtual && admiteModalidadPresencial(modalidades) && valorMatricula <= 0) {
      return res.status(400).json({ message: 'La tarifa 1 / valor de matrícula debe ser mayor a 0' });
    }
    if (!esJornada && soloVirtual && num(body.tarifaVirtual) <= 0) {
      return res.status(400).json({ message: 'Programa solo virtual: indique tarifa virtual mayor a 0' });
    }

    const now = new Date();
    const user = usuario(req).username || 'sistema';

    const progDoc = {
      idPrograma,
      codigoProg,
      nombreProg,
      nomCert: (body.nomCert || nombreProg).trim(),
      idTipCap,
      semestres: body.semestres != null && body.semestres !== '' ? Number(body.semestres) : null,
      horas: body.horas != null && body.horas !== '' ? Number(body.horas) : null,
      horasTeoria:
        body.horasTeoria != null && body.horasTeoria !== '' ? Number(body.horasTeoria) : null,
      horasPractica:
        body.horasPractica != null && body.horasPractica !== '' ? Number(body.horasPractica) : null,
      horasTaller:
        body.horasTaller != null && body.horasTaller !== '' ? Number(body.horasTaller) : null,
      valorMatricula,
      usaCohortes: body.usaCohortes === true || body.usaCohortes === 'true',
      descripcion: (body.descripcion || '').trim() || null,
      estado: (body.estado || 'ACTIVO').trim(),
      requistos: (body.requistos || '').trim() || null,
      diasVencimiento: body.diasVencimiento != null ? Number(body.diasVencimiento) : 365,
      ...refsRevalidacionPrograma(
        body.diasVencimiento != null ? Number(body.diasVencimiento) : 365,
        body.admiteRevalidacion === true || body.admiteRevalidacion === 'true',
        body.aplicarTarifaRevalidacionAuto === true || body.aplicarTarifaRevalidacionAuto === 'true',
      ),
      tipoCertificado: normalizarTipoCertificado(body.tipoCertificado),
      descripcionVirtual: (body.descripcionVirtual || '').trim() || null,
      urlPortadaVirtual: (body.urlPortadaVirtual || '').trim() || null,
      modalidades: esJornada ? [] : modalidades,
      fechaAudi: now,
      userAddReg: user,
      fechaMod: now,
      userChangeRecord: user,
    };

    const prog = await insertarCatalogo(cat.programas, progDoc);

    if (esJornada) {
      return res.status(201).json({
        programa: prog,
        servicio: null,
        servicios: [],
        message:
          'Programa de jornadas de capacitación creado. No genera servicio de matrícula (capacitación sin cobro al alumno).',
      });
    }

    let servicios;
    try {
      servicios = await sincronizarServicioPrograma(prog, bodyServicio(body), usuario(req));
    } catch (errServ) {
      await cat.programas.deleteOne({ idPrograma: prog.idPrograma });
      throw errServ;
    }

    const lista = Array.isArray(servicios) ? servicios : servicios ? [servicios] : [];
    if (!lista.length || !lista[0]?.idServ) {
      await cat.programas.deleteOne({ idPrograma: prog.idPrograma });
      return res.status(500).json({ message: 'No se pudo crear el servicio de matrícula' });
    }

    const matricula = lista.filter((s) => s.rolServicio !== 'hora_practica');
    const servicio = matricula[0] || lista[0];
    const msgSem = programaUsaSemestres(prog)
      ? `Programa y ${matricula.length} servicio(s) por semestre creados (#${matricula.map((s) => s.idServ).join(', ')})`
      : `Programa y servicio #${servicio?.idServ} creados correctamente`;

    res.status(201).json({
      programa: prog,
      servicio,
      servicios: lista,
      message: msgSem,
    });
  } catch (e) {
    next(e);
  }
};

exports.actualizar = async (req, res, next) => {
  try {
    const prog = await buscarPrograma(req.params.id);
    if (!prog) return res.status(404).json({ message: 'Programa no encontrado' });

    const body = req.body || {};
    const nombreProg = String(body.nombreProg ?? prog.nombreProg ?? '').trim();
    if (!nombreProg) return res.status(400).json({ message: 'nombreProg es obligatorio' });

    if (body.codigoProg && body.codigoProg !== prog.codigoProg) {
      const dup = await cat.programas
        .findOne({ codigoProg: body.codigoProg, idPrograma: { $ne: prog.idPrograma } })
        .lean();
      if (dup) return res.status(409).json({ message: 'Código de programa ya en uso' });
    }

    const valorMatriculaRaw =
      body.tarifa1 != null || body.valorMatricula != null
        ? num(body.tarifa1 ?? body.valorMatricula)
        : num(prog.valorMatricula);

    const tipoCertInput =
      body.tipoCertificado !== undefined
        ? normalizarTipoCertificado(body.tipoCertificado)
        : prog.tipoCertificado;
    const idTipCap = await idTipCapCanonico(body.idTipCap, prog.idTipCap, {
      forzarJornada: tipoCertInput === 'jornada_capacitacion',
    });
    const mergedTip = {
      idTipCap,
      tipoCertificado:
        body.tipoCertificado !== undefined
          ? normalizarTipoCertificado(body.tipoCertificado)
          : prog.tipoCertificado,
      nombreProg,
    };
    const esJornada = await esProgramaJornadasCap(mergedTip);
    const serviciosActuales = await listarServiciosMatricula(prog);
    const servMat = serviciosActuales[0] || null;
    const bodyTarifas = {
      tarifa1: body.tarifa1 ?? body.valorMatricula ?? servMat?.tarifa1 ?? prog.valorMatricula,
      tarifaVirtual: body.tarifaVirtual ?? servMat?.tarifaVirtual ?? 0,
      valorMatricula: valorMatriculaRaw,
    };
    const modalidadesInput =
      body.modalidades !== undefined ? body.modalidades : prog.modalidades ?? [MODALIDAD_PRESENCIAL];
    const modalidades = esJornada
      ? []
      : validarModalidadesParaPrograma(modalidadesInput, bodyTarifas, { esJornada: false });
    const soloVirtual = !esJornada && esSoloVirtual(modalidades);
    const valorMatricula = esJornada
      ? 0
      : valorMatriculaPrograma(
          { ...prog, modalidades },
          serviciosActuales,
          bodyTarifas,
        );
    if (!esJornada && !soloVirtual && admiteModalidadPresencial(modalidades) && valorMatricula <= 0) {
      return res.status(400).json({ message: 'La tarifa 1 / valor de matrícula debe ser mayor a 0' });
    }
    if (!esJornada && soloVirtual && num(bodyTarifas.tarifaVirtual) <= 0) {
      return res.status(400).json({ message: 'Programa solo virtual: indique tarifa virtual mayor a 0' });
    }

    const user = usuario(req).username || 'sistema';
    const diasVenc =
      body.diasVencimiento !== undefined ? Number(body.diasVencimiento) : prog.diasVencimiento;
    const admiteRevRaw =
      body.admiteRevalidacion !== undefined
        ? body.admiteRevalidacion === true || body.admiteRevalidacion === 'true'
        : prog.admiteRevalidacion === true;
    const autoRevRaw =
      body.aplicarTarifaRevalidacionAuto !== undefined
        ? body.aplicarTarifaRevalidacionAuto === true
          || body.aplicarTarifaRevalidacionAuto === 'true'
        : prog.aplicarTarifaRevalidacionAuto === true;
    const rev = refsRevalidacionPrograma(diasVenc, admiteRevRaw, autoRevRaw);

    const patch = {
      codigoProg: body.codigoProg ?? prog.codigoProg,
      nombreProg,
      nomCert: (body.nomCert ?? prog.nomCert ?? nombreProg).trim(),
      idTipCap,
      semestres:
        body.semestres !== undefined && body.semestres !== ''
          ? Number(body.semestres)
          : prog.semestres,
      horas:
        body.horas !== undefined && body.horas !== '' ? Number(body.horas) : prog.horas,
      horasTeoria:
        body.horasTeoria !== undefined && body.horasTeoria !== ''
          ? Number(body.horasTeoria)
          : prog.horasTeoria,
      horasPractica:
        body.horasPractica !== undefined && body.horasPractica !== ''
          ? Number(body.horasPractica)
          : prog.horasPractica,
      horasTaller:
        body.horasTaller !== undefined && body.horasTaller !== ''
          ? Number(body.horasTaller)
          : prog.horasTaller,
      valorMatricula,
      usaCohortes:
        body.usaCohortes !== undefined
          ? body.usaCohortes === true || body.usaCohortes === 'true'
          : prog.usaCohortes === true,
      descripcion: body.descripcion !== undefined ? body.descripcion : prog.descripcion,
      estado: body.estado !== undefined ? body.estado : prog.estado,
      requistos: body.requistos !== undefined ? body.requistos : prog.requistos,
      diasVencimiento:
        body.diasVencimiento !== undefined ? Number(body.diasVencimiento) : prog.diasVencimiento,
      admiteRevalidacion: rev.admiteRevalidacion,
      aplicarTarifaRevalidacionAuto: rev.aplicarTarifaRevalidacionAuto,
      tipoCertificado:
        body.tipoCertificado !== undefined
          ? normalizarTipoCertificado(body.tipoCertificado)
          : prog.tipoCertificado ?? null,
      descripcionVirtual:
        body.descripcionVirtual !== undefined
          ? String(body.descripcionVirtual || '').trim() || null
          : prog.descripcionVirtual ?? null,
      urlPortadaVirtual:
        body.urlPortadaVirtual !== undefined
          ? String(body.urlPortadaVirtual || '').trim() || null
          : prog.urlPortadaVirtual ?? null,
      modalidades: esJornada ? [] : modalidades,
      fechaMod: new Date(),
      userChangeRecord: user,
    };

    await cat.programas.updateOne({ idPrograma: prog.idPrograma }, { $set: patch });
    const actualizado = await cat.programas.findOne({ idPrograma: prog.idPrograma }).lean();

    if (esJornada) {
      return res.json({
        programa: actualizado,
        servicio: null,
        servicios: [],
        message: 'Programa de jornadas guardado (sin servicio de matrícula).',
      });
    }

    const sync = await sincronizarServicioPrograma(actualizado, bodyServicio(body), usuario(req));
    const servicios = Array.isArray(sync) ? sync : sync ? [sync] : [];
    const matricula = servicios.filter((s) => s?.rolServicio !== 'hora_practica');
    const servicio = matricula[0] || servicios[0] || null;

    const message = programaUsaSemestres(actualizado)
      ? servicios.length
        ? `Guardado. ${servicios.length} servicio(s) por semestre sincronizados.`
        : 'Programa guardado; no hay servicios vinculados.'
      : servicio
        ? `Guardado. Servicio #${servicio.idServ} actualizado.`
        : 'Programa guardado; no hay servicio vinculado (se creó uno nuevo si faltaba).';

    res.json({
      programa: actualizado,
      servicio,
      servicios,
      message,
    });
  } catch (e) {
    next(e);
  }
};

/** Imagen de portada para ficha del curso en portal virtual. */
exports.subirPortadaVirtual = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Seleccione una imagen de portada' });
    const prog = await buscarPrograma(req.params.id);
    if (!prog) return res.status(404).json({ message: 'Programa no encontrado' });

    const serv = await buscarServicioDePrograma(prog);
    if (!esCapacitacionVirtualServicio(serv)) {
      return res.status(400).json({
        message: 'Asigne tarifa virtual mayor a 0 para habilitar la portada del curso',
      });
    }

    const urlPortadaVirtual = publicUrl('programas-virtual', req.file.filename);
    await cat.programas.updateOne(
      { idPrograma: prog.idPrograma },
      {
        $set: {
          urlPortadaVirtual,
          fechaMod: new Date(),
          userChangeRecord: req.user?.username || 'sistema',
        },
      },
    );

    res.json({ urlPortadaVirtual, message: 'Portada del curso actualizada' });
  } catch (e) {
    next(e);
  }
};

/** Solo administrador: elimina programa y servicio vinculado si no tiene liquidaciones. */
exports.eliminar = async (req, res, next) => {
  try {
    const prog = await buscarPrograma(req.params.id);
    if (!prog) return res.status(404).json({ message: 'Programa no encontrado' });

    if (await serviciosTienenLiquidaciones(prog)) {
      return res.status(409).json({
        message:
          'No se puede eliminar: algún servicio del programa tiene liquidaciones o matrículas. Desactive el programa en su lugar.',
      });
    }

    const idProg = prog.idPrograma ?? prog.idProg;
    const n = Number(idProg);
    await cat.servicios.deleteMany({
      $or: [{ idProg }, { idProg: String(idProg) }, ...(Number.isFinite(n) ? [{ idProg: n }] : [])],
    });

    await cat.programas.deleteOne({ idPrograma: prog.idPrograma });

    res.json({
      ok: true,
      message: `Programa «${prog.nombreProg}» eliminado con sus servicios vinculados.`,
    });
  } catch (e) {
    next(e);
  }
};
