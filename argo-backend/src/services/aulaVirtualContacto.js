const { sendMail } = require('./mail');
const { obtenerConfigRecibo } = require('./configRecibo');
const { obtenerConfigAula, resolverEmailFormularioContacto } = require('./aulaVirtualPortal');

function escHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function validarEmail(email) {
  const mail = String(email || '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail) ? mail : null;
}

async function enviarContactoPortal(body) {
  const [aula, recibo] = await Promise.all([obtenerConfigAula(), obtenerConfigRecibo()]);
  const destino = resolverEmailFormularioContacto(aula, recibo);
  if (!destino) {
    const err = new Error(
      'El formulario de contacto no está configurado. Indique un correo en Aula virtual o en Recibos.',
    );
    err.status = 503;
    throw err;
  }

  const nombre = String(body?.nombre || '').trim();
  const email = validarEmail(body?.email);
  const telefono = String(body?.telefono || '').trim();
  const asunto = String(body?.asunto || '').trim();
  const mensaje = String(body?.mensaje || '').trim();
  const origen = String(body?.origen || 'portal').trim() || 'portal';

  if (!nombre || nombre.length < 2) {
    const err = new Error('Indique su nombre');
    err.status = 400;
    throw err;
  }
  if (!email) {
    const err = new Error('Indique un correo válido');
    err.status = 400;
    throw err;
  }
  if (!mensaje || mensaje.length < 10) {
    const err = new Error('Escriba un mensaje de al menos 10 caracteres');
    err.status = 400;
    throw err;
  }

  const nombreCea = String(aula.nombreEmpresa || 'Portal aula virtual').trim();
  const subject = `[${nombreCea}] Contacto web${asunto ? ` — ${asunto}` : ''}`;
  const text = [
    `Nuevo mensaje desde el formulario de contacto (${origen}).`,
    '',
    `Nombre: ${nombre}`,
    `Correo: ${email}`,
    telefono ? `Teléfono: ${telefono}` : null,
    asunto ? `Asunto: ${asunto}` : null,
    '',
    'Mensaje:',
    mensaje,
  ]
    .filter(Boolean)
    .join('\n');

  const html = `
    <p>Nuevo mensaje desde el formulario de contacto (<strong>${escHtml(origen)}</strong>).</p>
    <ul>
      <li><strong>Nombre:</strong> ${escHtml(nombre)}</li>
      <li><strong>Correo:</strong> ${escHtml(email)}</li>
      ${telefono ? `<li><strong>Teléfono:</strong> ${escHtml(telefono)}</li>` : ''}
      ${asunto ? `<li><strong>Asunto:</strong> ${escHtml(asunto)}</li>` : ''}
    </ul>
    <p><strong>Mensaje:</strong></p>
    <p style="white-space:pre-wrap">${escHtml(mensaje)}</p>
  `;

  await sendMail({ to: destino, subject, text, html, replyTo: email });

  return {
    message: 'Su mensaje fue enviado correctamente. Le responderemos pronto.',
  };
}

module.exports = { enviarContactoPortal };
