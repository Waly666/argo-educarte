const { getConfigSync } = require('./configNomina');

function cfg() {
  return getConfigSync();
}

function redondear(n) {
  return Math.round(Number(n) || 0);
}

function aplicaAuxilio(salario) {
  const c = cfg();
  const tope = c.smlmv * c.multiploSalarioAuxilio;
  return salario > 0 && salario <= tope;
}

function pctArl(nivelRiesgo) {
  const c = cfg();
  const n = Number(nivelRiesgo) || c.arlRiesgoDefault;
  return c.arlRiesgoPct[n] ?? c.arlRiesgoPct[c.arlRiesgoDefault];
}

function calcularFsp(salario) {
  const c = cfg();
  if (salario < c.smlmv * 4) return 0;
  const sm = salario / c.smlmv;
  for (const t of c.fspTramos) {
    if (sm >= t.desdeSmmlv && sm < t.hastaSmmlv) {
      return redondear(salario * t.pct);
    }
  }
  return 0;
}

/** Retención en la fuente — tabla mensual por tramos (configurable). */
function calcularRetencionFuente(salario, saludEmp, pensionEmp) {
  const c = cfg();
  const base = Math.max(0, salario - saludEmp - pensionEmp);
  if (base <= c.smlmv * c.retencionUmbralExentoSmmlv) return 0;

  const u = base / c.uvt;
  const tramos = (c.retencionTramos || [])
    .slice()
    .sort((a, b) => {
      const ha = a.hastaUvt === Infinity ? 1e15 : a.hastaUvt;
      const hb = b.hastaUvt === Infinity ? 1e15 : b.hastaUvt;
      return ha - hb;
    });

  let prevHasta = 0;
  for (const t of tramos) {
    const lim = t.hastaUvt === Infinity ? 1e15 : t.hastaUvt;
    if (u <= lim) {
      if (!t.pct || t.pct <= 0) return 0;
      const exceso = base - prevHasta * c.uvt;
      return redondear((t.baseUvt || 0) * c.uvt + exceso * t.pct);
    }
    prevHasta = lim >= 1e14 ? prevHasta : lim;
  }
  return 0;
}

function ibcDesdeNovedades(novedades, salarioFallback) {
  const c = cfg();
  let ibc = 0;
  for (const n of novedades) {
    const cod = String(n.codigoConcepto || n.tipoNovedad || '').toUpperCase();
    if (c.codigosExcluidosIbc.some((x) => cod.includes(x))) continue;
    if (n.naturaleza === 'devengo' || (!n.naturaleza && Number(n.valor) > 0)) {
      ibc += Math.abs(redondear(Number(n.valor) || 0));
    }
  }
  return ibc > 0 ? ibc : salarioFallback;
}

function calcularAportesPatronales({ ibc, nivelRiesgoArl }) {
  const c = cfg();
  const ibcR = redondear(ibc);
  const salud = redondear(ibcR * c.saludEmpleadorPct);
  const pension = redondear(ibcR * c.pensionEmpleadorPct);
  const arl = redondear(ibcR * pctArl(nivelRiesgoArl));
  const sena = redondear(ibcR * c.senaPct);
  const icbf = redondear(ibcR * c.icbfPct);
  const ccf = redondear(ibcR * c.ccfPct);
  const pct = (p) => `${(p * 100).toFixed(2).replace(/\.?0+$/, '')}%`;
  const lineas = [
    {
      codigoConcepto: 'SALUD_EMPLEADOR',
      concepto: `Salud empleador ${pct(c.saludEmpleadorPct)}`,
      naturaleza: 'patronal',
      valor: salud,
    },
    {
      codigoConcepto: 'PENSION_EMPLEADOR',
      concepto: `Pensión empleador ${pct(c.pensionEmpleadorPct)}`,
      naturaleza: 'patronal',
      valor: pension,
    },
    {
      codigoConcepto: 'ARL',
      concepto: `ARL riesgo ${nivelRiesgoArl || c.arlRiesgoDefault}`,
      naturaleza: 'patronal',
      valor: arl,
    },
    { codigoConcepto: 'SENA', concepto: `SENA ${pct(c.senaPct)}`, naturaleza: 'patronal', valor: sena },
    { codigoConcepto: 'ICBF', concepto: `ICBF ${pct(c.icbfPct)}`, naturaleza: 'patronal', valor: icbf },
    {
      codigoConcepto: 'CCF',
      concepto: `Caja compensación ${pct(c.ccfPct)}`,
      naturaleza: 'patronal',
      valor: ccf,
    },
  ];
  const total = salud + pension + arl + sena + icbf + ccf;
  return { lineas, total, ibc: ibcR, desglose: { salud, pension, arl, sena, icbf, ccf } };
}

function calcularProvisiones(salarioBase) {
  const c = cfg();
  const base = redondear(salarioBase);
  const cesantias = redondear(base * c.provisionCesantiasPct);
  const prima = redondear(base * c.provisionPrimaPct);
  const vacaciones = redondear(base * c.provisionVacacionesPct);
  const intCesantias = redondear(base * c.provisionIntCesantiasPct);
  const lineas = [
    { codigoConcepto: 'PROV_CESANTIAS', concepto: 'Provisión cesantías', naturaleza: 'provision', valor: cesantias },
    { codigoConcepto: 'PROV_PRIMA', concepto: 'Provisión prima', naturaleza: 'provision', valor: prima },
    { codigoConcepto: 'PROV_VACACIONES', concepto: 'Provisión vacaciones', naturaleza: 'provision', valor: vacaciones },
    {
      codigoConcepto: 'PROV_INT_CESANTIAS',
      concepto: 'Provisión intereses cesantías',
      naturaleza: 'provision',
      valor: intCesantias,
    },
  ];
  return { lineas, total: cesantias + prima + vacaciones + intCesantias };
}

module.exports = {
  cfg,
  redondear,
  aplicaAuxilio,
  pctArl,
  calcularFsp,
  calcularRetencionFuente,
  ibcDesdeNovedades,
  calcularAportesPatronales,
  calcularProvisiones,
};
