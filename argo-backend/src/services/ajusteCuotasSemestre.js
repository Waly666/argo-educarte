const mongoose = require('mongoose');
const Matricula = require('../models/Matricula');
const Liquidacion = require('../models/Liquidacion');
const { esTarifaVirtual } = require('../constants/tarifa');
const { obtenerConfigRecibo } = require('./configRecibo');
const {
  buscarPrograma,
  listarServiciosMatricula,
  programaUsaSemestres,
  num,
  valorTarifaServicio,
} = require('./programaServicio');
const { estadoLiq, refrescarPagoMatricula } = require('./liquidacionMatricula');

function toDec(n) {
  return mongoose.Types.Decimal128.fromString(String(Number(n) || 0));
}

function rechazar(msg, status = 400) {
  const err = new Error(msg);
  err.status = status;
  throw err;
}

async function configCuotasHabilitada() {
  const cfg = await obtenerConfigRecibo();
  return cfg.permitirAjusteCuotasSemestre === true;
}

async function exigirConfigCuotas() {
  if (!(await configCuotasHabilitada())) {
    rechazar(
      'El ajuste de cuotas por semestre está deshabilitado en Configuración → Comprobantes',
      403,
    );
  }
}

function parseValoresCuotasSemestre(body) {
  const activo =
    body?.ajustarCuotasSemestre === true ||
    body?.ajustarCuotasSemestre === 'true' ||
    (Array.isArray(body?.valoresCuotasSemestre) && body.valoresCuotasSemestre.length > 0);
  if (!activo) return null;

  const raw = body.valoresCuotasSemestre;
  if (!Array.isArray(raw) || !raw.length) {
    rechazar('Indique los valores por semestre');
  }

  const valores = raw.map((v, i) => {
    const n = Math.round(Number(v));
    if (!Number.isFinite(n) || n < 0) {
      rechazar(`Valor inválido en semestre ${i + 1}`);
    }
    return n;
  });
  return valores;
}

function validarLongitudCuotas(valores, numEsperado) {
  if (valores.length !== numEsperado) {
    rechazar(
      `Debe indicar exactamente ${numEsperado} valor(es) de semestre (recibió ${valores.length})`,
    );
  }
}

/**
 * Resuelve valores personalizados al crear matrícula (presencial/mixta, multisemestre).
 * Retorna null si no aplica o no se enviaron valores.
 */
async function resolverCuotasSemestreCreacion(body, ctx) {
  const { usaSemCuotas, numSemLiquidaciones, tarifa, serviciosProg, prog, modoMigracion } = ctx;
  if (!usaSemCuotas || numSemLiquidaciones < 2) return null;
  if (esTarifaVirtual(tarifa)) return null;

  const valores = parseValoresCuotasSemestre(body);
  if (!valores) return null;

  if (!modoMigracion) {
    await exigirConfigCuotas();
  }
  validarLongitudCuotas(valores, numSemLiquidaciones);

  const catalogo = serviciosProg
    .slice(0, numSemLiquidaciones)
    .map((s) => valorTarifaServicio(s, tarifa, prog));

  return {
    valores,
    catalogo,
    total: valores.reduce((a, v) => a + v, 0),
  };
}

async function cargarMatriculaCuotas(idMatricula) {
  const mat = await Matricula.findById(idMatricula).lean();
  if (!mat) rechazar('Matrícula no encontrada', 404);

  if (esTarifaVirtual(mat.tarifa)) {
    return { permitido: false, motivo: 'No aplica a matrículas virtuales' };
  }

  const prog = await buscarPrograma(mat.idProg || mat.idPrograma);
  if (!prog) rechazar('Programa no encontrado', 404);

  const serviciosProg = await listarServiciosMatricula(prog);
  const usaSem = programaUsaSemestres(prog) && serviciosProg.length >= 2;
  if (!usaSem) {
    return { permitido: false, motivo: 'Este programa no usa cuotas por semestre' };
  }

  const idServs = serviciosProg.map((s) => String(s.idServ));
  const idMat = String(mat._id);

  const todasLiq = await Liquidacion.find({
    $or: [{ idMat: idMat }, { idMatricula: idMat }],
  })
    .sort({ fechaCreacion: 1, createdAt: 1 })
    .lean();

  const cuotasLiq = todasLiq.filter((l) => l.idServ && idServs.includes(String(l.idServ)));
  const extrasLiq = todasLiq.filter((l) => !l.idServ || !idServs.includes(String(l.idServ)));

  const esMigracion = mat.origenMigracion === true;

  if (cuotasLiq.length < 2) {
    return { permitido: false, motivo: 'No hay cuotas por semestre en esta matrícula' };
  }

  const tarifa = Number(mat.tarifa) || 1;
  const cuotas = cuotasLiq.map((l, idx) => {
    const serv = serviciosProg.find((s) => String(s.idServ) === String(l.idServ)) || serviciosProg[idx];
    const valorCatalogo = serv ? valorTarifaServicio(serv, tarifa, prog) : num(l.valor);
    const valor = num(l.valor);
    const abonado = num(l.abonado);
    return {
      idLiquidacion: String(l._id),
      semestre: idx + 1,
      idServ: l.idServ ? String(l.idServ) : null,
      descripcion: String(l.descripcion || serv?.descrServicio || `Semestre ${idx + 1}`).trim(),
      valorCatalogo,
      valor,
      abonado,
      saldo: num(l.saldo) || Math.max(0, valor - abonado),
      estado: l.estado || estadoLiq(valor, abonado),
    };
  });

  const totalCuotas = cuotas.reduce((a, c) => a + c.valor, 0);
  const totalExtras = extrasLiq.reduce((a, l) => a + num(l.valor), 0);

  return {
    permitido: true,
    configHabilitada: esMigracion || (await configCuotasHabilitada()),
    esMigracion,
    idMatricula: idMat,
    idPrograma: String(prog.idPrograma ?? prog._id),
    programaNombre: String(prog.nombreProg || prog.nomCert || prog.descripcion || '').trim(),
    tarifa,
    numDoc: mat.numDoc,
    valorMatricula: num(mat.valorMat),
    cuotas,
    extras: extrasLiq.map((l) => ({
      idLiquidacion: String(l._id),
      descripcion: String(l.descripcion || 'Servicio adicional').trim(),
      valor: num(l.valor),
      abonado: num(l.abonado),
      saldo: num(l.saldo),
    })),
    totales: {
      cuotas: totalCuotas,
      extras: totalExtras,
      matricula: totalCuotas + totalExtras,
    },
  };
}

