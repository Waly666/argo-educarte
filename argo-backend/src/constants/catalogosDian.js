/** Catálogos DIAN/Factus de referencia para facturación electrónica. */

const TIPOS_IDENTIFICACION = [
  { code: '11', label: 'Registro civil' },
  { code: '12', label: 'Tarjeta de identidad' },
  { code: '13', label: 'Cédula de ciudadanía' },
  { code: '21', label: 'Tarjeta de extranjería' },
  { code: '22', label: 'Cédula de extranjería' },
  { code: '31', label: 'NIT' },
  { code: '41', label: 'Pasaporte' },
  { code: '42', label: 'Documento de identificación extranjero' },
  { code: '50', label: 'NIT de otro país' },
  { code: '91', label: 'NUIP' },
];

const ORGANIZACIONES_LEGALES = [
  { code: '1', label: 'Persona jurídica' },
  { code: '2', label: 'Persona natural' },
];

const TRIBUTOS = [
  { code: '01', label: 'IVA' },
  { code: '04', label: 'INC' },
  { code: 'ZZ', label: 'No aplica / No causa' },
  { code: '05', label: 'ReteIVA' },
];

const RESPONSABILIDADES_FISCALES = [
  { code: 'O-13', label: 'Gran contribuyente' },
  { code: 'O-15', label: 'Autorretenedor' },
  { code: 'O-23', label: 'Agente de retención IVA' },
  { code: 'O-47', label: 'Régimen simple de tributación' },
  { code: 'R-99-PN', label: 'No responsable / No aplica' },
];

/** Códigos de impuesto (items.taxes.code). */
const IMPUESTOS = [
  { code: '01', label: 'IVA' },
  { code: '04', label: 'INC' },
];

/** Códigos de retención (withholding / informativa). */
const RETENCIONES = [
  { code: '05', label: 'ReteIVA' },
  { code: '06', label: 'ReteFuente' },
  { code: '07', label: 'ReteICA' },
];

module.exports = {
  TIPOS_IDENTIFICACION,
  ORGANIZACIONES_LEGALES,
  TRIBUTOS,
  RESPONSABILIDADES_FISCALES,
  IMPUESTOS,
  RETENCIONES,
};
