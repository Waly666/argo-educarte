const caja = require('../services/cajaSesion');
const { registrarAuditoria } = require('../services/auditoria');
const { esAdmin } = require('../utils/roles');
const { num } = require('../utils/coerceTypes');
const { exigirAdminOSupervisor } = require('../services/authVerify');
const descuadreSvc = require('../services/descuadreCaja');
const ingresoCtrl = require('./ingresoController');
const egresoCtrl = require('./egresoController');
const CajaSesion = require('../models/CajaSesion');

function userCtx(req) {
  const u = req.user || {};
  return {
    usuario: u.username || 'sistema',
    idUsuario: u.sub ? String(u.sub) : null,
    user: u.username || 'sistema',
    rol: u.rol,
  };
}

async function resolverSesionConsulta(req) {
  const ctx = userCtx(req);
  const param = req.params.idSesion;
  if (param === 'activa') {
    const sesion = await caja.obtenerSesionActiva(ctx.idUsuario, req.idSede);
    if (!sesion) {
      const err = new Error('No tiene caja abierta');
      err.status = 404;
      throw err;
    }
    return sesion;
  }
  const idSesion = Number(param);
  const sesion = await CajaSesion.findOne({ idSesion }).lean();
  if (!sesion) {
    const err = new Error('Sesión no encontrada');
    err.status = 404;
    throw err;
  }
  if (!esAdmin(ctx.rol) && String(sesion.idUsuario) !== String(ctx.idUsuario)) {
    const err = new Error('Sin permisos para ver esta caja');
    err.status = 403;
    throw err;
  }
  return caja.planoSesion(sesion);
}

exports.activa = async (req, res, next) => {
  try {
    const { idUsuario } = userCtx(req);
    const sesion = await caja.obtenerSesionActiva(idUsuario, req.idSede);
    if (!sesion) return res.json({ abierta: false, sesion: null });
    const resumen = await caja.calcularResumenSesion(sesion);
    res.json({ abierta: true, sesion, resumenParcial: resumen });
  } catch (e) {
    next(e);
  }
};

exports.listar = async (req, res, next) => {
  try {
    const ctx = userCtx(req);
    const admin = esAdmin(ctx.rol);
    const soloMias = req.query.todas !== '1' && !admin;
    const rows = await caja.listarSesiones({
      limit: req.query.limit,
      estado: req.query.estado,
      usuario: req.query.usuario,
      desde: req.query.desde,
      hasta: req.query.hasta,
      porCierre: req.query.porCierre === '1',
      idUsuario: soloMias ? ctx.idUsuario : req.query.idUsuario,
      soloMias,
      idSede: req.idSede,
    });
    res.json(rows);
  } catch (e) {
    next(e);
  }
};

exports.listarAbiertas = async (req, res, next) => {
  try {
    if (!esAdmin(req.user?.rol)) {
      return res.status(403).json({ message: 'Solo administradores' });
    }
    const sesiones = await caja.listarSesionesAbiertas(req.idSede);
    const conResumen = await Promise.all(
      sesiones.map(async (s) => ({
        sesion: s,
        resumenParcial: await caja.calcularResumenSesion(s),
      })),
    );
    res.json(conResumen);
  } catch (e) {
    next(e);
  }
};

exports.ingresosSesionActiva = async (req, res, next) => {
  req.params.idSesion = 'activa';
  return exports.ingresosSesion(req, res, next);
};

exports.egresosSesionActiva = async (req, res, next) => {
  req.params.idSesion = 'activa';
  return exports.egresosSesion(req, res, next);
};

