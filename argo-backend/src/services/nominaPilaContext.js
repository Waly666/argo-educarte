const { redondear } = require('./nominaLegal');
const { normalizarEmpleadoLegacy } = require('../utils/empleadoDoc');
const { esPeriodoFuturo } = require('./nominaPeriodo');

const DIAS_MES = 30;

function toDateOnly(d) {
  if (!d) return null;
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return null;
  return new Date(x.getFullYear(), x.getMonth(), x.getDate());
}

function daysInclusive(a, b) {
  const da = toDateOnly(a);
  const db = toDateOnly(b);
  if (!da || !db || db < da) return 0;
  return Math.floor((db - da) / 86400000) + 1;
}

function overlapDays(periodoStart, periodoEnd, eventStart, eventEnd) {
  const ps = toDateOnly(periodoStart);
  const pe = toDateOnly(periodoEnd);
  const es = toDateOnly(eventStart);
  const ee = toDateOnly(eventEnd || eventEnd);
  if (!ps || !pe || !es) return 0;
  const end = ee && ee >= es ? ee : pe;
  const from = es > ps ? es : ps;
  const to = end < pe ? end : pe;
  if (to < from) return 0;
  return daysInclusive(from, to);
}

function mapTipoDoc(tipo) {
  const t = String(tipo || 'CC').toUpperCase();
  if (t === 'CE') return 'CE';
  if (t === 'TI') return 'TI';
  if (t === 'PA' || t === 'PAS') return 'PA';
  return 'CC';
}

/** Novedades manuales con codigoPila / tipoNovedad */
function parseNovedadesPilaManuales(novedades) {
  const out = {
    IGE: { dias: 0, fechaInicio: null, fechaFin: null },
    LMA: { dias: 0, fechaInicio: null, fechaFin: null },
    SLN: { dias: 0, fechaInicio: null, fechaFin: null },
    VAC_LR: { dias: 0, vacaciones: false, licenciaRem: false, fechaInicio: null, fechaFin: null },
    IRL: { dias: 0 },
  };
  for (const n of novedades || []) {
    if (n.autoGenerada) continue;
    const cod = String(n.codigoPila || n.codigoConcepto || n.tipoNovedad || '').toUpperCase();
    const dias = Number(n.diasNovedad) || 0;
    const fi = n.fechaInicioNovedad || n.fechaInicio;
    const ff = n.fechaFinNovedad || n.fechaFin || n.fecha;
    if (cod === 'IGE' || cod.includes('INCAPAC')) {
      out.IGE.dias += dias || overlapDaysFromNovedad(n);
      if (fi) out.IGE.fechaInicio = out.IGE.fechaInicio || fi;
      if (ff) out.IGE.fechaFin = ff;
    } else if (cod === 'LMA' || cod.includes('MATERN')) {
      out.LMA.dias += dias || overlapDaysFromNovedad(n);
      if (fi) out.LMA.fechaInicio = out.LMA.fechaInicio || fi;
      if (ff) out.LMA.fechaFin = ff;
    } else if (cod === 'SLN' || cod.includes('SUSPENSION')) {
      out.SLN.dias += dias || overlapDaysFromNovedad(n);
      if (fi) out.SLN.fechaInicio = out.SLN.fechaInicio || fi;
      if (ff) out.SLN.fechaFin = ff;
    } else if (cod === 'VAC_LR' || cod === 'VAC' || cod.includes('VACAC') || cod.includes('LICENCIA_REM')) {
      const sub = String(n.subtipoVacLic || '').toUpperCase();
      if (sub === 'L' || cod.includes('LICENCIA')) out.VAC_LR.licenciaRem = true;
      else out.VAC_LR.vacaciones = true;
      out.VAC_LR.dias += dias || overlapDaysFromNovedad(n);
      if (fi) out.VAC_LR.fechaInicio = out.VAC_LR.fechaInicio || fi;
      if (ff) out.VAC_LR.fechaFin = ff;
    } else if (cod === 'IRL') {
      out.IRL.dias += dias || overlapDaysFromNovedad(n);
    }
  }
  return out;
}

function overlapDaysFromNovedad(n) {
  if (n.fechaInicioNovedad && n.fechaFinNovedad) {
    return daysInclusive(n.fechaInicioNovedad, n.fechaFinNovedad);
  }
  return 0;
}

/**
 * Contexto PILA + nómina por empleado en el período.
 */
