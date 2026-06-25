import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnInit,
  Output,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

import {
  CAMPOS_CERTIFICADO_LAYOUT,
  CampoCertificadoId,
  CampoLayoutCert,
  EditorSeleccion,
  FUENTES_CERTIFICADO,
  FUENTE_CERTIFICADO_DEFAULT,
  ensureCertificadoGoogleFonts,
  TAMANO_FUENTE_MAX_PT,
  TAMANO_FUENTE_MIN_PT,
  LayoutDefaultsApi,
  LayoutOrientacionCert,
  LayoutPorTipoCert,
  QR_ESQUINAS,
  QrLayoutCert,
} from '../../core/constants/certificado-campos-layout';
import {
  ORIENTACIONES_CERTIFICADO,
  OrientacionCertificado,
  TIPOS_CERTIFICADO,
  TipoCertificadoId,
  labelOrientacion,
  labelTipoCert,
} from '../../core/constants/tipos-certificado';
import { ConfigCertificadoService } from '../../core/services/config-certificado.service';
import { ConfirmDialogService } from '../../shared/confirm-dialog/confirm-dialog.service';
import { fsToEditorFontSize } from '../../core/utils/certificado-tipografia';
import {
  QR_DEFAULT_SIZE_PCT,
  QR_SIZE_PCT_MAX,
  QR_SIZE_PCT_MIN,
  clampQrSizePct,
  qrSizePctToMm,
  qrSizeToEditorWidth,
  resolveQrSizePct,
} from '../../core/utils/certificado-qr';

@Component({
  selector: 'argo-certificado-layout-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './certificado-layout-editor.component.html',
  styleUrls: ['./certificado-layout-editor.component.scss'],
})
export class CertificadoLayoutEditorComponent implements OnInit {
  private cfgSvc = inject(ConfigCertificadoService);
  private sanitizer = inject(DomSanitizer);
  private confirm = inject(ConfirmDialogService);

  @Input({ required: true }) tipo!: TipoCertificadoId;
  @Input({ required: true }) orientacion!: OrientacionCertificado;
  @Input() urlFondoPreview = '';
  /** Ruta relativa del PNG (certificados/…); la vista previa la necesita sin URL absoluta. */
  @Input() urlFondoRel = '';
  @Input() layoutPorTipo: LayoutPorTipoCert = {};
  @Input() mostrarQr = true;
  @Input() qrPosicionGlobal: string = 'inferior_izquierda';
  @Input() qrTamanoGlobalPct = QR_DEFAULT_SIZE_PCT;
  @Output() layoutChange = new EventEmitter<LayoutPorTipoCert>();

  @ViewChild('certCanvas') certCanvas?: ElementRef<HTMLElement>;

  qrSizeMin = QR_SIZE_PCT_MIN;
  qrSizeMax = QR_SIZE_PCT_MAX;

  campos = CAMPOS_CERTIFICADO_LAYOUT;
  fuenteMinPt = TAMANO_FUENTE_MIN_PT;
  fuenteMaxPt = TAMANO_FUENTE_MAX_PT;
  qrPosMin = 2;
  qrPosMax = 90;
  qrEsquinas = QR_ESQUINAS;
  fuentes = FUENTES_CERTIFICADO;
  fuenteDefault = FUENTE_CERTIFICADO_DEFAULT;
  labelTipo = labelTipoCert;
  labelOri = labelOrientacion;

  abierto = signal(false);
  copiarDesdeKey = signal('');
  copyMsg = signal<string | null>(null);
  campoSel = signal<EditorSeleccion>('nombre');
  textoSel = computed(() => {
    const s = this.campoSel();
    return s === 'qr' ? null : s;
  });
  defaults = signal<LayoutDefaultsApi | null>(null);
  previewHtml = signal<string | null>(null);
  cargandoPreview = signal(false);
  arrastrando = signal(false);
  /** Posición/tamaño en vivo durante arrastre (sin guardar hasta soltar). */
  dragVista = signal<{
    texto?: Partial<
      Record<
        CampoCertificadoId,
        {
          top?: number;
          bottom?: number;
          left?: number;
          right?: number;
          w?: number;
          fs?: number;
          mantenerCentro?: boolean;
        }
      >
    >;
    qr?: {
      top?: number;
      bottom?: number;
      left?: number;
      right?: number;
      sizePct?: number;
    };
  } | null>(null);

  private readonly umbralArrastrePx = 4;
  private readonly umbralDesanclarCentroPct = 0.35;

  ngOnInit(): void {
    ensureCertificadoGoogleFonts();
    this.cfgSvc.layoutDefaults().subscribe({ next: (d) => this.defaults.set(d) });
  }

  abrirEditor() {
    ensureCertificadoGoogleFonts();
    const abrir = () => {
      this.materializarTipografiaEnCampos();
      this.abierto.set(true);
    };
    if (this.defaults()) abrir();
    else {
      this.cfgSvc.layoutDefaults().subscribe({
        next: (d) => {
          this.defaults.set(d);
          abrir();
        },
      });
    }
  }

  esQrSel(): boolean {
    return this.campoSel() === 'qr';
  }

  seleccionar(id: EditorSeleccion) {
    this.campoSel.set(id);
  }

  labelCampo(id: CampoCertificadoId): string {
    return this.campos.find((c) => c.id === id)?.label || id;
  }

  private slotFrom(layout: LayoutPorTipoCert): LayoutOrientacionCert {
    return layout?.[this.tipo]?.[this.orientacion] || {};
  }

  private slot(): LayoutOrientacionCert {
    return this.slotFrom(this.layoutPorTipo);
  }

  /** Mezcla campos guardados en `campos` con valores legados en la raíz del slot. */
  private campoFrom(layout: LayoutPorTipoCert, id: CampoCertificadoId): CampoLayoutCert {
    const s = this.slotFrom(layout);
    const legacy = (s as LayoutOrientacionCert & Record<string, CampoLayoutCert | undefined>)[id];
    const modern = s.campos?.[id];
    if (modern != null && legacy != null && typeof modern === 'object' && typeof legacy === 'object') {
      return { ...legacy, ...modern };
    }
    return modern ?? legacy ?? {};
  }

  campo(id: CampoCertificadoId): CampoLayoutCert {
    return this.campoFrom(this.layoutPorTipo, id);
  }

