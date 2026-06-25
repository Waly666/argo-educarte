const CajaSesion = require('../models/CajaSesion');
const { TIPO_SESION_VIRTUAL } = require('../constants/pasarela');
const { maxNumericId } = require('./programaServicio');
const { obtenerConfigPasarela } = require('./configPasarela');

function ymdCalendario(fecha = new Date()) {
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function esSesionCajaVirtual(s) {
  if (!s) return false;
  return s.tipoSesion === TIPO_SESION_VIRTUAL || s.excluirCierreGeneral === true;
}

async function cerrarSesionesVirtualesAnteriores(fechaDia, idSede) {
  const abiertas = await CajaSesion.find({
    tipoSesion: TIPO_SESION_VIRTUAL,
    estado: 'abierta',
    fechaDiaVirtual: { $ne: fechaDia },
  }).lean();
  const now = new Date();
  for (const s of abiertas) {
    await CajaSesion.updateOne(
      { _id: s._id },
      {
        $set: {
          estado: 'cerrada',
          fechaCierre: now,
          observacionesCierre: `Cierre automático caja virtual (${s.fechaDiaVirtual || 'sin día'})`,
          userChangeRecord: 'sistema',
          fechaMod: now,
        },
      },
    );
  }
}

/**
 * Obtiene o crea la caja virtual global del día calendario (canal Wompi).
 */
async function obtenerSesionVirtualDiaria(fecha = new Date()) {
  const cfg = await obtenerConfigPasarela({ incluirSecretos: true });
  const idSede = String(cfg.idSedeVirtual || '').trim();
  if (!idSede) {
    const err = new Error('Configure la sede virtual en Configuración → Pasarela Wompi.');
    err.status = 503;
    err.code = 'SEDE_VIRTUAL_NO_CONFIG';
    throw err;
  }

  const dia = ymdCalendario(fecha);
  await cerrarSesionesVirtualesAnteriores(dia, idSede);

  let sesion = await CajaSesion.findOne({
    tipoSesion: TIPO_SESION_VIRTUAL,
    fechaDiaVirtual: dia,
  }).lean();

  if (sesion?.estado === 'abierta') return sesion;

  if (sesion?.estado === 'cerrada') {
    const err = new Error(`La caja virtual del ${dia} ya está cerrada.`);
    err.status = 409;
    err.code = 'CAJA_VIRTUAL_CERRADA';
    throw err;
  }

  const idSesion = await maxNumericId(CajaSesion, 'idSesion');
  const doc = await CajaSesion.create({
    idSesion,
    idSede,
    tipoSesion: TIPO_SESION_VIRTUAL,
    fechaDiaVirtual: dia,
    excluirCierreGeneral: true,
    estado: 'abierta',
    usuario: 'SISTEMA_PASARELA',
    idUsuario: 'SISTEMA_PASARELA',
    nombreCaja: `Pasarela en línea ${dia}`,
    saldoInicial: 0,
    observacionesApertura: 'Caja virtual diaria — pagos Wompi (no efectivo)',
    userAddReg: 'sistema',
  });
  return doc.toObject();
}

module.exports = {
  ymdCalendario,
  esSesionCajaVirtual,
  obtenerSesionVirtualDiaria,
};
