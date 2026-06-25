const { sendMail } = require('./mail');
const { obtenerConfigAula } = require('./aulaVirtualPortal');

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

const TIPOS_PQR = ['Petición', 'Queja', 'Reclamo', 'Sugerencia', 'Felicitación'];

async function enviarPqrPortal(body) {
  const aula = await obtenerConfigAula();
  const destino = validarEmail(aula?.emailPqr);
  if (!destino) {
    const err = new Error('El formulario PQR no está configurado. Configure el correo PQR en Aula virtual.');
    err.status = 503;
    throw err;
  }

  const nombre   = String(body?.nombre   || '').trim();
  const email    = validarEmail(body?.email);
  const telefono = String(body?.telefono || '').trim();
  const tipo     = TIPOS_PQR.includes(body?.tipo) ? body.tipo : 'Petición';
  const mensaje  = String(body?.mensaje  || '').trim();
  const numDoc   = String(body?.numDoc   || '').trim();

  if (!nombre || nombre.length < 2) { const e = new Error('Indique su nombre completo'); e.status = 400; throw e; }
  if (!email)                        { const e = new Error('Indique un correo válido');    e.status = 400; throw e; }
  if (!mensaje || mensaje.length < 10) { const e = new Error('El mensaje debe tener al menos 10 caracteres'); e.status = 400; throw e; }

  const nombreCea = String(aula.nombreEmpresa || 'Portal aula virtual').trim();
  const subject   = `[${nombreCea}] ${tipo} — ${nombre}`;

  const text = [
    `Nueva ${tipo.toLowerCase()} recibida desde el aula virtual.`,
    '',
    `Tipo:    ${tipo}`,
    `Nombre:  ${nombre}`,
    numDoc   ? `Documento: ${numDoc}` : null,
    `Correo:  ${email}`,
    telefono ? `Teléfono:  ${telefono}` : null,
    '',
    'Mensaje:',
    mensaje,
  ].filter(Boolean).join('\n');

  const html = `
    <h2 style="color:#1d4ed8">${escHtml(tipo)} — Aula Virtual</h2>
    <ul>
      <li><strong>Tipo:</strong> ${escHtml(tipo)}</li>
      <li><strong>Nombre:</strong> ${escHtml(nombre)}</li>
      ${numDoc   ? `<li><strong>Documento:</strong> ${escHtml(numDoc)}</li>` : ''}
      <li><strong>Correo:</strong> ${escHtml(email)}</li>
      ${telefono ? `<li><strong>Teléfono:</strong> ${escHtml(telefono)}</li>` : ''}
    </ul>
    <p><strong>Mensaje:</strong></p>
    <p style="white-space:pre-wrap;background:#f1f5f9;padding:1rem;border-radius:8px">${escHtml(mensaje)}</p>
  `.trim();

  await sendMail({ to: destino, subject, text, html, replyTo: email });

  return { message: 'Su PQR fue enviado correctamente. Le responderemos pronto.' };
}

module.exports = { enviarPqrPortal };