  /** Mezcla guardado + defaults del API (posición y tipografía efectivas). */
  private campoEfectivoFrom(layout: LayoutPorTipoCert, id: CampoCertificadoId): CampoLayoutCert {
    const c = this.campoFrom(layout, id);
    const d = this.defectoCampo(id) as CampoLayoutCert;
    const out: CampoLayoutCert = { visible: c.visible !== false };

    const hasTop = c.top != null && String(c.top).trim() !== '';
    const hasBottom = c.bottom != null && String(c.bottom).trim() !== '';
    if (hasTop || c.bottom === null) {
      if (hasTop) out.top = c.top;
      else if (d.top) out.top = d.top;
    } else if (hasBottom || c.top === null) {
      if (hasBottom) out.bottom = c.bottom;
      else if (d.bottom) out.bottom = d.bottom;
    } else if (d.top) {
      out.top = d.top;
    } else if (d.bottom) {
      out.bottom = d.bottom;
    }

    const hasLeft = c.left != null && String(c.left).trim() !== '';
    const hasRight = c.right != null && String(c.right).trim() !== '';
    if (hasLeft) out.left = c.left;
    else if (hasRight) out.right = c.right;
    else if (d.left) out.left = d.left;
    else if (d.right) out.right = d.right;

    if (c.w) out.w = c.w;
    else if (d.w) out.w = d.w;
    if (c.align) out.align = c.align;
    else if (d.align) out.align = d.align;
    if (c.fs) out.fs = c.fs;
    else if (d.fs) out.fs = d.fs;
    if (c.fw) out.fw = c.fw;
    else if (d.fw) out.fw = d.fw;
    if (c.ls) out.ls = c.ls;
    else if (d.ls) out.ls = d.ls;
    if (c.fontFamily) out.fontFamily = c.fontFamily;
    else if (d.fontFamily) out.fontFamily = d.fontFamily;
    if (c.color) out.color = c.color;
    return out;
  }

  private campoEfectivo(id: CampoCertificadoId): CampoLayoutCert {
    return this.campoEfectivoFrom(this.layoutPorTipo, id);
  }
  private presetQr(esquina: string): QrLayoutCert {
    const defs = this.defaults();
    const ori = this.orientacion === 'horizontal' ? 'horizontal' : 'vertical';
    const map = defs?.qr?.[ori] as Record<string, QrLayoutCert> | undefined;
    return (map?.[esquina] as QrLayoutCert) || { bottom: '2.5%', left: '2.5%' };
  }

  qrGuardado(): QrLayoutCert {
    return this.slot().qr || {};
  }

  /** Valores efectivos (guardados + preset global), con un solo ancla vertical y uno horizontal. */
  qrEfectivo(): QrLayoutCert {
    const q = this.qrGuardado();
    const preset = this.presetQr(this.qrPosicionGlobal);
    const sizePct = resolveQrSizePct(
      q,
      this.orientacion,
      this.qrTamanoGlobalPct,
      undefined,
    );
    const out: QrLayoutCert = { sizePct };

    const hasTop = q.top != null && String(q.top).trim() !== '';
    const hasBottom = q.bottom != null && String(q.bottom).trim() !== '';
    if (hasTop || q.bottom === null) out.top = q.top ?? preset.top;
    else if (hasBottom || q.top === null) out.bottom = q.bottom ?? preset.bottom;
    else if (preset.top) out.top = preset.top;
    else if (preset.bottom) out.bottom = preset.bottom;

    const hasLeft = q.left != null && String(q.left).trim() !== '';
    const hasRight = q.right != null && String(q.right).trim() !== '';
    if (hasLeft) out.left = q.left;
    else if (hasRight) out.right = q.right;
    else if (preset.left) out.left = preset.left;
    else if (preset.right) out.right = preset.right;

    return out;
  }

  /** Persiste la posición/tamaño QR tal como se ve en el editor (WYSIWYG con impresión). */
  materializarQrEnSlot(): QrLayoutCert {
    const eff = this.qrEfectivo();
    const out: QrLayoutCert = { sizePct: eff.sizePct };
    if (eff.top) out.top = eff.top;
    else if (eff.bottom) out.bottom = eff.bottom;
    if (eff.left) out.left = eff.left;
    else if (eff.right) out.right = eff.right;
    return out;
  }

  colorGlobal(): string {
    return this.slot().color || '#4a3a6a';
  }

  /** Campos anclados con left/right en plantilla (no usar modo «centrado en página»). */
  esCampoPosicional(id: CampoCertificadoId): boolean {
    const d = this.defectoCampo(id);
    return !!(d['left'] || d['right']);
  }

  alineacionActual(id: CampoCertificadoId): 'left' | 'center' | 'right' {
    const a = this.campoEfectivo(id).align;
    return a === 'left' || a === 'right' ? a : 'center';
  }

  visible(id: CampoCertificadoId): boolean {
    return this.campo(id).visible !== false;
  }

  private limpiarLegacyCampos(slot: LayoutOrientacionCert): LayoutOrientacionCert {
    const s = { ...slot } as LayoutOrientacionCert & Record<string, unknown>;
    for (const meta of this.campos) {
      delete s[meta.id];
    }
    return s;
  }

  private emit(slot: LayoutOrientacionCert) {
    const slotLimpio = this.limpiarLegacyCampos(slot);
    const layoutNext: LayoutPorTipoCert = {
      ...(this.layoutPorTipo || {}),
      [this.tipo]: {
        ...(this.layoutPorTipo?.[this.tipo] || {}),
        [this.orientacion]: slotLimpio,
      },
    };
    this.layoutChange.emit(layoutNext);
  }

  patchSlot(partial: Partial<LayoutOrientacionCert>) {
    this.emit({ ...this.slot(), ...partial });
  }

  patchColorGlobal(color: string) {
    this.patchSlot({ color });
  }

  /** Persiste posición, alineación y tipografía efectivas de todos los campos. */
  materializarTipografiaEnCampos() {
    if (!this.defaults()) return;
    const campos = { ...(this.slot().campos || {}) };
    for (const meta of this.campos) {
      const id = meta.id;
      const eff = this.campoEfectivo(id);
      campos[id] = eff.visible === false ? { visible: false } : { ...eff, visible: true };
    }
    this.patchSlot({ campos });
  }

  /** Fusiona layout completo de este tipo/orientación (para Guardar configuración). */
  snapshotLayoutPorTipo(base: LayoutPorTipoCert): LayoutPorTipoCert {
    if (!this.defaults()) return base;
    const layoutSrc = base || {};
    const slotBase = this.slotFrom(layoutSrc);
    const campos = { ...(slotBase.campos || {}) };
    for (const meta of this.campos) {
      const id = meta.id;
      const eff = this.campoEfectivoFrom(layoutSrc, id);
      campos[id] = eff.visible === false ? { visible: false } : { ...eff, visible: true };
    }
    const slot: LayoutOrientacionCert = this.limpiarLegacyCampos({
      ...slotBase,
      campos,
      qr: this.materializarQrEnSlot(),
    });
    return {
      ...layoutSrc,
      [this.tipo]: {
        ...(layoutSrc[this.tipo] || {}),
        [this.orientacion]: slot,
      },
    };
  }

  private normalizarAnclasCampo(c: CampoLayoutCert): CampoLayoutCert {
    const out = { ...c };
    const hasTop = out.top != null && String(out.top).trim() !== '';
    const hasBottom = out.bottom != null && String(out.bottom).trim() !== '';
    if (hasTop) delete out.bottom;
    else if (hasBottom) delete out.top;

    const hasLeft = out.left != null && String(out.left).trim() !== '';
    const hasRight = out.right != null && String(out.right).trim() !== '';
    if (hasLeft) delete out.right;
    else if (hasRight) delete out.left;
    return out;
  }

