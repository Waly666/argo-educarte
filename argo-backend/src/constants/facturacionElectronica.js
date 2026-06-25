/** Proveedor de facturación electrónica. */
const PROVEEDOR_STUB = 'stub';
const PROVEEDOR_FACTUS = 'factus';
const PROVEEDORES_FE = [PROVEEDOR_STUB, PROVEEDOR_FACTUS];

/** Ambiente API del proveedor. */
const AMBIENTE_SANDBOX = 'sandbox';
const AMBIENTE_PRODUCCION = 'produccion';
const AMBIENTES_FE = [AMBIENTE_SANDBOX, AMBIENTE_PRODUCCION];

/** Cuándo ARGO propone emitir factura electrónica. */
const MODO_EMISION_MANUAL = 'manual';
const MODO_EMISION_AL_PAGAR_TOTAL = 'al_pagar_total';
const MODO_EMISION_AL_MATRICULAR = 'al_matricular';
const MODOS_EMISION = [MODO_EMISION_MANUAL, MODO_EMISION_AL_PAGAR_TOTAL, MODO_EMISION_AL_MATRICULAR];

/** Estados locales del documento (antes y después del envío DIAN). */
const ESTADO_BORRADOR = 'borrador';
const ESTADO_PENDIENTE_ENVIO = 'pendiente_envio';
const ESTADO_VALIDADA = 'validada';
const ESTADO_RECHAZADA = 'rechazada';
const ESTADO_ANULADA = 'anulada';
const ESTADOS_FE = [
  ESTADO_BORRADOR,
  ESTADO_PENDIENTE_ENVIO,
  ESTADO_VALIDADA,
  ESTADO_RECHAZADA,
  ESTADO_ANULADA,
];

const PROVEEDOR_LABELS = {
  [PROVEEDOR_STUB]: 'Desarrollo (sin envío DIAN)',
  [PROVEEDOR_FACTUS]: 'Factus API',
};

const MODO_EMISION_LABELS = {
  [MODO_EMISION_MANUAL]: 'Manual desde módulo Facturación',
  [MODO_EMISION_AL_PAGAR_TOTAL]: 'Automático al pagar liquidación (futuro)',
  [MODO_EMISION_AL_MATRICULAR]: 'Automático al matricular (futuro)',
};

/** Condición de IVA por servicio. */
const IVA_GRAVADO = 'gravado';
const IVA_EXENTO = 'exento';
const IVA_EXCLUIDO = 'excluido';
const CONDICIONES_IVA = [IVA_GRAVADO, IVA_EXENTO, IVA_EXCLUIDO];
const CONDICION_IVA_LABELS = {
  [IVA_GRAVADO]: 'Gravado (cobra IVA)',
  [IVA_EXENTO]: 'Exento (tarifa 0%)',
  [IVA_EXCLUIDO]: 'Excluido (sin IVA)',
};

/** Adquirente de la factura. */
const ADQUIRENTE_ALUMNO = 'alumno';
const ADQUIRENTE_CLIENTE = 'cliente';

/** Forma de pago DIAN. */
const FORMA_PAGO_CONTADO = '1';
const FORMA_PAGO_CREDITO = '2';

/** Conceptos de corrección para nota crédito (DIAN). */
const NC_DEVOLUCION_PARCIAL = '1';
const NC_ANULACION = '2';
const NC_REBAJA = '3';
const NC_AJUSTE_PRECIO = '4';
const NC_OTROS = '5';
const CONCEPTOS_NOTA_CREDITO = [
  NC_DEVOLUCION_PARCIAL,
  NC_ANULACION,
  NC_REBAJA,
  NC_AJUSTE_PRECIO,
  NC_OTROS,
];
const CONCEPTO_NOTA_CREDITO_LABELS = {
  [NC_DEVOLUCION_PARCIAL]: 'Devolución parcial de bienes / no aceptación parcial del servicio',
  [NC_ANULACION]: 'Anulación de la factura',
  [NC_REBAJA]: 'Rebaja o descuento',
  [NC_AJUSTE_PRECIO]: 'Ajuste de precio',
  [NC_OTROS]: 'Otros',
};
const NOTA_CREDITO_TOTAL = 'total';
const NOTA_CREDITO_PARCIAL = 'parcial';

module.exports = {
  PROVEEDOR_STUB,
  PROVEEDOR_FACTUS,
  PROVEEDORES_FE,
  AMBIENTE_SANDBOX,
  AMBIENTE_PRODUCCION,
  AMBIENTES_FE,
  MODO_EMISION_MANUAL,
  MODO_EMISION_AL_PAGAR_TOTAL,
  MODO_EMISION_AL_MATRICULAR,
  MODOS_EMISION,
  ESTADO_BORRADOR,
  ESTADO_PENDIENTE_ENVIO,
  ESTADO_VALIDADA,
  ESTADO_RECHAZADA,
  ESTADO_ANULADA,
  ESTADOS_FE,
  PROVEEDOR_LABELS,
  MODO_EMISION_LABELS,
  IVA_GRAVADO,
  IVA_EXENTO,
  IVA_EXCLUIDO,
  CONDICIONES_IVA,
  CONDICION_IVA_LABELS,
  ADQUIRENTE_ALUMNO,
  ADQUIRENTE_CLIENTE,
  FORMA_PAGO_CONTADO,
  FORMA_PAGO_CREDITO,
  NC_DEVOLUCION_PARCIAL,
  NC_ANULACION,
  NC_REBAJA,
  NC_AJUSTE_PRECIO,
  NC_OTROS,
  CONCEPTOS_NOTA_CREDITO,
  CONCEPTO_NOTA_CREDITO_LABELS,
  NOTA_CREDITO_TOTAL,
  NOTA_CREDITO_PARCIAL,
};
