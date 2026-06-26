import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { mergePortalLanding } from '../../core/portal-landing';
import { PortalConfigStore } from '../../core/portal-config.store';
import { PortalSeoService } from '../../core/portal-seo.service';
import { resolveUploadUrl, withUploadCacheBust } from '../../core/upload-url.util';
import { ContactoFormComponent } from '../../shared/contacto-form/contacto-form.component';
import { FUNDACION_CONTACTO } from './fundacion-content';

@Component({
  selector: 'av-fundacion',
  standalone: true,
  imports: [CommonModule, RouterLink, ContactoFormComponent],
  templateUrl: './fundacion.component.html',
  styleUrl: './fundacion.component.scss',
})
export class FundacionComponent implements OnInit {
  private store = inject(PortalConfigStore);
  private seo = inject(PortalSeoService);

  config = this.store.config;
  heroImgLoaded = signal(false);

  landing = computed(() => mergePortalLanding(this.config()?.landing));
  fund = computed(() => this.landing().fundacion);

  nombreCea = computed(() => this.config()?.nombreCea?.trim() || 'Mi institución');

  heroTitulo = computed(() => this.fund().hero.titulo?.trim() || this.nombreCea());

  heroImagen = computed(() => {
    if (!this.config()) return null;
    const url = this.fund().hero.imagenUrl?.trim();
    if (!url) return null;
    const resolved =
      resolveUploadUrl(url) ||
      (url.startsWith('http') || url.startsWith('//')
        ? url
        : url.startsWith('/')
          ? url
          : `/${url}`);
    return withUploadCacheBust(resolved);
  });

  telefono = computed(() => this.config()?.telefono?.trim() || FUNDACION_CONTACTO.telefono);
  email = computed(() => this.config()?.email?.trim() || FUNDACION_CONTACTO.email);
  direccion = computed(() => {
    const c = this.config();
    const partes = [c?.direccion, c?.ciudad].filter(Boolean);
    return partes.length ? partes.join(', ') : FUNDACION_CONTACTO.direccion;
  });

  logoUrl = computed(() => {
    const cfg = this.config();
    return resolveUploadUrl(cfg?.urlLogoAbsoluta || cfg?.urlLogo);
  });

  constructor() {
    effect(() => {
      this.heroImagen();
      this.heroImgLoaded.set(false);
    });
  }

  ngOnInit() {
    this.seo.applyFundacion(this.config());
  }

  telHref() {
    const digits = this.telefono().replace(/\D/g, '');
    if (!digits) return null;
    const withCountry = digits.startsWith('57') ? digits : `57${digits}`;
    return `tel:+${withCountry}`;
  }

  whatsappHref() {
    const digits = this.telefono().replace(/\D/g, '');
    if (!digits) return null;
    const withCountry = digits.startsWith('57') ? digits : `57${digits}`;
    return `https://wa.me/${withCountry}`;
  }
}
