import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, OnInit, ViewChild, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { CatalogoService } from '../../core/services/catalogo.service';
import { AuthService } from '../../core/services/auth.service';
import {
  ServicioCatalogo,
  ServicioCatalogoService,
  ServicioDto,
} from '../../core/services/servicio-catalogo.service';
import { ConfirmDialogService } from '../../shared/confirm-dialog/confirm-dialog.service';
import {
  capId,
  capMoneda,
  capTipoServ,
  capVinculo,
} from '../../core/utils/capsule.util';
import { coerceNumberInput } from '../../core/utils/numeric-fields.util';
import { readVistaLista, saveVistaLista, VistaLista } from '../../core/utils/vista-lista.helpers';
import { FormModalComponent } from '../../shared/form-modal/form-modal.component';
import {
  CatalogoEnumBuscarComponent,
  EnumBuscarOption,
} from '../../shared/catalogo-enum-buscar/catalogo-enum-buscar.component';
import { AsistenteContextoService } from '../../core/services/asistente-contexto.service';
import { tipFormulario } from '../../core/utils/asistente-formulario.util';
import type { AsistenteTip } from '../../core/constants/asistente.types';

interface AuditInfo {
  fechaAudi?: string;
  userAddReg?: string;
  userChangeRecord?: string;
  fechaMod?: string;
}

type FiltroVista = 'todos' | 'sinPrograma' | 'conPrograma';

@Component({
  selector: 'argo-servicios-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, FormModalComponent, CatalogoEnumBuscarComponent],
  templateUrl: './servicios-admin.component.html',
  styleUrls: ['./servicios-admin.component.scss'],
})
export class ServiciosAdminComponent implements OnInit {
  private svc = inject(ServicioCatalogoService);
  private catSvc = inject(CatalogoService);
  private asistente = inject(AsistenteContextoService);

  constructor() {
    effect(() => {
      if (this.modalAbierto()) {
        this.asistente.setTipsPrepend(this.tipsMiaFormulario());
        this.posicionarModal();
      } else {
        this.asistente.clearTipsPrepend();
      }
    });
  }
  private auth = inject(AuthService);
  private confirm = inject(ConfirmDialogService);

  servicios = signal<ServicioCatalogo[]>([]);
  tiposServ = signal<{ id: number; code: string; label: string; esCapacitacion?: boolean }[]>([]);
  loading = signal(false);
  saving = signal(false);
  msg = signal<string | null>(null);
  msgError = signal(false);
  busqueda = signal('');
  filtro = signal<FiltroVista>('todos');
  vista = signal<VistaLista>(readVistaLista('argo-servicios-vista'));
  modalAbierto = signal(false);
  editando = signal<ServicioCatalogo | null>(null);
  audit = signal<AuditInfo | null>(null);
  programaLabel = signal('');
  esAdmin = signal(false);

  form = signal<ServicioDto>(this.formVacio());

  opcionesTipoServForm = computed<EnumBuscarOption[]>(() => {
    const list = this.esEdicion() ? this.tiposServ() : this.tiposServOtros();
    return list.map((t) => ({
      value: t.code,
      label: `${t.label} (${t.code})`,
    }));
  });

  textoTipoServ = computed(() => {
    const code = this.form().tipoServ;
    const t = this.tiposServ().find((x) => x.code === code);
    return t ? `${t.label} (${t.code})` : String(code || '');
  });

  opcionesFacturar: EnumBuscarOption[] = [
    { value: 'NO', label: 'NO' },
    { value: 'SI', label: 'SI' },
  ];

  textoFacturar = computed(() => this.facturarStr(this.form().facturar));

  modalTop = signal(80);

  @ViewChild('pageHead') pageHead?: ElementRef<HTMLElement>;
  @ViewChild('titleAnchor') titleAnchor?: ElementRef<HTMLElement>;

  @HostListener('window:resize')
  onResize() {
    if (this.modalAbierto()) this.posicionarModal();
  }

  private formVacio(): ServicioDto {
    return {
      descrServicio: '',
      tipoServ: 'SEG',
      idProg: null,
      tarifa1: 0,
      tarifa2: 0,
      tarifa3: 0,
      tarifaVirtual: 0,
      facturar: 'NO',
      iva: 0,
      condicionIva: 'gravado',
    };
  }

  opcionesCondicionIva = [
    { value: 'gravado', label: 'Gravado (cobra IVA)' },
    { value: 'exento', label: 'Exento (tarifa 0%)' },
    { value: 'excluido', label: 'Excluido (sin IVA)' },
  ];

  private posicionarModal() {
    const head = this.pageHead?.nativeElement;
    if (head) {
      const scrollTop = head.getBoundingClientRect().top + window.scrollY - 12;
      window.scrollTo({ top: Math.max(0, scrollTop), behavior: 'auto' });
    }

    const measure = () => {
      const title = this.titleAnchor?.nativeElement ?? this.pageHead?.nativeElement;
      if (!title) return;
      const bottom = title.getBoundingClientRect().bottom;
      this.modalTop.set(Math.max(8, Math.round(bottom + 6)));
    };

    requestAnimationFrame(() => {
      measure();
      requestAnimationFrame(measure);
    });
    setTimeout(measure, 80);
  }

