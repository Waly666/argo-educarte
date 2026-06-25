import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { environment } from '../../../environments/environment';

import { ConfigService, ConfigRecibo, ConfigFacturacion } from '../../core/services/config.service';
import { ConfigCertificadoService, ConfigCertificado } from '../../core/services/config-certificado.service';
import { AulaVirtualAdminService, PortalAulaConfig } from '../../core/services/aula-virtual-admin.service';

@Component({
  selector: 'argo-config-empresa',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './config-empresa.component.html',
  styleUrls: ['./config-empresa.component.scss'],
})
export class ConfigEmpresaComponent implements OnInit {
  private cfgSvc = inject(ConfigService);
  private cfgCertSvc = inject(ConfigCertificadoService);
  private avSvc = inject(AulaVirtualAdminService);

  loading = signal(true);
  loadError = signal(false);

  /** URL absoluta del logo (resuelve desde el backend, funciona en LAN). */
  readonly logoUrl = computed(() => {
    const rel = this.portal().urlLogoAbsoluta;
    if (!rel) return null;
    const serverBase = environment.apiUrl.replace(/\/api$/, '');
    return serverBase + rel;
  });

  recibo = signal<ConfigRecibo>({});
  portal = signal<Partial<PortalAulaConfig>>({});
  facturacion = signal<Partial<ConfigFacturacion>>({});
  certificado = signal<Partial<ConfigCertificado>>({});

  savingIdentidad = signal(false);
  savingFiscal = signal(false);
  savingCert = signal(false);
  subiendoLogo = signal(false);

  msgIdentidad = signal<string | null>(null);
  msgIdentidadErr = signal(false);
  msgFiscal = signal<string | null>(null);
  msgFiscalErr = signal(false);
  msgCert = signal<string | null>(null);
  msgCertErr = signal(false);
  msgLogo = signal<string | null>(null);
  msgLogoErr = signal(false);

  ngOnInit(): void {
    forkJoin({
      recibo: this.cfgSvc.obtenerRecibo(),
      portal: this.avSvc.obtenerPortal(),
      facturacion: this.cfgSvc.obtenerFacturacion(),
      certificado: this.cfgCertSvc.obtener(),
    }).subscribe({
      next: ({ recibo, portal, facturacion, certificado }) => {
        this.recibo.set(recibo);
        this.portal.set(portal);
        this.facturacion.set({
          emisorNit: facturacion.emisorNit,
          emisorDv: facturacion.emisorDv,
          emisorRazonSocial: facturacion.emisorRazonSocial,
          emisorResponsabilidadFiscal: facturacion.emisorResponsabilidadFiscal,
          emisorRegimen: facturacion.emisorRegimen,
          emisorMunicipioCodigo: facturacion.emisorMunicipioCodigo,
          emisorActividadEconomica: facturacion.emisorActividadEconomica,
        });
        this.certificado.set({
          nombreInstitucion: certificado.nombreInstitucion,
          ciudad: certificado.ciudad,
        });
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(true);
      },
    });
  }

  patchRecibo<K extends keyof ConfigRecibo>(k: K, v: ConfigRecibo[K]) {
    this.recibo.update((f) => ({ ...f, [k]: v }));
  }

  patchFiscal<K extends keyof ConfigFacturacion>(k: K, v: ConfigFacturacion[K]) {
    this.facturacion.update((f) => ({ ...f, [k]: v }));
  }

  patchCert<K extends keyof ConfigCertificado>(k: K, v: ConfigCertificado[K]) {
    this.certificado.update((f) => ({ ...f, [k]: v }));
  }

  guardarIdentidad() {
    this.savingIdentidad.set(true);
    this.msgIdentidad.set(null);
    this.cfgSvc.guardarRecibo(this.recibo()).subscribe({
      next: (c) => {
        this.recibo.set(c);
        this.savingIdentidad.set(false);
        this.msgIdentidadErr.set(false);
        this.msgIdentidad.set('Datos guardados.');
      },
      error: (e) => {
        this.savingIdentidad.set(false);
        this.msgIdentidadErr.set(true);
        this.msgIdentidad.set(e?.error?.message || 'Error al guardar');
      },
    });
  }

  guardarFiscal() {
    this.savingFiscal.set(true);
    this.msgFiscal.set(null);
    this.cfgSvc.guardarFacturacion(this.facturacion()).subscribe({
      next: (c) => {
        this.facturacion.set({
          emisorNit: c.emisorNit,
          emisorDv: c.emisorDv,
          emisorRazonSocial: c.emisorRazonSocial,
          emisorResponsabilidadFiscal: c.emisorResponsabilidadFiscal,
          emisorRegimen: c.emisorRegimen,
          emisorMunicipioCodigo: c.emisorMunicipioCodigo,
          emisorActividadEconomica: c.emisorActividadEconomica,
        });
        this.savingFiscal.set(false);
        this.msgFiscalErr.set(false);
        this.msgFiscal.set('Datos fiscales guardados.');
      },
      error: (e) => {
        this.savingFiscal.set(false);
        this.msgFiscalErr.set(true);
        this.msgFiscal.set(e?.error?.message || 'Error al guardar');
      },
    });
  }

  guardarCert() {
    this.savingCert.set(true);
    this.msgCert.set(null);
    this.cfgCertSvc.guardar(this.certificado() as ConfigCertificado).subscribe({
      next: (c) => {
        this.certificado.set({
          nombreInstitucion: c.nombreInstitucion,
          ciudad: c.ciudad,
        });
        this.savingCert.set(false);
        this.msgCertErr.set(false);
        this.msgCert.set('Datos guardados.');
      },
      error: (e) => {
        this.savingCert.set(false);
        this.msgCertErr.set(true);
        this.msgCert.set(e?.error?.message || 'Error al guardar');
      },
    });
  }

  onLogoChange(ev: Event) {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.subiendoLogo.set(true);
    this.msgLogo.set(null);
    this.avSvc.subirLogoPortal(file).subscribe({
      next: ({ config }) => {
        this.portal.set(config);
        this.subiendoLogo.set(false);
        this.msgLogoErr.set(false);
        this.msgLogo.set('Logo actualizado correctamente.');
        (ev.target as HTMLInputElement).value = '';
      },
      error: (e) => {
        this.subiendoLogo.set(false);
        this.msgLogoErr.set(true);
        this.msgLogo.set(e?.error?.message || 'Error al subir el logo');
      },
    });
  }

  quitarLogo() {
    this.subiendoLogo.set(true);
    this.msgLogo.set(null);
    this.avSvc.quitarLogoPortal().subscribe({
      next: ({ config }) => {
        this.portal.set(config);
        this.subiendoLogo.set(false);
        this.msgLogoErr.set(false);
        this.msgLogo.set('Logo eliminado.');
      },
      error: (e) => {
        this.subiendoLogo.set(false);
        this.msgLogoErr.set(true);
        this.msgLogo.set(e?.error?.message || 'Error al eliminar el logo');
      },
    });
  }
}
