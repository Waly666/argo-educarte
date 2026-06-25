import { CommonModule, IMAGE_CONFIG } from '@angular/common';
import { Component, OnInit, QueryList, ViewChildren, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

import {
  ORIENTACIONES_CERTIFICADO,
  TIPOS_CERTIFICADO_PRINCIPALES,
  TipoCertificadoId,
  OrientacionCertificado,
  labelTipoCert,
  labelOrientacion,
} from '../../core/constants/tipos-certificado';
import { LayoutPorTipoCert } from '../../core/constants/certificado-campos-layout';
import {
  QR_DEFAULT_SIZE_PCT,
  clampQrSizePct,
  sizePxLegacyToPct,
} from '../../core/utils/certificado-qr';
import {
  ConfigCertificado,
  ConfigCertificadoService,
  PlantillaCertificado,
  PlantillaPorTipoSlot,
  QR_POSICIONES_CERT,
  TipoCapacitacionOpcion,
} from '../../core/services/config-certificado.service';
import { CertificadoLayoutEditorComponent } from './certificado-layout-editor.component';
import { ConfirmDialogService } from '../../shared/confirm-dialog/confirm-dialog.service';
import { ArgoSwitchComponent } from '../../shared/argo-switch/argo-switch.component';

@Component({
  selector: 'argo-config-certificados',
  standalone: true,
  imports: [CommonModule, FormsModule, CertificadoLayoutEditorComponent, ArgoSwitchComponent],
  templateUrl: './config-certificados.component.html',
  styleUrls: ['./config-certificados.component.scss'],
  providers: [
    {
      provide: IMAGE_CONFIG,
      useValue: { disableOversizedImageWarnings: true },
    },
  ],
})
export class ConfigCertificadosComponent implements OnInit {
  private cfgSvc = inject(ConfigCertificadoService);
  private confirm = inject(ConfirmDialogService);
  private http = inject(HttpClient);

  readonly anioActual = String(new Date().getFullYear());

  marcandoVencidos = signal(false);
  msgVencidos = signal<string | null>(null);
  msgVencidosError = signal(false);

  marcarVencidosAhora() {
    if (this.marcandoVencidos()) return;
    this.marcandoVencidos.set(true);
    this.msgVencidos.set(null);
    this.http.post<{ ok: boolean; actualizados: number; message: string }>(
      `${environment.apiUrl}/certificados/admin/marcar-vencidos`, {}
    ).subscribe({
      next: (res) => {
        this.marcandoVencidos.set(false);
        this.msgVencidos.set(res.message);
        this.msgVencidosError.set(false);
      },
      error: (e) => {
        this.marcandoVencidos.set(false);
        this.msgVencidos.set(e?.error?.message || 'Error al ejecutar el proceso.');
        this.msgVencidosError.set(true);
      },
    });
  }

  @ViewChildren(CertificadoLayoutEditorComponent)
  private layoutEditors?: QueryList<CertificadoLayoutEditorComponent>;

  tiposPrincipales = TIPOS_CERTIFICADO_PRINCIPALES;
  orientaciones = ORIENTACIONES_CERTIFICADO;
  qrPosiciones = QR_POSICIONES_CERT;
  labelTipo = labelTipoCert;
  labelOrientacion = labelOrientacion;
  clampQrPct = clampQrSizePct;

  form = signal<ConfigCertificado>({
    plantillaPorTipo: {},
    layoutPorTipo: {},
    mostrarQr: true,
    qrPosicion: 'inferior_izquierda',
    qrTamanoPct: QR_DEFAULT_SIZE_PCT,
    qrTamanoPx: 72,
    diasAvisoCertificadoPorVencer: 15,
    diasAvisoCertificadoVencido: 3,
  });
  plantillas = signal<PlantillaCertificado[]>([]);
  tiposCapacitacion = signal<TipoCapacitacionOpcion[]>([]);
  saving = signal(false);
  loading = signal(true);
  msg = signal<string | null>(null);
  msgError = signal(false);
  subiendo = signal<TipoCertificadoId | null>(null);

  plantillasAsignadas = computed(() => {
    const ppt = this.form().plantillaPorTipo || {};
    return Object.values(ppt).filter((s) => s?.id).length;
  });

  previewCodigoCertificado(): string {
    const f = this.form();
    const partes: string[] = [];
    if (f.usarPrefijoCertificado !== false) {
      partes.push((f.prefijoCertificado || 'CERT').trim() || 'CERT');
    }
    if (f.usarSegundoPrefijoCertificado) {
      partes.push(String(f.segundoPrefijoCertificado || '').trim() || this.anioActual);
    }
    const n = String(f.consecutivoCertificado ?? 0).padStart(6, '0');
    return partes.length ? `${partes.join('-')}-${n}` : n;
  }

  /** Formatos que se pueden certificar automáticamente al pagar (jornada se certifica por asistencia). */
  tiposAutoCert = [
    ...TIPOS_CERTIFICADO_PRINCIPALES.filter((t) => t.id !== 'jornada_capacitacion'),
    { id: 'mercancias_peligrosas' as TipoCertificadoId, label: 'Mercancías peligrosas' },
  ];

  ngOnInit(): void {
    this.cfgSvc.obtener().subscribe({
      next: (c) => {
        this.form.set({
          ...c,
          plantillaPorTipo: { ...(c.plantillaPorTipo || {}) },
          layoutPorTipo: { ...(c.layoutPorTipo || {}) },
          autoCertificadoPorTipo: { ...(c.autoCertificadoPorTipo || {}) },
          autoCertificadoTiposCapExcluidos: [...(c.autoCertificadoTiposCapExcluidos || [])],
          segundoPrefijoCertificado: c.segundoPrefijoCertificado?.trim() || this.anioActual,
          qrTamanoPct:
            c.qrTamanoPct != null
              ? clampQrSizePct(c.qrTamanoPct)
              : sizePxLegacyToPct(c.qrTamanoPx ?? 72, 'vertical'),
        });
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.msgError.set(true);
        this.msg.set(e?.error?.message || 'Error cargando configuración.');
      },
    });
    this.cargarPlantillas();
    this.cfgSvc.listarTiposCapacitacion().subscribe({
      next: (r) => this.tiposCapacitacion.set(r || []),
    });
  }

  autoActivo(tipo: TipoCertificadoId): boolean {
    return this.form().autoCertificadoPorTipo?.[tipo] === true;
  }

  toggleAuto(tipo: TipoCertificadoId, activo: boolean) {
    const map = { ...(this.form().autoCertificadoPorTipo || {}) };
    map[tipo] = activo;
    this.patch('autoCertificadoPorTipo', map);
  }

  tipoCapExcluido(idTipCap: string): boolean {
    return (this.form().autoCertificadoTiposCapExcluidos || []).includes(idTipCap);
  }

  toggleTipoCapExcluido(idTipCap: string, excluir: boolean) {
    const set = new Set(this.form().autoCertificadoTiposCapExcluidos || []);
    if (excluir) set.add(idTipCap);
    else set.delete(idTipCap);
    this.patch('autoCertificadoTiposCapExcluidos', [...set]);
  }

  cargarPlantillas() {
    this.cfgSvc.listarPlantillasTodas().subscribe({
      next: (r) => {
        this.plantillas.set(r || []);
        this.syncOrientacionConPlantilla();
      },
    });
  }

  /** Alinea la orientación del slot con la plantilla PNG real (la que usa la impresión). */
  private syncOrientacionConPlantilla() {
    const ppt = { ...(this.form().plantillaPorTipo || {}) };
    let changed = false;
    for (const t of [...this.tiposPrincipales, { id: 'mercancias_peligrosas' as TipoCertificadoId }]) {
      const slot = ppt[t.id];
      if (!slot?.id) continue;
      const p = this.plantillaDoc(slot.id);
      if (p && (p.orientacion === 'vertical' || p.orientacion === 'horizontal') && slot.orientacion !== p.orientacion) {
        ppt[t.id] = { ...slot, orientacion: p.orientacion };
        changed = true;
      }
    }
    if (changed) this.patch('plantillaPorTipo', ppt);
  }

  patchNumeroAlerta(campo: 'diasAvisoCertificadoPorVencer' | 'diasAvisoCertificadoVencido', val: unknown, max: number) {
    const n = Math.max(1, Math.min(max, Number(val) || 1));
    this.patch(campo, n);
  }

  patch<K extends keyof ConfigCertificado>(k: K, v: ConfigCertificado[K]) {
    this.form.update((f) => ({ ...f, [k]: v }));
  }

  slotTipo(tipo: TipoCertificadoId): PlantillaPorTipoSlot {
    const s = this.form().plantillaPorTipo?.[tipo];
    return {
      orientacion: s?.orientacion === 'horizontal' ? 'horizontal' : 'vertical',
      id: s?.id || null,
    };
  }

  plantillaDoc(id?: string | null): PlantillaCertificado | undefined {
    if (!id) return undefined;
    return this.plantillas().find((p) => p._id === id);
  }

  private patchSlot(tipo: TipoCertificadoId, slot: Partial<PlantillaPorTipoSlot>) {
    const ppt = { ...(this.form().plantillaPorTipo || {}) };
    ppt[tipo] = { ...this.slotTipo(tipo), ...slot };
    this.patch('plantillaPorTipo', ppt);
  }

  onOrientacionTipo(tipo: TipoCertificadoId, orientacion: OrientacionCertificado) {
    const actual = this.plantillaDoc(this.slotTipo(tipo).id);
    let id = this.slotTipo(tipo).id;
    if (actual && actual.orientacion !== orientacion) {
      const otra = this.plantillas().find(
        (p) => p.tipoCertificado === tipo && p.orientacion === orientacion && p.activa !== false,
      );
      id = otra?._id || null;
    }
    this.patchSlot(tipo, { orientacion, id });
  }

  onFormatoFondo(tipo: TipoCertificadoId, ev: Event) {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const slot = this.slotTipo(tipo);
    this.subiendo.set(tipo);
    this.msg.set(null);
    this.msgError.set(false);

    const existente = this.plantillaDoc(slot.id);
    const nombre = `${this.labelTipo(tipo)} (${this.labelOrientacion(slot.orientacion)})`;
    const fd = new FormData();
    fd.append('nombre', nombre);
    fd.append('tipoCertificado', tipo);
    fd.append('orientacion', slot.orientacion);
    fd.append('fondo', file);

    const req =
      existente?._id && existente.orientacion === slot.orientacion
        ? this.cfgSvc.actualizarPlantilla(existente._id, fd)
        : this.cfgSvc.crearPlantilla(fd);

    req.subscribe({
      next: (p) => {
        this.subiendo.set(null);
        (ev.target as HTMLInputElement).value = '';
        this.cargarPlantillas();
        this.patchSlot(tipo, { id: p._id, orientacion: slot.orientacion });
        this.persistirSlotPlantilla(tipo);
      },
      error: (e) => {
        this.subiendo.set(null);
        this.msgError.set(true);
        this.msg.set(e?.error?.message || 'Error subiendo formato.');
      },
    });
  }

  private persistirSlotPlantilla(tipo: TipoCertificadoId) {
    const ppt = { ...(this.form().plantillaPorTipo || {}) };
    this.cfgSvc.guardar({ plantillaPorTipo: ppt }).subscribe({
      next: (c) => {
        this.form.update((f) => ({
          ...f,
          plantillaPorTipo: { ...(c.plantillaPorTipo || {}) },
        }));
        this.msgError.set(false);
        this.msg.set(`Formato «${this.labelTipo(tipo)}» guardado. Ajuste el paso 2 si hace falta y pulse Guardar.`);
      },
      error: (e) => {
        this.msgError.set(true);
        this.msg.set(e?.error?.message || 'Formato subido pero no se pudo guardar en la configuración.');
      },
    });
  }

  async quitarFormato(tipo: TipoCertificadoId) {
    const slot = this.slotTipo(tipo);
    if (!slot.id) return;
    const ok = await this.confirm.open({
      title: 'Quitar formato',
      message: `¿Quitar el formato de «${this.labelTipo(tipo)}»?`,
      confirmLabel: 'Quitar',
      variant: 'danger',
    });
    if (!ok) return;
    this.cfgSvc.eliminarPlantilla(slot.id).subscribe({
      next: () => {
        this.patchSlot(tipo, { id: null });
        this.cargarPlantillas();
        this.msgError.set(false);
        this.msg.set('Formato quitado. Guarde la configuración.');
      },
      error: (e) => {
        this.msgError.set(true);
        this.msg.set(e?.error?.message || 'Error.');
      },
    });
  }

  /** Orientación del layout = la de la plantilla PNG (la que usa la impresión). */
  orientacionLayout(tipo: TipoCertificadoId): OrientacionCertificado {
    const p = this.plantillaDoc(this.slotTipo(tipo).id);
    if (p?.orientacion === 'horizontal' || p?.orientacion === 'vertical') {
      return p.orientacion;
    }
    return this.slotTipo(tipo).orientacion;
  }

  private layoutParaGuardar(): ConfigCertificado['layoutPorTipo'] {
    let layout = JSON.parse(JSON.stringify(this.form().layoutPorTipo || {})) as LayoutPorTipoCert;
    for (const ed of this.layoutEditors ?? []) {
      layout = ed.snapshotLayoutPorTipo(layout);
    }
    return layout;
  }

  guardar() {
    this.saving.set(true);
    this.msg.set(null);
    this.msgError.set(false);
    const payload = { ...this.form(), layoutPorTipo: this.layoutParaGuardar() };
    this.patch('layoutPorTipo', payload.layoutPorTipo);
    this.cfgSvc.guardar(payload).subscribe({
      next: (c) => {
        this.form.set({
          ...c,
          plantillaPorTipo: { ...(c.plantillaPorTipo || {}) },
          layoutPorTipo: { ...(c.layoutPorTipo || {}) },
        });
        this.saving.set(false);
        this.msgError.set(false);
        this.msg.set('Configuración guardada.');
      },
      error: (e) => {
        this.saving.set(false);
        this.msgError.set(true);
        this.msg.set(e?.error?.message || 'Error al guardar.');
      },
    });
  }

  onFirmaDirector(ev: Event) {
    const f = (ev.target as HTMLInputElement).files?.[0];
    if (!f) return;
    const fd = new FormData();
    fd.append('firmaDirector', f);
    this.subirFirmas(fd);
  }

  onFirmaInstructor(ev: Event) {
    const f = (ev.target as HTMLInputElement).files?.[0];
    if (!f) return;
    const fd = new FormData();
    fd.append('firmaInstructor', f);
    this.subirFirmas(fd);
  }

  private subirFirmas(fd: FormData) {
    this.cfgSvc.guardarFirmas(fd).subscribe({
      next: (c) => {
        this.form.set({
          ...c,
          plantillaPorTipo: { ...(c.plantillaPorTipo || {}) },
          layoutPorTipo: { ...(c.layoutPorTipo || {}) },
        });
        this.msgError.set(false);
        this.msg.set('Firma actualizada.');
      },
      error: (e) => {
        this.msgError.set(true);
        this.msg.set(e?.error?.message || 'Error subiendo firma.');
      },
    });
  }

  urlFondo(p: PlantillaCertificado) {
    return this.cfgSvc.urlFondo(p.urlFondo);
  }

  urlFirma(path?: string) {
    return this.cfgSvc.urlFondo(path);
  }

  subiendoTipo(tipo: TipoCertificadoId): boolean {
    return this.subiendo() === tipo;
  }

  onLayoutChange(layout: LayoutPorTipoCert) {
    this.patch('layoutPorTipo', layout);
  }

  urlFondoAbs(p?: PlantillaCertificado): string {
    if (!p?.urlFondo) return '';
    return this.urlFondo(p);
  }
}
