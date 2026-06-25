const fs = require('fs');
const path = require('path');

const respaldos = require('../services/respaldos');
const { verificarReautenticacionAdmin } = require('../services/reautenticacion');
const { ejecutarResetEmpresa, FRASE_CONFIRMACION } = require('../services/resetEmpresa');
const { listarModulosReset } = require('../constants/modulosResetEmpresa');
const migracion = require('../services/migracionDatos');
const limpiezaTablas = require('../services/limpiezaTablas');
const { registrarAuditoria } = require('../services/auditoria');

function exigirFrase(req, frase) {
  if (String(req.body?.confirmacion || '').trim().toUpperCase() !== frase) {
    const err = new Error(`Debe escribir exactamente "${frase}" para confirmar`);
    err.status = 400;
    throw err;
  }
}

/* ---------- Respaldos ---------- */

exports.listarRespaldos = async (_req, res, next) => {
  try {
    res.json({ respaldos: await respaldos.listarRespaldos(), config: await respaldos.obtenerConfigRespaldos() });
  } catch (e) {
    next(e);
  }
};

exports.crearRespaldo = async (req, res, next) => {
  try {
    const meta = await respaldos.crearRespaldo({
      tipo: 'manual',
      usuario: req.user.username,
      nota: String(req.body?.nota || ''),
    });
    registrarAuditoria({
      req,
      accion: 'respaldo_crear',
      entidad: 'respaldo',
      idEntidad: meta.archivo,
      resumen: `Respaldo manual ${meta.archivo} (${meta.totalDocs} documentos)`,
      datosDespues: meta,
    }).catch(() => {});
    res.status(201).json(meta);
  } catch (e) {
    next(e);
  }
};

exports.descargarRespaldo = async (req, res, next) => {
  try {
    const ruta = respaldos.rutaRespaldo(req.params.archivo);
    if (!fs.existsSync(ruta)) return res.status(404).json({ message: 'Respaldo no encontrado' });
    registrarAuditoria({
      req,
      accion: 'respaldo_descargar',
      entidad: 'respaldo',
      idEntidad: path.basename(ruta),
      resumen: `Descarga de respaldo ${path.basename(ruta)}`,
    }).catch(() => {});
    res.download(ruta);
  } catch (e) {
    next(e);
  }
};

