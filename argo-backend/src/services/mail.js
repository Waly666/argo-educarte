const nodemailer = require('nodemailer');

let transporter = null;

function smtpConfigured() {
  return !!String(process.env.SMTP_HOST || '').trim();
}

function getTransporter() {
  if (!smtpConfigured()) return null;
  if (transporter) return transporter;

  const port = Number(process.env.SMTP_PORT) || 587;
  const secure = process.env.SMTP_SECURE === '1' || port === 465;
  const user = String(process.env.SMTP_USER || '').trim();
  const pass = String(process.env.SMTP_PASS || '').trim();

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST.trim(),
    port,
    secure,
    auth: user ? { user, pass } : undefined,
  });

  return transporter;
}

function mailFrom() {
  return (
    String(process.env.PORTAL_EMAIL_FROM || process.env.SMTP_FROM || '').trim() ||
    String(process.env.SMTP_USER || '').trim() ||
    'no-reply@finstruvial.edu.co'
  );
}

async function sendMail({ to, subject, text, html, replyTo, from }) {
  const tx = getTransporter();
  if (!tx) {
    const err = new Error('Servicio de correo no configurado');
    err.status = 503;
    throw err;
  }

  await tx.sendMail({
    from: from || mailFrom(),
    to,
    replyTo: replyTo || undefined,
    subject,
    text,
    html,
  });
}

module.exports = {
  smtpConfigured,
  sendMail,
  mailFrom,
};