  ngOnInit(): void {
    const r = String(this.auth.user()?.rol || '').toLowerCase();
    this.esAdmin.set(r === 'admin' || r.includes('admin'));
    this.cargar();
    this.catSvc.list('catTipServicio').subscribe({
      next: (rows) => {
        const cap = new Set(['CUR', 'DIP', 'TEC']);
        const list = (rows || []).map(
          (t: { idTipoServ?: number; tipoServ?: string; descTipoServ?: string }) => ({
            id: Number(t.idTipoServ) || 0,
            code: String(t.tipoServ || '').trim(),
            label: String(t.descTipoServ || t.tipoServ || ''),
            esCapacitacion: cap.has(String(t.tipoServ || '').trim()),
          }),
        );
        this.tiposServ.set(list.filter((x) => x.code));
      },
    });
  }

  cargar() {
    this.loading.set(true);
    const q = this.busqueda().trim();
    const f = this.filtro();
    this.svc
      .listar({
        q: q.length >= 2 ? q : undefined,
        soloPrograma: f === 'conPrograma',
        sinPrograma: f === 'sinPrograma',
      })
      .subscribe({
        next: (r) => {
          this.servicios.set(r || []);
          this.loading.set(false);
        },
        error: (e) => {
          this.loading.set(false);
          this.inform(e?.error?.message || 'Error cargando servicios', true);
        },
      });
  }

  setFiltro(f: FiltroVista) {
    this.filtro.set(f);
    this.cargar();
  }

  setVista(v: VistaLista) {
    this.vista.set(v);
    saveVistaLista('argo-servicios-vista', v);
  }

  esServicioPrograma(s: ServicioCatalogo): boolean {
    return s.idProg != null && s.idProg !== '';
  }

  labelPrograma(s: ServicioCatalogo): string {
    if (s.programaCodigo) return `${s.programaCodigo} — ${s.programaNombre || ''}`;
    if (this.esServicioPrograma(s)) return `Prog ${s.idProg}`;
    return 'Servicio general';
  }

  tiposServOtros() {
    return this.tiposServ().filter((t) => !t.esCapacitacion);
  }

  tiposServCap() {
    return this.tiposServ().filter((t) => t.esCapacitacion);
  }

  tipoServInicialOtros(): string {
    const prefer = ['SEG', 'TRM', 'DET', 'RUNT', 'ASE', 'CEA', 'CRC', 'FNSV'];
    for (const p of prefer) {
      if (this.tiposServ().some((t) => t.code === p)) return p;
    }
    const otro = this.tiposServ().find((t) => !t.esCapacitacion);
    return otro?.code || 'SEG';
  }

  nuevo() {
    this.editando.set(null);
    this.audit.set(null);
    this.programaLabel.set('');
    this.form.set({ ...this.formVacio(), tipoServ: this.tipoServInicialOtros() });
    this.modalAbierto.set(true);
    this.posicionarModal();
    this.inform(null);
  }

  editar(s: ServicioCatalogo) {
    if (s.idServ == null) return;
    this.svc.obtener(s.idServ).subscribe({
      next: (det) => {
        const serv = det.servicio;
        const prog = det.programa as { codigoProg?: string; nombreProg?: string } | null;
        this.editando.set(serv);
        this.programaLabel.set(
          prog ? `${prog.codigoProg ?? ''} — ${prog.nombreProg ?? ''}`.trim() : 'Servicio general (sin programa)',
        );
        this.audit.set({
          fechaAudi: this.fmtFecha(serv.fechaAudi),
          userAddReg: String(serv.userAddReg ?? '—'),
          userChangeRecord: String(serv.userChangeRecord ?? '—'),
          fechaMod: this.fmtFecha(serv.fechaMod),
        });
        this.form.set({
          descrServicio: serv.descrServicio || '',
          tipoServ: serv.tipoServ ?? 'CUR',
          idProg: serv.idProg ?? null,
          tarifa1: this.num(serv.tarifa1),
          tarifa2: this.num(serv.tarifa2),
          tarifa3: this.num(serv.tarifa3),
          tarifaVirtual: this.num(serv.tarifaVirtual),
          facturar: this.facturarStr(serv.facturar),
          iva: this.num(serv.iva),
          condicionIva: ['gravado', 'exento', 'excluido'].includes(String(serv.condicionIva || '').toLowerCase())
            ? String(serv.condicionIva).toLowerCase()
            : this.num(serv.iva) > 0
              ? 'gravado'
              : 'excluido',
        });
        this.modalAbierto.set(true);
        this.posicionarModal();
        this.inform(null);
      },
      error: (e) => this.inform(e?.error?.message || 'No se pudo cargar el servicio', true),
    });
  }

