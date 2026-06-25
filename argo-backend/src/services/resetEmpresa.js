const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const Usuario = require('../models/Usuario');
const { baseDir: uploadsDir } = require('../middleware/upload');
const { CONSERVAR_EN_RESET, COLECCIONES_ESPECIALES } = require('../constants/cicloVidaColecciones');
const { planReset, debeLimpiarColeccion } = require('../constants/modulosResetEmpresa');
const { crearRespaldo, recrearIndices } = require('./respaldos');
const { registrarAuditoria } = require('./auditoria');
const progreso = require('./progresoOperacion');

const FRASE_CONFIRMACION = 'REINICIAR EMPRESA';

async function coleccionesActuales() {
  const cols = await mongoose.connection.db.listCollections().toArray();
  return cols.map((c) => c.name).filter((n) => !n.startsWith('system.'));
}

async function vaciarUploads() {
  if (!fs.existsSync(uploadsDir)) return 0;
  const entradas = await fs.promises.readdir(uploadsDir);
  for (const e of entradas) {
    await fs.promises.rm(path.join(uploadsDir, e), { recursive: true, force: true });
  }
  return entradas.length;
}

async function reinicializarConfigSistema() {
  const db = mongoose.connection.db;
  await db.collection('config').drop().catch(() => {});
  await db.collection('roles_app').drop().catch(() => {});
  await recrearIndices();
  const { initRolesSistema, limpiarCache } = require('./rolesPermisos');
  await initRolesSistema({ force: true });
  limpiarCache();
  const { initConfigNomina } = require('./configNomina');
  await initConfigNomina().catch(() => {});
}

async function limpiarUsuariosExceptoAdmin(db, adminDoc) {
  const rUsuarios = await db
    .collection('usuarios')
    .deleteMany({ _id: { $ne: adminDoc._id } });
  await Usuario.updateOne(
    { _id: adminDoc._id },
    { $unset: { idEmpleado: '', numero: '', numeroDocumento: '' }, $set: { sedesPermitidas: [] } },
  ).catch(() => {});
  return rUsuarios.deletedCount;
}

/**
 * Puesta en cero total o parcial por módulos:
 * - Respaldo completo previo (obligatorio).
 * - Catálogos base (CONSERVAR_EN_RESET) nunca se tocan.
 * - Reset completo: comportamiento histórico (todos los datos + config + usuarios + uploads).
 * - Reset parcial: solo las colecciones de los módulos elegidos.
 */
async function ejecutarResetEmpresa(req, adminDoc) {
  const usuario = adminDoc.username;
  const plan = planReset(req.body?.modulos);

  progreso.iniciar('reset', 'Creando copia de seguridad previa…');
  const notaRespaldo = plan.completo
    ? 'Respaldo automático antes de la puesta en cero'
    : `Respaldo automático antes del reset parcial (${plan.modulos.join(', ')})`;
  const respaldo = await crearRespaldo({
    tipo: 'pre-reset',
    usuario,
    nota: notaRespaldo,
    _interno: true,
    reportarProgreso: true,
  });

  const db = mongoose.connection.db;
  const todas = await coleccionesActuales();
  const conservadas = [];
  const limpiadas = [];

  progreso.fase(
    plan.completo ? 'Limpiando datos de la empresa…' : 'Limpiando módulos seleccionados…',
    { total: todas.length },
  );

  for (const nombre of todas) {
    progreso.avanzar(1);
    if (CONSERVAR_EN_RESET.has(nombre)) {
      conservadas.push(nombre);
      continue;
    }
    if (COLECCIONES_ESPECIALES.has(nombre)) continue;

    if (!debeLimpiarColeccion(nombre, plan)) {
      conservadas.push(nombre);
      continue;
    }

    await db.collection(nombre).drop().catch(() => {});
    limpiadas.push(nombre);
  }

  const huboTablas = limpiadas.some((n) => n !== 'config' && n !== 'roles_app');
  if (huboTablas && !plan.flags.config) {
    await recrearIndices().catch(() => {});
  }

  let usuariosEliminados = 0;
  if (plan.flags.usuarios) {
    usuariosEliminados = await limpiarUsuariosExceptoAdmin(db, adminDoc);
  }

  if (plan.flags.config) {
    await reinicializarConfigSistema();
    limpiadas.push('config', 'roles_app');
  }

  if (plan.completo || plan.flags.sedePrincipal) {
    progreso.fase('Reinicializando catálogos y configuración…', { total: 0 });
    const { asegurarSedePrincipal } = require('./sedeContext');
    await asegurarSedePrincipal().catch(() => {});
  }

  let carpetasUploadsEliminadas = 0;
  if (plan.flags.uploads) {
    carpetasUploadsEliminadas = await vaciarUploads();
  }

  const tipoReset = plan.completo ? 'completo' : 'parcial';
  await registrarAuditoria({
    req,
    accion: 'reset_empresa',
    entidad: 'sistema',
    resumen:
      `Puesta en cero ${tipoReset} ejecutada por ${usuario}. ` +
      `Módulos: ${plan.modulos.join(', ')}. ` +
      `Colecciones limpiadas: ${limpiadas.length}; conservadas: ${conservadas.length}. ` +
      `Respaldo previo: ${respaldo.archivo}`,
    datosDespues: {
      tipoReset,
      modulos: plan.modulos,
      respaldoPrevio: respaldo.archivo,
      coleccionesLimpiadas: limpiadas,
      coleccionesConservadas: conservadas,
      usuariosEliminados,
      carpetasUploadsEliminadas,
    },
  });

  const msgFin = plan.completo
    ? `Puesta en cero completada: ${limpiadas.length} tablas en cero, ${conservadas.length} catálogos conservados.`
    : `Reset parcial completado: ${limpiadas.length} tablas limpiadas (${plan.modulos.length} módulos).`;

  progreso.finalizar('ok', msgFin);

  return {
    tipoReset,
    modulos: plan.modulos,
    respaldoPrevio: respaldo.archivo,
    coleccionesLimpiadas: limpiadas.length,
    coleccionesConservadas: conservadas.length,
    usuariosEliminados,
    detalle: { limpiadas, conservadas },
  };
}

async function ejecutarResetEmpresaConProgreso(req, adminDoc) {
  try {
    return await ejecutarResetEmpresa(req, adminDoc);
  } catch (err) {
    progreso.finalizar('error', err.message || 'La puesta en cero falló');
    throw err;
  }
}

module.exports = {
  ejecutarResetEmpresa: ejecutarResetEmpresaConProgreso,
  FRASE_CONFIRMACION,
};
