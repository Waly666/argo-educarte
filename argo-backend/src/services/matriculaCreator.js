const mongoose = require('mongoose');
const Matricula = require('../models/Matricula');
const DatosAlumno = require('../models/DatosAlumno');
const Liquidacion = require('../models/Liquidacion');
const { parseNumDoc, numDocQuery } = require('../utils/numDoc');
const {
  buscarPrograma,
  listarServiciosMatricula,
  programaUsaSemestres,
  num,
  repartirValor,
  valorTarifaServicio,
} = require('./programaServicio');
const { estadoLiq } = require('./liquidacionMatricula');
const {
  esProgramaJornadasCap,
  TIPO_JORNADAS_CAPACITACION,
  resolverIdSedeMatriculaJornada,
} = require('./jornadaCapacitacion');
const { normalizarIdSede } = require('./sedeContext');
const { esTarifaVirtual } = require('../constants/tarifa');
const {
  resolverTarifaMatricula,
  descripcionConRevalidacion,
} = require('./revalidacionPrograma');
const { resolverModalidadPrograma } = require('./programaModalidad');
const { obtenerConfigRecibo } = require('./configRecibo');
const {
  resolverServiciosAdicionalesMatricula,
  sumaExtrasMatricula,
} = require('./serviciosAdicionalesResolver');
const { crearLiquidacionesServiciosAdicionales } = require('./serviciosAdicionalesLiquidacion');
const { resolverCuotasSemestreCreacion } = require('./ajusteCuotasSemestre');

function toDec(n) {
  return mongoose.Types.Decimal128.fromString(String(Number(n) || 0));
}

function resolverAjusteValor(body, { valorCatalogo, tarifa, esJornada, usuario, permitirAjuste = true }) {
  const catalogo = Math.round(Number(valorCatalogo) || 0);
  const rechazarAjuste = (msg) => {
    const err = new Error(msg || 'No se puede ajustar el valor en este tipo de matrícula');
    err.status = 400;
    throw err;
  };
  const rechazarAjusteDeshabilitado = () => {
    const err = new Error(
      'El ajuste de valor en matrícula está deshabilitado en Configuración → Comprobantes',
    );
    err.status = 403;
    throw err;
  };

  if (esJornada || esTarifaVirtual(tarifa) || catalogo <= 0) {
    const intento =
      body?.ajustarValor === true ||
      body?.ajustarValor === 'true' ||
      (body?.valorAcordado != null && body?.valorAcordado !== '');
    if (intento) {
      if (!permitirAjuste) rechazarAjusteDeshabilitado();
      const ac = Math.round(Number(body.valorAcordado));
      if (Number.isFinite(ac) && ac !== catalogo) rechazarAjuste();
    }
    return null;
  }

  const activo =
    body?.ajustarValor === true ||
    body?.ajustarValor === 'true' ||
    (body?.valorAcordado != null && body?.valorAcordado !== '');
  if (!activo) return null;
  if (!permitirAjuste) rechazarAjusteDeshabilitado();

  const acordado = Math.round(Number(body.valorAcordado));
  if (!Number.isFinite(acordado) || acordado < 0) {
    const err = new Error('Valor acordado inválido');
    err.status = 400;
    throw err;
  }
  if (acordado > catalogo) {
    const err = new Error('Solo se permiten rebajas: el valor acordado no puede superar el valor catálogo');
    err.status = 400;
    throw err;
  }

  const motivo = String(body.motivoAjuste || '').trim();
  if (acordado < catalogo && !motivo) {
    const err = new Error('Indique el motivo de la rebaja sobre el valor catálogo');
    err.status = 400;
    throw err;
  }
  if (acordado === catalogo) return null;

  return {
    valorCatalogo: catalogo,
    valorAcordado: acordado,
    motivoAjuste: motivo,
    ajustadoPor: usuario?.sub ? String(usuario.sub) : usuario?.username || null,
    fechaAjuste: new Date(),
  };
}

function tieneValorHistoricoMigracion(body) {
  const raw = body?.valorHistorico ?? body?.valorAcordado;
  return raw != null && raw !== '';
}

