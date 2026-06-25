const { wompiApiBase } = require('./configPasarela');

async function obtenerTransaccionWompi(transactionId, cfg) {
  const id = String(transactionId || '').trim();
  if (!id) {
    const err = new Error('ID de transacción Wompi requerido');
    err.status = 400;
    throw err;
  }
  if (!cfg?.privateKey) {
    const err = new Error('Llave privada Wompi no configurada');
    err.status = 503;
    throw err;
  }

  const url = `${wompiApiBase(cfg)}/transactions/${encodeURIComponent(id)}`;
  const resp = await fetch(url, {
    headers: {
      Authorization: `Bearer ${cfg.privateKey}`,
      Accept: 'application/json',
    },
  });

  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const err = new Error(json?.error?.reason || json?.message || 'No se pudo consultar la transacción en Wompi');
    err.status = resp.status >= 400 && resp.status < 500 ? resp.status : 502;
    throw err;
  }

  return json?.data || json;
}

function validarTransaccionConIntent(tx, intent) {
  if (!tx || !intent) return { ok: false, message: 'Datos incompletos' };
  const status = String(tx.status || '').toUpperCase();
  if (status !== 'APPROVED') {
    return { ok: false, message: `Transacción no aprobada (${status || 'desconocido'})` };
  }
  const reference = String(tx.reference || '').trim();
  if (reference !== String(intent.reference || '').trim()) {
    return { ok: false, message: 'La referencia no coincide con el intento de pago' };
  }
  const cents = Number(tx.amount_in_cents);
  if (!Number.isFinite(cents) || cents !== Number(intent.montoCentavos)) {
    return { ok: false, message: 'El monto de la transacción no coincide' };
  }
  return { ok: true };
}

module.exports = {
  obtenerTransaccionWompi,
  validarTransaccionConIntent,
};