  /** Fija en guardado la posición absoluta que se ve ahora (anclas exclusivas). */
  private materializarPosicionCampo(id: CampoCertificadoId): Partial<CampoLayoutCert> {
    const live = this.dragVista()?.texto?.[id];
    const eff = this.campoEfectivo(id);
    const patch: Partial<CampoLayoutCert> = {};

    if (live?.bottom != null) {
      patch.bottom = `${live.bottom}%`;
      patch.top = null;
    } else if (live?.top != null) {
      patch.top = `${live.top}%`;
      patch.bottom = null;
    } else if (eff.bottom) {
      patch.bottom = eff.bottom;
      patch.top = null;
    } else if (eff.top) {
      patch.top = eff.top;
      patch.bottom = null;
    }

    if (live?.mantenerCentro) {
      patch.align = 'center';
      patch.left = undefined;
      patch.right = undefined;
    } else if (live?.right != null) {
      patch.right = `${live.right}%`;
      patch.left = undefined;
      patch.align = 'right';
    } else if (live?.left != null) {
      patch.left = `${live.left}%`;
      patch.right = undefined;
    } else if (eff.right && !eff.left) {
      patch.right = eff.right;
      patch.left = undefined;
    } else if (eff.left) {
      patch.left = eff.left;
      patch.right = undefined;
    } else if (this.esCentrado(id)) {
      patch.align = 'center';
      patch.left = undefined;
      patch.right = undefined;
    }

    return patch;
  }

  private materializarPosicionQr(): Partial<QrLayoutCert> {
    const live = this.dragVista()?.qr;
    const eff = this.qrEfectivo();
    const patch: Partial<QrLayoutCert> = {};

    if (live?.bottom != null) {
      patch.bottom = `${live.bottom}%`;
      patch.top = null;
    } else if (live?.top != null) {
      patch.top = `${live.top}%`;
      patch.bottom = null;
    } else if (eff.bottom) {
      patch.bottom = eff.bottom;
      patch.top = null;
    } else if (eff.top) {
      patch.top = eff.top;
      patch.bottom = null;
    }

    if (live?.right != null) {
      patch.right = `${live.right}%`;
      patch.left = null;
    } else if (live?.left != null) {
      patch.left = `${live.left}%`;
      patch.right = null;
    } else if (eff.right && !eff.left) {
      patch.right = eff.right;
      patch.left = null;
    } else if (eff.left) {
      patch.left = eff.left;
      patch.right = null;
    }

    return patch;
  }

  patchCampo(id: CampoCertificadoId, partial: Partial<CampoLayoutCert>) {
    const campos = { ...(this.slot().campos || {}) };
    const next: CampoLayoutCert = {
      ...this.campo(id),
      ...partial,
    };
    if (partial.top === null) delete next.top;
    if (partial.bottom === null) delete next.bottom;
    if (partial.left === undefined) delete next.left;
    if (partial.right === undefined) delete next.right;
    campos[id] = this.normalizarAnclasCampo(next);
    this.patchSlot({ campos });
  }

  patchQr(partial: Partial<QrLayoutCert>) {
    const prev = { ...this.qrGuardado(), ...partial };
    delete prev.sizePx;
    if (partial.top === null) delete prev.top;
    if (partial.bottom === null) delete prev.bottom;
    if (partial.left === null) delete prev.left;
    if (partial.right === null) delete prev.right;
    this.patchSlot({ qr: prev });
  }

  qrSizeActual(): number {
    return resolveQrSizePct(
      this.qrGuardado(),
      this.orientacion,
      this.qrTamanoGlobalPct,
      undefined,
    );
  }

  qrSizeMmActual(): number {
    return Math.round(qrSizePctToMm(this.qrSizeActual(), this.orientacion) * 10) / 10;
  }

  onQrSize(n: number) {
    this.patchQr({ ...this.materializarPosicionQr(), sizePct: clampQrSizePct(n) });
  }

  usaAnclaAbajoQr(): boolean {
    const q = this.qrEfectivo();
    if (q.top != null && String(q.top).trim() !== '') return false;
    return !!(q.bottom && String(q.bottom).trim());
  }

  qrTopActual(): number {
    return this.pctVal(this.qrEfectivo().top, 2);
  }

  qrBottomActual(): number {
    return this.pctVal(this.qrEfectivo().bottom, 2.5);
  }

  qrLeftActual(): number {
    return this.pctVal(this.qrEfectivo().left, 2.5);
  }

  qrRightActual(): number {
    return this.pctVal(this.qrEfectivo().right, 2.5);
  }

  onQrTop(n: number) {
    this.patchQr({ top: `${this.clampQrTop(n)}%`, bottom: null });
  }

  onQrBottom(n: number) {
    this.patchQr({ bottom: `${this.clampQrBottom(n)}%`, top: null });
  }

  onQrLeft(n: number) {
    this.patchQr({ left: `${this.clampQrHorizontal(n)}%`, right: null });
  }

  onQrRight(n: number) {
    this.patchQr({ right: `${this.clampQrHorizontal(n)}%`, left: null });
  }

  aplicarEsquinaQr(esquina: string) {
    const p = this.presetQr(esquina);
    this.patchQr({
      top: p.top ?? null,
      bottom: p.bottom ?? null,
      left: p.left ?? null,
      right: p.right ?? null,
      sizePct: this.qrSizeActual(),
    });
  }

  nudgeQr(dir: 'up' | 'down' | 'left' | 'right') {
    const paso = 0.5;
    if (dir === 'up' || dir === 'down') {
      if (this.usaAnclaAbajoQr()) {
        const b = this.qrBottomActual() + (dir === 'up' ? paso : -paso);
        this.onQrBottom(this.clampQrBottom(b));
      } else {
        const t = this.qrTopActual() + (dir === 'up' ? -paso : paso);
        this.onQrTop(this.clampQrTop(t));
      }
      return;
    }
    const q = this.qrEfectivo();
    if (q.right && !q.left) {
      const r = this.qrRightActual() + (dir === 'left' ? paso : -paso);
      this.onQrRight(this.clampQrHorizontal(r));
    } else {
      const l = this.qrLeftActual() + (dir === 'left' ? -paso : paso);
      this.onQrLeft(this.clampQrHorizontal(l));
    }
  }

  private clampQrHorizontal(n: number): number {
    return Math.min(this.qrPosMax, Math.max(this.qrPosMin, n));
  }

  private clampVerticalTop(n: number, alturaPct: number): number {
    const max = Math.max(this.qrPosMin, 98 - alturaPct);
    return Math.min(max, Math.max(1, n));
  }

