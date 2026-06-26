import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';

import { PortalConfig } from './models';
import {
  buildPortalThemeCssVars,
  EDUCARTE_HERO_PERSONA,
  isEducarteTema,
  PORTAL_TEMA_EDUCARTE,
} from './portal-theme-css.util';
import { resolveUploadUrl, withUploadCacheBust } from './upload-url.util';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class PortalThemeService {
  private doc = inject(DOCUMENT);

  /** En dev local previsualiza marca Educarte MISIÓN (localhost o IP LAN). */
  localEducartePreview(): boolean {
    if (environment.production) return false;
    const host = this.doc.defaultView?.location?.hostname ?? '';
    if (host === 'localhost' || host === '127.0.0.1') return true;
    const parts = host.split('.').map((n) => parseInt(n, 10));
    if (parts.length === 4 && !parts.some(Number.isNaN)) {
      const [a, b] = parts;
      if (a === 10) return true;
      if (a === 172 && b >= 16 && b <= 31) return true;
      if (a === 192 && b === 168) return true;
    }
    return false;
  }

  /** Skin Educarte: localhost (dev), build Educarte (prod) o data-portal-skin ya aplicado. */
  educarteSkinActive(): boolean {
    if ((environment as { forceEducarteSkin?: boolean }).forceEducarteSkin) return true;
    return this.localEducartePreview() || this.doc.documentElement.dataset['portalSkin'] === 'educarte';
  }

  educarteBrandingActive(): boolean {
    return this.educarteSkinActive();
  }

  apply(config: PortalConfig | null) {
    const preview = this.localEducartePreview();
    const forceSkin =
      (environment as { forceEducarteSkin?: boolean }).forceEducarteSkin === true;
    const tema =
      preview || forceSkin ? PORTAL_TEMA_EDUCARTE : (config?.site?.tema ?? PORTAL_TEMA_EDUCARTE);
    const root = this.doc.documentElement;

    const vars = buildPortalThemeCssVars(tema);
    for (const [key, val] of Object.entries(vars)) {
      if (val) root.style.setProperty(key, val);
    }

    if (preview || forceSkin || isEducarteTema(tema) || !config?.site?.tema) {
      root.dataset['portalSkin'] = 'educarte';
    } else {
      delete root.dataset['portalSkin'];
    }

    const themeColor = vars['--av-bg'];
    if (themeColor) {
      this.doc.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor);
    }
  }

  heroImageUrl(config: PortalConfig | null): string | null {
    if (!config) return null;

    const t = config.site?.tema;
    const abs = t?.urlHeroAbsoluta?.trim();
    if (abs) return withUploadCacheBust(abs);
    const resolved = resolveUploadUrl(t?.urlHero);
    if (resolved) return withUploadCacheBust(resolved);
    const rel = t?.urlHero?.trim();
    if (rel && (rel.startsWith('http') || rel.startsWith('/'))) {
      // FONDO_HERO es textura de fondo (CSS), no foto lateral.
      if (rel.includes('fondo-hero-educarte')) return EDUCARTE_HERO_PERSONA;
      return withUploadCacheBust(rel);
    }
    if (
      this.localEducartePreview() ||
      (environment as { forceEducarteSkin?: boolean }).forceEducarteSkin ||
      isEducarteTema(t ?? null)
    ) {
      return EDUCARTE_HERO_PERSONA;
    }
    return null;
  }
}
