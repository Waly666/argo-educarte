import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';

import { PortalLandingConfig } from '../../core/constants/portal-landing-defaults';
import { AulaVirtualAdminService, PortalAulaConfig } from '../../core/services/aula-virtual-admin.service';

@Component({
  selector: 'argo-portal-apk-upload',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './portal-apk-upload.component.html',
  styleUrl: './portal-apk-upload.component.scss',
})
export class PortalApkUploadComponent {
  private svc = inject(AulaVirtualAdminService);

  @Input({ required: true }) landing!: PortalLandingConfig;
  @Input() portalUrl = 'http://localhost:4202/';
  @Output() portalConfigUpdated = new EventEmitter<PortalAulaConfig>();
  @Output() avNotice = new EventEmitter<{ message: string; error?: boolean }>();

  apkUploading = signal(false);

  tieneApkSubido(): boolean {
    const url = this.landing.appMobile?.apkUrl?.trim() || '';
    return url.includes('/uploads/aula-virtual-apk/');
  }

  apkEnlacePortal(): string {
    const url = this.landing.appMobile?.apkUrl?.trim();
    if (!url) return '';
    if (/^https?:\/\//i.test(url)) return url;
    const base = this.portalUrl.replace(/\/+$/, '');
    return `${base}${url.startsWith('/') ? url : `/${url}`}`;
  }

  onApkSelected(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.apk')) {
      this.avNotice.emit({ message: 'Seleccione un archivo .apk', error: true });
      input.value = '';
      return;
    }
    this.apkUploading.set(true);
    this.svc
      .subirApkAulaPortal(file)
      .pipe(
        finalize(() => {
          this.apkUploading.set(false);
          input.value = '';
        }),
      )
      .subscribe({
        next: (res) => {
          if (res.config.landing?.appMobile) {
            this.landing.appMobile = { ...this.landing.appMobile, ...res.config.landing.appMobile };
          }
          this.portalConfigUpdated.emit(res.config);
          this.avNotice.emit({ message: res.message || 'APK publicado en el portal' });
        },
        error: (e) => {
          this.avNotice.emit({
            message: e?.error?.message || 'No se pudo subir el APK',
            error: true,
          });
        },
      });
  }

  quitarApk() {
    this.apkUploading.set(true);
    this.svc
      .quitarApkAulaPortal()
      .pipe(finalize(() => this.apkUploading.set(false)))
      .subscribe({
        next: (res) => {
          if (res.config.landing?.appMobile) {
            this.landing.appMobile = { ...this.landing.appMobile, ...res.config.landing.appMobile };
          }
          this.portalConfigUpdated.emit(res.config);
          this.avNotice.emit({ message: res.message || 'APK restaurado' });
        },
        error: (e) => {
          this.avNotice.emit({
            message: e?.error?.message || 'No se pudo quitar el APK',
            error: true,
          });
        },
      });
  }
}