  private clampVerticalBottom(n: number, alturaPct: number): number {
    const max = Math.max(this.qrPosMin, 98 - alturaPct);
    return Math.min(max, Math.max(1, n));
  }

  /** Alto del QR como % de la altura de la hoja (cuadrado, ancho en % del ancho). */
  private qrAlturaPct(): number {
    const sizePct = this.qrSizeActual();
    const pageW = this.orientacion === 'horizontal' ? 297 : 210;
    const pageH = this.orientacion === 'horizontal' ? 210 : 297;
    return (sizePct / 100) * (pageW / pageH) * 100;
  }

  /** Alto estimado del campo de texto como % de la altura de la hoja. */
  private campoAlturaPct(id: CampoCertificadoId): number {
    if (this.esMultilinea(id)) return 14;
    const pt = this.tamanoActual(id);
    const pageH = this.orientacion === 'horizontal' ? 210 : 297;
    const mm = ((pt * 25.4) / 72) * 1.35;
    return Math.max(1.5, (mm / pageH) * 100);
  }

  private verticalDesdeArrastre(
    alturaPct: number,
    anchorBottom: boolean,
    origTop: number | undefined,
    origBottom: number | undefined,
    dyPct: number,
  ): { top?: number; bottom?: number } {
    if (anchorBottom && origBottom != null) {
      const bottom = origBottom - dyPct;
      const equivTop = 100 - bottom - alturaPct;
      if (equivTop <= 52) {
        return { top: this.clampVerticalTop(equivTop, alturaPct) };
      }
      return { bottom: this.clampVerticalBottom(bottom, alturaPct) };
    }
    if (origTop != null) {
      const top = origTop + dyPct;
      const equivBottom = 100 - top - alturaPct;
      if (top >= 52) {
        return { bottom: this.clampVerticalBottom(equivBottom, alturaPct) };
      }
      return { top: this.clampVerticalTop(top, alturaPct) };
    }
    return {};
  }

  private clampQrTop(n: number): number {
    return this.clampVerticalTop(n, this.qrAlturaPct());
  }

  private clampQrBottom(n: number): number {
    return this.clampVerticalBottom(n, this.qrAlturaPct());
  }

  private qrVerticalDesdeArrastre(
    anchorBottom: boolean,
    origTop: number | undefined,
    origBottom: number | undefined,
    dyPct: number,
  ): { top?: number; bottom?: number } {
    return this.verticalDesdeArrastre(this.qrAlturaPct(), anchorBottom, origTop, origBottom, dyPct);
  }

  restaurarQr() {
    const slot = { ...this.slot() };
    delete slot.qr;
    this.patchSlot(slot);
  }

  usaAnclaAbajo(id: CampoCertificadoId): boolean {
    const c = this.campo(id);
    if (c.top != null && String(c.top).trim() !== '') return false;
    if (c.bottom === null) return false;
    if (c.bottom != null && String(c.bottom).trim() !== '') return true;
    const eff = this.campoEfectivo(id);
    if (eff.top != null && String(eff.top).trim() !== '') return false;
    return !!(eff.bottom && String(eff.bottom).trim());
  }

  private anclaDerechaEfectiva(id: CampoCertificadoId): boolean {
    const eff = this.campoEfectivo(id);
    return !!(eff.right && String(eff.right).trim() !== '' && (!eff.left || String(eff.left).trim() === ''));
  }

  pctVal(v?: string | null, fallback = 50): number {
    const m = String(v ?? '').match(/(\d+(?:\.\d+)?)/);
    return m ? parseFloat(m[1]) : fallback;
  }

  topActual(id: CampoCertificadoId): number {
    const eff = this.campoEfectivo(id);
    return this.pctVal(eff.top, this.pctVal(this.defectoCampo(id)['top'], 50));
  }

  bottomActual(id: CampoCertificadoId): number {
    const eff = this.campoEfectivo(id);
    return this.pctVal(eff.bottom, this.pctVal(this.defectoCampo(id)['bottom'], 11));
  }

  leftActual(id: CampoCertificadoId): number {
    return this.pctVal(this.campoEfectivo(id).left, this.pctVal(this.defectoCampo(id)['left'], 50));
  }

  anchoActual(id: CampoCertificadoId): number {
    return this.pctVal(this.campoEfectivo(id).w, this.pctVal(this.defectoCampo(id)['w'], 82));
  }

  onAncho(id: CampoCertificadoId, n: number) {
    this.patchCampo(id, { w: `${n}%` });
  }

  onTop(id: CampoCertificadoId, n: number) {
    this.patchCampo(id, {
      top: `${this.clampVerticalTop(n, this.campoAlturaPct(id))}%`,
      bottom: null,
    });
  }

  onBottom(id: CampoCertificadoId, n: number) {
    this.patchCampo(id, {
      bottom: `${this.clampVerticalBottom(n, this.campoAlturaPct(id))}%`,
      top: null,
    });
  }

  onLeft(id: CampoCertificadoId, n: number) {
    this.patchCampo(id, { left: `${n}%` });
  }

  esCentrado(id: CampoCertificadoId): boolean {
    if (this.esCampoPosicional(id)) return false;
    const eff = this.campoEfectivo(id);
    const sinLeft = !eff.left || String(eff.left).trim() === '';
    return sinLeft && (eff.align || 'center') === 'center';
  }

  setCentrado(id: CampoCertificadoId, centrado: boolean) {
    const d = this.defectoCampo(id) as CampoLayoutCert;
    if (centrado) {
      this.patchCampo(id, { left: undefined, align: 'center', w: d.w || '82%' });
    } else {
      this.patchCampo(id, {
        left: d.left || '34%',
        align: (d.align as CampoLayoutCert['align']) || 'left',
        w: d.w,
      });
    }
  }

  fsPt(v?: string): number {
    const m = String(v ?? '').match(/(\d+(?:\.\d+)?)/);
    return m ? parseFloat(m[1]) : 12;
  }

  tamanoActual(id: CampoCertificadoId): number {
    return this.fsPt(this.campoEfectivo(id).fs);
  }

  onTamano(id: CampoCertificadoId, n: number) {
    const v = Math.min(this.fuenteMaxPt, Math.max(this.fuenteMinPt, Number(n) || this.fuenteMinPt));
    this.patchCampo(id, {
      ...this.materializarPosicionCampo(id),
      fs: `${Math.round(v * 2) / 2}pt`,
    });
  }

  ajustarTamano(id: CampoCertificadoId, delta: number) {
    this.onTamano(id, this.tamanoActual(id) + delta);
  }

  nudge(id: CampoCertificadoId, dir: 'up' | 'down' | 'left' | 'right') {
    const paso = 0.5;
    if (dir === 'up' || dir === 'down') {
      if (this.usaAnclaAbajo(id)) {
        const b = this.bottomActual(id) + (dir === 'up' ? paso : -paso);
        this.onBottom(id, b);
      } else {
        const t = this.topActual(id) + (dir === 'up' ? -paso : paso);
        this.onTop(id, t);
      }
      return;
    }
    if (this.esCentrado(id)) this.setCentrado(id, false);
    const l = this.leftActual(id) + (dir === 'left' ? -paso : paso);
    this.onLeft(id, Math.min(90, Math.max(2, l)));
  }