/**
 * Actualiza valores de cuotas por semestre de una matrícula existente.
 * body.cuotas: [{ idLiquidacion, valor }] o valoresCuotasSemestre en orden.
 */
async function actualizarCuotasSemestreMatricula(idMatricula, body, usuario) {
  const mat = await Matricula.findById(idMatricula).lean();
  if (!mat) rechazar('Matrícula no encontrada', 404);

  const esMigracion = mat.origenMigracion === true;
  if (!esMigracion) {
    await exigirConfigCuotas();
  }

  const info = await cargarMatriculaCuotas(idMatricula);
  if (!info.permitido) rechazar(info.motivo || 'No se pueden ajustar las cuotas de esta matrícula');

  const mapa = new Map(info.cuotas.map((c) => [c.idLiquidacion, c]));
  let updates = [];

  if (Array.isArray(body?.cuotas) && body.cuotas.length) {
    updates = body.cuotas.map((c) => {
      const id = String(c.idLiquidacion || c._id || '');
      const prev = mapa.get(id);
      if (!prev) rechazar(`Liquidación no pertenece a esta matrícula: ${id}`);
      const valor = Math.round(Number(c.valor));
      if (!Number.isFinite(valor) || valor < 0) rechazar(`Valor inválido en ${prev.descripcion}`);
      if (valor < prev.abonado) {
        rechazar(
          `${prev.descripcion}: el valor (${valor.toLocaleString('es-CO')}) no puede ser menor que lo abonado (${prev.abonado.toLocaleString('es-CO')})`,
        );
      }
      return { idLiquidacion: id, valor, prev };
    });
    if (updates.length !== info.cuotas.length) {
      rechazar(`Debe enviar los ${info.cuotas.length} valores de semestre`);
    }
  } else {
    const valores = parseValoresCuotasSemestre(body);
    if (!valores) rechazar('Indique los nuevos valores por semestre');
    validarLongitudCuotas(valores, info.cuotas.length);
    updates = info.cuotas.map((c, i) => {
      const valor = valores[i];
      if (valor < c.abonado) {
        rechazar(
          `${c.descripcion}: el valor no puede ser menor que lo abonado (${c.abonado.toLocaleString('es-CO')})`,
        );
      }
      return { idLiquidacion: c.idLiquidacion, valor, prev: c };
    });
  }

  const ajustadoPor = usuario?.sub ? String(usuario.sub) : usuario?.username || null;
  const fechaAjuste = new Date();
  const motivo = String(body?.motivoAjuste || '').trim() || null;

  for (const u of updates) {
    const abonado = u.prev.abonado;
    const saldo = Math.max(0, u.valor - abonado);
    const estado = estadoLiq(u.valor, abonado);
    const $set = {
      valor: toDec(u.valor),
      saldo: toDec(saldo),
      estado,
      valorAcordado: toDec(u.valor),
      fechaAjuste,
    };
    if (ajustadoPor) $set.ajustadoPor = ajustadoPor;
    if (motivo) $set.motivoAjusteCuotas = motivo;
    if (u.valor !== u.prev.valorCatalogo) {
      $set.valorCatalogo = toDec(u.prev.valorCatalogo);
    }
    await Liquidacion.updateOne({ _id: u.idLiquidacion }, { $set });
  }

  const idMat = String(idMatricula);
  const todasLiq = await Liquidacion.find({
    $or: [{ idMat: idMat }, { idMatricula: idMat }],
  }).lean();
  const valorMat = todasLiq.reduce((a, l) => a + num(l.valor), 0);
  await Matricula.findByIdAndUpdate(idMatricula, { valorMat: toDec(valorMat) });
  await refrescarPagoMatricula(idMatricula);

  return cargarMatriculaCuotas(idMatricula);
}

module.exports = {
  configCuotasHabilitada,
  resolverCuotasSemestreCreacion,
  cargarMatriculaCuotas,
  actualizarCuotasSemestreMatricula,
  parseValoresCuotasSemestre,
};
