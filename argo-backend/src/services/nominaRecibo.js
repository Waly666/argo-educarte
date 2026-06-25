const LiquidacionNomina = require('../models/LiquidacionNomina');
const PeriodoNomina = require('../models/PeriodoNomina');
const Empleado = require('../models/Empleado');
const { obtenerConfigRecibo } = require('./configRecibo');
const { fmtFechaSolo } = require('../utils/timezoneColombia');

function fmtMoney(n) {
  return Number(n || 0).toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  });
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function filasTabla(lineas, naturaleza) {
  return (lineas || [])
    .filter((l) => l.naturaleza === naturaleza)
    .map(
      (l) =>
        `<tr><td>${esc(l.concepto)}</td><td class="num">${fmtMoney(l.valor)}</td></tr>`,
    )
    .join('');
}

async function generarReciboHtml(idPeriodo, empleadoId) {
  const periodo = await PeriodoNomina.findOne({ idPeriodo }).lean();
  if (!periodo) return null;
  const liq = await LiquidacionNomina.findOne({ idPeriodo }).lean();
  if (!liq) return null;
  const det = (liq.detalle || []).find((d) => d.empleadoId === Number(empleadoId));
  if (!det) return null;

  const emp = await Empleado.findOne({ idEmpleado: det.empleadoId }).lean();
  const config = await obtenerConfigRecibo();

  const devengos = filasTabla(det.lineas, 'devengo');
  const deducciones = filasTabla(det.lineas, 'deduccion');
  const patronal = (det.lineasPatronales || [])
    .map((l) => `<tr><td>${esc(l.concepto)}</td><td class="num">${fmtMoney(l.valor)}</td></tr>`)
    .join('');
  const provisiones = (det.lineasProvisiones || [])
    .map((l) => `<tr><td>${esc(l.concepto)}</td><td class="num">${fmtMoney(l.valor)}</td></tr>`)
    .join('');

  const adv =
    det.advertencias?.length > 0
      ? `<p class="warn">${det.advertencias.map(esc).join(' · ')}</p>`
      : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<title>Colilla de pago ${esc(periodo.nombre)}</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 24px; color: #111; font-size: 13px; }
  h1 { font-size: 1.2rem; margin: 0 0 4px; }
  .empresa { color: #444; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0 16px; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
  th { background: #f0f4f8; }
  .num { text-align: right; white-space: nowrap; }
  .totals { font-weight: 700; background: #f8fafc; }
  .neto { font-size: 1.15rem; color: #0a5; }
  h2 { font-size: 0.95rem; margin: 16px 0 6px; color: #333; }
  .warn { color: #a60; font-size: 12px; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; }
</style>
</head>
<body>
  <h1>${esc(config.nombreEmpresa || 'ARGO')}</h1>
  <p class="empresa">NIT ${esc(config.nit || '')} · Colilla de pago</p>
  <div class="meta">
    <div><strong>Período:</strong> ${esc(periodo.nombre)}</div>
    <div><strong>Fecha liquidación:</strong> ${fmtFechaSolo(liq.fechaLiquidacion)}</div>
    <div><strong>Empleado:</strong> ${esc(det.empleadoNombre)}</div>
    <div><strong>Documento:</strong> ${esc(det.tipoDocumento)} ${esc(det.numeroDocumento)}</div>
    <div><strong>EPS:</strong> ${esc(det.administradoras?.eps || '—')}</div>
    <div><strong>AFP:</strong> ${esc(det.administradoras?.afp || '—')}</div>
  </div>
  ${adv}
  <h2>Devengos</h2>
  <table><thead><tr><th>Concepto</th><th>Valor</th></tr></thead><tbody>
    ${devengos || '<tr><td colspan="2">—</td></tr>'}
    <tr class="totals"><td>Total devengos</td><td class="num">${fmtMoney(det.totalDevengos)}</td></tr>
  </tbody></table>
  <h2>Deducciones</h2>
  <table><thead><tr><th>Concepto</th><th>Valor</th></tr></thead><tbody>
    ${deducciones || '<tr><td colspan="2">—</td></tr>'}
    <tr class="totals"><td>Total deducciones</td><td class="num">${fmtMoney(det.totalDeducciones)}</td></tr>
  </tbody></table>
  <p class="neto"><strong>Neto a pagar:</strong> ${fmtMoney(det.netoPagar)}</p>
  <p><strong>IBC seguridad social:</strong> ${fmtMoney(det.ibc)}</p>
  <h2>Aportes empleador (informativo PILA)</h2>
  <table><thead><tr><th>Concepto</th><th>Valor</th></tr></thead><tbody>
    ${patronal || '<tr><td colspan="2">—</td></tr>'}
    <tr class="totals"><td>Total aportes patronales</td><td class="num">${fmtMoney(det.totalPatronal)}</td></tr>
  </tbody></table>
  <h2>Provisiones prestaciones (mes)</h2>
  <table><thead><tr><th>Concepto</th><th>Valor</th></tr></thead><tbody>
    ${provisiones || '<tr><td colspan="2">—</td></tr>'}
    <tr class="totals"><td>Total provisiones</td><td class="num">${fmtMoney(det.totalProvisiones)}</td></tr>
  </tbody></table>
  <p><strong>Costo total empresa (mes):</strong> ${fmtMoney(det.totalCostoEmpresa)}</p>
</body>
</html>`;
}

module.exports = { generarReciboHtml };
