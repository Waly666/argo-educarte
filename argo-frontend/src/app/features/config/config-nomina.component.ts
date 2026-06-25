import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import {
  ConfigNomina,
  ConfigService,
  FspTramo,
  RetencionTramo,
} from '../../core/services/config.service';
import { ConfirmDialogService } from '../../shared/confirm-dialog/confirm-dialog.service';

type FormNomina = ConfigNomina & {
  saludEmpleadoPctUi?: number;
  pensionEmpleadoPctUi?: number;
  saludEmpleadorPctUi?: number;
  pensionEmpleadorPctUi?: number;
  senaPctUi?: number;
  icbfPctUi?: number;
  ccfPctUi?: number;
  provisionCesantiasPctUi?: number;
  provisionPrimaPctUi?: number;
  provisionVacacionesPctUi?: number;
  provisionIntCesantiasPctUi?: number;
  arl1Ui?: number;
  arl2Ui?: number;
  arl3Ui?: number;
  arl4Ui?: number;
  arl5Ui?: number;
};

@Component({
  selector: 'argo-config-nomina',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './config-nomina.component.html',
  styleUrls: ['./config-nomina.component.scss'],
})
export class ConfigNominaComponent implements OnInit {
  private cfgSvc = inject(ConfigService);
  private confirm = inject(ConfirmDialogService);

  form = signal<FormNomina>({});
  meta = signal<{ fuente?: string; actualizado?: string | null }>({});
  saving = signal(false);
  loading = signal(true);
  msg = signal<string | null>(null);
  msgError = signal(false);

  ngOnInit(): void {
    this.cargar();
  }

  cargar() {
    this.loading.set(true);
    this.cfgSvc.obtenerNomina().subscribe({
      next: (c) => {
        this.form.set(this.toForm(c));
        this.meta.set({ fuente: c._fuente, actualizado: c._actualizadoEn ?? null });
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.msgError.set(true);
        this.msg.set('No se pudo cargar la configuración de nómina');
      },
    });
  }

  private pctUi(dec?: number): number {
    return Math.round((dec ?? 0) * 10000) / 100;
  }

  private pctDec(ui?: number): number {
    return Math.round((ui ?? 0) * 100) / 10000;
  }

  private toForm(c: ConfigNomina): FormNomina {
    const arl = c.arlRiesgoPct || {};
    return {
      ...c,
      fspTramos: (c.fspTramos || []).map((t) => ({
        ...t,
        hastaSmmlv: t.hastaSmmlv == null ? null : t.hastaSmmlv,
      })),
      retencionTramos: (c.retencionTramos || []).map((t) => ({
        ...t,
        hastaUvt: t.hastaUvt == null ? null : t.hastaUvt,
      })),
      saludEmpleadoPctUi: this.pctUi(c.saludEmpleadoPct),
      pensionEmpleadoPctUi: this.pctUi(c.pensionEmpleadoPct),
      saludEmpleadorPctUi: this.pctUi(c.saludEmpleadorPct),
      pensionEmpleadorPctUi: this.pctUi(c.pensionEmpleadorPct),
      senaPctUi: this.pctUi(c.senaPct),
      icbfPctUi: this.pctUi(c.icbfPct),
      ccfPctUi: this.pctUi(c.ccfPct),
      provisionCesantiasPctUi: this.pctUi(c.provisionCesantiasPct),
      provisionPrimaPctUi: this.pctUi(c.provisionPrimaPct),
      provisionVacacionesPctUi: this.pctUi(c.provisionVacacionesPct),
      provisionIntCesantiasPctUi: this.pctUi(c.provisionIntCesantiasPct),
      arl1Ui: this.pctUi(arl['1'] ?? arl[1]),
      arl2Ui: this.pctUi(arl['2'] ?? arl[2]),
      arl3Ui: this.pctUi(arl['3'] ?? arl[3]),
      arl4Ui: this.pctUi(arl['4'] ?? arl[4]),
      arl5Ui: this.pctUi(arl['5'] ?? arl[5]),
    };
  }

  private toApi(f: FormNomina): ConfigNomina {
    const {
      saludEmpleadoPctUi,
      pensionEmpleadoPctUi,
      saludEmpleadorPctUi,
      pensionEmpleadorPctUi,
      senaPctUi,
      icbfPctUi,
      ccfPctUi,
      provisionCesantiasPctUi,
      provisionPrimaPctUi,
      provisionVacacionesPctUi,
      provisionIntCesantiasPctUi,
      arl1Ui,
      arl2Ui,
      arl3Ui,
      arl4Ui,
      arl5Ui,
      _fuente,
      _actualizadoEn,
      ...rest
    } = f;
    return {
      ...rest,
      saludEmpleadoPct: this.pctDec(saludEmpleadoPctUi),
      pensionEmpleadoPct: this.pctDec(pensionEmpleadoPctUi),
      saludEmpleadorPct: this.pctDec(saludEmpleadorPctUi),
      pensionEmpleadorPct: this.pctDec(pensionEmpleadorPctUi),
      senaPct: this.pctDec(senaPctUi),
      icbfPct: this.pctDec(icbfPctUi),
      ccfPct: this.pctDec(ccfPctUi),
      provisionCesantiasPct: this.pctDec(provisionCesantiasPctUi),
      provisionPrimaPct: this.pctDec(provisionPrimaPctUi),
      provisionVacacionesPct: this.pctDec(provisionVacacionesPctUi),
      provisionIntCesantiasPct: this.pctDec(provisionIntCesantiasPctUi),
      arlRiesgoPct: {
        1: this.pctDec(arl1Ui),
        2: this.pctDec(arl2Ui),
        3: this.pctDec(arl3Ui),
        4: this.pctDec(arl4Ui),
        5: this.pctDec(arl5Ui),
      },
      fspTramos: (f.fspTramos || []).map((t) => ({
        desdeSmmlv: Number(t.desdeSmmlv) || 0,
        hastaSmmlv:
          t.hastaSmmlv == null || (t.hastaSmmlv as unknown) === '' ? null : Number(t.hastaSmmlv),
        pct: Number(t.pct) || 0,
      })),
      retencionTramos: (f.retencionTramos || []).map((t) => ({
        hastaUvt: t.hastaUvt == null || (t.hastaUvt as unknown) === '' ? null : Number(t.hastaUvt),
        baseUvt: Number(t.baseUvt) || 0,
        pct: Number(t.pct) || 0,
      })),
    };
  }

