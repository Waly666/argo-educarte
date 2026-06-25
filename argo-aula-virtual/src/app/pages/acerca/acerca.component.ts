import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AulaApiService } from '../../core/aula-api.service';
import { PortalSeoService } from '../../core/portal-seo.service';
import { PortalConfig } from '../../core/models';
import { resolveUploadUrl } from '../../core/upload-url.util';
import { ContactoFormComponent } from '../../shared/contacto-form/contacto-form.component';
import { ACERCA_DEFAULT, VALORES } from '../home/home-content';

@Component({
  selector: 'av-acerca',
  standalone: true,
  imports: [CommonModule, RouterLink, ContactoFormComponent],
  templateUrl: './acerca.component.html',
  styleUrl: './acerca.component.scss',
})
export class AcercaComponent implements OnInit {
  private api = inject(AulaApiService);
  private seo = inject(PortalSeoService);
  config = signal<PortalConfig | null>(null);
  readonly valores = VALORES;

  ngOnInit() {
    this.api.config().subscribe({
      next: (c) => {
        this.config.set(c);
        this.seo.applyAcerca(c);
      },
      error: () => this.seo.applyAcerca(null),
    });
  }

  private readonly valorIcons = ['⭐', '🛣️', '🤝', '🎯', '💚', '🚗'];

  acercaTexto() {
    return this.config()?.acercaDeHtml?.trim() || ACERCA_DEFAULT;
  }

  acercaParrafos(): string[] {
    return this.acercaTexto()
      .split(/\n+/)
      .map((p) => p.trim())
      .filter(Boolean);
  }

  iconoValor(index: number): string {
    return this.valorIcons[index % this.valorIcons.length];
  }

  nombreCea() {
    return this.config()?.nombreCea || 'Fundación Finstruvial';
  }

  logoUrl() {
    const cfg = this.config();
    return resolveUploadUrl(cfg?.urlLogoAbsoluta || cfg?.urlLogo);
  }
}