  patchForm(partial: Partial<ServicioDto>) {
    const numericKeys = new Set(['tarifa1', 'tarifa2', 'tarifa3', 'tarifaVirtual', 'iva']);
    const next: Partial<ServicioDto> = { ...partial };
    for (const key of numericKeys) {
      if (key in partial && partial[key as keyof ServicioDto] != null) {
        (next as Record<string, number>)[key] = coerceNumberInput(partial[key as keyof ServicioDto]);
      }
    }
    this.form.update((f) => ({ ...f, ...next }));
  }

  onTipoServPick(opt: EnumBuscarOption): void {
    this.patchForm({ tipoServ: String(opt.value) });
  }

  onTipoServLimpiar(): void {
    this.patchForm({ tipoServ: '' });
  }

  onFacturarPick(opt: EnumBuscarOption): void {
    this.patchForm({ facturar: String(opt.value) });
  }

  onFacturarLimpiar(): void {
    this.patchForm({ facturar: 'NO' });
  }

  cerrarModal() {
    this.modalAbierto.set(false);
    this.editando.set(null);
  }

  modalTitulo(): string {
    const s = this.editando();
    return s ? `Editar servicio #${s.idServ}` : 'Nuevo servicio (sin programa)';
  }

  private tipsMiaFormulario(): AsistenteTip[] {
    const tips: AsistenteTip[] = [
      tipFormulario(
        'Este formulario',
        this.esEdicion()
          ? this.programaLabel()
          : 'Servicio independiente: no se vincula a un programa educativo.',
        'srv-form-ctx',
      ),
    ];
    if (!this.esEdicion()) {
      tips.push(
        tipFormulario(
          'Tipo de servicio',
          'Use un tipo distinto de CUR / DIP / TEC (ej. SEG, TRM, RUNT). Quedará disponible al cobrar servicios al alumno.',
          'srv-form-tipo',
        ),
      );
    }
    return tips;
  }

  esEdicion(): boolean {
    return !!this.editando()?.idServ;
  }

  guardar() {
    const f = this.form();
    if (!f.descrServicio?.trim()) {
      this.inform('La descripción del servicio es obligatoria.');
      return;
    }
    if ((f.tarifa1 ?? 0) < 0) {
      this.inform('La tarifa 1 no puede ser negativa.');
      return;
    }

    this.saving.set(true);
    const payload: ServicioDto = {
      ...f,
      idProg: this.esEdicion() ? f.idProg : null,
    };

    const req = this.esEdicion()
      ? this.svc.actualizar(this.editando()!.idServ!, payload)
      : this.svc.crear(payload);

    req.subscribe({
      next: (r) => {
        this.saving.set(false);
        this.modalAbierto.set(false);
        this.editando.set(null);
        this.catSvc.invalidate('servicios');
        this.catSvc.invalidate('programas');
        this.inform(
          (r as { message?: string }).message ||
            (this.esEdicion() ? 'Servicio actualizado.' : 'Servicio creado correctamente.'),
        );
        this.cargar();
      },
      error: (e) => {
        this.saving.set(false);
        this.inform(e?.error?.message || 'Error al guardar', true);
      },
    });
  }

  async eliminar(s: ServicioCatalogo) {
    if (this.esServicioPrograma(s)) {
      this.inform('Los servicios de matrícula de programas se eliminan desde Programas.');
      return;
    }
    const ok = await this.confirm.open({
      title: 'Eliminar servicio',
      message: `¿Eliminar «${s.descrServicio}»?`,
      confirmLabel: 'Eliminar',
      variant: 'danger',
    });
    if (!ok || s.idServ == null) return;
    this.svc.eliminar(s.idServ).subscribe({
      next: (r) => {
        this.catSvc.invalidate('servicios');
        this.inform(r.message || 'Servicio eliminado.');
        this.cargar();
      },
      error: (e) => this.inform(e?.error?.message || 'Error al eliminar', true),
    });
  }

  num(v: unknown): number {
    if (v == null) return 0;
    if (typeof v === 'number') return v;
    return Number(v) || 0;
  }

  facturarStr(v: unknown): string {
    if (v === true || v === 'SI' || v === 'si') return 'SI';
    return 'NO';
  }

  fmtFecha(v: unknown): string {
    if (v == null || v === '') return '—';
    const d = v instanceof Date ? v : new Date(String(v));
    if (Number.isNaN(d.getTime())) return String(v);
    return d.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
  }

  private inform(text: string | null, isErr?: boolean): void {
    this.msg.set(text);
    let err = !!isErr;
    if (!err && text) {
      const t = text.toLowerCase();
      err =
        t.includes('error') ||
        t.includes('no se') ||
        t.includes('inválid') ||
        t.includes('obligator') ||
        t.includes('indique') ||
        t.includes('seleccione') ||
        t.includes('ingrese') ||
        t.includes('solo puede') ||
        t.includes('adjunte') ||
        t.includes('verifique');
    }
    this.msgError.set(err);
  }

  capId = capId;
  capTipoServ = capTipoServ;
  capVinculo = capVinculo;
  capMoneda = capMoneda;
}