  formatCop(n?: number): string {
    if (n == null || Number.isNaN(n)) return '—';
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(n);
  }

  fuenteLabel(): string {
    return this.meta().fuente === 'base_datos' ? 'base de datos' : 'valores por defecto';
  }

  patch(k: keyof FormNomina, v: unknown) {
    this.form.update((f) => ({ ...f, [k]: v }));
  }

  patchFsp(i: number, k: keyof FspTramo, v: unknown) {
    this.form.update((f) => {
      const rows = [...(f.fspTramos || [])];
      rows[i] = { ...rows[i], [k]: v };
      return { ...f, fspTramos: rows };
    });
  }

  patchFspPct(i: number, pctUi: number) {
    this.form.update((f) => {
      const rows = [...(f.fspTramos || [])];
      rows[i] = { ...rows[i], pct: this.pctDec(pctUi) };
      return { ...f, fspTramos: rows };
    });
  }

  fspPctUi(t: FspTramo): number {
    return this.pctUi(t.pct);
  }

  patchRet(i: number, k: keyof RetencionTramo, v: unknown) {
    this.form.update((f) => {
      const rows = [...(f.retencionTramos || [])];
      rows[i] = { ...rows[i], [k]: v };
      return { ...f, retencionTramos: rows };
    });
  }

  patchRetPct(i: number, pctUi: number) {
    this.form.update((f) => {
      const rows = [...(f.retencionTramos || [])];
      rows[i] = { ...rows[i], pct: this.pctDec(pctUi) };
      return { ...f, retencionTramos: rows };
    });
  }

  retPctUi(t: RetencionTramo): number {
    return this.pctUi(t.pct);
  }

  agregarFsp() {
    this.form.update((f) => ({
      ...f,
      fspTramos: [...(f.fspTramos || []), { desdeSmmlv: 4, hastaSmmlv: 16, pct: 0.01 }],
    }));
  }

  quitarFsp(i: number) {
    this.form.update((f) => ({
      ...f,
      fspTramos: (f.fspTramos || []).filter((_, idx) => idx !== i),
    }));
  }

  agregarRet() {
    this.form.update((f) => ({
      ...f,
      retencionTramos: [...(f.retencionTramos || []), { hastaUvt: 150, baseUvt: 0, pct: 0.19 }],
    }));
  }

  quitarRet(i: number) {
    this.form.update((f) => ({
      ...f,
      retencionTramos: (f.retencionTramos || []).filter((_, idx) => idx !== i),
    }));
  }

  guardar() {
    this.saving.set(true);
    this.msg.set(null);
    this.msgError.set(false);
    this.cfgSvc.guardarNomina(this.toApi(this.form())).subscribe({
      next: (c) => {
        this.form.set(this.toForm(c));
        this.meta.set({ fuente: 'base_datos', actualizado: new Date().toISOString() });
        this.saving.set(false);
        this.msgError.set(false);
        this.msg.set('Parámetros de nómina guardados. Regeneré y liquide períodos abiertos si aplica.');
      },
      error: (e) => {
        this.saving.set(false);
        this.msgError.set(true);
        this.msg.set(e?.error?.message || 'Error al guardar');
      },
    });
  }

  async restaurar() {
    const ok = await this.confirm.open({
      title: 'Restaurar valores por defecto',
      message:
        '¿Reemplazar la configuración de nómina con los valores por defecto del sistema? Los períodos ya liquidados no se recalculan solos.',
      variant: 'danger',
      confirmLabel: 'Restaurar',
    });
    if (!ok) return;
    this.saving.set(true);
    this.msg.set(null);
    this.msgError.set(false);
    this.cfgSvc.restaurarNominaDefaults().subscribe({
      next: (c) => {
        this.form.set(this.toForm(c));
        this.saving.set(false);
        this.msgError.set(false);
        this.msg.set('Valores por defecto restaurados.');
      },
      error: (e) => {
        this.saving.set(false);
        this.msgError.set(true);
        this.msg.set(e?.error?.message || 'Error');
      },
    });
  }
}
