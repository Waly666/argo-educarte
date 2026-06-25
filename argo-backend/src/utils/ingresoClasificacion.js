/**
 * Distingue ingreso de caja (tercero) vs cobro a alumno.
 * Multi-ítem de alumno tiene idLiquidacion null pero sí numDoc y detalle[].
 */
function esIngresoCaja(doc) {
  if (!doc) return false;
  if (doc.ingresoCaja) return true;
  if (doc.numDoc != null || doc.idLiquidacion) return false;
  return !!doc.idTipoIngreso;
}

module.exports = { esIngresoCaja };
