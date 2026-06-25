const crypto = require('crypto');
const PagoEnLineaIntent = require('../models/PagoEnLineaIntent');
const { obtenerConfigPasarela } = require('./configPasarela');
const { registrarIngresoPasarela } = require('./pasarelaWompi');
const { obtenerTransaccionWompi, validarTransaccionConIntent } = require('./wompiApi');

function valorEnData(data, path) {
  return String(path || '')
    .split('.')
    .reduce((acc, key) => (acc == null ? undefined : acc[key]), data);
}

function verificarChecksumEvento(body, checksumHeader, eventsSecret) {
  if (!eventsSecret) return false;

  const checksum = checksumHeader || body?.signature?.checksum;
  if (!checksum) return false;

  const properties = body?.signature?.properties;
  if (!Array.isArray(properties) || properties.length === 0) return false;

  const data = body?.data || {};
  let chain = '';
  for (const prop of properties) {
    const val = valorEnData(data, prop);
    if (val === undefined || val === null) return false;
    chain += String(val);
  }

  const timestamp = body?.timestamp;
  if (timestamp == null || timestamp === '') return false;
  chain += String(timestamp);
  chain += eventsSecret;

  const hash = crypto.createHash('sha256').update(chain).digest('hex');
  const provided = String(checksum).trim();
  return hash === provided || hash.toUpperCase() === provided.toUpperCase();
}

async function confirmarTransaccionWompi(tx, intent, cfg) {
  if (!cfg?.privateKey) return tx;
  const txId = tx?.id;
  if (!txId) return tx;

  const remota = await obtenerTransaccionWompi(txId, cfg);
  const transaccion = remota?.transaction || remota;
  const val = validarTransaccionConIntent(transaccion, intent);
  if (!val.ok) {
    const err = new Error(val.message);
    err.status = 400;
    throw err;
  }
  return transaccion;
}

async function procesarWebhookWompi(body, headers = {}) {
  const cfg = await obtenerConfigPasarela({ incluirSecretos: true });
  const checksum = headers['x-event-checksum'] || headers['X-Event-Checksum'];

  if (cfg.eventsSecret) {
    if (!verificarChecksumEvento(body, checksum, cfg.eventsSecret)) {
      const err = new Error('Firma de evento Wompi inválida');
      err.status = 401;
      throw err;
    }
  }

  const event = String(body?.event || '').trim();
  if (event !== 'transaction.updated') {
    return { ok: true, ignorado: true, motivo: 'evento_no_transaccion' };
  }

  const tx = body?.data?.transaction;
  if (!tx) {
    return { ok: true, ignorado: true, motivo: 'sin_transaccion' };
  }

  const status = String(tx.status || '').toUpperCase();
  const reference = String(tx.reference || '').trim();
  if (!reference) {
    return { ok: true, ignorado: true, motivo: 'sin_referencia' };
  }

  const intent = await PagoEnLineaIntent.findOne({ reference }).lean();
  if (!intent) {
    return { ok: true, ignorado: true, motivo: 'intent_no_encontrado', reference };
  }

  if (status === 'APPROVED') {
    const txConfirmada = await confirmarTransaccionWompi(tx, intent, cfg);
    const result = await registrarIngresoPasarela({ intent, wompiTransaction: txConfirmada, cfg });
    return { ok: true, aprobado: true, duplicado: result.duplicado, idIngreso: result.ingreso?._id };
  }

  const mapEstado = {
    DECLINED: 'declined',
    VOIDED: 'voided',
    ERROR: 'error',
    PENDING: 'pending',
  };
  await PagoEnLineaIntent.updateOne(
    { _id: intent._id },
    {
      $set: {
        estado: mapEstado[status] || 'error',
        wompiStatus: status,
        wompiTransactionId: tx.id || null,
        rawWebhook: body,
      },
    },
  );

  return { ok: true, aprobado: false, estado: status };
}

module.exports = {
  procesarWebhookWompi,
  verificarChecksumEvento,
};
