import { CommonModule } from '@angular/common';
import { Component, Input, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

import {
  PORTAL_HOME_SECCIONES_LABELS,
  PORTAL_HOME_SECCIONES_ORDEN,
  PortalPaginaKey,
} from '../../core/constants/portal-site-defaults';
import { buildPortalThemeCssVars } from '../../core/utils/portal-theme-css.util';
import { mergePortalLanding } from '../../core/constants/portal-landing-defaults';
import { PortalAulaConfig } from '../../core/services/aula-virtual-admin.service';
import { BuilderPanel } from './portal-site-builder.component';

type PreviewMode = 'borrador' | 'publicado';
type DeviceMode = 'desktop' | 'mobile';

@Component({
  selector: 'argo-portal-site-preview',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './portal-site-preview.component.html',
  styleUrl: './portal-site-preview.component.scss',
})
export class PortalSitePreviewComponent {
  @Input({ required: true }) portalForm!: PortalAulaConfig;
  @Input({ required: true }) portalUrl!: string;
  @Input() activePanel: BuilderPanel = 'panel';

  previewMode = signal<PreviewMode>('borrador');
  deviceMode = signal<DeviceMode>('desktop');
  private publishedIframeUrl: SafeResourceUrl | null = null;

  constructor(private sanitizer: DomSanitizer) {}

  setPreviewMode(mode: PreviewMode) {
    this.previewMode.set(mode);
    if (mode === 'publicado') {
      this.refreshPublishedIframe();
    }
  }

  refreshPublishedIframe() {
    const base = this.portalUrl.replace(/\/?$/, '/');
    this.publishedIframeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
      `${base}?_t=${Date.now()}`,
    );
  }

  private portalOrigin(): string {
    try {
      return new URL(this.portalUrl).origin;
    } catch {
      return '';
    }
  }

  setDeviceMode(mode: DeviceMode) {
    this.deviceMode.set(mode);
  }

  liveIframeUrl(): SafeResourceUrl {
    if (!this.publishedIframeUrl) this.refreshPublishedIframe();
    return this.publishedIframeUrl!;
  }

  landingConfig() {
    return this.landing;
  }

  private get site() {
    return this.portalForm.site;
  }

  private get landing() {
    return mergePortalLanding(this.portalForm.landing);
  }

  nombreCea(): string {
    return this.portalForm.nombreEmpresa?.trim() || 'Mi institución';
  }

  logoUrl(): string | null {
    return this.portalForm.urlLogoAbsoluta || this.portalForm.urlLogo || null;
  }

  heroTitulo(): string {
    return this.portalForm.heroTitulo?.trim() || 'Título principal del portal';
  }

  heroSubtitulo(): string {
    return (
      this.portalForm.heroSubtitulo?.trim() ||
      'Subtítulo que describe su oferta educativa y capacitación.'
    );
  }

  heroImageUrl(): string {
    const abs = this.site?.tema?.urlHeroAbsoluta?.trim();
    if (abs) return abs;
    const rel = this.site?.tema?.urlHero?.trim();
    if (rel) {
      if (rel.startsWith('http')) return rel;
      if (rel.startsWith('/')) return `${this.portalOrigin()}${rel}`;
      const logoBase = this.portalForm.urlLogoAbsoluta || '';
      if (logoBase.includes('/uploads/')) {
        const origin = logoBase.replace(/\/uploads\/.*$/, '');
        return `${origin}/${rel.replace(/^\//, '')}`;
      }
      return rel;
    }
    return `${this.portalOrigin()}/images/hero-estudiante.png`;
  }

  copyrightText(): string {
    const custom = this.site?.marca?.textoCopyright?.trim();
    if (custom) return custom;
    const fb = this.landing.footer.copyright?.trim();
    if (this.site?.marca?.ocultarMarcaDesarrollador && fb) {
      return fb.replace(/\s*[·|]\s*desarrollado.*/i, '').trim();
    }
    return fb || `© ${new Date().getFullYear()} ${this.nombreCea()}`;
  }

  navItems(): { key: PortalPaginaKey; label: string }[] {
    const nav = this.landing.nav;
    const paginas = this.site?.paginas;
    const items: { key: PortalPaginaKey; label: string }[] = [
      { key: 'home', label: paginas?.home?.etiquetaMenu || nav.home },
      { key: 'tienda', label: paginas?.tienda?.etiquetaMenu || nav.tienda },
      { key: 'cursos', label: paginas?.cursos?.etiquetaMenu || nav.cursos },
      { key: 'aula', label: paginas?.aula?.etiquetaMenu || nav.aula },
      { key: 'fundacion', label: paginas?.fundacion?.etiquetaMenu || nav.fundacion },
      {
        key: 'consultaCertificados',
        label: paginas?.consultaCertificados?.etiquetaMenu || nav.consultaCertificados,
      },
      { key: 'blog', label: paginas?.blog?.etiquetaMenu || nav.blog },
      { key: 'acerca', label: paginas?.acerca?.etiquetaMenu || nav.acerca },
    ];
    return items.filter((i) => {
      if (i.key === 'home' || i.key === 'aula') return true;
      return paginas?.[i.key]?.activa !== false;
    });
  }

  seccionesHome(): { id: string; label: string; activa: boolean }[] {
    const labels = { ...PORTAL_HOME_SECCIONES_LABELS, ...this.site?.homeSeccionesLabels };
    const orden = this.site?.home?.orden?.length
      ? [...this.site.home.orden]
      : [...PORTAL_HOME_SECCIONES_ORDEN];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const id of orden) {
      if (!seen.has(id)) {
        seen.add(id);
        out.push(id);
      }
    }
    for (const id of PORTAL_HOME_SECCIONES_ORDEN) {
      if (!seen.has(id)) out.push(id);
    }
    return out.map((id) => ({
      id,
      label: labels[id] || id,
      activa: this.site?.home?.secciones?.[id] !== false,
    }));
  }

  seccionesActivasCount(): number {
    return this.seccionesHome().filter((s) => s.activa).length;
  }

  themeVars(): Record<string, string> {
    return buildPortalThemeCssVars(this.site?.tema);
  }

  panelHint(): string {
    const hints: Partial<Record<BuilderPanel, string>> = {
      panel: 'Resumen del sitio',
      empresa: 'Nombre y contacto',
      paginas: 'Menú del sitio',
      inicio: 'Bloques del inicio',
      contenido: 'Textos del inicio',
      institucional: 'Quiénes somos',
      blog: 'Blog',
      apariencia: 'Colores y estilo',
      marca: 'Pie de página',
    };
    return hints[this.activePanel] || 'Vista previa';
  }

  sectionIcon(id: string): string {
    const icons: Record<string, string> = {
      instBar: '▬',
      hero: '◆',
      infoCards: '▦',
      ofertas: '✦',
      beneficios: '★',
      quoteBand: '❝',
      serviciosEmpresa: '◎',
      testimonios: '💬',
      valores: '♥',
      cursosVirtuales: '📚',
      carreras: '🎓',
      pasos: '①',
      faq: '?',
      pilares: '⚑',
    };
    return icons[id] || '▢';
  }

  highlightSection(_id: string): boolean {
    return this.activePanel === 'inicio';
  }
}
