const svc = require('../services/programacionCea');
const clasesSvc = require('../services/programacionCeaClases');

exports.programas = async (_req, res, next) => {
  try {
    const rows = await svc.listarProgramasCea();
    res.json(rows);
  } catch (e) {
    next(e);
  }
};

exports.obtenerConfig = async (_req, res, next) => {
  try {
    res.json(await svc.obtenerConfig());
  } catch (e) {
    next(e);
  }
};

exports.guardarConfig = async (req, res, next) => {
  try {
    const data = await svc.guardarConfig(req.body, req.user);
    res.json(data);
  } catch (e) {
    next(e);
  }
};

exports.festivos = async (req, res, next) => {
  try {
    const anio = req.query.anio || new Date().getFullYear();
    res.json({ anio: Number(anio), fechas: svc.listarFestivos(anio) });
  } catch (e) {
    next(e);
  }
};

exports.listarTemas = async (req, res, next) => {
  try {
    const rows = await svc.listarTemas(req.params.idProg);
    if (rows === null) return res.status(404).json({ message: 'Programa CEA no encontrado' });
    res.json(rows);
  } catch (e) {
    next(e);
  }
};

exports.crearTema = async (req, res, next) => {
  try {
    const result = await svc.crearTema(req.params.idProg, req.body, req.user);
    if (result.error) return res.status(result.status).json({ message: result.error });
    res.status(201).json(result.doc);
  } catch (e) {
    next(e);
  }
};

exports.actualizarTema = async (req, res, next) => {
  try {
    const result = await svc.actualizarTema(req.params.id, req.body, req.user);
    if (result.error) return res.status(result.status).json({ message: result.error });
    res.json(result.doc);
  } catch (e) {
    next(e);
  }
};

exports.eliminarTema = async (req, res, next) => {
  try {
    const result = await svc.eliminarTema(req.params.id);
    if (result.error) return res.status(result.status).json({ message: result.error });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};

exports.rastreoGlobal = async (req, res, next) => {
  try {
    const soloPendientes = req.query.soloPendientes === '1' || req.query.soloPendientes === 'true';
    res.json(await svc.rastreoGlobal({ soloPendientes }));
  } catch (e) {
    next(e);
  }
};

exports.clasesAlumno = async (req, res, next) => {
  try {
    res.json(await clasesSvc.listarClasesAlumno(req.params.numDoc, req.query));
  } catch (e) {
    next(e);
  }
};

exports.rastreoAlumno = async (req, res, next) => {
  try {
    res.json(await svc.rastreoAlumno(req.params.numDoc));
  } catch (e) {
    next(e);
  }
};

exports.preferenciasAlumno = async (req, res, next) => {
  try {
    const result = await svc.guardarPreferenciasAlumno(req.params.numDoc, req.body, req.user);
    if (result.error) return res.status(result.status).json({ message: result.error });
    res.json(result);
  } catch (e) {
    next(e);
  }
};

exports.generarClasesPendientesGlobales = async (_req, res, next) => {
  try {
    const { generarClasesPendientesGlobales } = require('../services/programacionCeaAuto');
    const r = await generarClasesPendientesGlobales();
    res.json(r);
  } catch (e) {
    next(e);
  }
};

exports.completarClasesFaltantesAlumno = async (req, res, next) => {
  try {
    const {
      completarClasesGrupalesAlumno,
      contarClasesGrupalesFaltantesAlumno,
    } = require('../services/programacionCeaAuto');
    const numDoc = req.params.numDoc;
    const faltantesAntes = await contarClasesGrupalesFaltantesAlumno(numDoc);
    const r = await completarClasesGrupalesAlumno(numDoc);
    const faltantesDespues = await contarClasesGrupalesFaltantesAlumno(numDoc);

    if (r.skipped) {
      return res.status(400).json({
        message:
          r.motivo === 'sin_matricula_generada'
            ? 'Este alumno no tiene matrícula CEA con clases generadas.'
            : r.motivo === 'sin_programa_cea'
              ? 'No se encontró un programa CEA válido para completar clases.'
              : 'No se pudieron generar clases faltantes.',
        ...r,
        faltantesAntes,
        faltantesDespues,
      });
    }

    const generadas = r.clases || 0;
    res.json({
      ...r,
      faltantesAntes,
      faltantesDespues,
      message:
        generadas > 0
          ? `Se generaron o inscribieron ${generadas} clase(s) faltante(s) (teoría/taller).`
          : 'No había clases teóricas ni de taller pendientes por generar.',
    });
  } catch (e) {
    next(e);
  }
};

exports.previewPlanificacion = async (req, res, next) => {
  try {
    const planSvc = require('../services/programacionCeaPlanificacion');
    const r = await planSvc.previewPlanificacion(req.body, req);
    if (r.error) return res.status(r.status || 400).json({ message: r.error });
    res.json(r);
  } catch (e) {
    next(e);
  }
};

exports.generarPlanificacion = async (req, res, next) => {
  try {
    const planSvc = require('../services/programacionCeaPlanificacion');
    const r = await planSvc.generarClasesPlanificadas(req.body, req);
    if (r.error) return res.status(r.status || 400).json({ message: r.error });
    res.json(r);
  } catch (e) {
    next(e);
  }
};

exports.alertasPendientes = async (_req, res, next) => {
  try {
    res.json(await svc.alertasPendientes());
  } catch (e) {
    next(e);
  }
};

exports.alertasClasesCreado = async (_req, res, next) => {
  try {
    res.json(await svc.alertasClasesCreado());
  } catch (e) {
    next(e);
  }
};

exports.alertasClasesProximas = async (req, res, next) => {
  try {
    const minutos = req.query.minutos != null ? Number(req.query.minutos) : 15;
    res.json(await clasesSvc.alertasClasesProximas(req, minutos));
  } catch (e) {
    next(e);
  }
};

exports.recursos = async (req, res, next) => {
  try {
    const idProg = req.query.idProg || req.query.idPrograma || '';
    const categoriaLicencia = req.query.categoriaLicencia || req.query.categoria || '';
    res.json(await clasesSvc.recursosProgramacion({ idProg, categoriaLicencia, idSede: req.idSede }));
  } catch (e) {
    next(e);
  }
};

exports.listarClases = async (req, res, next) => {
  try {
    res.json(await clasesSvc.listarClases(req));
  } catch (e) {
    next(e);
  }
};

exports.obtenerClase = async (req, res, next) => {
  try {
    const doc = await clasesSvc.obtenerClase(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Clase no encontrada' });
    res.json(doc);
  } catch (e) {
    next(e);
  }
};

exports.crearClase = async (req, res, next) => {
  try {
    const result = await clasesSvc.crearClase(req.body, req);
    if (result?.error) {
      return res.status(result.status || 400).json({ message: result.error, conflictos: result.conflictos });
    }
    res.status(201).json(result);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message, conflictos: e.conflictos });
    next(e);
  }
};