exports.ingresosSesion = async (req, res, next) => {
  try {
    const sesion = await resolverSesionConsulta(req);
    req.params.idSesion = String(sesion.idSesion);
    return ingresoCtrl.listarPorSesion(req, res, next);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};

exports.egresosSesion = async (req, res, next) => {
  try {
    const sesion = await resolverSesionConsulta(req);
    req.query.idSesion = String(sesion.idSesion);
    return egresoCtrl.listar(req, res, next);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};

exports.abrir = async (req, res, next) => {
  try {
    const { saldoInicial, observaciones } = req.body || {};
    const ctx = userCtx(req);
    const sesion = await caja.abrirSesion({
      saldoInicial: Number(saldoInicial) || 0,
      observaciones,
      idSede: req.idSede,
      ...ctx,
    });
    await registrarAuditoria({
      req,
      accion: 'apertura_caja',
      entidad: 'cajaSesion',
      idEntidad: sesion.idSesion,
      resumen: `Apertura caja #${sesion.idSesion} (${ctx.usuario}) saldo ${sesion.saldoInicial}`,
      datosDespues: sesion,
      codigoHttp: 201,
    });
    res.status(201).json(sesion);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};

exports.cerrar = async (req, res, next) => {
  try {
    const idSesion = Number(req.params.idSesion);
    const { observaciones, efectivoContado, arqueo } = req.body || {};
    const ctx = userCtx(req);

    const sesionAbierta = await CajaSesion.findOne({ idSesion, estado: 'abierta' });
    if (!sesionAbierta) {
      return res.status(404).json({ message: 'No hay sesión de caja abierta con ese id' });
    }

    const contado = efectivoContado != null ? Number(efectivoContado) : null;
    if (contado == null || !Number.isFinite(contado)) {
      return res.status(400).json({ message: 'Indique el efectivo contado en caja' });
    }

    const resumenPrevio = await caja.calcularResumenSesion(sesionAbierta);
    const diferencia = contado - resumenPrevio.efectivoEsperado;

    let supervisor = null;
    if (descuadreSvc.tieneDescuadreSignificativo(diferencia)) {
      const auth = await exigirAdminOSupervisor(
        req,
        'Cierre con descuadre requiere autorización de un administrador (usuario y contraseña).',
      );
      if (!auth.ok) {
        return res.status(auth.status).json({
          message: auth.message,
          code: auth.code || 'DESCUADRE_AUTH_REQUIRED',
          diferencia,
          efectivoEsperado: resumenPrevio.efectivoEsperado,
        });
      }
      supervisor = auth.supervisor;
    }

    const { sesion, resumen, descuadre } = await caja.cerrarSesion(idSesion, {
      observaciones,
      efectivoContado: contado,
      arqueo,
      user: ctx.user,
      idUsuario: ctx.idUsuario,
      rol: ctx.rol,
      supervisor,
    });
    await registrarAuditoria({
      req,
      accion: 'cierre_caja',
      entidad: 'cajaSesion',
      idEntidad: idSesion,
      resumen: `Cierre caja #${idSesion} (${sesion.usuario}) — ing ${resumen.totalIngresos} / egr ${resumen.totalEgresos}${
        descuadre ? ` — DESCUADRE ${num(descuadre.diferencia)}` : ''
      }`,
      datosDespues: { sesion, resumen, descuadre },
      codigoHttp: 200,
    });
    res.json({ sesion, resumen, descuadre });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};

exports.cerrarMultiples = async (req, res, next) => {
  try {
    if (!esAdmin(req.user?.rol)) {
      return res.status(403).json({ message: 'Solo administradores' });
    }
    const { cierres, autorizadoUsername, autorizadoPassword } = req.body || {};
    const ctx = userCtx(req);
    const lista = Array.isArray(cierres) ? cierres : [];
    if (!lista.length) {
      return res.status(400).json({ message: 'Indique las cajas a cerrar con su efectivo contado' });
    }

    let supervisor = null;
    for (const item of lista) {
      const idSesion = Number(item.idSesion);
      const sesionAbierta = await CajaSesion.findOne({ idSesion, estado: 'abierta' });
      if (!sesionAbierta) {
        return res.status(404).json({ message: `No hay sesión abierta #${idSesion}` });
      }
      const contado = item.efectivoContado != null ? Number(item.efectivoContado) : null;
      if (contado == null || !Number.isFinite(contado)) {
        return res.status(400).json({ message: `Indique el efectivo contado para la sesión #${idSesion}` });
      }
      const resumenPrevio = await caja.calcularResumenSesion(sesionAbierta);
      const diferencia = contado - resumenPrevio.efectivoEsperado;
      if (descuadreSvc.tieneDescuadreSignificativo(diferencia)) {
        const auth = await exigirAdminOSupervisor(
          {
            ...req,
            body: { autorizadoUsername, autorizadoPassword },
          },
          'Cierre con descuadre requiere autorización de un administrador (usuario y contraseña).',
        );
        if (!auth.ok) {
          return res.status(auth.status).json({
            message: auth.message,
            code: 'DESCUADRE_AUTH_REQUIRED',
            idSesion,
            diferencia,
            efectivoEsperado: resumenPrevio.efectivoEsperado,
          });
        }
        supervisor = auth.supervisor;
        break;
      }
    }

    const resultados = await caja.cerrarSesionesMultiples(lista, { ...ctx, supervisor });
    for (const r of resultados) {
      await registrarAuditoria({
        req,
        accion: 'cierre_caja',
        entidad: 'cajaSesion',
        idEntidad: r.sesion.idSesion,
        resumen: `Cierre múltiple caja #${r.sesion.idSesion} (${r.sesion.usuario})`,
        datosDespues: r,
        codigoHttp: 200,
      });
    }
    res.json({ cierres: resultados, cantidad: resultados.length });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};

exports.resumen = async (req, res, next) => {
  try {
    const idSesion = Number(req.params.idSesion);
    const sesion = await CajaSesion.findOne({ idSesion }).lean();
    if (!sesion) return res.status(404).json({ message: 'Sesión no encontrada' });
    const ctx = userCtx(req);
    if (!esAdmin(ctx.rol) && String(sesion.idUsuario) !== String(ctx.idUsuario)) {
      return res.status(403).json({ message: 'Sin permisos para ver esta caja' });
    }
    let descuadre = await descuadreSvc.obtenerPorSesion(idSesion);
    if (descuadre?.estado === 'pendiente') {
      await descuadreSvc.sincronizarDescuadreSesion(idSesion).catch(() => null);
      descuadre = await descuadreSvc.obtenerPorSesion(idSesion);
    }
    const sesionFinal = (await CajaSesion.findOne({ idSesion }).lean()) || sesion;
    const resumenOut = await caja.resumenVistaSesion(sesionFinal, { descuadre });
    res.json({ sesion: caja.planoSesion(sesionFinal), resumen: resumenOut, descuadre });
  } catch (e) {
    next(e);
  }
};

exports.previewCierreGeneral = async (req, res, next) => {
  try {
    if (!esAdmin(req.user?.rol)) {
      return res.status(403).json({ message: 'Solo administradores' });
    }
    const fechaDia = req.query.fechaDia || new Date().toISOString().slice(0, 10);
    const resumen = await caja.calcularCierreGeneral(fechaDia, { soloCerradas: true, idSede: req.idSede });
    const estado = await caja.estadoCierresGeneralesDia(fechaDia, req.idSede);
    res.json({ ...resumen, estadoDia: estado });
  } catch (e) {
    next(e);
  }
};

exports.estadoCierreGeneralDia = async (req, res, next) => {
  try {
    if (!esAdmin(req.user?.rol)) {
      return res.status(403).json({ message: 'Solo administradores' });
    }
    const fecha = req.query.fecha || new Date().toISOString().slice(0, 10);
    res.json(await caja.estadoCierresGeneralesDia(fecha, req.idSede));
  } catch (e) {
    next(e);
  }
};

exports.registrarCierreGeneral = async (req, res, next) => {
  try {
    if (!esAdmin(req.user?.rol)) {
      return res.status(403).json({ message: 'Solo administradores' });
    }
    const { fechaDia, observaciones, forzar } = req.body || {};
    const ctx = userCtx(req);
    const diaUse = fechaDia || new Date().toISOString().slice(0, 10);

    const { cierre, resumen } = await caja.registrarCierreGeneral({
      fechaDia: diaUse,
      idSede: req.idSede,
      observaciones,
      usuarioAdmin: ctx.usuario,
      idUsuarioAdmin: ctx.idUsuario,
      forzar: !!forzar,
    });

    await registrarAuditoria({
      req,
      accion: 'cierre_caja',
      entidad: 'cajaCierreGeneral',
      idEntidad: cierre.idCierreGeneral,
      resumen: `Cierre general ${diaUse} — ${resumen.cantidadCajas} cajas`,
      datosDespues: { cierre, resumen },
      codigoHttp: 201,
    });

    res.status(201).json({ cierre, resumen });
  } catch (e) {
    if (e.status) {
      return res.status(e.status).json({
        message: e.message,
        code: e.code,
        cierreExistente: e.cierreExistente,
        cajasAbiertas: e.cajasAbiertas,
      });
    }
    next(e);
  }
};

exports.listarCierresGenerales = async (req, res, next) => {
  try {
    if (!esAdmin(req.user?.rol)) {
      return res.status(403).json({ message: 'Solo administradores' });
    }
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const fecha = req.query.fecha || null;
    res.json(await caja.listarCierresGenerales(limit, fecha, req.idSede));
  } catch (e) {
    next(e);
  }
};

exports.listarDescuadres = async (req, res, next) => {
  try {
    if (!esAdmin(req.user?.rol)) {
      return res.status(403).json({ message: 'Solo administradores' });
    }
    const rows = await descuadreSvc.listarDescuadres({
      estado: req.query.estado,
      idUsuario: req.query.idUsuario,
      desde: req.query.desde,
      hasta: req.query.hasta,
      limit: req.query.limit,
    });
    res.json(rows);
  } catch (e) {
    next(e);
  }
};

exports.resumenDescuadresMensual = async (req, res, next) => {
  try {
    if (!esAdmin(req.user?.rol)) {
      return res.status(403).json({ message: 'Solo administradores' });
    }
    const mes = req.query.mes || new Date().toISOString().slice(0, 7);
    res.json(await descuadreSvc.resumenMensual(mes));
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};

exports.reabrirSesion = async (req, res, next) => {
  try {
    if (!esAdmin(req.user?.rol)) {
      return res.status(403).json({ message: 'Solo administradores' });
    }
    const idSesion = Number(req.params.idSesion);
    const ctx = userCtx(req);
    const { observaciones } = req.body || {};
    const sesion = await caja.reabrirSesion(idSesion, {
      user: ctx.user,
      rol: ctx.rol,
      observaciones,
    });
    await registrarAuditoria({
      req,
      accion: 'reabrir_caja',
      entidad: 'cajaSesion',
      idEntidad: idSesion,
      resumen: `Reapertura caja #${idSesion} (${sesion.usuario})`,
      datosDespues: sesion,
      codigoHttp: 200,
    });
    res.json({ sesion, message: 'Caja reabierta. Puede corregir egresos/ingresos y volver a cerrar.' });
  } catch (e) {
    if (e.status) {
      return res.status(e.status).json({
        message: e.message,
        code: e.code,
      });
    }
    next(e);
  }
};

exports.recalcularDescuadre = async (req, res, next) => {
  try {
    const idSesion = Number(req.params.idSesion);
    const ctx = userCtx(req);
    const sesion = await CajaSesion.findOne({ idSesion }).lean();
    if (!sesion) return res.status(404).json({ message: 'Sesión no encontrada' });
    if (!esAdmin(ctx.rol) && String(sesion.idUsuario) !== String(ctx.idUsuario)) {
      return res.status(403).json({ message: 'Sin permisos' });
    }
    const result = await descuadreSvc.verificarDescuadreResuelto(idSesion);
    if (!result) {
      return res.status(404).json({ message: 'No hay descuadre pendiente para esta sesión' });
    }
    const descuadre = await descuadreSvc.obtenerPorSesion(idSesion);
    res.json({ ...result, descuadre });
  } catch (e) {
    next(e);
  }
};

exports.ingresoCuadreDescuadre = async (req, res, next) => {
  try {
    const idSesion = Number(req.params.idSesion);
    const { valor, idTipoPago, observaciones } = req.body || {};
    const ctx = userCtx(req);
    const out = await descuadreSvc.registrarIngresoCuadreDescuadre({
      idSesion,
      valor,
      idTipoPago,
      observaciones,
      user: ctx.user,
      idUsuario: ctx.idUsuario,
      rol: ctx.rol,
    });
    await registrarAuditoria({
      req,
      accion: 'ingreso_cuadre_descuadre',
      entidad: 'cajaSesion',
      idEntidad: idSesion,
      resumen: `Ingreso cuadre descuadre sesión #${idSesion} — ${valor} COP`,
      datosDespues: out,
      codigoHttp: 201,
    });
    res.status(201).json(out);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};