  defectoCampo(id: CampoCertificadoId): Record<string, string> {
    const defs = this.defaults();
    const ori = this.orientacion === 'horizontal' ? defs?.horizontal : defs?.vertical;
    return ((ori?.[id] as Record<string, string>) || {}) as Record<string, string>;
  }

  previewSafe(): SafeHtml | null {
    const h = this.previewHtml();
    return h ? this.sanitizer.bypassSecurityTrustHtml(h) : null;
  }

  restaurarCampo(id: CampoCertificadoId) {
    const campos = { ...(this.slot().campos || {}) };
    delete campos[id];
    this.patchSlot({ campos });
  }

  restaurarTodo() {
    const porTipo = { ...(this.layoutPorTipo || {}) };
    if (porTipo[this.tipo]) {
      const t = { ...porTipo[this.tipo] };
      delete t[this.orientacion];
      if (Object.keys(t).length === 0) delete porTipo[this.tipo];
      else porTipo[this.tipo] = t;
    }
    this.layoutChange.emit(porTipo);
  }

  abrirPreview() {
    this.materializarTipografiaEnCampos();
    this.patchSlot({ qr: this.materializarQrEnSlot() });
    this.cargandoPreview.set(true);
    this.cfgSvc
      .vistaPrevia({
        tipo: this.tipo,
        orientacion: this.orientacion,
        layoutPorTipo: this.layoutPorTipo,
        urlFondo: this.urlFondoRel || this.cfgSvc.urlFondoRel(this.urlFondoPreview),
      })
      .subscribe({
        next: (html) => {
          this.previewHtml.set(html);
          this.cargandoPreview.set(false);
        },
        error: () => this.cargandoPreview.set(false),
      });
  }

  cerrarPreview() {
    this.previewHtml.set(null);
  }

  estiloOverlayQr(): Record<string, string> {
    const q = this.qrEfectivo();
    const live = this.dragVista()?.qr;
    const st: Record<string, string> = {
      width: qrSizeToEditorWidth(live?.sizePct ?? this.qrSizeActual()),
      aspectRatio: '1',
    };
    if (live?.bottom != null) {
      st['bottom'] = `${live.bottom}%`;
      st['top'] = 'auto';
    } else if (live?.top != null) {
      st['top'] = `${live.top}%`;
      st['bottom'] = 'auto';
    } else if (q.top) {
      st['top'] = q.top;
      st['bottom'] = 'auto';
    } else if (q.bottom) {
      st['bottom'] = q.bottom;
      st['top'] = 'auto';
    }
    if (live?.right != null) {
      st['right'] = `${live.right}%`;
      st['left'] = 'auto';
    } else if (live?.left != null) {
      st['left'] = `${live.left}%`;
      st['right'] = 'auto';
    } else {
      if (q.left) {
        st['left'] = q.left;
        st['right'] = 'auto';
      } else if (q.right) {
        st['right'] = q.right;
        st['left'] = 'auto';
      }
    }
    return st;
  }

  private aplicarPosicionOverlay(
    st: Record<string, string>,
    id: CampoCertificadoId,
    eff: CampoLayoutCert,
    align: string,
  ) {
    const live = this.dragVista()?.texto?.[id];
    if (live) {
      let hasVertical = false;
      if (live.bottom != null) {
        st['top'] = 'auto';
        st['bottom'] = `${live.bottom}%`;
        hasVertical = true;
      } else if (live.top != null) {
        st['top'] = `${live.top}%`;
        st['bottom'] = 'auto';
        hasVertical = true;
      }
      if (live.mantenerCentro) {
        st['left'] = '50%';
        st['transform'] = 'translateX(-50%)';
        st['width'] = `${live.w ?? this.anchoActual(id)}%`;
        return;
      }
      if (live.right != null) {
        st['right'] = `${live.right}%`;
        st['left'] = 'auto';
        st['width'] = `${live.w ?? eff.w ?? '30%'}`;
        st['transform'] = 'none';
        return;
      }
      if (live.left != null) {
        st['left'] = `${live.left}%`;
        st['width'] = `${live.w ?? eff.w ?? '30%'}`;
        st['transform'] = 'none';
        return;
      }
      if (hasVertical) {
        st['width'] = `${live.w ?? eff.w ?? '30%'}`;
        if (eff.right && (!eff.left || String(eff.left).trim() === '')) {
          st['right'] = eff.right;
          st['left'] = 'auto';
          st['transform'] = 'none';
        } else if (eff.left) {
          st['left'] = eff.left;
          st['transform'] = 'none';
        } else if (align === 'center') {
          st['left'] = '50%';
          st['transform'] = 'translateX(-50%)';
        }
        return;
      }
    }
    if (this.usaAnclaAbajo(id)) {
      st['top'] = 'auto';
      st['bottom'] = eff.bottom || '10%';
    } else {
      st['top'] = eff.top || '50%';
    }
    if (eff.right && (!eff.left || String(eff.left).trim() === '')) {
      st['right'] = eff.right;
      st['left'] = 'auto';
      st['width'] = eff.w || '30%';
      st['transform'] = 'none';
    } else if (eff.left) {
      st['left'] = eff.left;
      st['width'] = eff.w || '30%';
      st['transform'] = 'none';
    } else if (align === 'center') {
      st['left'] = '50%';
      st['transform'] = 'translateX(-50%)';
      st['width'] = eff.w || (this.esMultilinea(id) ? '82%' : '82%');
    }
  }

  estiloOverlay(id: CampoCertificadoId): Record<string, string> {
    const eff = this.campoEfectivo(id);
    const live = this.dragVista()?.texto?.[id];
    const align = live?.mantenerCentro ? 'center' : eff.align || 'center';
    const color = eff.color || this.colorGlobal();
    const st: Record<string, string> = {
      color,
      fontSize: fsToEditorFontSize(
        live?.fs != null ? `${live.fs}pt` : eff.fs,
        this.orientacion,
      ),
      fontWeight: String(eff.fw || '600'),
      textAlign: align === 'center' ? 'center' : align,
      fontFamily: eff.fontFamily || FUENTE_CERTIFICADO_DEFAULT,
    };
    this.aplicarPosicionOverlay(st, id, eff, align);
    if (this.visible(id) === false) st['display'] = 'none';
    if (this.esMultilinea(id)) {
      st['whiteSpace'] = 'normal';
      st['wordWrap'] = 'break-word';
      st['overflowWrap'] = 'break-word';
      st['lineHeight'] = '1.2';
      st['overflow'] = 'visible';
      st['maxHeight'] = 'none';
    }
    return st;
  }