exports.actualizarClase = async (req, res, next) => {
  try {
    const result = await clasesSvc.actualizarClase(req.params.id, req.body, req);
    if (result?.error) {
      return res.status(result.status || 400).json({ message: result.error, conflictos: result.conflictos });
    }
    res.json(result.doc);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message, conflictos: e.conflictos });
    next(e);
  }
};

exports.cancelarClase = async (req, res, next) => {
  try {
    const result = await clasesSvc.cancelarClase(req.params.id, req);
    if (result?.error) return res.status(result.status).json({ message: result.error });
    res.json(result.doc);
  } catch (e) {
    next(e);
  }
};

exports.eliminarClase = async (req, res, next) => {
  try {
    const result = await clasesSvc.eliminarClase(req.params.id, req);
    if (result?.error) return res.status(result.status).json({ message: result.error });
    res.json(result);
  } catch (e) {
    next(e);
  }
};

exports.verificarConflictos = async (req, res, next) => {
  try {
    const excludeId = req.query.excludeId || null;
    res.json(await clasesSvc.verificarConflictos(req.body, req, excludeId));
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};

exports.iniciarClase = async (req, res, next) => {
  try {
    const result = await clasesSvc.iniciarClase(req.params.id, req);
    if (result?.error) {
      return res.status(result.status).json({
        message: result.error,
        codigo: result.codigo,
        placa: result.placa,
        vehiculoId: result.vehiculoId,
      });
    }
    res.json(result.doc);
  } catch (e) {
    next(e);
  }
};

exports.finalizarClase = async (req, res, next) => {
  try {
    const result = await clasesSvc.finalizarClase(req.params.id, req);
    if (result?.error) return res.status(result.status).json({ message: result.error });
    res.json(result.doc);
  } catch (e) {
    next(e);
  }
};

exports.finalizarClaseRetroactiva = async (req, res, next) => {
  try {
    const result = await clasesSvc.finalizarClaseRetroactiva(req.params.id, req);
    if (result?.error) return res.status(result.status).json({ message: result.error });
    res.json(result.doc);
  } catch (e) {
    next(e);
  }
};

exports.listarInscripciones = async (req, res, next) => {
  try {
    res.json(await clasesSvc.listarInscripciones(req.params.id));
  } catch (e) {
    next(e);
  }
};

exports.inscribirAlumno = async (req, res, next) => {
  try {
    const result = await clasesSvc.inscribirAlumno(req.params.id, req.body, req);
    if (result?.error) return res.status(result.status).json({ message: result.error });
    res.status(201).json(result);
  } catch (e) {
    next(e);
  }
};

exports.quitarInscripcion = async (req, res, next) => {
  try {
    const result = await clasesSvc.quitarInscripcion(req.params.id, req.params.numDoc, req);
    if (result?.error) return res.status(result.status).json({ message: result.error });
    res.json(result);
  } catch (e) {
    next(e);
  }
};

exports.alumnosElegiblesPrograma = async (req, res, next) => {
  try {
    const idProg = String(req.query.idProg || '').trim();
    const tipoHoras = String(req.query.tipoHoras || req.query.tipoClase || '').trim();
    if (!idProg || !tipoHoras) {
      return res.status(400).json({ message: 'idProg y tipoHoras son obligatorios' });
    }
    const rows = await clasesSvc.alumnosElegiblesPrograma(idProg, tipoHoras, req.query.q || '');
    res.json(rows);
  } catch (e) {
    next(e);
  }
};

exports.alumnosElegibles = async (req, res, next) => {
  try {
    const rows = await clasesSvc.alumnosElegibles(req.params.id, req.query.q || '');
    if (rows === null) return res.status(404).json({ message: 'Clase no encontrada' });
    res.json(rows);
  } catch (e) {
    next(e);
  }
};
