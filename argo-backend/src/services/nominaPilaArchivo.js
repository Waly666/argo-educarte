const LiquidacionNomina = require('../models/LiquidacionNomina');
const PeriodoNomina = require('../models/PeriodoNomina');
const Config = require('../models/Config');
const { getConfigSync } = require('./configNomina');
const { pctArl } = require('./nominaLegal');
const { fmtPilaDate } = require('./nominaPilaContext');

const LEN_TIPO1 = 359;
const LEN_TIPO2 = 676;
const CLAVE_CONFIG = 'recibo';

function blankLine(len) {
  return ' '.repeat(len);
}

function setField(line, start, end, value, type = 'A') {
  const len = end - start + 1;
  let s = String(value ?? '');
  if (type === 'N') {
    s = s.replace(/\D/g, '');
    if (s.length > len) s = s.slice(-len);
    s = s.padStart(len, '0');
  } else {
    if (s.length > len) s = s.slice(0, len);
    s = s.padEnd(len, ' ');
  }
  return line.slice(0, start - 1) + s + line.slice(end);
}

function numPila(n) {
  return String(Math.max(0, Math.round(Number(n) || 0)));
}

function tarifaPila(pct) {
  const v = Math.round(pct * 10000);
  return String(v).padStart(7, '0');
}

function periodoYm(periodo) {
  const y = periodo.ano || new Date(periodo.fechaInicio).getFullYear();
  const m = periodo.mes || new Date(periodo.fechaInicio).getMonth() + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
}

async function cargarEmpresa() {
  const doc = await Config.findOne({ clave: CLAVE_CONFIG }).lean();
  return {
    nombre: doc?.nombreEmpresa || 'ARGO',
    nit: String(doc?.nit || '').replace(/\D/g, ''),
    tipoDoc: 'NI',
  };
}

function buildRegistroTipo1({ empresa, periodo, totalEmpleados, totalIbc }) {
  let line = blankLine(LEN_TIPO1);
  const ym = periodoYm(periodo);
  line = setField(line, 1, 2, '01', 'N');
  line = setField(line, 3, 3, '1', 'N');
  line = setField(line, 4, 7, '0001', 'N');
  line = setField(line, 8, 207, empresa.nombre);
  line = setField(line, 208, 209, empresa.tipoDoc || 'NI');
  line = setField(line, 210, 225, empresa.nit);
  line = setField(line, 226, 226, ' ', 'A');
  line = setField(line, 227, 227, 'E');
  line = setField(line, 305, 311, ym);
  line = setField(line, 312, 318, ym);
  line = setField(line, 339, 343, totalEmpleados, 'N');
  line = setField(line, 344, 355, totalIbc, 'N');
  return line;
}