function buildPilaContext(emp, contrato, periodo, novedadesManuales = []) {
  const e = normalizarEmpleadoLegacy(emp);
  const ps = periodo.fechaInicio;
  const pe = periodo.fechaFin;
  const salarioMes = Math.max(0, Number(contrato?.salario ? contrato.salario : e.salario) || 0);

  if (esPeriodoFuturo(periodo)) {
    return {
      tipoDocumento: mapTipoDoc(e.tipoDocumento),
      numeroDocumento: String(e.numeroDocumento || '').replace(/\D/g, '') || String(e.numeroDocumento || ''),
      diasMes: DIAS_MES,
      diasEnPeriodo: 0,
      diasCotizacion: 0,
      diasCotPension: 0,
      diasCotSalud: 0,
      diasCotArl: 0,
      diasCotCcf: 0,
      diasSalarioPagar: 0,
      salarioMes,
      salarioProporcional: 0,
      ibc: 0,
      factorSalario: 0,
      factorIbc: 0,
      novedadIng: '',
      novedadRet: '',
      fechaIng: null,
      fechaRet: null,
      novedadIGE: '',
      novedadLMA: '',
      novedadSLN: '',
      novedadVAC_LR: '',
      fechaInicioIGE: null,
      fechaFinIGE: null,
      fechaInicioLMA: null,
      fechaFinLMA: null,
      fechaInicioSLN: null,
      fechaFinSLN: null,
      fechaInicioVAC: null,
      fechaFinVAC: null,
      manual: parseNovedadesPilaManuales(novedadesManuales),
      periodoFuturo: true,
    };
  }

  const fi = contrato?.fechaInicio || e.fechaIngreso;
  const fr = contrato?.fechaFin || e.fechaRetiro;

  let novedadIng = '';
  let novedadRet = '';
  let fechaIng = null;
  let fechaRet = null;

  let diasEnPeriodo = DIAS_MES;
  if (fi) {
    const dfi = toDateOnly(fi);
    const dps = toDateOnly(ps);
    const dpe = toDateOnly(pe);
    if (dfi >= dps && dfi <= dpe) {
      novedadIng = 'X';
      fechaIng = fi;
      diasEnPeriodo = daysInclusive(dfi, pe);
    } else if (dfi > dpe) {
      diasEnPeriodo = 0;
    }
  }
  if (fr) {
    const dfr = toDateOnly(fr);
    const dps = toDateOnly(ps);
    const dpe = toDateOnly(pe);
    if (dfr >= dps && dfr <= dpe) {
      novedadRet = 'X';
      fechaRet = fr;
      const hastaRet = daysInclusive(dps, dfr);
      diasEnPeriodo = Math.min(diasEnPeriodo, hastaRet);
    }
  }

  const manual = parseNovedadesPilaManuales(novedadesManuales);

  const diasSLN = Math.min(DIAS_MES, manual.SLN.dias || 0);
  const diasIGE = Math.min(DIAS_MES, manual.IGE.dias || 0);
  const diasLMA = Math.min(DIAS_MES, manual.LMA.dias || 0);
  const diasVAC = Math.min(DIAS_MES, manual.VAC_LR.dias || 0);

  const diasCotizacion = Math.max(0, Math.min(DIAS_MES, diasEnPeriodo - diasSLN));

  const diasSalarioPagar = Math.max(
    0,
    diasEnPeriodo - diasIGE - diasSLN,
  );

  const factorSalario = diasSalarioPagar / DIAS_MES;
  const factorIbc = diasCotizacion / DIAS_MES;
  const salarioProporcional = redondear(salarioMes * factorSalario);
  const ibc = redondear(salarioMes * factorIbc);

  const vacFlag =
    manual.VAC_LR.vacaciones && manual.VAC_LR.dias > 0
      ? 'X'
      : manual.VAC_LR.licenciaRem && manual.VAC_LR.dias > 0
        ? 'L'
        : '';

  return {
    tipoDocumento: mapTipoDoc(e.tipoDocumento),
    numeroDocumento: String(e.numeroDocumento || '').replace(/\D/g, '') || String(e.numeroDocumento || ''),
    diasMes: DIAS_MES,
    diasEnPeriodo,
    diasCotizacion,
    diasCotPension: diasCotizacion,
    diasCotSalud: diasCotizacion,
    diasCotArl: diasSLN > 0 && diasCotizacion === 0 ? 0 : diasCotizacion,
    diasCotCcf: diasSLN > 0 ? 0 : diasCotizacion,
    diasSalarioPagar,
    salarioMes,
    salarioProporcional,
    ibc,
    factorSalario,
    factorIbc,
    novedadIng,
    novedadRet,
    fechaIng,
    fechaRet,
    novedadIGE: diasIGE > 0 ? 'X' : '',
    novedadLMA: diasLMA > 0 ? 'X' : '',
    novedadSLN: diasSLN > 0 ? 'X' : '',
    novedadVAC_LR: vacFlag,
    fechaInicioIGE: manual.IGE.fechaInicio,
    fechaFinIGE: manual.IGE.fechaFin,
    fechaInicioLMA: manual.LMA.fechaInicio,
    fechaFinLMA: manual.LMA.fechaFin,
    fechaInicioSLN: manual.SLN.fechaInicio,
    fechaFinSLN: manual.SLN.fechaFin,
    fechaInicioVAC: manual.VAC_LR.fechaInicio,
    fechaFinVAC: manual.VAC_LR.fechaFin,
    manual,
  };
}

function fmtPilaDate(d) {
  if (!d) return '';
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

module.exports = {
  DIAS_MES,
  buildPilaContext,
  parseNovedadesPilaManuales,
  fmtPilaDate,
  mapTipoDoc,
};
