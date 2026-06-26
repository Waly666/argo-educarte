import { CommonModule } from '@angular/common';
import { Component, computed, DestroyRef, ElementRef, inject, OnInit, AfterViewInit, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

import { PortalConfigStore } from '../../core/portal-config.store';
import { CardWaveService } from '../../core/card-wave.service';
import { resolveUploadUrl } from '../../core/upload-url.util';
import { PortalBrandingService } from '../../core/portal-branding.service';
import { etiquetaPagina, paginaActiva, type PortalPaginaKey } from '../../core/portal-site';
import { PortalConfig } from '../../core/models';
import { PortalAuthService } from '../../core/portal-auth.service';
import { mergePortalLanding } from '../../core/portal-landing';
import { ACERCA_DEFAULT } from '../../pages/home/home-content';

import { FUNDACION_SITIO_URL } from '../../pages/fundacion/fundacion-content';

const FOOTER_ABOUT_DEFAULT =
  'promueve educación, cultura y desarrollo comunitario para mejorar la calidad de vida de las personas y las familias en Colombia.';

const FOOTER_SERVICIO_HREF: Record<string, string> = {
  'educación y pedagogía': '/fundacion',
  'desarrollo social comunitario': '/fundacion',
  emprendimiento: '/fundacion',
  'formación rural': '/fundacion',
  'seguridad vial y movilidad': '/cursos',
  'alfabetización digital': '/cursos',
  capacitación: '/cursos',
};

export interface FooterEnlace {
  label: string;
  route: string;
  fragment?: string;
}

export interface FooterServicioEnlace {
  label: string;
  href?: string;
  route?: string;
  fragment?: string;
  external: boolean;
}

@Component({
  selector: 'av-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent implements OnInit, AfterViewInit {
  private store = inject(PortalConfigStore);
  private branding = inject(PortalBrandingService);
  private router = inject(Router);
  private cardWaves = inject(CardWaveService);
  private destroyRef = inject(DestroyRef);
  private host = inject(ElementRef<HTMLElement>);
  private menuToggle = viewChild<ElementRef<HTMLButtonElement>>('menuToggle');
  auth = inject(PortalAuthService);

  config = this.store.config;
  menuAbierto = signal(false);

  logoUrl = computed(() => resolveUploadUrl(this.config()?.urlLogoAbsoluta || this.config()?.urlLogo));

  landing = computed(() => mergePortalLanding(this.config()?.landing));

  footerServicios = computed(() => this.landing().footerServicios);

  navItems = computed(() => {
    const cfg = this.config();
    const nav = this.landing().nav;
    const items: { key: PortalPaginaKey; route: string; label: string }[] = [
      { key: 'home', route: '/', label: etiquetaPagina(cfg, 'home', nav.home) },
      { key: 'tienda', route: '/tienda', label: etiquetaPagina(cfg, 'tienda', nav.tienda) },
      { key: 'cursos', route: '/cursos', label: etiquetaPagina(cfg, 'cursos', nav.cursos) },
      { key: 'aula', route: '/aula', label: etiquetaPagina(cfg, 'aula', nav.aula) },
      { key: 'fundacion', route: '/fundacion', label: etiquetaPagina(cfg, 'fundacion', nav.fundacion) },
      {
        key: 'consultaCertificados',
        route: '/consulta-certificados',
        label: etiquetaPagina(cfg, 'consultaCertificados', nav.consultaCertificados),
      },
      { key: 'blog', route: '/blog', label: etiquetaPagina(cfg, 'blog', nav.blog) },
      { key: 'acerca', route: '/acerca', label: etiquetaPagina(cfg, 'acerca', nav.acerca) },
    ];
    return items.filter((i) => paginaActiva(cfg, i.key));
  });

  footerEnlaces = computed((): FooterEnlace[] => {
    const cfg = this.config();
    const nav = this.landing().nav;
    const paginas: { key: PortalPaginaKey; route: string }[] = [
      { key: 'cursos', route: '/cursos' },
      { key: 'tienda', route: '/tienda' },
      { key: 'aula', route: '/aula' },
      { key: 'fundacion', route: '/fundacion' },
      { key: 'blog', route: '/blog' },
      { key: 'acerca', route: '/acerca' },
    ];
    const pages = paginas
      .filter((p) => paginaActiva(cfg, p.key))
      .map((p) => ({
        label: etiquetaPagina(cfg, p.key, nav[p.key as keyof typeof nav] as string),
        route: p.route,
      }));
    return [
      ...pages,
      { label: 'Servicios', route: '/', fragment: 'servicios-empresa' },
      { label: 'Cómo funciona', route: '/', fragment: 'como-funciona' },
      { label: 'Preguntas frecuentes', route: '/', fragment: 'preguntas-frecuentes' },
      { label: 'Contacto', route: '/acerca', fragment: 'contacto' },
    ];
  });

  footerServiciosLinks = computed((): FooterServicioEnlace[] =>
    this.footerServicios().map((label) => {
      const href = FOOTER_SERVICIO_HREF[label.trim().toLowerCase()] || '/#servicios-empresa';
      if (href.startsWith('http')) {
        return { label, href, external: true };
      }
      if (href.includes('#')) {
        const [route, fragment] = href.split('#');
        return { label, route: route || '/', fragment, external: false };
      }
      return { label, route: href, external: false };
    }),
  );

  sitioInstitucionalUrl = FUNDACION_SITIO_URL;

  nombreCea = computed(() => this.config()?.nombreCea || 'Fundación Finstruvial');

  paginaActivaConsulta = computed(() => paginaActiva(this.config(), 'consultaCertificados'));

  etiquetaConsultaCertificados = computed(() =>
    etiquetaPagina(this.config(), 'consultaCertificados', this.landing().nav.consultaCertificados),
  );

  /** Texto junto al logo en el header (marca corta). */
  brandMarca = computed(() => {
    const name = this.config()?.nombreCea?.trim() || '';
    if (/finstruvial/i.test(name)) return 'FINSTRUVIAL';
    const corto = name.replace(/^fundaci[oó]n\s+/i, '').trim();
    return corto ? corto.toUpperCase() : 'FINSTRUVIAL';
  });

  whatsappTelefono = computed(() => this.config()?.telefono?.trim() || '');

  whatsappHref = computed(() => {
    const digits = this.whatsappTelefono().replace(/\D/g, '');
    if (!digits) return null;
    const withCountry = digits.startsWith('57') ? digits : `57${digits}`;
    return `https://wa.me/${withCountry}`;
  });

  direccionCompleta = computed(() => {
    const c = this.config();
    return [c?.direccion, c?.ciudad].filter(Boolean).join(' ').trim() || '';
  });

  footerAbout = computed(() => {
    const custom = this.config()?.acercaDeHtml?.trim();
    if (custom) {
      const first = custom.split('\n').map((l) => l.trim()).find(Boolean);
      if (first) return first;
    }
    return `${this.nombreCea()} ${FOOTER_ABOUT_DEFAULT}`;
  });

  toggleMenu() {
    const abrir = !this.menuAbierto();
    this.menuAbierto.set(abrir);
    if (!abrir) this.devolverFocoMenu();
  }

  cerrarMenu() {
    if (!this.menuAbierto()) return;
    this.menuAbierto.set(false);
    this.devolverFocoMenu();
  }

  private devolverFocoMenu() {
    queueMicrotask(() => this.menuToggle()?.nativeElement.focus());
  }

  ngOnInit() {
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => this.cerrarMenu());

    const c = this.config();
    if (c) {
      this.branding.apply(c);
    } else {
      this.store.load().then((cfg) => {
        if (cfg) this.branding.apply(cfg);
        else {
          const fallback = {
            nombreCea: 'Fundación Educarte Colombia',
            heroTitulo: 'Educación virtual',
            heroSubtitulo: 'Capacitación en línea',
            acercaDeHtml: ACERCA_DEFAULT,
          };
          this.branding.apply(fallback);
        }
      });
    }
  }

  ngAfterViewInit(): void {
    this.cardWaves.bind(this.host.nativeElement);

    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        setTimeout(() => this.cardWaves.refresh(), 0);
      });

    this.destroyRef.onDestroy(() => this.cardWaves.unbind());
  }

  telHref() {
    const digits = this.config()?.telefono?.replace(/\D/g, '') || '';
    if (!digits) return null;
    const withCountry = digits.startsWith('57') ? digits : `57${digits}`;
    return `tel:+${withCountry}`;
  }

  telDisplay() {
    const tel = this.config()?.telefono?.trim() || '';
    const digits = tel.replace(/\D/g, '');
    if (!digits) return tel;
    const withCountry = digits.startsWith('57') ? digits : `57${digits}`;
    if (withCountry.length === 12) {
      return `+${withCountry.slice(0, 2)} ${withCountry.slice(2, 5)} ${withCountry.slice(5, 8)} ${withCountry.slice(8)}`;
    }
    return tel.startsWith('+') ? tel : `+${withCountry}`;
  }

  logout() {
    this.auth.logout();
  }
}
