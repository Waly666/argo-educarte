import { Injectable } from '@angular/core';

import { PortalConfig } from './models';

@Injectable({ providedIn: 'root' })
export class PortalBrandingService {
  apply(config: Pick<PortalConfig, 'nombreCea' | 'urlLogoAbsoluta'>) {
    const logo = config.urlLogoAbsoluta?.trim();
    this.setLinkRel('icon', logo || '/favicon.ico', logo ? this.guessIconType(logo) : 'image/x-icon');
    if (logo) {
      this.setLinkRel('apple-touch-icon', logo);
    }
  }

  private setLinkRel(rel: string, href: string, type?: string) {
    let link = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
    if (!link) {
      link = document.createElement('link');
      link.rel = rel;
      document.head.appendChild(link);
    }
    link.href = href;
    if (type) link.type = type;
    else link.removeAttribute('type');
  }

  private guessIconType(href: string): string {
    const lower = href.toLowerCase();
    if (lower.includes('.png')) return 'image/png';
    if (lower.includes('.webp')) return 'image/webp';
    if (lower.includes('.svg')) return 'image/svg+xml';
    if (lower.includes('.jpg') || lower.includes('.jpeg')) return 'image/jpeg';
    return 'image/x-icon';
  }
}
