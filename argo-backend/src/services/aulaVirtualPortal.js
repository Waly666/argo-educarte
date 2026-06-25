const Config = require('../models/Config');
const { obtenerConfigRecibo } = require('./configRecibo');
const { publicUploadUrl } = require('../utils/uploadPublicUrl');
const { mergeLanding, normalizarLanding } = require('./aulaVirtualPortalLanding');
const {
  mergePortalSite,
  sincronizarNavLanding,
  copyrightPublico,
  HOME_SECCIONES_ORDEN,
} = require('./portalSiteConfig');
const { HOME_SECCIONES_LABELS } = require('../constants/portalSiteDefaults');

const CLAVE_AULA = 'aula_virtual';

const DEFAULTS_AULA = {
  clave: CLAVE_AULA,
  /** Datos de empresa mostrados en el portal (prioridad sobre Recibos). */
  nombreEmpresa: '',
  nit: '',
  direccion: '',
  ciudad: '',
  telefono: '',
  email: '',
  /** Ruta relativa bajo uploads/; vacío = usar logo de Config → Recibos. */
  urlLogo: '',
  heroTitulo: 'Educación y oportunidades que transforman comunidades.',
  heroSubtitulo:
    'Formación virtual, proyectos sociales y acompañamiento para personas y familias, con énfasis en poblaciones vulnerables y el departamento del Cauca.',
  acercaDeHtml:
    'La Fundación Educarte Colombia promueve el bienestar de las comunidades a través de la educación, la cultura y el desarrollo social.\n\nSomos una entidad sin ánimo de lucro que diseña y ejecuta programas educativos, sociales, culturales, ambientales y comunitarios, orientados a personas, familias y comunidades —especialmente quienes están en condiciones de vulnerabilidad, exclusión o pobreza.\n\nActuamos con solidaridad, equidad, inclusión, participación comunitaria, responsabilidad social y sostenibilidad, impulsando el acceso a la educación, el emprendimiento, la formación ciudadana y el desarrollo humano integral.',
  telefonoWhatsapp: '',
  /** Correo destino del formulario de contacto general */
  emailContacto: '',
  /** Remitente visible en los correos de confirmación de registro del aula */
  emailConfirmacion: '',
  /** Correo destino para el formulario PQR del aula */
  emailPqr: '',
};

function logoAbsoluto(urlLogo) {
  return publicUploadUrl(urlLogo);
}

function pickLogo(aula, recibo) {
  const rel = String(aula.urlLogo || recibo.urlLogo || '').trim();
  return {
    urlLogo: rel,
    urlLogoAbsoluta: logoAbsoluto(rel),
    logoDesdeRecibos: !String(aula.urlLogo || '').trim() && !!String(recibo.urlLogo || '').trim(),
  };
}

