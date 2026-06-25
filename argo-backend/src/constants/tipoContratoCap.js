/** Tipos de contratante en jornadas de capacitación (perfil fiscal en Config). */
const TIPO_JURIDICA_EMPRESA = 'juridica_empresa';
const TIPO_JURIDICA_OFICIAL = 'juridica_oficial';
const TIPO_JURIDICA_ONG = 'juridica_ong';
const TIPO_PERSONA_NATURAL = 'persona_natural';

const TIPOS_CONTRATO_CAP = [
  TIPO_JURIDICA_EMPRESA,
  TIPO_JURIDICA_OFICIAL,
  TIPO_JURIDICA_ONG,
  TIPO_PERSONA_NATURAL,
];

const TIPO_CONTRATO_CAP_LABELS = {
  [TIPO_JURIDICA_EMPRESA]: 'Persona jurídica — Empresa particular',
  [TIPO_JURIDICA_OFICIAL]: 'Persona jurídica — Entidad oficial (Estado)',
  [TIPO_JURIDICA_ONG]: 'Persona jurídica — ONG',
  [TIPO_PERSONA_NATURAL]: 'Persona natural',
};

/** Organización legal DIAN sugerida al vincular Cliente desde contrato. */
const TIPO_CONTRATO_LEGAL_ORG = {
  [TIPO_JURIDICA_EMPRESA]: '1',
  [TIPO_JURIDICA_OFICIAL]: '1',
  [TIPO_JURIDICA_ONG]: '1',
  [TIPO_PERSONA_NATURAL]: '2',
};

function esTipoContratoCapValido(tipo) {
  return TIPOS_CONTRATO_CAP.includes(String(tipo || '').trim());
}

module.exports = {
  TIPO_JURIDICA_EMPRESA,
  TIPO_JURIDICA_OFICIAL,
  TIPO_JURIDICA_ONG,
  TIPO_PERSONA_NATURAL,
  TIPOS_CONTRATO_CAP,
  TIPO_CONTRATO_CAP_LABELS,
  TIPO_CONTRATO_LEGAL_ORG,
  esTipoContratoCapValido,
};
