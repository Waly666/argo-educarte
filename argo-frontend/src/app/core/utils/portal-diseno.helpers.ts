import { mergePortalLanding, PortalLandingConfig } from '../constants/portal-landing-defaults';
import { mergePortalSiteDefaults, PortalSiteConfig } from '../constants/portal-site-defaults';
import { PortalAulaConfig } from '../services/aula-virtual-admin.service';

export const PORTAL_DISENO_TIPO = 'argo-portal-diseno';
export const PORTAL_DISENO_VERSION = 1;

/** Solo diseño del sitio (colores, secciones, textos). No incluye logo ni datos fiscales. */
export interface PortalDisenoPack {
  heroTitulo?: string;
  heroSubtitulo?: string;
  acercaDeHtml?: string;
  landing?: Partial<PortalLandingConfig>;
  site?: Partial<PortalSiteConfig>;
}

export interface PortalDisenoExport {
  tipo: typeof PORTAL_DISENO_TIPO;
  version: number;
  exportadoEn: string;
  diseno: PortalDisenoPack;
}

export function extraerDisenoPortal(form: PortalAulaConfig): PortalDisenoPack {
  const site = form.site ? structuredClone(form.site) : undefined;
  if (site?.tema) delete site.tema.urlHeroAbsoluta;
  return {
    heroTitulo: form.heroTitulo,
    heroSubtitulo: form.heroSubtitulo,
    acercaDeHtml: form.acercaDeHtml,
    landing: form.landing ? structuredClone(form.landing) : undefined,
    site,
  };
}

export function crearExportacionPortal(form: PortalAulaConfig): PortalDisenoExport {
  return {
    tipo: PORTAL_DISENO_TIPO,
    version: PORTAL_DISENO_VERSION,
    exportadoEn: new Date().toISOString(),
    diseno: extraerDisenoPortal(form),
  };
}

export function parsearImportacionPortal(raw: unknown): PortalDisenoPack {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Archivo JSON inválido.');
  }
  const obj = raw as Record<string, unknown>;
  if (obj['tipo'] === PORTAL_DISENO_TIPO && obj['diseno'] && typeof obj['diseno'] === 'object') {
    return obj['diseno'] as PortalDisenoPack;
  }
  if (obj['site'] || obj['landing'] || obj['heroTitulo']) {
    return obj as PortalDisenoPack;
  }
  throw new Error('No reconocemos este archivo. Use un export de ARGO (argo-portal-diseno).');
}

export function aplicarDisenoPortal(form: PortalAulaConfig, diseno: PortalDisenoPack): PortalAulaConfig {
  if (diseno.heroTitulo !== undefined) form.heroTitulo = diseno.heroTitulo;
  if (diseno.heroSubtitulo !== undefined) form.heroSubtitulo = diseno.heroSubtitulo;
  if (diseno.acercaDeHtml !== undefined) form.acercaDeHtml = diseno.acercaDeHtml;
  if (diseno.landing) {
    form.landing = mergePortalLanding({ ...form.landing, ...diseno.landing });
  }
  if (diseno.site) {
    const defaults = mergePortalSiteDefaults();
    form.site = mergePortalSiteDefaults({
      ...form.site,
      ...diseno.site,
      tema: diseno.site.tema ? { ...defaults.tema, ...diseno.site.tema } : form.site?.tema,
      home: diseno.site.home
        ? {
            orden: diseno.site.home.orden?.length
              ? [...diseno.site.home.orden]
              : form.site?.home?.orden || defaults.home.orden,
            secciones: { ...(diseno.site.home.secciones || {}) },
          }
        : form.site?.home,
    });
  }
  return form;
}

export function descargarJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function nombreArchivoDisenoPortal(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `portal-diseno-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.json`;
}
