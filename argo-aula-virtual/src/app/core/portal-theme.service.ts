import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';

import { PortalConfig } from './models';
import {
  buildPortalThemeCssVars,
  isEducarteTema,
  PORTAL_TEMA_EDUCARTE,
} from './portal-theme-css.util';
import { resolveUploadUrl } from './upload-url.util';

@Injectable({ providedIn: 'root' })
export class PortalThemeService {
  private doc = inject(DOCUMENT);

  apply(config: PortalConfig | null) {
    const tema = config?.site?.tema ?? PORTAL_TEMA_EDUCARTE;
    const root = this.doc.documentElement;

    const vars = buildPortalThemeCssVars(tema);
    for (const [key, val] of Object.entries(vars)) {
      if (val) root.style.setProperty(key, val);
    }

    if (isEducarteTema(tema) || !config?.site?.tema) {
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
    const t = config?.site?.tema;
    const abs = t?.urlHeroAbsoluta?.trim();
    if (abs) return abs;
    const resolved = resolveUploadUrl(t?.urlHero);
    if (resolved) return resolved;
    const rel = t?.urlHero?.trim();
    if (rel && (rel.startsWith('http') || rel.startsWith('/'))) return rel;
    return null;
  }
}