exports.eliminarRespaldo = async (req, res, next) => {
  try {
    await respaldos.eliminarRespaldo(req.params.archivo);
    registrarAuditoria({
      req,
      accion: 'respaldo_eliminar',
      entidad: 'respaldo',
      idEntidad: req.params.archivo,
      resumen: `Respaldo eliminado: ${req.params.archivo}`,
    }).catch(() => {});
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};

exports.restaurarRespaldo = async (req, res, next) => {
  try {
    exigirFrase(req, 'RESTAURAR');
    await verificarReautenticacionAdmin(req, req.body, { omitirMfa: true });
    const archivo = req.params.archivo;
    console.log(`[ARGO respaldos] Iniciando restauración: ${archivo} (${req.user.username})`);
    const ruta = respaldos.rutaRespaldo(archivo);
    const r = await respaldos.restaurarRespaldo(ruta, { usuario: req.user.username });
    console.log(
      `[ARGO respaldos] Restauración OK: ${archivo} — ${r.docsRestaurados} docs, ${r.archivosRestaurados} archivos`,
    );
    await registrarAuditoria({
      req,
      accion: 'respaldo_restaurar',
      entidad: 'respaldo',
      idEntidad: req.params.archivo,
      resumen: `Restauración del respaldo ${req.params.archivo} por ${req.user.username}`,
      datosDespues: r,
    });
    res.json({
      ...r,
      mensaje:
        'Restauración completada. Los datos y usuarios volvieron al estado del respaldo: ' +
        'es posible que deba iniciar sesión de nuevo.',
    });
  } catch (e) {
    next(e);
  }
};

exports.restaurarSubido = async (req, res, next) => {
  try {
    exigirFrase(req, 'RESTAURAR');
    await verificarReautenticacionAdmin(req, req.body, { omitirMfa: true });
    if (!req.file?.path) {
      return res.status(400).json({ message: 'Adjunte el archivo de respaldo (.zip o .argobk)' });
    }
    const r = await respaldos.restaurarRespaldo(req.file.path, { usuario: req.user.username });
    await fs.promises.unlink(req.file.path).catch(() => {});
    await registrarAuditoria({
      req,
      accion: 'respaldo_restaurar',
      entidad: 'respaldo',
      idEntidad: req.file.originalname,
      resumen: `Restauración desde archivo subido ${req.file.originalname} por ${req.user.username}`,
      datosDespues: r,
    });
    res.json({
      ...r,
      mensaje:
        'Restauración completada. Los datos y usuarios volvieron al estado del respaldo: ' +
        'es posible que deba iniciar sesión de nuevo.',
    });
  } catch (e) {
    if (req.file?.path) await fs.promises.unlink(req.file.path).catch(() => {});
    next(e);
  }
};

exports.configRespaldos = async (_req, res, next) => {
  try {
    res.json(await respaldos.obtenerConfigRespaldos());
  } catch (e) {
    next(e);
  }
};

exports.progresoOperacion = (_req, res) => {
  res.json(respaldos.obtenerProgreso());
};

exports.actualizarConfigRespaldos = async (req, res, next) => {
  try {
    const cfg = await respaldos.actualizarConfigRespaldos(req.body || {});
    registrarAuditoria({
      req,
      accion: 'modificar',
      entidad: 'configRespaldos',
      resumen: 'Configuración de respaldos automáticos actualizada',
      datosDespues: cfg,
    }).catch(() => {});
    res.json(cfg);
  } catch (e) {
    next(e);
  }
};

/* ---------- Reset de empresa ---------- */

exports.infoReset = async (_req, res) => {
  res.json({
    fraseConfirmacion: FRASE_CONFIRMACION,
    modulos: listarModulosReset(),
  });
};

exports.resetEmpresa = async (req, res, next) => {
  try {
    exigirFrase(req, FRASE_CONFIRMACION);
    const admin = await verificarReautenticacionAdmin(req, req.body);
    const r = await ejecutarResetEmpresa(req, admin);
    const esParcial = r.tipoReset === 'parcial';
    res.json({
      ...r,
      mensaje: esParcial
        ? `Reset parcial completado (${r.modulos.join(', ')}). Se creó el respaldo previo ${r.respaldoPrevio}.`
        : 'Puesta en cero completada. Los catálogos se conservaron, los consecutivos quedaron en 0 ' +
          `y se creó el respaldo previo ${r.respaldoPrevio}.`,
    });
  } catch (e) {
    next(e);
  }
};

/* ---------- Migración ---------- */

exports.plantillaMigracion = async (req, res, next) => {
  try {
    const buffer = migracion.generarPlantilla(req.query?.hojas, {
      certificadosHistoricos: req.query?.certificadosHistoricos,
      modoIntegridad: req.query?.modoIntegridad,
    });
    registrarAuditoria({
      req,
      accion: 'migracion_plantilla',
      entidad: 'migracion',
      resumen: 'Descarga de plantilla de migración',
    }).catch(() => {});
    res.setHeader('Content-Disposition', 'attachment; filename="plantilla-migracion-argo.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (e) {
    next(e);
  }
};

exports.validarMigracion = async (req, res, next) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ message: 'Adjunte el archivo Excel con los datos a migrar' });
    }
    const optsIntegridad = {
      certificadosHistoricos: req.body?.certificadosHistoricos,
      modoIntegridad: req.body?.modoIntegridad,
    };
    const analisis = await migracion.analizarArchivo(req.file.buffer, req.body?.hojas, optsIntegridad);
    res.json({
      hojas: analisis.hojas,
      opcionesIntegridad: analisis.opcionesIntegridad,
      ignoradas: analisis.ignoradas,
      totales: analisis.totales,
      validos: {
        programas: analisis.validos.programas.length,
        alumnos: analisis.validos.alumnos.length,
        matriculas: analisis.validos.matriculas.length,
        pagos: analisis.validos.pagos.length,
        certificados: analisis.validos.certificados.length,
      },
      errores: analisis.errores,
    });
  } catch (e) {
    next(e);
  }
};

