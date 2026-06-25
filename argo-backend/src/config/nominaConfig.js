/** Valores por defecto (fallback). La vigencia activa se guarda en Config (clave nomina). */
module.exports = {
  vigenciaAno: 2025,
  vigenciaLabel: '2025 — referencia legal',
  /** Salario mínimo mensual legal vigente */
  smlmv: 1423500,
  uvt: 49799,
  auxilioTransporteMensual: 200000,

  /** Aportes empleado (deducción nómina) */
  saludEmpleadoPct: 0.04,
  pensionEmpleadoPct: 0.04,

  /** Aportes empleador (PILA / costo empresa) */
  saludEmpleadorPct: 0.085,
  pensionEmpleadorPct: 0.12,
  senaPct: 0.02,
  icbfPct: 0.03,
  ccfPct: 0.04,

  /** ARL por clase de riesgo (1-5) */
  arlRiesgoPct: {
    1: 0.00522,
    2: 0.01044,
    3: 0.02436,
    4: 0.0435,
    5: 0.0696,
  },
  arlRiesgoDefault: 1,

  /** Auxilio transporte: aplica si salario <= 2 SMLMV */
  multiploSalarioAuxilio: 2,

  /** Fondo solidaridad pensional — % sobre salario según múltiplos SMLMV */
  fspTramos: [
    { desdeSmmlv: 4, hastaSmmlv: 16, pct: 0.01 },
    { desdeSmmlv: 16, hastaSmmlv: 17, pct: 0.012 },
    { desdeSmmlv: 17, hastaSmmlv: 18, pct: 0.014 },
    { desdeSmmlv: 18, hastaSmmlv: 19, pct: 0.016 },
    { desdeSmmlv: 19, hastaSmmlv: 20, pct: 0.018 },
    { desdeSmmlv: 20, hastaSmmlv: Infinity, pct: 0.02 },
  ],

  /** Provisiones mensuales (acumulan prestaciones) */
  provisionCesantiasPct: 1 / 12,
  provisionPrimaPct: 1 / 12,
  provisionVacacionesPct: 15 / 360,
  provisionIntCesantiasPct: 0.01,

  /** Retención en la fuente — tabla mensual simplificada (base en UVT tras deducir salud/pensión) */
  retencionTramos: [
    { hastaUvt: 95, baseUvt: 0, pct: 0 },
    { hastaUvt: 150, baseUvt: 0, pct: 0.19 },
    { hastaUvt: 360, baseUvt: 10.37, pct: 0.28 },
    { hastaUvt: 640, baseUvt: 69.2, pct: 0.33 },
    { hastaUvt: 945, baseUvt: 162.2, pct: 0.35 },
    { hastaUvt: Infinity, baseUvt: 268.8, pct: 0.37 },
  ],
  retencionUmbralExentoSmmlv: 2,

  tiposDevengo: ['HORAS_EXTRA', 'BONIFICACION', 'COMISION', 'PRIMA', 'VACACIONES', 'OTRO_DEVENGO'],
  tiposDeduccion: [
    'EMBARGO',
    'PRESTAMO',
    'LIBRANZA',
    'RETENCION_FUENTE',
    'FSP',
    'DESCUADRE_CAJA',
    'OTRO_DEDUCCION',
  ],

  /** Conceptos que no hacen base para seguridad social (parafiscales) */
  codigosExcluidosIbc: ['AUX_TRANSPORTE'],

  /** Novedades PILA (planilla integrada) — novedades manuales en nómina */
  codigosPila: [
    { codigo: 'IGE', label: 'Incapacidad general (IGE)', requiereFechas: true },
    { codigo: 'LMA', label: 'Licencia maternidad/paternidad (LMA)', requiereFechas: true },
    { codigo: 'SLN', label: 'Suspensión / licencia no remunerada (SLN)', requiereFechas: true },
    { codigo: 'VAC_LR', label: 'Vacaciones (X) o licencia remunerada (L)', requiereFechas: true },
    { codigo: 'IRL', label: 'Incapacidad riesgo laboral (IRL)', requiereFechas: true },
  ],
};