function validarEmailPortal(email) {
  const mail = String(email || '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail) ? mail : null;
}

/** Correo donde llegan los mensajes del formulario (contacto → portal → recibos). */
function resolverEmailFormularioContacto(aula, recibo) {
  for (const raw of [aula?.emailContacto, aula?.email, recibo?.email]) {
    const mail = validarEmailPortal(raw);
    if (mail) return mail;
  }
  return null;
}

function pickEmpresa(aula, recibo) {
  return {
    nombreCea: String(aula.nombreEmpresa || recibo.nombreEmpresa || 'CEA').trim() || 'CEA',
    nit: String(aula.nit || recibo.nit || '').trim(),
    direccion: String(aula.direccion || recibo.direccion || '').trim(),
    ciudad: String(aula.ciudad || recibo.ciudad || '').trim(),
    telefono: String(aula.telefono || recibo.telefono || aula.telefonoWhatsapp || '').trim(),
    email: String(aula.email || recibo.email || aula.emailContacto || '').trim(),
  };
}

async function obtenerConfigAula() {
  let doc = await Config.findOne({ clave: CLAVE_AULA }).lean();
  if (!doc) doc = DEFAULTS_AULA;
  return { ...DEFAULTS_AULA, ...doc };
}

async function guardarConfigAula(body, usuario) {
  const dto = {
    ...DEFAULTS_AULA,
    ...body,
    clave: CLAVE_AULA,
    nombreEmpresa: String(body.nombreEmpresa ?? body.nombreCea ?? '').trim(),
    nit: String(body.nit ?? '').trim(),
    direccion: String(body.direccion ?? '').trim(),
    ciudad: String(body.ciudad ?? '').trim(),
    telefono: String(body.telefono ?? '').trim(),
    email: String(body.email ?? '').trim(),
    emailContacto:      String(body.emailContacto ?? '').trim().toLowerCase(),
    emailConfirmacion:  String(body.emailConfirmacion ?? '').trim().toLowerCase(),
    emailPqr:           String(body.emailPqr ?? '').trim().toLowerCase(),
    telefonoWhatsapp: String(body.telefonoWhatsapp ?? '').trim(),
    urlLogo: body.urlLogo !== undefined ? String(body.urlLogo ?? '').trim() : undefined,
    userChangeRecord: usuario?.username || 'sistema',
  };
  delete dto._id;
  delete dto.nombreCea;
  if (dto.urlLogo === undefined) delete dto.urlLogo;
  if (body.landing !== undefined) {
    dto.landing = normalizarLanding(body.landing);
  }
  if (body.site !== undefined) {
    const navBase = dto.landing?.nav || mergeLanding((await obtenerConfigAula()).landing).nav;
    const footerBase = dto.landing?.footer || mergeLanding((await obtenerConfigAula()).landing).footer;
    dto.site = mergePortalSite(body.site, { nav: navBase, footer: footerBase });
    dto.landing = sincronizarNavLanding(dto.landing || mergeLanding((await obtenerConfigAula()).landing), dto.site);
  }
  await Config.updateOne({ clave: CLAVE_AULA }, { $set: dto }, { upsert: true });
  if (body.urlLogo !== undefined) {
    const logoSync = String(body.urlLogo ?? '').trim();
    await Config.updateOne(
      { clave: 'recibo' },
      { $set: { urlLogo: logoSync, userChangeRecord: usuario?.username || 'sistema' } },
    );
  }
  return obtenerConfigAula();
}

/** Config editable en admin (rellena con Recibos si el portal aún no tiene datos). */
function armarSitePublico(aula, landing) {
  const site = mergePortalSite(aula.site, { nav: landing.nav, footer: landing.footer });
  return {
    ...site,
    homeSeccionesLabels: HOME_SECCIONES_LABELS,
    homeSeccionesOrden: HOME_SECCIONES_ORDEN,
  };
}

async function obtenerConfigPortalAdmin() {
  const [aula, recibo] = await Promise.all([obtenerConfigAula(), obtenerConfigRecibo()]);
  const empresa = pickEmpresa(aula, recibo);
  const logo = pickLogo(aula, recibo);
  const landing = mergeLanding(aula.landing);
  return {
    ...aula,
    landing,
    site: armarSitePublico(aula, landing),
    nombreEmpresa: aula.nombreEmpresa || recibo.nombreEmpresa || '',
    nit: aula.nit || recibo.nit || '',
    direccion: aula.direccion || recibo.direccion || '',
    ciudad: aula.ciudad || recibo.ciudad || '',
    telefono: aula.telefono || recibo.telefono || '',
    email: aula.email || recibo.email || '',
    urlLogo: aula.urlLogo || '',
    urlLogoAbsoluta: logo.urlLogoAbsoluta,
    logoDesdeRecibos: logo.logoDesdeRecibos,
    vistaPreviaEmpresa: empresa,
  };
}

/** Config pública del portal (marca CEA + textos aula). */
async function obtenerConfigPortalPublica() {
  const [recibo, aula] = await Promise.all([obtenerConfigRecibo(), obtenerConfigAula()]);
  const empresa = pickEmpresa(aula, recibo);
  const logo = pickLogo(aula, recibo);
  const landing = mergeLanding(aula.landing);
  const site = armarSitePublico(aula, landing);
  const landingNav = sincronizarNavLanding(landing, site);
  return {
    ...empresa,
    urlLogo: logo.urlLogo,
    urlLogoAbsoluta: logo.urlLogoAbsoluta,
    heroTitulo: aula.heroTitulo,
    heroSubtitulo: aula.heroSubtitulo,
    acercaDeHtml: aula.acercaDeHtml || '',
    landing: {
      ...landingNav,
      footer: {
        ...landingNav.footer,
        copyright: copyrightPublico(site, landingNav, empresa.nombreCea),
      },
    },
    site,
    formularioContactoActivo: !!resolverEmailFormularioContacto(aula, recibo),
    formularioPqrActivo: !!validarEmailPortal(aula?.emailPqr),
  };
}

module.exports = {
  obtenerConfigAula,
  guardarConfigAula,
  obtenerConfigPortalAdmin,
  obtenerConfigPortalPublica,
  resolverEmailFormularioContacto,
  pickLogo,
  logoAbsoluto,
  DEFAULTS_AULA,
  mergeLanding,
};
