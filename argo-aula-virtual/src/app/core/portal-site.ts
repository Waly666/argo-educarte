import { PortalConfig } from './models';

export type PortalPaginaKey =
  | 'home'
  | 'tienda'
  | 'cursos'
  | 'aula'
  | 'fundacion'
  | 'consultaCertificados'
  | 'blog'
  | 'acerca';

const RUTA_PAGINA: Record<PortalPaginaKey, string> = {
  home: '/',
  tienda: '/tienda',
  cursos: '/cursos',
  aula: '/aula',
  fundacion: '/fundacion',
  consultaCertificados: '/consulta-certificados',
  blog: '/blog',
  acerca: '/acerca',
};

const DEFAULT_HOME_ORDER = [
  'instBar',
  'hero',
  'infoCards',
  'ofertas',
  'beneficios',
  'quoteBand',
  'serviciosEmpresa',
  'carreras',
  'cursosVirtuales',
  'valores',
  'pasos',
  'appMobile',
  'testimonios',
  'faq',
  'pilares',
];

export function paginaActiva(config: PortalConfig | null, key: PortalPaginaKey): boolean {
  if (key === 'home' || key === 'aula') return true;
  const p = config?.site?.paginas?.[key];
  if (!p) return true;
  return p.activa !== false;
}

export function etiquetaPagina(config: PortalConfig | null, key: PortalPaginaKey, fallback: string): string {
  return config?.site?.paginas?.[key]?.etiquetaMenu?.trim() || fallback;
}

export function rutaPagina(key: PortalPaginaKey): string {
  return RUTA_PAGINA[key];
}

export function seccionHomeVisible(config: PortalConfig | null, id: string): boolean {
  const sec = config?.site?.home?.secciones;
  if (!sec) return true;
  return sec[id] !== false;
}

export function ordenSeccionesHome(config: PortalConfig | null): string[] {
  const orden = config?.site?.home?.orden;
  if (orden?.length) {
    const set = new Set(DEFAULT_HOME_ORDER);
    const out: string[] = [];
    for (const id of orden) {
      if (set.has(id) && !out.includes(id)) out.push(id);
    }
    for (const id of DEFAULT_HOME_ORDER) {
      if (!out.includes(id)) out.push(id);
    }
    return aplicarMigracionesOrdenHome(out);
  }
  return aplicarMigracionesOrdenHome([...DEFAULT_HOME_ORDER]);
}

function aplicarMigracionesOrdenHome(orden: string[]): string[] {
  return posicionarTestimoniosAntesFaq(aplicarSwapValoresCarreras(orden)).filter((id) => id !== 'infoCards');
}

/** Intercambia valores ↔ carreras si aún está el orden anterior guardado en BD. */
function aplicarSwapValoresCarreras(orden: string[]): string[] {
  const iv = orden.indexOf('valores');
  const ic = orden.indexOf('carreras');
  if (iv === -1 || ic === -1 || iv >= ic) return orden;
  const out = [...orden];
  out[iv] = 'carreras';
  out[ic] = 'valores';
  return out;
}

/** Coloca testimonios justo antes de FAQ si aún está en la posición antigua del home. */
function posicionarTestimoniosAntesFaq(orden: string[]): string[] {
  const it = orden.indexOf('testimonios');
  const ifaq = orden.indexOf('faq');
  const ipasos = orden.indexOf('pasos');
  if (it === -1 || ifaq === -1) return orden;
  if (it === ifaq - 1) return orden;
  if (ipasos !== -1 && it > ipasos && it < ifaq) return orden;
  const out = orden.filter((id) => id !== 'testimonios');
  const idxFaq = out.indexOf('faq');
  if (idxFaq === -1) return orden;
  out.splice(idxFaq, 0, 'testimonios');
  return out;
}

export function clavePaginaPorRuta(path: string): PortalPaginaKey | null {
  const clean = path.split('?')[0].split('#')[0];
  const base = clean.replace(/\/:[^/]+.*$/, '').replace(/\/$/, '') || '/';
  if (base === '/' || base === '') return 'home';
  if (base.startsWith('/cursos/')) return 'cursos';
  if (base === '/blog' || base.startsWith('/blog/')) return 'blog';
  for (const [key, ruta] of Object.entries(RUTA_PAGINA)) {
    if (ruta !== '/' && base === ruta) return key as PortalPaginaKey;
  }
  return null;
}