function resolverValorMigracionHistorica(body, { valorCatalogo, usuario }) {
  const raw = body?.valorHistorico ?? body?.valorAcordado;
  if (raw == null || raw === '') return null;

  const acordado = Math.round(Number(raw));
  if (!Number.isFinite(acordado) || acordado < 0) {
    const err = new Error('Valor histórico inválido');
    err.status = 400;
    throw err;
  }

  const catalogo = Math.round(Number(valorCatalogo) || 0);
  if (acordado === catalogo) return null;

  const motivo = String(body.motivoAjuste || body.motivoValorHistorico || '').trim();
  return {
    valorCatalogo: catalogo,
    valorAcordado: acordado,
    motivoAjuste: motivo || 'Valor histórico migración (Access)',
    ajustadoPor: usuario?.sub ? String(usuario.sub) : usuario?.username || null,
    fechaAjuste: new Date(),
  };
}

async function crearMatriculaDesdeBody(body, idSedeCtx, ctx = {}) {
  const {
    numDoc: numDocRaw,
    idPrograma,
    idProg,
    tarifa: tarifaBody = 1,
    observaciones,
    tarifaManual = false,
  } = body || {};
  const numDoc = parseNumDoc(numDocRaw);
  const progId = idPrograma || idProg;
  if (numDoc == null || !progId) {
    const err = new Error('numDoc e idPrograma son obligatorios');
    err.status = 400;
    throw err;
  }

  const prog = await buscarPrograma(progId);
  if (!prog) {
    const err = new Error('Programa no encontrado');
    err.status = 404;
    throw err;
  }

  const esJornada = await esProgramaJornadasCap(prog);
  let idSede = normalizarIdSede(idSedeCtx || body?.idSede);
  if (!idSede && !esJornada) {
    const err = new Error('Debe seleccionar la sede para matricular');
    err.status = 428;
    err.code = 'SEDE_REQUERIDA';
    throw err;
  }
  if (esJornada) {
    idSede = await resolverIdSedeMatriculaJornada();
  }

  const alumno = await DatosAlumno.findOne(numDocQuery(numDoc)).lean();
  const serviciosProg = await listarServiciosMatricula(prog);
  const modInfo = resolverModalidadPrograma(prog, serviciosProg);

  const tarifaManualFlag =
    tarifaManual === true || tarifaManual === 'true' || body?.forzarTarifa === true;
  const resTarifa = await resolverTarifaMatricula({
    numDoc,
    prog,
    tarifa: tarifaBody,
    tarifaManual: tarifaManualFlag,
  });
  const t = resTarifa.tarifa;
  const esRevalidacion = resTarifa.revalidacion === true;

  const usaSemBase = programaUsaSemestres(prog) && serviciosProg.length > 0;
  /** Virtual: total en una sola liquidación, sin cuotas por semestre. */
  const usaSemCuotas = usaSemBase && !esTarifaVirtual(t);
  const usaSem = usaSemBase;

  const modoMigracion = ctx.modoMigracion === true;
  const desdePortal =
    ctx.desdePortal === true ||
    body?.origenMatricula === 'portal' ||
    body?.origenMatricula === 'aula_virtual';
  if (modInfo.soloVirtual && !desdePortal && !esJornada && !modoMigracion) {
    const err = new Error(
      'Este programa es solo virtual. El alumno debe matricularse desde el portal; el cajero puede cobrar la liquidación generada.',
    );
    err.status = 403;
    err.code = 'MATRICULA_SOLO_PORTAL';
    throw err;
  }

  if (!modInfo.tarifasPermitidas.includes(t)) {
    const err = new Error(
      `Tarifa ${t} no permitida. Modalidades del programa: ${modInfo.modalidadLabels.join(', ')}. Tarifas permitidas: ${modInfo.tarifasPermitidas.join(', ')}.`,
    );
    err.status = 400;
    err.code = 'TARIFA_NO_PERMITIDA_MODALIDAD';
    throw err;
  }

  const valorHistoricoMigracion = modoMigracion && tieneValorHistoricoMigracion(body);
  if (esTarifaVirtual(t) && !valorHistoricoMigracion) {
    const tieneVirtual = usaSem
      ? serviciosProg.some((s) => num(s.tarifaVirtual) > 0)
      : num(serviciosProg[0]?.tarifaVirtual) > 0;
    if (!tieneVirtual) {
      const err = new Error('Este programa no tiene tarifa virtual configurada en Programas');
      err.status = 400;
      throw err;
    }
  }

  let numSemLiquidaciones = usaSemCuotas ? serviciosProg.length : 1;
  if (modoMigracion && usaSemCuotas && body?.semestreHasta != null && body?.semestreHasta !== '') {
    const h = Math.round(Number(body.semestreHasta));
    if (Number.isFinite(h) && h >= 1) {
      numSemLiquidaciones = Math.min(h, serviciosProg.length);
    }
  }

  let valorCatalogoMat = 0;
  if (esJornada) {
    valorCatalogoMat = 0;
  } else if (usaSem) {
    const slice = usaSemCuotas
      ? serviciosProg.slice(0, numSemLiquidaciones)
      : serviciosProg;
    valorCatalogoMat = slice.reduce((acc, s) => acc + valorTarifaServicio(s, t, prog), 0);
  } else {
    const serv = serviciosProg[0] || null;
    valorCatalogoMat = valorTarifaServicio(serv, t, prog);
  }

  const extrasMatricula = await resolverServiciosAdicionalesMatricula(prog, {
    tarifa: t,
    serviciosProg,
    modoMigracion: ctx.modoMigracion,
  });
  const valorExtrasMatricula = sumaExtrasMatricula(extrasMatricula);

  const ajuste = modoMigracion
    ? resolverValorMigracionHistorica(body, { valorCatalogo: valorCatalogoMat, usuario: ctx.usuario })
    : resolverAjusteValor(body, {
        valorCatalogo: valorCatalogoMat,
        tarifa: t,
        esJornada,
        usuario: ctx.usuario,
        permitirAjuste: (await obtenerConfigRecibo()).permitirAjusteValorMatricula !== false,
      });

  const cuotasPersonalizadas = await resolverCuotasSemestreCreacion(body, {
    usaSemCuotas,
    numSemLiquidaciones,
    tarifa: t,
    serviciosProg,
    prog,
    modoMigracion: ctx.modoMigracion === true,
  });

  let valorMatriculaNet = ajuste ? ajuste.valorAcordado : valorCatalogoMat;
  let valoresPorSemestre = null;

  if (cuotasPersonalizadas) {
    valorMatriculaNet = cuotasPersonalizadas.total;
    valoresPorSemestre = cuotasPersonalizadas.valores;
  } else if (ajuste && usaSemCuotas) {
    valoresPorSemestre = repartirValor(valorMatriculaNet, numSemLiquidaciones);
  }

  const valorMat = valorMatriculaNet + valorExtrasMatricula;

  let fechaMat = new Date();
  if (modoMigracion && body?.fechaMat) {
    const fm = new Date(body.fechaMat);
    if (!Number.isNaN(fm.getTime())) fechaMat = fm;
  }
  const marcaMigracion = modoMigracion ? { origenMigracion: true } : {};

  if (esJornada && alumno?._id) {
    await DatosAlumno.updateOne(
      { _id: alumno._id },
      { $set: { tipoAlumno: TIPO_JORNADAS_CAPACITACION } },
    );
  }

  const idProgramaVal = String(prog.idPrograma ?? prog._id);
  const obsBase = String(observaciones || '').trim();
  const obsRevalidacion = esRevalidacion
    ? [obsBase, 'Refrendación / renovación de certificado'].filter(Boolean).join(' · ')
    : obsBase;

  const camposAjuste = ajuste
    ? {
        valorCatalogo: toDec(ajuste.valorCatalogo),
        valorAcordado: toDec(ajuste.valorAcordado),
        motivoAjuste: ajuste.motivoAjuste,
        ajustadoPor: ajuste.ajustadoPor,
        fechaAjuste: ajuste.fechaAjuste,
      }
    : {};

  const m = await Matricula.create({
    numDoc,
    idSede,
    idPrograma: idProgramaVal,
    idProg: idProgramaVal,
    fechaMat,
    valorMat: toDec(valorMat),
    tarifa: t,
    pagada: 'No Pago',
    estado: 'Activo',
    observaciones: obsRevalidacion,
    esRevalidacion,
    ...camposAjuste,
    ...marcaMigracion,
  });

  const liquidaciones = [];
  if (usaSemCuotas) {
    for (let i = 0; i < numSemLiquidaciones; i++) {
      const serv = serviciosProg[i];
      const vCatalogoSem = valorTarifaServicio(serv, t, prog);
      const v = valoresPorSemestre ? valoresPorSemestre[i] : vCatalogoSem;
      const marcaCuotas =
        cuotasPersonalizadas && v !== vCatalogoSem
          ? {
              valorCatalogo: toDec(vCatalogoSem),
              valorAcordado: toDec(v),
              motivoAjusteCuotas: String(body.motivoAjusteCuotas || body.motivoAjuste || '').trim() || 'Cuotas personalizadas',
              ajustadoPor: ctx.usuario?.sub ? String(ctx.usuario.sub) : ctx.usuario?.username || null,
              fechaAjuste: new Date(),
            }
          : {};
      const liq = await Liquidacion.create({
        numDoc,
        idSede,
        idAlumno: alumno?._id ? String(alumno._id) : null,
        idMatricula: m._id,
        idMat: m._id,
        idProg: idProgramaVal,
        idServ: String(serv.idServ),
        descripcion: descripcionConRevalidacion(
          serv.descrServicio || serv.descripcion || prog.nombreProg,
          esRevalidacion,
        ),
        valor: toDec(v),
        abonado: toDec(0),
        saldo: toDec(v),
        estado: v <= 0 ? 'pagado' : 'pendiente',
        esRevalidacion,
        fechaCreacion: fechaMat,
        ...(ajuste && !cuotasPersonalizadas
          ? {
              valorCatalogo: toDec(vCatalogoSem),
              valorAcordado: toDec(v),
              motivoAjuste: ajuste.motivoAjuste,
              ajustadoPor: ajuste.ajustadoPor,
              fechaAjuste: ajuste.fechaAjuste,
            }
          : {}),
        ...marcaCuotas,
        ...marcaMigracion,
      });
      liquidaciones.push(liq);
    }
  } else if (usaSem && esTarifaVirtual(t)) {
    const serv = serviciosProg[0] || null;
    const liq = await Liquidacion.create({
      numDoc,
      idSede,
      idAlumno: alumno?._id ? String(alumno._id) : null,
      idMatricula: m._id,
      idMat: m._id,
      idProg: idProgramaVal,
      idServ: serv ? String(serv.idServ) : null,
      descripcion: descripcionConRevalidacion(
        prog.nombreProg || prog.nomCert || serv?.descrServicio || 'Matrícula virtual',
        esRevalidacion,
      ),
      valor: toDec(valorMatriculaNet),
      abonado: toDec(0),
      saldo: toDec(valorMatriculaNet),
      estado: valorMatriculaNet <= 0 ? 'pagado' : 'pendiente',
      esRevalidacion,
      fechaCreacion: fechaMat,
      ...(ajuste
        ? {
            valorCatalogo: toDec(valorCatalogoMat),
            valorAcordado: toDec(valorMatriculaNet),
            motivoAjuste: ajuste.motivoAjuste,
            ajustadoPor: ajuste.ajustadoPor,
            fechaAjuste: ajuste.fechaAjuste,
          }
        : {}),
      ...marcaMigracion,
    });
    liquidaciones.push(liq);
  } else {
    const serv = serviciosProg[0] || null;
    const liq = await Liquidacion.create({
      numDoc,
      idSede,
      idAlumno: alumno?._id ? String(alumno._id) : null,
      idMatricula: m._id,
      idMat: m._id,
      idProg: idProgramaVal,
      idServ: serv ? String(serv.idServ) : null,
      descripcion: descripcionConRevalidacion(
        serv?.descrServicio || serv?.descripcion || prog.nombreProg || prog.descripcion || 'Matrícula programa',
        esRevalidacion,
      ),
      valor: toDec(valorMatriculaNet),
      abonado: toDec(0),
      saldo: toDec(valorMatriculaNet),
      estado: valorMatriculaNet <= 0 ? 'pagado' : 'pendiente',
      esRevalidacion,
      fechaCreacion: fechaMat,
      ...(ajuste
        ? {
            valorCatalogo: toDec(valorCatalogoMat),
            valorAcordado: toDec(valorMatriculaNet),
            motivoAjuste: ajuste.motivoAjuste,
            ajustadoPor: ajuste.ajustadoPor,
            fechaAjuste: ajuste.fechaAjuste,
          }
        : {}),
      ...marcaMigracion,
    });
    liquidaciones.push(liq);
  }

  const extrasLiq = await crearLiquidacionesServiciosAdicionales({
    items: extrasMatricula.filter((i) => !i.repartirSemestres),
    numDoc,
    idSede,
    idMatricula: m._id,
    idProg: idProgramaVal,
    idAlumno: alumno?._id,
    fechaCreacion: fechaMat,
    extras: marcaMigracion,
  });
  liquidaciones.push(...extrasLiq);

  const estadoAgregado = liquidaciones.length
    ? estadoLiq(
        liquidaciones.reduce((a, l) => a + num(l.valor), 0),
        liquidaciones.reduce((a, l) => a + num(l.abonado), 0),
      )
    : 'pendiente';
  if (estadoAgregado === 'pagado') {
    await Matricula.findByIdAndUpdate(m._id, { pagada: 'Pagado' });
  }

  const result = {
    matricula: { ...m.toObject(), valorMat: num(m.valorMat) },
    revalidacion: {
      aplica: esRevalidacion,
      aplicadaAuto: resTarifa.aplicadaAuto === true,
      mensaje: resTarifa.mensaje,
      tarifa: t,
    },
    liquidacion: liquidaciones[0]
      ? {
          ...liquidaciones[0].toObject(),
          valor: num(liquidaciones[0].valor),
          abonado: num(liquidaciones[0].abonado),
          saldo: num(liquidaciones[0].saldo),
        }
      : null,
    liquidaciones: liquidaciones.map((l) => ({
      ...l.toObject(),
      valor: num(l.valor),
      abonado: num(l.abonado),
      saldo: num(l.saldo),
    })),
    ajuste: ajuste && !cuotasPersonalizadas
      ? {
          valorCatalogo: ajuste.valorCatalogo + valorExtrasMatricula,
          valorAcordado: ajuste.valorAcordado + valorExtrasMatricula,
          rebaja: ajuste.valorCatalogo - ajuste.valorAcordado,
          motivoAjuste: ajuste.motivoAjuste,
        }
      : null,
    cuotasSemestre: cuotasPersonalizadas
      ? {
          valores: cuotasPersonalizadas.valores,
          total: cuotasPersonalizadas.total + valorExtrasMatricula,
          totalMatricula: cuotasPersonalizadas.total,
        }
      : null,
    serviciosAdicionales: extrasMatricula.map((i) => ({
      reglaId: i.reglaId,
      idServ: i.idServ,
      descripcion: i.descripcion,
      valor: i.valor,
      repartirSemestres: i.repartirSemestres,
    })),
    usuarioPortal: null,
  };

  const crearPortal =
    !modoMigracion &&
    esTarifaVirtual(t) &&
    (body.crearUsuarioPortal === true || body.crearUsuarioPortal === 'true');
  if (crearPortal) {
    const { crearUsuarioPortalAlumno } = require('./aulaVirtualMatricula');
    result.usuarioPortal = await crearUsuarioPortalAlumno({
      numDoc,
      email: body.email || alumno?.correo,
      password: body.password,
    });
  }

  return result;
}

module.exports = { crearMatriculaDesdeBody };
