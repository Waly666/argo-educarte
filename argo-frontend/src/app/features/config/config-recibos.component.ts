import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { ConfigRecibo, ConfigService } from '../../core/services/config.service';
import { ArgoSwitchComponent } from '../../shared/argo-switch/argo-switch.component';

@Component({
  selector: 'argo-config-recibos',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ArgoSwitchComponent],
  templateUrl: './config-recibos.component.html',
  styleUrls: ['./config-recibos.component.scss'],
})
export class ConfigRecibosComponent implements OnInit {
  private cfgSvc = inject(ConfigService);

  readonly anioActual = String(new Date().getFullYear());

  readonly formatosComprobante = [
    { id: 'validadora', label: 'Validadora (térmica ~80 mm)' },
    { id: 'media_carta', label: 'Media carta (14 × 21,6 cm)' },
  ] as const;

  form = signal<ConfigRecibo>({});
  loading = signal(true);
  saving = signal(false);
  msg = signal<string | null>(null);
  msgError = signal(false);

  ngOnInit(): void {
    this.cfgSvc.obtenerRecibo().subscribe({
      next: (c) => {
        this.form.set({
          ...c,
          permitirAjusteValorMatricula: c.permitirAjusteValorMatricula !== false,
          permitirAjusteCuotasSemestre: c.permitirAjusteCuotasSemestre === true,
          segundoPrefijoComprobanteIngreso:
            c.segundoPrefijoComprobanteIngreso?.trim() || this.anioActual,
          segundoPrefijoComprobanteEgreso:
            c.segundoPrefijoComprobanteEgreso?.trim() || this.anioActual,
        });
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.msgError.set(true);
        this.msg.set('No se pudo cargar la configuración');
      },
    });
  }

  formatoLabel(id?: string): string {
    const found = this.formatosComprobante.find((f) => f.id === (id || 'validadora'));
    return found?.label.replace(/\s*\(.*\)/, '') ?? 'Validadora';
  }

  previewNum(prefijo?: string, consecutivo?: number): string {
    const p = (prefijo || '—').trim() || '—';
    const n = String(consecutivo ?? 0).padStart(6, '0');
    return `${p}-${n}`;
  }

  previewComprobante(tipo: 'ingreso' | 'egreso'): string {
    const f = this.form();
    const partes: string[] = [];
    const usarPrimero =
      tipo === 'ingreso'
        ? f.usarPrefijoComprobanteIngreso !== false
        : f.usarPrefijoComprobanteEgreso !== false;
    const prefijo =
      tipo === 'ingreso' ? f.prefijoComprobanteIngreso : f.prefijoComprobanteEgreso;
    const consecutivo =
      tipo === 'ingreso' ? f.consecutivoComprobanteIngreso : f.consecutivoComprobanteEgreso;
    const usarSegundo =
      tipo === 'ingreso'
        ? !!f.usarSegundoPrefijoComprobanteIngreso
        : !!f.usarSegundoPrefijoComprobanteEgreso;
    const segundo =
      tipo === 'ingreso'
        ? f.segundoPrefijoComprobanteIngreso
        : f.segundoPrefijoComprobanteEgreso;
    if (usarPrimero) {
      partes.push((prefijo || 'DOC').trim() || 'DOC');
    }
    if (usarSegundo) {
      partes.push(String(segundo || '').trim() || this.anioActual);
    }
    const n = String(consecutivo ?? 0).padStart(6, '0');
    return partes.length ? `${partes.join('-')}-${n}` : n;
  }

  patch<K extends keyof ConfigRecibo>(k: K, v: ConfigRecibo[K]) {
    this.form.update((f) => ({ ...f, [k]: v }));
  }

  usaValidadora(tipo: 'ingreso' | 'egreso'): boolean {
    const f = this.form();
    const key = tipo === 'ingreso' ? 'formatoComprobanteIngreso' : 'formatoComprobanteEgreso';
    return (f[key] || 'validadora') === 'validadora';
  }

  guardar() {
    this.saving.set(true);
    this.msg.set(null);
    this.msgError.set(false);
    this.cfgSvc.guardarRecibo(this.form()).subscribe({
      next: (c) => {
        this.form.set({
          ...c,
          permitirAjusteValorMatricula: c.permitirAjusteValorMatricula !== false,
          permitirAjusteCuotasSemestre: c.permitirAjusteCuotasSemestre === true,
          segundoPrefijoComprobanteIngreso:
            c.segundoPrefijoComprobanteIngreso?.trim() || this.anioActual,
          segundoPrefijoComprobanteEgreso:
            c.segundoPrefijoComprobanteEgreso?.trim() || this.anioActual,
        });
        this.saving.set(false);
        this.msgError.set(false);
        this.msg.set('Configuración guardada.');
      },
      error: (e) => {
        this.saving.set(false);
        this.msgError.set(true);
        this.msg.set(e?.error?.message || 'Error al guardar');
      },
    });
  }
}