  setAlineacion(id: CampoCertificadoId, align: 'left' | 'center' | 'right') {
    this.dragVista.set(null);
    if (align === 'center' && !this.esCampoPosicional(id)) {
      this.setCentrado(id, true);
      return;
    }
    const w = this.anchoActual(id);
    if (align === 'left') {
      this.patchCampo(id, {
        align: 'left',
        left: `${Math.max(2, this.esCentrado(id) ? (100 - w) / 2 : this.leftActual(id))}%`,
        right: undefined,
        w: `${w}%`,
      });
    } else {
      this.patchCampo(id, {
        align: 'right',
        right: `${this.usaAnclaDerecha(id) ? this.rightActual(id) : 8}%`,
        left: undefined,
        w: `${w}%`,
      });
    }
  }

  /** Centra el cuadro solo en horizontal; mantiene la posición vertical actual. */
  centrarCuadroEnCertificado(id: CampoCertificadoId) {
    this.dragVista.set(null);
    const w = this.anchoActual(id);

    if (this.esCampoPosicional(id)) return;

    if (this.usaAnclaAbajo(id)) {
      const left = Math.max(2, Math.min(88, (100 - w) / 2));
      this.patchCampo(id, {
        left: `${left}%`,
        align: 'left',
        w: `${w}%`,
        right: undefined,
      });
      return;
    }

    this.patchCampo(id, {
      align: 'center',
      left: undefined,
      right: undefined,
      w: `${w}%`,
    });
  }

  puedeCentrarEnHoja(id: CampoCertificadoId): boolean {
    return !this.esCampoPosicional(id);
  }

  /** Centra el QR solo en horizontal; mantiene arriba/abajo como está. */
  centrarQrEnCertificado() {
    this.dragVista.set(null);
    const size = this.qrSizeActual();
    const left = Math.max(2, Math.min(88, (100 - size) / 2));
    this.patchQr({
      left: `${Math.round(left * 10) / 10}%`,
      right: null,
    });
  }

  usaAnclaDerecha(id: CampoCertificadoId): boolean {
    const eff = this.campoEfectivo(id);
    return !!(eff.right && String(eff.right).trim() && (!eff.left || String(eff.left).trim() === ''));
  }

  rightActual(id: CampoCertificadoId): number {
    return this.pctVal(this.campoEfectivo(id).right, 8);
  }

  esMultilinea(id: CampoCertificadoId): boolean {
    return id === 'nombre' || id === 'curso';
  }

  textoMuestra(id: CampoCertificadoId): string {
    const map: Record<CampoCertificadoId, string> = {
      nombre: 'JUAN CARLOS PEREZ GOMEZ MARTINEZ',
      tipoDoc: 'CC',
      doc: '1234567890',
      expedida: 'BOGOTÁ D.C.',
      curso: 'TRANSPORTE DE MERCANCIAS PELIGROSAS CLASE 3',
      ciudad: 'Villavicencio',
      horas: '40',
      fecha: '21/05/2026',
      vence: '21/05/2027',
      acta: '12345',
      folio: '67890',
      runt: 'RUNT-001',
      obs: 'Sin observaciones',
      certId: 'CERT-000001',
    };
    return map[id];
  }

  /** Formatos con medidas guardadas (excluye el actual). */
  fuentesCopia(): { key: string; label: string }[] {
    const layout = this.layoutPorTipo || {};
    const out: { key: string; label: string }[] = [];
    for (const t of TIPOS_CERTIFICADO) {
      for (const o of ORIENTACIONES_CERTIFICADO) {
        if (t.id === this.tipo && o.id === this.orientacion) continue;
        const slot = layout[t.id]?.[o.id];
        if (!this.slotTieneMedidas(slot)) continue;
        out.push({
          key: `${t.id}|${o.id}`,
          label: `${labelTipoCert(t.id)} · ${labelOrientacion(o.id)}`,
        });
      }
    }
    return out.sort((a, b) => a.label.localeCompare(b.label, 'es'));
  }

  async copiarMedidas() {
    const key = this.copiarDesdeKey().trim();
    if (!key) return;
    const sep = key.indexOf('|');
    if (sep < 0) return;
    const srcTipo = key.slice(0, sep) as TipoCertificadoId;
    const srcOri = key.slice(sep + 1) as OrientacionCertificado;
    const src = this.layoutPorTipo?.[srcTipo]?.[srcOri];
    if (!src || !this.slotTieneMedidas(src)) {
      this.copyMsg.set('El formato origen no tiene medidas guardadas.');
      setTimeout(() => this.copyMsg.set(null), 4000);
      return;
    }
    const origen = `${labelTipoCert(srcTipo)} · ${labelOrientacion(srcOri)}`;
    const destino = `${labelTipoCert(this.tipo)} · ${labelOrientacion(this.orientacion)}`;
    const ok = await this.confirm.open({
      title: 'Copiar medidas',
      message:
        `¿Copiar posiciones, tamaños, color y QR de «${origen}» a «${destino}»? ` +
        'Se reemplazarán las medidas actuales de este formato.',
      confirmLabel: 'Copiar medidas',
      variant: 'primary',
    });
    if (!ok) return;
    this.emit(this.clonarSlot(src));
    this.copyMsg.set(`Medidas copiadas desde ${origen}. Pulse «Guardar configuración» abajo.`);
    setTimeout(() => this.copyMsg.set(null), 6000);
  }

  private slotTieneMedidas(slot: LayoutOrientacionCert | undefined): boolean {
    if (!slot || typeof slot !== 'object') return false;
    if (String(slot.color || '').trim()) return true;
    if (slot.qr && Object.keys(slot.qr).length > 0) return true;
    if (slot.campos && Object.keys(slot.campos).length > 0) return true;
    return this.campos.some((c) => {
      const legacy = (slot as LayoutOrientacionCert & Record<string, CampoLayoutCert | undefined>)[c.id];
      return legacy && typeof legacy === 'object' && Object.keys(legacy).length > 0;
    });
  }

  private clonarSlot(slot: LayoutOrientacionCert): LayoutOrientacionCert {
    return JSON.parse(JSON.stringify(slot)) as LayoutOrientacionCert;
  }

  /** --- Arrastre y redimensionado interactivo --- */
  private drag:
    | {
        kind: 'move-text';
        id: CampoCertificadoId;
        startX: number;
        startY: number;
        origTop?: number;
        origBottom?: number;
        origLeft: number;
        useBottom: boolean;
        anchorRight: boolean;
        origRight?: number;
        wasCentered: boolean;
      }
    | {
        kind: 'move-qr';
        startX: number;
        startY: number;
        origTop?: number;
        origBottom?: number;
        origLeft?: number;
        origRight?: number;
        anchorBottom: boolean;
        anchorRight: boolean;
      }
    | {
        kind: 'resize-qr';
        startX: number;
        origPct: number;
        rectW: number;
        origTop?: number;
        origBottom?: number;
        origLeft?: number;
        origRight?: number;
      }
    | {
        kind: 'resize-text';
        id: CampoCertificadoId;
        mode: 'e' | 'w' | 's' | 'se';
        startX: number;
        startY: number;
        origTop?: number;
        origBottom?: number;
        origLeft?: number;
        origRight?: number;
        origW: number;
        origPt: number;
        wasCentered: boolean;
        useBottom: boolean;
        anchorRight: boolean;
      }
    | null = null;

