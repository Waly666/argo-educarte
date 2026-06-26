import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';

import {
  FUNDACION_LANDING_DEFAULTS,
  mergeFundacionLanding,
  PortalFundacionLanding,
} from '../../core/constants/fundacion-landing-defaults';
import { AulaVirtualAdminService, PortalAulaConfig } from '../../core/services/aula-virtual-admin.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'argo-portal-fundacion-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './portal-fundacion-editor.component.html',
  styleUrl: './portal-fundacion-editor.component.scss',
})
export class PortalFundacionEditorComponent {
  private svc = inject(AulaVirtualAdminService);

  @Input({ required: true }) fundacion!: PortalFundacionLanding;
  @Input() nombreEmpresa = '';
  @Input() portalUrl = 'http://localhost:4202/';
  @Output() portalConfigUpdated = new EventEmitter<PortalAulaConfig>();
  @Output() avNotice = new EventEmitter<{ message: string; error?: boolean }>();

  bloque = signal<string | null>('hero');
  heroUploading = signal(false);

  toggleBloque(id: string) {
    this.bloque.update((actual) => (actual === id ? null : id));
  }

  restaurarDefaults() {
    Object.assign(this.fundacion, mergeFundacionLanding(FUNDACION_LANDING_DEFAULTS));
  }

  tieneImagenFundacion(): boolean {
    return !!this.fundacion.hero.imagenUrl?.trim();
  }

  fundacionHeroPreviewUrl(): string | null {
    const rel = this.fundacion.hero.imagenUrl?.trim();
    if (!rel) return null;
    if (/^https?:\/\//i.test(rel)) return rel;
    if (rel.startsWith('/uploads/')) return rel;
    if (rel.startsWith('/')) return rel;
    const base = environment.uploadsUrl.replace(/\/+$/, '');
    return `${base}/${rel.replace(/^\/+/, '')}`;
  }

  onFundacionHeroImagen(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.heroUploading.set(true);
    this.svc
      .subirImagenFundacionPortal(file)
      .pipe(
        finalize(() => {
          this.heroUploading.set(false);
          input.value = '';
        }),
      )
      .subscribe({
        next: (res) => {
          if (res.config.landing?.fundacion?.hero) {
            this.fundacion.hero = {
              ...this.fundacion.hero,
              ...res.config.landing.fundacion.hero,
            };
          }
          this.portalConfigUpdated.emit(res.config);
          this.avNotice.emit({ message: res.message || 'Imagen institucional actualizada' });
        },
        error: (e) => {
          this.avNotice.emit({
            message: e?.error?.message || 'No se pudo subir la imagen institucional',
            error: true,
          });
        },
      });
  }

  quitarImagenFundacion() {
    this.heroUploading.set(true);
    this.svc
      .quitarImagenFundacionPortal()
      .pipe(finalize(() => this.heroUploading.set(false)))
      .subscribe({
        next: (res) => {
          if (res.config.landing?.fundacion?.hero) {
            this.fundacion.hero = {
              ...this.fundacion.hero,
              ...res.config.landing.fundacion.hero,
            };
          }
          this.portalConfigUpdated.emit(res.config);
          this.avNotice.emit({ message: res.message || 'Imagen institucional eliminada' });
        },
        error: (e) => {
          this.avNotice.emit({
            message: e?.error?.message || 'No se pudo quitar la imagen institucional',
            error: true,
          });
        },
      });
  }

  addDestacado() {
    this.fundacion.quienes.destacados.push({ icon: '📍', label: '', text: '' });
  }

  removeDestacado(i: number) {
    this.fundacion.quienes.destacados.splice(i, 1);
  }

  addBloque() {
    this.fundacion.quienes.bloques.push({ icon: '✦', titulo: '', texto: '' });
  }

  removeBloque(i: number) {
    this.fundacion.quienes.bloques.splice(i, 1);
  }

  addLinea() {
    this.fundacion.lineas.items.push({ icon: '🎓', title: '', text: '' });
  }

  removeLinea(i: number) {
    this.fundacion.lineas.items.splice(i, 1);
  }
}
