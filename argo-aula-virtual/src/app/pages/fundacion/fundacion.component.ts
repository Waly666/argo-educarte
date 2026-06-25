import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AulaApiService } from '../../core/aula-api.service';
import { mergePortalLanding } from '../../core/portal-landing';
import { PortalSeoService } from '../../core/portal-seo.service';
import { PortalConfig } from '../../core/models';
import { resolveUploadUrl } from '../../core/upload-url.util';
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
  private api = inject(AulaApiService);
  private seo = inject(PortalSeoService);

  config = signal<PortalConfig | null>(null);

  landing = computed(() => mergePortalLanding(this.config()?.landing));
  fund = computed(() => this.landing().fundacion);

  nombreCea = computed(() => this.config()?.nombreCea?.trim() || 'Mi institución');

  heroTitulo = computed(() => this.fund().hero.titulo?.trim() || this.nombreCea());

  heroImagen = computed(() => {
    const url = this.fund().hero.imagenUrl?.trim();
    if (!url) return '/images/fundacion-equipo.png';
    if (url.startsWith('http') || url.startsWith('//')) return url;
    return url.startsWith('/') ? url : `/${url}`;
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

  ngOnInit() {
    this.api.config().subscribe({
      next: (c) => {
        this.config.set(c);
        this.seo.applyFundacion(c);
      },
      error: () => this.seo.applyFundacion(null),
    });
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
