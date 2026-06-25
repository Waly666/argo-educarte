const { models: cat } = require('../models/catalogos');
const {
  ADQUIRENTE_CLIENTE,
  ADQUIRENTE_ALUMNO,
} = require('../constants/facturacionElectronica');
const { customerDesdeAlumno, customerDesdeCliente, codigoTipoDoc } = require('./facturaPayload');

function sinAcentos(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

/** Código municipio DANE (5 dígitos) para Factus. */
async function resolverCodigoMunicipioDane(codigo, nombre) {
  const c = String(codigo || '').trim();
  if (/^\d{5}$/.test(c)) return c;
  if (/^\d{1,5}$/.test(c)) return c.padStart(5, '0');

  const buscar = String(nombre || c || '').trim();
  if (!buscar) return '';

  const norm = sinAcentos(buscar);
  const re = new RegExp(buscar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const candidatos = await cat.divipola.find({ nombreMunicipio: re }).limit(8).lean();
  const exacto = candidatos.find((r) => sinAcentos(r.nombreMunicipio) === norm);
  if (exacto?.codMunicipio) return String(exacto.codMunicipio).padStart(5, '0');

  if (candidatos[0]?.codMunicipio) return String(candidatos[0].codMunicipio).padStart(5, '0');

  const parcial = await cat.divipola
    .find({ nombreMunicipio: new RegExp(buscar.slice(0, Math.min(5, buscar.length)), 'i') })
    .limit(5)
    .lean();
  const hit = parcial.find((r) => sinAcentos(r.nombreMunicipio).includes(norm) || norm.includes(sinAcentos(r.nombreMunicipio)));
  return hit?.codMunicipio ? String(hit.codMunicipio).padStart(5, '0') : '';
}

/** Dígito de verificación DIAN para NIT. */
function calcularDvNit(nit) {
  const s = String(nit || '').replace(/\D/g, '');
  if (!s) return null;
  const pesos = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
  let suma = 0;
  for (let i = 0; i < s.length; i += 1) {
    suma += Number(s[s.length - 1 - i]) * pesos[i];
  }
  const mod = suma % 11;
  return mod < 2 ? String(mod) : String(11 - mod);
}

function dvNitParaFactus(nit, dvGuardado) {
  const calc = calcularDvNit(nit);
  if (calc == null) return null;
  const d = String(dvGuardado ?? '').trim();
  if (!d) return calc;
  return d === calc ? d : calc;
}

async function enriquecerCustomer(customer, fuente = {}) {
  const out = { ...customer };
  const mun = await resolverCodigoMunicipioDane(fuente.municipioCodigo, fuente.municipioNombre);
  if (mun) out.municipality_code = mun;
  else if (out.municipality_code && !/^\d{5}$/.test(String(out.municipality_code))) {
    delete out.municipality_code;
  }

  const docCode = String(out.identification_document_code || codigoTipoDoc(fuente.tipoDoc) || '13');
  if (docCode === '31') {
    const dv = dvNitParaFactus(out.identification, fuente.dv);
    if (dv != null) out.dv = dv;
    else delete out.dv;
  } else {
    delete out.dv;
  }
  return out;
}

async function buildCustomerFactus(adquirente) {
  if (adquirente?.tipo === ADQUIRENTE_CLIENTE && adquirente.cliente) {
    const c = adquirente.cliente;
    const customer = customerDesdeCliente(c);
    return enriquecerCustomer(customer, {
      municipioCodigo: c.municipioCodigo,
      municipioNombre: c.municipioNombre,
      dv: c.dv,
    });
  }
  if (adquirente?.tipo === ADQUIRENTE_ALUMNO && adquirente.alumno) {
    const a = adquirente.alumno;
    const customer = customerDesdeAlumno(a);
    return enriquecerCustomer(customer, {
      municipioCodigo: a.codMunicipio,
      municipioNombre: a.ciudad || a.municipio,
      tipoDoc: a.tipoDoc,
      dv: null,
    });
  }
  const err = new Error('No se pudo determinar el adquirente de la factura');
  err.status = 400;
  throw err;
}

/** Validación previa con mensajes accionables (Config → Clientes). */
function validarCustomerFactus(customer, adquirente) {
  const errores = [];
  const esEmpresa = adquirente?.tipo === ADQUIRENTE_CLIENTE;

  if (!String(customer.identification || '').trim()) {
    errores.push('Falta el número de identificación del adquirente.');
  }
  if (esEmpresa && !String(customer.company || customer.names || '').trim()) {
    errores.push('El cliente no tiene razón social / nombre.');
  }
  if (String(customer.identification_document_code) === '31') {
    const dv = String(customer.dv ?? '').trim();
    const calc = calcularDvNit(customer.identification);
    if (calc != null && dv && dv !== calc) {
      errores.push(`El dígito de verificación del NIT debe ser ${calc}. Actualice el cliente en Configuración → Clientes de facturación.`);
    }
  }
  const mun = String(customer.municipality_code || '').trim();
  if (!mun || !/^\d{5}$/.test(mun)) {
    const nombre = adquirente?.cliente?.municipioNombre || adquirente?.cliente?.municipioCodigo || '';
    errores.push(
      nombre
        ? `El municipio "${nombre}" no tiene código DANE válido (ej. 19001 para Popayán). Corríjalo en Configuración → Clientes de facturación.`
        : 'Falta el código de municipio DANE del cliente (5 dígitos, ej. 19001).',
    );
  }

  if (!errores.length) return;
  const err = new Error(errores.join(' '));
  err.status = 400;
  err.code = 'FACTUS_CLIENTE_INVALIDO';
  err.details = { errors: { cliente: errores } };
  throw err;
}

module.exports = {
  buildCustomerFactus,
  validarCustomerFactus,
  resolverCodigoMunicipioDane,
  calcularDvNit,
};