function splitNombre(empleadoNombre) {
  const parts = String(empleadoNombre || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return { ap1: '', ap2: '', n1: '', n2: '' };
  if (parts.length === 1) return { ap1: parts[0], ap2: '', n1: parts[0], n2: '' };
  if (parts.length === 2) return { ap1: parts[0], ap2: '', n1: parts[1], n2: '' };
  if (parts.length === 3) return { ap1: parts[0], ap2: '', n1: parts[1], n2: parts[2] };
  return {
    ap1: parts[0],
    ap2: parts.slice(1, -2).join(' '),
    n1: parts[parts.length - 2],
    n2: parts[parts.length - 1],
  };
}

function buildRegistroTipo2(det, ctx, seq) {
  const cfg = getConfigSync();
  const p = det.pila || {};
  const px = p.pilaContext || ctx || {};
  const ibc = numPila(p.ibc ?? det.ibc ?? px.ibc);
  const salario = numPila(px.salarioProporcional ?? px.salarioMes);
  const nom = splitNombre(det.empleadoNombre);

  const saludEmp = numPila(p.saludEmpleado);
  const pensionEmp = numPila(p.pensionEmpleado);
  const fsp = numPila(p.fsp);
  const saludPat = numPila(p.salud);
  const pensionPat = numPila(p.pension);
  const arlVal = numPila(p.arl);
  const ccfVal = numPila(p.ccf);
  const senaVal = numPila(p.sena);
  const icbfVal = numPila(p.icbf);

  const tarPension = tarifaPila(cfg.pensionEmpleadorPct + cfg.pensionEmpleadoPct);
  const tarSalud = tarifaPila(cfg.saludEmpleadorPct + cfg.saludEmpleadoPct);
  const tarArl = tarifaPila(pctArl(p.arlNivel));
  const tarCcf = tarifaPila(cfg.ccfPct);

  let line = blankLine(LEN_TIPO2);
  line = setField(line, 1, 2, '02', 'N');
  line = setField(line, 3, 7, seq, 'N');
  line = setField(line, 8, 9, det.tipoDocumento || 'CC');
  line = setField(line, 10, 25, det.numeroDocumento);
  line = setField(line, 26, 27, '01', 'N');
  line = setField(line, 28, 29, '00', 'N');
  line = setField(line, 37, 56, nom.ap1);
  line = setField(line, 57, 86, nom.ap2);
  line = setField(line, 87, 106, nom.n1);
  line = setField(line, 107, 136, nom.n2);

  line = setField(line, 137, 137, px.novedadIng || '');
  line = setField(line, 138, 138, px.novedadRet || '');
  line = setField(line, 146, 146, px.novedadSLN || '');
  line = setField(line, 147, 147, px.novedadIGE || '');
  line = setField(line, 148, 148, px.novedadLMA || '');
  line = setField(line, 149, 149, px.novedadVAC_LR || '');

  line = setField(line, 154, 159, p.codigoAfp || '');
  line = setField(line, 166, 171, p.codigoEps || '');
  line = setField(line, 178, 183, p.codigoCcf || '');

  const dPen = String(px.diasCotPension ?? px.diasCotizacion ?? 30).padStart(2, '0');
  const dSal = String(px.diasCotSalud ?? px.diasCotizacion ?? 30).padStart(2, '0');
  const dArl = String(px.diasCotArl ?? px.diasCotizacion ?? 30).padStart(2, '0');
  const dCcf = String(px.diasCotCcf ?? px.diasCotizacion ?? 30).padStart(2, '0');
  line = setField(line, 184, 185, dPen, 'N');
  line = setField(line, 186, 187, dSal, 'N');
  line = setField(line, 188, 189, dArl, 'N');
  line = setField(line, 190, 191, dCcf, 'N');

  line = setField(line, 192, 200, salario, 'N');
  line = setField(line, 202, 210, ibc, 'N');
  line = setField(line, 211, 219, ibc, 'N');
  line = setField(line, 220, 228, ibc, 'N');
  line = setField(line, 229, 237, ibc, 'N');

  line = setField(line, 238, 244, tarPension, 'N');
  line = setField(line, 245, 253, pensionPat, 'N');
  line = setField(line, 281, 289, fsp, 'N');
  line = setField(line, 308, 314, tarSalud, 'N');
  line = setField(line, 315, 323, saludPat, 'N');
  line = setField(line, 381, 389, tarArl, 'N');
  line = setField(line, 399, 407, arlVal, 'N');
  line = setField(line, 507, 512, p.codigoArl || '');
  line = setField(line, 513, 513, String(p.arlNivel || cfg.arlRiesgoDefault), 'N');

  line = setField(line, 515, 524, fmtPilaDate(px.fechaIng));
  line = setField(line, 525, 534, fmtPilaDate(px.fechaRet));
  line = setField(line, 545, 554, fmtPilaDate(px.fechaInicioSLN));
  line = setField(line, 555, 564, fmtPilaDate(px.fechaFinSLN));
  line = setField(line, 565, 574, fmtPilaDate(px.fechaInicioIGE));
  line = setField(line, 575, 584, fmtPilaDate(px.fechaFinIGE));
  line = setField(line, 585, 594, fmtPilaDate(px.fechaInicioLMA));
  line = setField(line, 595, 604, fmtPilaDate(px.fechaFinLMA));
  line = setField(line, 605, 614, fmtPilaDate(px.fechaInicioVAC));
  line = setField(line, 615, 624, fmtPilaDate(px.fechaFinVAC));

  line = setField(line, 408, 414, tarCcf, 'N');
  line = setField(line, 415, 423, ccfVal, 'N');
  line = setField(line, 424, 430, tarifaPila(cfg.senaPct), 'N');
  line = setField(line, 431, 439, senaVal, 'N');
  line = setField(line, 440, 446, tarifaPila(cfg.icbfPct), 'N');
  line = setField(line, 447, 455, icbfVal, 'N');
  line = setField(line, 506, 506, 'N');

  return line;
}

/**
 * Archivo planilla integrada (Res. 2388/2016): registro tipo 1 + tipo 2 por cotizante.
 */
async function exportarPilaTxt(idPeriodo) {
  const periodo = await PeriodoNomina.findOne({ idPeriodo }).lean();
  if (!periodo) throw Object.assign(new Error('Período no encontrado'), { status: 404 });
  const liq = await LiquidacionNomina.findOne({ idPeriodo }).lean();
  if (!liq?.detalle?.length) {
    throw Object.assign(new Error('No hay liquidación. Liquide el período primero.'), { status: 400 });
  }

  const empresa = await cargarEmpresa();
  if (!empresa.nit) {
    throw Object.assign(
      new Error(
        'Configure el NIT y nombre de la empresa en Configuración → Empresa y comprobantes antes de exportar PILA.',
      ),
      { status: 400 },
    );
  }

  const lineas = [];
  let totalIbc = 0;
  let seq = 1;
  for (const d of liq.detalle) {
    totalIbc += Number(d.ibc || d.pila?.ibc || 0);
    lineas.push(buildRegistroTipo2(d, d.pila?.pilaContext, seq));
    seq += 1;
  }

  const header = buildRegistroTipo1({
    empresa,
    periodo,
    totalEmpleados: liq.detalle.length,
    totalIbc: numPila(totalIbc),
  });

  const content = [header, ...lineas].join('\r\n');
  const ym = periodoYm(periodo).replace('-', '');

  return {
    filename: `PILA_${ym}_tipo2.txt`,
    content,
    periodo: periodo.nombre,
    empleados: liq.detalle.length,
    advertencia:
      'Archivo según estructura Res. 2388/2016 (registros 01 y 02). Valide en el operador PILA antes del pago; campos de radicación y pago los asigna el operador.',
  };
}

module.exports = { exportarPilaTxt, buildRegistroTipo1, buildRegistroTipo2, LEN_TIPO2 };