exports.importarMigracion = async (req, res, next) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ message: 'Adjunte el archivo Excel con los datos a migrar' });
    }
    const r = await migracion.importarArchivo(req.file.buffer, {
      usuario: req.user.username,
      nombreArchivo: req.file.originalname,
      idSede: req.idSede,
      actualizarExistentes: req.body?.actualizarExistentes === 'true' || req.body?.actualizarExistentes === true,
      hojas: req.body?.hojas,
      certificadosHistoricos: req.body?.certificadosHistoricos,
      modoIntegridad: req.body?.modoIntegridad,
    });
    await registrarAuditoria({
      req,
      accion: 'migracion_importar',
      entidad: 'migracion',
      idEntidad: r.lote,
      resumen:
        `Importación ${r.lote}: ${r.programas.creados} programas, ${r.alumnos.creados} alumnos, ` +
        `${r.matriculas.creadas} matrículas, ${r.pagos.creados} pagos, ${r.certificados.creados} certificados`,
      datosDespues: r,
    });
    res.status(201).json(r);
  } catch (e) {
    next(e);
  }
};

exports.lotesMigracion = async (_req, res, next) => {
  try {
    res.json(await migracion.listarLotes());
  } catch (e) {
    next(e);
  }
};

/* ---------- Limpieza de tablas (soporte) ---------- */

exports.metaLimpiezaTablas = (_req, res) => {
  res.json({
    fraseVaciar: limpiezaTablas.FRASE_VACIAR,
    fraseBorrar: limpiezaTablas.FRASE_BORRAR,
    coleccionesCriticas: [...limpiezaTablas.COLECCIONES_CRITICAS],
  });
};

exports.listarTablas = async (_req, res, next) => {
  try {
    res.json({ tablas: await limpiezaTablas.listarColecciones() });
  } catch (e) {
    next(e);
  }
};

exports.registrosTabla = async (req, res, next) => {
  try {
    const data = await limpiezaTablas.listarRegistros(req.params.nombre, {
      page: req.query.page,
      limit: req.query.limit,
      buscar: req.query.buscar,
    });
    res.json(data);
  } catch (e) {
    next(e);
  }
};

exports.vaciarTabla = async (req, res, next) => {
  try {
    exigirFrase(req, limpiezaTablas.FRASE_VACIAR);
    await verificarReautenticacionAdmin(req, req.body, { omitirMfa: true });
    const nombre = req.params.nombre;
    const r = await limpiezaTablas.vaciarColeccion(nombre);
    await registrarAuditoria({
      req,
      accion: 'tabla_vaciar',
      entidad: 'coleccion',
      idEntidad: nombre,
      resumen: `Soporte: vaciada tabla ${nombre} (${r.eliminados} registros) por ${req.user.username}`,
      datosDespues: r,
    });
    res.json({ ...r, mensaje: `Tabla ${nombre} vaciada: ${r.eliminados} registros eliminados.` });
  } catch (e) {
    next(e);
  }
};

exports.borrarRegistrosTabla = async (req, res, next) => {
  try {
    exigirFrase(req, limpiezaTablas.FRASE_BORRAR);
    await verificarReautenticacionAdmin(req, req.body, { omitirMfa: true });
    const nombre = req.params.nombre;
    const ids = req.body?.ids;
    const r = await limpiezaTablas.eliminarRegistros(nombre, ids);
    await registrarAuditoria({
      req,
      accion: 'tabla_borrar_registros',
      entidad: 'coleccion',
      idEntidad: nombre,
      resumen:
        `Soporte: eliminados ${r.eliminados}/${r.solicitados} registros en ${nombre} ` +
        `por ${req.user.username}`,
      datosDespues: r,
    });
    res.json({
      ...r,
      mensaje: `Eliminados ${r.eliminados} registro(s) de ${nombre}.`,
    });
  } catch (e) {
    next(e);
  }
};
