import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { AulaApiService } from '../../core/aula-api.service';
import { AnimateTitleDirective } from '../../core/animate-title.directive';
import { RevealOnScrollDirective } from '../../core/reveal-on-scroll.directive';
import { CursoVirtual } from '../../core/models';
import { CursoCardComponent } from '../../shared/curso-card/curso-card.component';
import { resolveUploadUrl } from '../../core/upload-url.util';
import { mergePortalLanding } from '../../core/portal-landing';
import { ordenSeccionesHome, seccionHomeVisible } from '../../core/portal-site';
import { PortalConfigStore } from '../../core/portal-config.store';
import { PortalSeoService } from '../../core/portal-seo.service';
import { PortalThemeService } from '../../core/portal-theme.service';
import { HERO_DEFAULT } from './home-content';

@Component({
  selector: 'av-home',
  standalone: true,
  imports: [CommonModule, RouterLink, RevealOnScrollDirective, AnimateTitleDirective, CursoCardComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('heroH1') heroH1?: ElementRef<HTMLElement>;

  private api = inject(AulaApiService);
  private store = inject(PortalConfigStore);
  private seo = inject(PortalSeoService);
  private theme = inject(PortalThemeService);
  private typeTimer?: ReturnType<typeof setInterval>;
  private typeRun = 0;

  config = this.store.config;
  heroImgLoaded = signal(false);
  cursos = signal<CursoVirtual[]>([]);
  tabPilar = signal<'capacitacion' | 'campanas'>('capacitacion');
  faqAbierta = signal<number | null>(null);

  landing = computed(() => mergePortalLanding(this.config()?.landing));

  nombreCea = computed(() => this.config()?.nombreCea || 'Fundación Finstruvial');
  telefono = computed(() => this.config()?.telefono?.trim() || '');
  direccion = computed(
    () =>
      [this.config()?.direccion, this.config()?.ciudad].filter(Boolean).join(', ') ||
      'CLL 26 DN # 4-63 BARRIO VILLA DOCENTE, POPAYÁN',
  );
  heroTitulo = computed(() => this.config()?.heroTitulo || HERO_DEFAULT.titulo);
  heroSubtitulo = computed(() => this.config()?.heroSubtitulo || HERO_DEFAULT.subtitulo);
  logoUrl = computed(() => {
    const cfg = this.config();
    return resolveUploadUrl(cfg?.urlLogoAbsoluta || cfg?.urlLogo);
  });

  ordenSecciones = computed(() => {
    const cfg = this.config();
    return ordenSeccionesHome(cfg)
      .filter((id) => seccionHomeVisible(cfg, id) && id !== 'infoCards');
  });

  infoCardsVisibles = computed(() => seccionHomeVisible(this.config(), 'infoCards'));

  heroImg = computed(() => this.theme.heroImageUrl(this.config()));

  educarteHero = computed(() => {
    this.config();
    return this.theme.educarteBrandingActive();
  });

  apkDownloadUrl = computed(() => this.landing().appMobile.apkUrl || '/apk/aula-virtual-finstruvial.apk');

  apkDownloadName = computed(() => this.landing().appMobile.apkNombre || 'aula-virtual-finstruvial.apk');

  constructor() {
    effect(() => {
      this.heroImg();
      this.heroImgLoaded.set(false);
    });
  }

  ngOnInit() {
    const c = this.config();
    if (c) {
      this.seo.applyHome(c, this.cursos());
      const titulo = (c.heroTitulo || HERO_DEFAULT.titulo).trim();
      if (titulo !== HERO_DEFAULT.titulo.trim()) {
        this.startTypewriter(titulo);
      }
    }
    this.api.cursos().subscribe({
      next: (rows) => {
        this.cursos.set(rows);
        this.seo.applyHome(this.config(), rows);
      },
    });
  }

  toggleFaq(index: number) {
    this.faqAbierta.update((actual) => (actual === index ? null : index));
  }

  ngAfterViewInit() {
    this.startTypewriter(this.heroTitulo());
  }

  ngOnDestroy() {
    this.stopTypewriter();
  }

  fmt(n: number) {
    return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(n || 0);
  }

  /** Posiciona cada carrera alrededor del núcleo central (layout orbital). */
  carrerasOrbita = computed(() => {
    const items = this.landing().carreras.items;
    const n = items.length || 1;
    // Radios en % del contenedor (elipse, más ancha que alta).
    const rx = 39;
    const ry = 38;
    return items.map((c, i) => {
      const ang = ((-90 + (360 / n) * i) * Math.PI) / 180;
      return {
        ...c,
        nombreCorto: this.carreraNombreCorto(c.titulo),
        x: Math.round((50 + rx * Math.cos(ang)) * 100) / 100,
        y: Math.round((50 + ry * Math.sin(ang)) * 100) / 100,
      };
    });
  });

  private carreraNombreCorto(titulo: string) {
    const corto = (titulo || '')
      .replace(/^t[eé]cnico\s+laboral\s+por\s+competencias\s*[—–-]?\s*(en\s+)?/i, '')
      .trim();
    if (!corto) return titulo;
    return corto.charAt(0).toUpperCase() + corto.slice(1);
  }

  telHref() {
    const digits = this.telefono().replace(/\D/g, '');
    if (!digits) return null;
    return `tel:+57${digits}`;
  }

  private stopTypewriter() {
    if (this.typeTimer) {
      clearInterval(this.typeTimer);
      this.typeTimer = undefined;
    }
  }

  private startTypewriter(text: string) {
    const el = this.heroH1?.nativeElement;
    if (!el) return;

    this.stopTypewriter();
    const run = ++this.typeRun;
    const full = text.trim();

    el.setAttribute('aria-label', full);

    if (!full) {
      el.textContent = '';
      el.classList.remove('hero-title--typing', 'hero-title--done');
      return;
    }

    el.classList.remove('hero-title--done');
    el.classList.add('hero-title--typing');
    el.textContent = '';

    let index = 0;

    this.typeTimer = setInterval(() => {
      if (run !== this.typeRun) {
        this.stopTypewriter();
        return;
      }

      if (index < full.length) {
        el.textContent = full.slice(0, index + 1);
        index += 1;
        return;
      }

      this.stopTypewriter();
      el.classList.remove('hero-title--typing');
      el.classList.add('hero-title--done');
    }, 55);
  }
}