  private arrastrePendiente:
    | {
        kind: 'move-text';
        id: CampoCertificadoId;
        startX: number;
        startY: number;
        origTop?: number;
        origBottom?: number;
        origLeft: number;
        useBottom: boolean;
        anchorRight: boolean;
        origRight?: number;
        wasCentered: boolean;
        pointerId: number;
      }
    | {
        kind: 'move-qr';
        startX: number;
        startY: number;
        origTop?: number;
        origBottom?: number;
        origLeft?: number;
        origRight?: number;
        anchorBottom: boolean;
        anchorRight: boolean;
        pointerId: number;
      }
    | null = null;

  private pointerCapturado = false;

  private canvasRect(): DOMRect | null {
    return this.certCanvas?.nativeElement.getBoundingClientRect() ?? null;
  }

  /** Posición horizontal virtual para arrastre sin alterar alineación guardada. */
  private leftVirtualParaArrastre(id: CampoCertificadoId): number {
    if (this.esCentrado(id)) {
      const w = this.anchoActual(id);
      return Math.max(2, Math.min(88, (100 - w) / 2));
    }
    return this.leftActual(id);
  }

  private capturarCanvas(ev: PointerEvent) {
    const canvas = this.certCanvas?.nativeElement;
    if (!canvas) return;
    canvas.setPointerCapture(ev.pointerId);
    this.pointerCapturado = true;
  }

  private liberarCanvas(ev: PointerEvent) {
    if (!this.pointerCapturado) return;
    try {
      this.certCanvas?.nativeElement.releasePointerCapture(ev.pointerId);
    } catch {
      /* ignore */
    }
    this.pointerCapturado = false;
  }

  private confirmarDragVista() {
    const v = this.dragVista();
    if (!v) return;

    if (v.texto) {
      for (const [rawId, live] of Object.entries(v.texto)) {
        if (!live) continue;
        const id = rawId as CampoCertificadoId;
        const patch: Partial<CampoLayoutCert> = {};
        if (live.bottom != null) {
          patch.bottom = `${live.bottom}%`;
          patch.top = null;
        } else if (live.top != null) {
          patch.top = `${live.top}%`;
          patch.bottom = null;
        }
        if (live.fs != null) patch.fs = `${live.fs}pt`;
        if (live.mantenerCentro) {
          patch.align = 'center';
          patch.left = undefined;
          patch.right = undefined;
          if (live.w != null) patch.w = `${live.w}%`;
        } else if (live.right != null) {
          patch.right = `${live.right}%`;
          patch.left = undefined;
          patch.align = 'right';
          if (live.w != null) patch.w = `${live.w}%`;
        } else if (live.left != null) {
          patch.left = `${live.left}%`;
          patch.right = undefined;
          patch.align = 'left';
          patch.w = `${live.w ?? this.anchoActual(id)}%`;
        } else if (live.w != null) {
          patch.w = `${live.w}%`;
        }
        if (Object.keys(patch).length) this.patchCampo(id, patch);
      }
    }

    if (v.qr) {
      const q: Partial<QrLayoutCert> = {};
      if (v.qr.bottom != null) {
        q.bottom = `${v.qr.bottom}%`;
        q.top = null;
      } else if (v.qr.top != null) {
        q.top = `${v.qr.top}%`;
        q.bottom = null;
      }
      if (v.qr.right != null) {
        q.right = `${v.qr.right}%`;
        q.left = null;
      } else if (v.qr.left != null) {
        q.left = `${v.qr.left}%`;
        q.right = null;
      }
      if (v.qr.sizePct != null) q.sizePct = clampQrSizePct(v.qr.sizePct);
      if (Object.keys(q).length) this.patchQr(q);
    }

    this.dragVista.set(null);
  }

  iniciarArrastreTexto(ev: PointerEvent, id: CampoCertificadoId) {
    if (!this.visible(id)) return;
    if ((ev.target as HTMLElement).closest('.handle, .preview-toolbar')) return;
    ev.preventDefault();
    ev.stopPropagation();
    this.seleccionar(id);

    const useBottom = this.usaAnclaAbajo(id);
    const anchorRight = this.usaAnclaDerecha(id);
    const wasCentered = this.esCentrado(id);
    this.capturarCanvas(ev);

    this.arrastrePendiente = {
      kind: 'move-text',
      id,
      startX: ev.clientX,
      startY: ev.clientY,
      origTop: useBottom ? undefined : this.topActual(id),
      origBottom: useBottom ? this.bottomActual(id) : undefined,
      origLeft: anchorRight ? 0 : this.leftVirtualParaArrastre(id),
      useBottom,
      anchorRight,
      origRight: anchorRight ? this.rightActual(id) : undefined,
      wasCentered,
      pointerId: ev.pointerId,
    };
  }

  iniciarResizeTexto(ev: PointerEvent, id: CampoCertificadoId, mode: 'e' | 'w' | 's' | 'se') {
    ev.preventDefault();
    ev.stopPropagation();
    this.seleccionar(id);
    this.capturarCanvas(ev);
    const useBottom = this.usaAnclaAbajo(id);
    const anchorRight = this.anclaDerechaEfectiva(id);
    const wasCentered = this.esCentrado(id);
    this.drag = {
      kind: 'resize-text',
      id,
      mode,
      startX: ev.clientX,
      startY: ev.clientY,
      origTop: useBottom ? undefined : this.topActual(id),
      origBottom: useBottom ? this.bottomActual(id) : undefined,
      origLeft: anchorRight || wasCentered ? undefined : this.leftVirtualParaArrastre(id),
      origRight: anchorRight ? this.rightActual(id) : undefined,
      origW: this.anchoActual(id),
      origPt: this.tamanoActual(id),
      wasCentered,
      useBottom,
      anchorRight,
    };
    this.arrastrando.set(true);
  }

  iniciarArrastreQr(ev: PointerEvent) {
    if ((ev.target as HTMLElement).closest('.handle')) return;
    ev.preventDefault();
    ev.stopPropagation();
    this.seleccionar('qr');
    const anchorBottom = this.usaAnclaAbajoQr();
    const anchorRight = !!(this.qrEfectivo().right && !this.qrEfectivo().left);
    this.capturarCanvas(ev);

    this.arrastrePendiente = {
      kind: 'move-qr',
      startX: ev.clientX,
      startY: ev.clientY,
      origTop: anchorBottom ? undefined : this.qrTopActual(),
      origBottom: anchorBottom ? this.qrBottomActual() : undefined,
      origLeft: anchorRight ? undefined : this.qrLeftActual(),
      origRight: anchorRight ? this.qrRightActual() : undefined,
      anchorBottom,
      anchorRight,
      pointerId: ev.pointerId,
    };
  }

