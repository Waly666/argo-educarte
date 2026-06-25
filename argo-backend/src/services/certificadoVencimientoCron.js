/**
 * Cron diario — actualiza certificados vencidos.
 *
 * Regla:
 *  - Solo certificados con fechaVencimiento definida (no nula).
 *  - Solo si esa fecha ya pasó O es hoy (< inicio del día de mañana).
 *  - Solo los que siguen en estado 'vigente'.
 *  - Los pasa a estado 'vencido'.
 *
 * Los certificados sin fechaVencimiento (programas con vigencia 0) no se tocan.
 */

const cron = require('node-cron');
const Certificado = require('../models/Certificado');

/** Retorna la medianoche (00:00:00.000) del inicio de mañana en hora local del servidor. */
function inicioDiaMañana() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  return d;
}

/**
 * Ejecuta la actualización masiva de certificados vencidos.
 * Retorna un objeto con el resultado: { actualizados, error? }
 */
async function actualizarCertificadosVencidos() {
  const manana = inicioDiaMañana();
  try {
    const result = await Certificado.updateMany(
      {
        fechaVencimiento: { $ne: null, $lt: manana },
        estado: 'vigente',
      },
      { $set: { estado: 'vencido' } },
    );

    const actualizados = result.modifiedCount ?? result.nModified ?? 0;

    if (actualizados > 0) {
      console.log(`[CRON cert-vencimiento] ${new Date().toISOString()} — ${actualizados} certificado(s) marcado(s) como vencido (umbral: ${manana.toISOString()}).`);
    } else {
      console.log(`[CRON cert-vencimiento] ${new Date().toISOString()} — Sin certificados nuevos por vencer.`);
    }

    return { actualizados };
  } catch (err) {
    console.error(`[CRON cert-vencimiento] Error al actualizar certificados:`, err.message || err);
    return { actualizados: 0, error: err.message || String(err) };
  }
}

/**
 * Registra el cron job: se ejecuta todos los días a la 01:00 AM hora del servidor.
 * Llama también una vez al arrancar para ponerse al día si el servidor estuvo caído.
 */
function iniciarCronCertificadoVencimiento() {
  // Ejecución al arrancar el servidor (catch-up por si estuvo offline)
  actualizarCertificadosVencidos().catch(() => {});

  // Cron: todos los días a la 01:00 AM
  cron.schedule('0 1 * * *', () => {
    actualizarCertificadosVencidos().catch(() => {});
  });

  console.log('[CRON cert-vencimiento] Programado: todos los días a la 01:00 AM.');
}

module.exports = { iniciarCronCertificadoVencimiento, actualizarCertificadosVencidos };
