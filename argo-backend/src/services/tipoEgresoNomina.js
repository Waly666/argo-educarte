const { models: cat } = require('../models/catalogos');

/** Efecto en nómina al registrar el egreso (deducción automática, etc.) */
const EFECTOS_NOMINA = ['', 'prestamo', 'abono_adelanto', 'pago_sueldo'];

const DEFAULTS_POR_ID = {
  2: { requiereEmpleado: true, efectoNomina: 'pago_sueldo' },
  3: { requiereEmpleado: true, efectoNomina: 'abono_adelanto' },
  10: { requiereEmpleado: true, efectoNomina: 'prestamo' },
  14: { requiereVehiculo: true },
  15: { requiereVehiculo: true },
};

function normBool(v) {
  if (v === true || v === 1 || v === '1' || v === 'true' || v === 'si' || v === 'Sí') return true;
  if (v === false || v === 0 || v === '0' || v === 'false' || v === 'no' || v === 'No') return false;
  return null;
}

function inferirDesdeNombre(tipoNombre) {
  const t = normTipoNombre(tipoNombre);
  if (/\bPRESTAMO/.test(t)) return { efectoNomina: 'prestamo', requiereEmpleado: true };
  if (/ABONO/.test(t) && /SUELDO/.test(t)) {
    return { efectoNomina: 'abono_adelanto', requiereEmpleado: true };
  }
  if (/PAGO/.test(t) && /SUELDO/.test(t)) {
    return { efectoNomina: 'pago_sueldo', requiereEmpleado: true };
  }
  if (/HORA/.test(t) && /DICTAD/.test(t)) return { requiereEmpleado: true, efectoNomina: '' };
  if (/VEHICULO|COMBUSTIBLE/.test(t)) return { requiereVehiculo: true, requiereEmpleado: false, efectoNomina: '' };
  return { requiereEmpleado: false, efectoNomina: '', requiereVehiculo: false };
}

function normTipoNombre(tipoNombre) {
  return String(tipoNombre || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
    .toUpperCase();
}

/** Traslado de efectivo de caja (consignación, caja fuerte, etc.) — catálogo tipoEgreso "RETIRO". */
function esRetiroCajaTipo(tipoDoc) {
  if (!tipoDoc) return false;
  if (tipoDoc.esRetiroCaja === true || tipoDoc.esRetiroCaja === 1 || tipoDoc.esRetiroCaja === '1') {
    return true;
  }
  const t = normTipoNombre(tipoDoc.tipo);
  return t === 'RETIRO' || /^RETIRO\b/.test(t);
}

function configDesdeTipoDoc(tipoDoc) {
  if (!tipoDoc) {
    return {
      requiereEmpleado: false,
      requiereVehiculo: false,
      efectoNomina: '',
      generaDeduccionNomina: false,
      anticipoNomina: null,
    };
  }
  let requiereEmpleado = normBool(tipoDoc.requiereEmpleado);
  let requiereVehiculo = normBool(tipoDoc.requiereVehiculo);
  let efectoNomina = String(tipoDoc.efectoNomina || '').trim().toLowerCase();
  if (!EFECTOS_NOMINA.includes(efectoNomina)) efectoNomina = '';

  if (requiereEmpleado == null && !efectoNomina && requiereVehiculo == null) {
    const inf = inferirDesdeNombre(tipoDoc.tipo);
    if (requiereEmpleado == null) requiereEmpleado = inf.requiereEmpleado;
    if (!efectoNomina) efectoNomina = inf.efectoNomina || '';
    if (requiereVehiculo == null) requiereVehiculo = !!inf.requiereVehiculo;
  }
  if (requiereEmpleado == null) requiereEmpleado = !!efectoNomina;
  if (requiereVehiculo == null) requiereVehiculo = false;
  if (efectoNomina === 'pago_sueldo') {
    return {
      requiereEmpleado: true,
      requiereVehiculo,
      efectoNomina: 'pago_sueldo',
      generaDeduccionNomina: false,
      anticipoNomina: null,
    };
  }
  const anticipoNomina =
    efectoNomina === 'prestamo' || efectoNomina === 'abono_adelanto' ? efectoNomina : null;
  return {
    requiereEmpleado,
    requiereVehiculo,
    efectoNomina,
    generaDeduccionNomina: !!anticipoNomina,
    anticipoNomina,
  };
}

async function resolverTipoEgresoDoc(tipoEgreso) {
  if (!tipoEgreso) return null;
  const mongoose = require('mongoose');
  const or = [{ idTipoEgreso: tipoEgreso }];
  const n = Number(tipoEgreso);
  if (Number.isFinite(n)) or.push({ idTipoEgreso: n });
  if (mongoose.isValidObjectId(String(tipoEgreso))) {
    or.push({ _id: new mongoose.Types.ObjectId(String(tipoEgreso)) });
  }
  return cat.tipoEgreso.findOne({ $or: or }).lean();
}

async function configPorTipoEgresoId(tipoEgreso) {
  const doc = await resolverTipoEgresoDoc(tipoEgreso);
  return { tipoDoc: doc, ...configDesdeTipoDoc(doc) };
}

/** Rellena campos nuevos en catálogo sin pisar lo configurado en admin. */
async function sincronizarDefaultsTipoEgreso() {
  const col = cat.tipoEgreso;
  let actualizados = 0;
  for (const [idStr, defs] of Object.entries(DEFAULTS_POR_ID)) {
    const id = Number(idStr);
    const row = await col.findOne({ idTipoEgreso: id }).lean();
    if (!row) continue;
    const patch = {};
    if (row.requiereEmpleado == null && defs.requiereEmpleado != null) {
      patch.requiereEmpleado = defs.requiereEmpleado;
    }
    if (row.requiereVehiculo == null && defs.requiereVehiculo != null) {
      patch.requiereVehiculo = defs.requiereVehiculo;
    }
    if (!row.efectoNomina && defs.efectoNomina) patch.efectoNomina = defs.efectoNomina;
    if (Object.keys(patch).length) {
      await col.updateOne({ _id: row._id }, { $set: patch });
      actualizados += 1;
    }
  }
  const sinEfecto = await col
    .find({
      efectoNomina: { $in: [null, ''] },
      requiereEmpleado: { $in: [null, undefined] },
      requiereVehiculo: { $in: [null, undefined] },
    })
    .lean();
  for (const row of sinEfecto) {
    const inf = inferirDesdeNombre(row.tipo);
    const patch = {};
    if (row.requiereEmpleado == null && inf.requiereEmpleado) patch.requiereEmpleado = true;
    if (row.requiereVehiculo == null && inf.requiereVehiculo) patch.requiereVehiculo = true;
    if (!row.efectoNomina && inf.efectoNomina) patch.efectoNomina = inf.efectoNomina;
    if (Object.keys(patch).length) {
      await col.updateOne({ _id: row._id }, { $set: patch });
      actualizados += 1;
    }
  }
  return actualizados;
}

module.exports = {
  EFECTOS_NOMINA,
  DEFAULTS_POR_ID,
  normTipoNombre,
  esRetiroCajaTipo,
  configDesdeTipoDoc,
  configPorTipoEgresoId,
  resolverTipoEgresoDoc,
  sincronizarDefaultsTipoEgreso,
};