  iniciarResizeQr(ev: PointerEvent) {
    ev.preventDefault();
    ev.stopPropagation();
    this.seleccionar('qr');
    this.capturarCanvas(ev);
    const anchorBottom = this.usaAnclaAbajoQr();
    const anchorRight = !!(this.qrEfectivo().right && !this.qrEfectivo().left);
    this.drag = {
      kind: 'resize-qr',
      startX: ev.clientX,
      origPct: this.qrSizeActual(),
      rectW: this.canvasRect()?.width ?? 380,
      origTop: anchorBottom ? undefined : this.qrTopActual(),
      origBottom: anchorBottom ? this.qrBottomActual() : undefined,
      origLeft: anchorRight ? undefined : this.qrLeftActual(),
      origRight: anchorRight ? this.qrRightActual() : undefined,
    };
    this.arrastrando.set(true);
  }

  private activarArrastrePendiente(ev: PointerEvent) {
    const p = this.arrastrePendiente;
    if (!p || p.pointerId !== ev.pointerId) return;
    const { pointerId, ...rest } = p;
    this.drag = rest;
    this.arrastrePendiente = null;
    this.arrastrando.set(true);
  }

  private distanciaArrastre(ev: PointerEvent, startX: number, startY: number): number {
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;
    return Math.hypot(dx, dy);
  }

  @HostListener('document:pointermove', ['$event'])
  onDocumentPointerMove(ev: PointerEvent) {
    const pend = this.arrastrePendiente;
    if (pend && pend.pointerId === ev.pointerId) {
      if (this.distanciaArrastre(ev, pend.startX, pend.startY) >= this.umbralArrastrePx) {
        this.activarArrastrePendiente(ev);
      } else {
        return;
      }
    }

    const d = this.drag;
    if (!d) return;
    const rect = this.canvasRect();
    if (!rect) return;
    const dxPct = ((ev.clientX - d.startX) / rect.width) * 100;

    if (d.kind === 'resize-qr') {
      const deltaPct = (dxPct / 100) * (d.origPct * 2);
      const qrLive: {
        top?: number;
        bottom?: number;
        left?: number;
        right?: number;
        sizePct: number;
      } = { sizePct: clampQrSizePct(d.origPct + deltaPct) };
      if (d.origBottom != null) qrLive.bottom = d.origBottom;
      else if (d.origTop != null) qrLive.top = d.origTop;
      if (d.origRight != null) qrLive.right = d.origRight;
      else if (d.origLeft != null) qrLive.left = d.origLeft;
      this.dragVista.set({ qr: qrLive });
      return;
    }

    const dyPct = ((ev.clientY - d.startY) / rect.height) * 100;

    if (d.kind === 'resize-text') {
      const live: {
        top?: number;
        bottom?: number;
        left?: number;
        right?: number;
        w?: number;
        fs?: number;
        mantenerCentro?: boolean;
      } = {
        w: d.origW,
        fs: d.origPt,
        mantenerCentro: d.wasCentered,
      };

      if (d.useBottom && d.origBottom != null) {
        live.bottom = d.origBottom;
      } else if (d.origTop != null) {
        live.top = d.origTop;
      }

      if (d.anchorRight && d.origRight != null) {
        live.right = d.origRight;
        live.mantenerCentro = false;
      } else if (d.wasCentered && d.mode === 's') {
        live.mantenerCentro = true;
      } else if (d.origLeft != null) {
        live.left = d.origLeft;
      }

      if (d.mode === 'e') {
        live.w = Math.min(92, Math.max(18, d.origW + dxPct));
        live.mantenerCentro = false;
      } else if (d.mode === 'w') {
        live.w = Math.min(92, Math.max(18, d.origW - dxPct));
        if (d.origLeft != null) {
          live.left = Math.min(88, Math.max(2, d.origLeft + dxPct));
        }
        live.mantenerCentro = false;
      } else if (d.mode === 'se') {
        live.w = Math.min(92, Math.max(18, d.origW + dxPct));
        live.fs = Math.min(
          this.fuenteMaxPt,
          Math.max(this.fuenteMinPt, d.origPt - dyPct * 0.35),
        );
        live.mantenerCentro = false;
      } else if (d.mode === 's') {
        live.fs = Math.min(
          this.fuenteMaxPt,
          Math.max(this.fuenteMinPt, d.origPt - dyPct * 0.35),
        );
      }
      if (d.wasCentered && d.mode !== 's') live.mantenerCentro = false;
      this.dragVista.set({ texto: { [d.id]: live } });
      return;
    }

    if (d.kind === 'move-text') {
      const desanclarCentro =
        d.wasCentered && Math.abs(dxPct) > this.umbralDesanclarCentroPct;
      const live: {
        top?: number;
        bottom?: number;
        left?: number;
        right?: number;
        mantenerCentro?: boolean;
      } = {};

      Object.assign(
        live,
        this.verticalDesdeArrastre(
          this.campoAlturaPct(d.id),
          !!d.useBottom,
          d.origTop,
          d.origBottom,
          dyPct,
        ),
      );

      if (d.anchorRight && d.origRight != null) {
        live.right = Math.min(88, Math.max(2, d.origRight - dxPct));
        live.mantenerCentro = false;
      } else if (desanclarCentro || !d.wasCentered) {
        live.left = Math.min(88, Math.max(2, d.origLeft + dxPct));
        live.mantenerCentro = false;
      } else {
        live.mantenerCentro = true;
      }

      this.dragVista.set({ texto: { [d.id]: live } });
      return;
    }

    if (d.kind === 'move-qr') {
      const qrLive: {
        top?: number;
        bottom?: number;
        left?: number;
        right?: number;
        sizePct?: number;
      } = {
        ...this.qrVerticalDesdeArrastre(d.anchorBottom, d.origTop, d.origBottom, dyPct),
      };
      if (d.anchorRight && d.origRight != null) {
        qrLive.right = this.clampQrHorizontal(d.origRight - dxPct);
      } else if (d.origLeft != null) {
        qrLive.left = this.clampQrHorizontal(d.origLeft + dxPct);
      }
      this.dragVista.set({ qr: qrLive });
    }
  }

  @HostListener('document:pointerup', ['$event'])
  @HostListener('document:pointercancel', ['$event'])
  finalizarArrastre(ev: PointerEvent) {
    const huboArrastre = !!this.drag || !!this.dragVista();
    if (this.arrastrePendiente?.pointerId === ev.pointerId) {
      this.arrastrePendiente = null;
    }
    if (huboArrastre) {
      this.confirmarDragVista();
    }
    this.liberarCanvas(ev);
    this.drag = null;
    this.arrastrando.set(false);
  }
}
