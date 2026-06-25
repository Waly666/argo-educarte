const LiquidacionNomina = require('../models/LiquidacionNomina');
const PeriodoNomina = require('../models/PeriodoNomina');

function escCsv(v) {
  const s = String(v ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Planilla PILA simplificada (CSV) — una fila por empleado.
 * Usa códigos ministerio de EPS/AFP/ARL/CCF del empleado.
 */
async function exportarPilaCsv(idPeriodo) {
  const periodo = await PeriodoNomina.findOne({ idPeriodo }).lean();
  if (!periodo) throw Object.assign(new Error('Período no encontrado'), { status: 404 });
  const liq = await LiquidacionNomina.findOne({ idPeriodo }).lean();
  if (!liq?.detalle?.length) {
    throw Object.assign(new Error('No hay liquidación. Liquide el período primero.'), { status: 400 });
  }

  const headers = [
    'periodo',
    'tipoDoc',
    'numeroDocumento',
    'nombre',
    'codigoEPS',
    'codigoAFP',
    'codigoARL',
    'codigoCCF',
    'diasCotizacion',
    'diasSalario',
    'novedadIng',
    'novedadRet',
    'novedadIGE',
    'novedadLMA',
    'novedadSLN',
    'novedadVAC_LR',
    'ibc',
    'salario',
    'saludEmpleado',
    'pensionEmpleado',
    'fsp',
    'retencionFuente',
    'saludEmpleador',
    'pensionEmpleador',
    'arl',
    'sena',
    'icbf',
    'ccf',
    'netoPagar',
    'totalPatronal',
    'totalProvisiones',
  ];

  const filas = [headers.join(',')];
  for (const d of liq.detalle) {
    const p = d.pila || {};
    const salario = (d.lineas || []).find((l) => l.codigoConcepto === 'SALARIO_BASE')?.valor || 0;
    filas.push(
      [
        periodo.nombre,
        d.tipoDocumento || 'CC',
        d.numeroDocumento,
        d.empleadoNombre,
        p.codigoEps,
        p.codigoAfp,
        p.codigoArl,
        p.codigoCcf,
        p.diasCotizacion ?? p.dias ?? 30,
        (p.pilaContext && p.pilaContext.diasSalarioPagar) || '',
        p.novedadIng || '',
        p.novedadRet || '',
        p.novedadIGE || '',
        p.novedadLMA || '',
        p.novedadSLN || '',
        p.novedadVAC_LR || '',
        p.ibc ?? d.ibc,
        salario,
        p.saludEmpleado,
        p.pensionEmpleado,
        p.fsp,
        p.retencion,
        p.salud,
        p.pension,
        p.arl,
        p.sena,
        p.icbf,
        p.ccf,
        d.netoPagar,
        d.totalPatronal,
        d.totalProvisiones,
      ]
        .map(escCsv)
        .join(','),
    );
  }

  return {
    filename: `PILA_${periodo.nombre || idPeriodo}.csv`,
    content: `\uFEFF${filas.join('\r\n')}`,
    periodo: periodo.nombre,
    empleados: liq.detalle.length,
  };
}

module.exports = { exportarPilaCsv };
