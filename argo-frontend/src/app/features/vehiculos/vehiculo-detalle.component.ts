import { CommonModule } from '@angular/common';
import { ArgoDateInputComponent } from '../../shared/argo-date-input/argo-date-input.component';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, map, of } from 'rxjs';

import {
  ClaseVehiculo,
  DocVehiculoDto,
  TipoDocumentoVehiculo,
  VehiculoDto,
  VehiculoMeta,
  VehiculoService,
} from '../../core/services/vehiculo.service';
import {
  CatalogoEnumBuscarComponent,
  EnumBuscarOption,
} from '../../shared/catalogo-enum-buscar/catalogo-enum-buscar.component';
import { ConfirmDialogService } from '../../shared/confirm-dialog/confirm-dialog.service';
import { FormModalComponent } from '../../shared/form-modal/form-modal.component';
import { capId } from '../../core/utils/capsule.util';
import type { DocumentoRequeridoVehiculo, TipoDocumentoRequisitoVehi } from '../../core/services/config-requisitos-documentos-vehiculos.service';
import { environment } from '../../../environments/environment';
import { VehiculoInspeccionPanelComponent } from './vehiculo-inspeccion-panel.component';

type TabKey = 'datos' | 'documentos' | 'inspeccion';

@Component({
  selector: 'argo-vehiculo-detalle',
  standalone: true,
  imports: [CommonModule, FormsModule, CatalogoEnumBuscarComponent, FormModalComponent, VehiculoInspeccionPanelComponent,
    ArgoDateInputComponent,
  ],
  templateUrl: './vehiculo-detalle.component.html',
  styleUrls: ['./vehiculo-detalle.component.scss'],
})
export class VehiculoDetalleComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private svc = inject(VehiculoService);
  private confirm = inject(ConfirmDialogService);

  uploads = environment.uploadsUrl;
  tab = signal<TabKey>('datos');
  loading = signal(false);
  saving = signal(false);
  msg = signal<string | null>(null);
  err = signal<string | null>(null);
  esNuevo = signal(true);
  vehiculoId = signal<string | null>(null);
  abrirInspeccionHoy = signal(false);

  meta = signal<VehiculoMeta | null>(null);
  clases = signal<ClaseVehiculo[]>([]);
  tiposDocumento = signal<TipoDocumentoVehiculo[]>([]);
  documentos = signal<DocVehiculoDto[]>([]);

  form = signal<VehiculoDto>(this.formVacio());
  fotoFile = signal<File | null>(null);
  fotoPreview = signal<string | null>(null);

  docEdit = signal<DocVehiculoDto | null>(null);
  docForm = signal<Partial<DocVehiculoDto>>({});
  docArchivo = signal<File | null>(null);
  docSaving = signal(false);
  docModalOpen = signal(false);

  docsRequeridos = signal<DocumentoRequeridoVehiculo[]>([]);
  claseDoc = signal<{ idClase: string; label: string } | null>(null);
  sinClaseDoc = signal(false);
  diasAvisoGlobal = signal(30);
  tiposDocConfig = signal<TipoDocumentoRequisitoVehi[]>([]);
  loadingReq = signal(false);

  docReqActivo = computed(() => {
    const id = String(this.docForm().idDocVehi ?? '');
    if (!id) return null;
    return this.docsRequeridos().find((d) => String(d.id) === id) ?? null;
  });

  docControlaVencimiento = computed(() => {
    const id = String(this.docForm().idDocVehi ?? '');
    if (!id) return false;
    const req = this.docReqActivo();
    if (req) return req.controlaVencimiento !== false;
    const meta = this.tiposDocConfig().find((t) => String(t.id) === id);
    if (meta) return meta.controlaVencimiento !== false;
    return false;
  });

  opcionesClase = computed<EnumBuscarOption[]>(() =>
    this.clases().map((c) => ({
      value: c.idClase as string | number,
      label: String(c.descripcion || '').trim(),
    })),
  );

  opcionesCarroceria = computed<EnumBuscarOption[]>(() =>
    this.carroceriasDisponibles().map((c) => ({ value: c, label: c })),
  );

  opcionesTipoDocumento = computed<EnumBuscarOption[]>(() =>
    this.tiposDocumento().map((t) => ({
      value: t.idDocVehi as string | number,
      label: String(t.documentoVehi || '').trim(),
    })),
  );

  carroceriasDisponibles = computed(() => {
    const idClase = this.form().idClase;
    const clase = this.clases().find((c) => String(c.idClase) === String(idClase));
    return clase?.carroceriasLista || [];
  });

  tituloPagina = computed(() => {
    if (this.esNuevo()) return 'Nuevo vehículo';
    return this.form().placa || 'Ficha del vehículo';
  });

  puedeDocumentos = computed(() => !this.esNuevo() && !!this.vehiculoId());

  docsResumen = computed(() => {
    const docs = this.docsRequeridos();
    return {
      total: docs.length,
      ok: docs.filter((d) => d.subido && !d.vencido).length,
      pendientes: docs.filter((d) => !d.subido).length,
      vencidos: docs.filter((d) => d.vencido).length,
    };
  });

  buscarMarcasRemoto = (q: string): Observable<EnumBuscarOption[]> =>
    this.svc.listarMarcas(q).pipe(
      map((rows) =>
        rows.map((m) => ({
          value: m.codigoMarca || '',
          label: String(m.nombreMarca || '').trim(),
          hint: m.codigoMarca ? `Código ${m.codigoMarca}` : undefined,
        })),
      ),
    );

  buscarLineasRemoto = (q: string): Observable<EnumBuscarOption[]> => {
    const cod = this.form().codigoMarca;
    if (!cod) return of([]);
    return this.svc.listarLineas(cod, q).pipe(
      map((rows) =>
        rows.map((l) => ({
          value: l.codigoLinea as string | number,
          label: String(l.nombreLinea || '').trim(),
          hint: l.codigoLinea != null ? `Código ${l.codigoLinea}` : undefined,
        })),
      ),
    );
  };

  buscarColoresRemoto = (q: string): Observable<EnumBuscarOption[]> =>
    this.svc.listarColores(q).pipe(
      map((rows) =>
        rows.map((c) => ({
          value: c.idcolor as string | number,
          label: String(c.descripcion || '').trim(),
        })),
      ),
    );

  tabs: { key: TabKey; label: string }[] = [
    { key: 'datos', label: 'Datos del vehículo' },
    { key: 'documentos', label: 'Documentos' },
    { key: 'inspeccion', label: 'Inspección' },
  ];

  ngOnInit(): void {
    this.svc.meta().subscribe((m) => this.meta.set(m));
    this.svc.listarClases().subscribe((rows) => this.clases.set(rows));
    this.svc.listarTiposDocumento().subscribe((rows) => this.tiposDocumento.set(rows));

    this.route.queryParamMap.subscribe((q) => {
      this.aplicarTabDesdeQuery(q.get('tab'));
      this.abrirInspeccionHoy.set(q.get('inspeccionHoy') === '1');
    });

    const id = this.route.snapshot.paramMap.get('id');
    this.aplicarTabDesdeQuery(this.route.snapshot.queryParamMap.get('tab'));
    this.abrirInspeccionHoy.set(this.route.snapshot.queryParamMap.get('inspeccionHoy') === '1');

    if (id && id !== 'nuevo') {
      this.esNuevo.set(false);
      this.vehiculoId.set(id);
      this.cargar(id);
    }
  }

  private aplicarTabDesdeQuery(tabParam: string | null): void {
    if (tabParam === 'documentos') {
      this.tab.set('documentos');
      if (this.vehiculoId()) this.cargarRequisitos();
    } else if (tabParam === 'inspeccion') {
      this.tab.set('inspeccion');
    }
  }

  formVacio(): VehiculoDto {
    return {
      placa: '',
      estado: 'Libre',
    };
  }

  patch<K extends keyof VehiculoDto>(key: K, value: VehiculoDto[K]): void {
    this.form.update((f) => ({ ...f, [key]: value }));
  }

  patchDoc<K extends keyof DocVehiculoDto>(key: K, value: DocVehiculoDto[K]): void {
    this.docForm.update((f) => ({ ...f, [key]: value }));
  }

  setTab(key: TabKey): void {
    if ((key === 'documentos' || key === 'inspeccion') && !this.puedeDocumentos()) return;
    this.tab.set(key);
    if (key === 'documentos') this.cargarRequisitos();
  }

  cargar(id: string): void {
    this.loading.set(true);
    this.svc.obtener(id).subscribe({
      next: (v) => {
        this.form.set({ ...v });
        this.documentos.set(v.documentos || []);
        if (v.urlFoto) this.fotoPreview.set(this.fotoUrl(v.urlFoto));
        this.loading.set(false);
        if (this.tab() === 'documentos') this.cargarRequisitos();
      },
      error: (e) => {
        this.err.set(e?.error?.message || 'No se pudo cargar el vehículo');
        this.loading.set(false);
      },
    });
  }

  onMarcaPick(opt: EnumBuscarOption): void {
    this.form.update((f) => ({
      ...f,
      codigoMarca: String(opt.value),
      nombreMarca: opt.label,
      codigoLinea: '',
      nombreLinea: '',
    }));
  }

  onMarcaLimpiar(): void {
    this.form.update((f) => ({
      ...f,
      codigoMarca: '',
      nombreMarca: '',
      codigoLinea: '',
      nombreLinea: '',
    }));
  }

  onLineaPick(opt: EnumBuscarOption): void {
    this.patch('codigoLinea', opt.value);
    this.patch('nombreLinea', opt.label);
  }

  onLineaLimpiar(): void {
    this.patch('codigoLinea', '');
    this.patch('nombreLinea', '');
  }

  onClasePick(opt: EnumBuscarOption): void {
    const clase = this.clases().find((c) => String(c.idClase) === String(opt.value));
    this.form.update((f) => ({
      ...f,
      idClase: opt.value,
      claseVehiculo: clase?.descripcion || opt.label,
      carroceria: '',
    }));
  }

  onClaseLimpiar(): void {
    this.form.update((f) => ({
      ...f,
      idClase: '',
      claseVehiculo: '',
      carroceria: '',
    }));
  }

  onCarroceriaPick(opt: EnumBuscarOption): void {
    this.patch('carroceria', String(opt.value));
  }

  onCarroceriaLimpiar(): void {
    this.patch('carroceria', '');
  }

  onColorPick(opt: EnumBuscarOption): void {
    this.patch('idColor', opt.value);
    this.patch('color', opt.label);
  }

  onColorLimpiar(): void {
    this.patch('idColor', '');
    this.patch('color', '');
  }

  onTipoDocPick(opt: EnumBuscarOption): void {
    this.docForm.update((f) => ({
      ...f,
      idDocVehi: opt.value,
      documento: opt.label,
    }));
  }

  onFoto(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.fotoFile.set(file);
    this.fotoPreview.set(URL.createObjectURL(file));
  }

  volver(): void {
    this.router.navigate(['/app/vehiculos']);
  }

  guardar(): void {
    const dto = { ...this.form() };
    if (!dto.placa?.trim()) {
      this.err.set('La placa es obligatoria');
      return;
    }
    this.saving.set(true);
    this.err.set(null);
    this.msg.set(null);

    const foto = this.fotoFile() || undefined;
    const req = this.esNuevo()
      ? this.svc.crear(dto, foto)
      : this.svc.actualizar(String(this.vehiculoId()), dto, foto);

    req.subscribe({
      next: (v) => {
        this.saving.set(false);
        this.msg.set(this.esNuevo() ? 'Vehículo creado' : 'Cambios guardados');
        if (this.esNuevo() && v._id) {
          this.router.navigate(['/app/vehiculos', v._id], { replaceUrl: true });
          this.esNuevo.set(false);
          this.vehiculoId.set(v._id);
        }
        this.form.set({ ...v, documentos: this.documentos() });
        this.fotoFile.set(null);
      },
      error: (e) => {
        this.saving.set(false);
        const existingId = e?.error?.existingId;
        if (e?.status === 409 && existingId) {
          this.err.set(`${e.error?.message || 'Placa duplicada'}. ¿Ir al registro existente?`);
          this.confirm
            .open({
              title: 'Placa existente',
              message: 'Ya hay un vehículo con esa placa. ¿Desea abrirlo?',
              confirmLabel: 'Abrir',
              cancelLabel: 'Cancelar',
            })
            .then((ok) => {
              if (ok) this.router.navigate(['/app/vehiculos', existingId]);
            });
          return;
        }
        this.err.set(e?.error?.message || 'Error al guardar');
      },
    });
  }

  async eliminar(): Promise<void> {
    const id = this.vehiculoId();
    if (!id) return;
    const ok = await this.confirm.open({
      title: 'Eliminar vehículo',
      message: `¿Eliminar el vehículo ${this.form().placa}? Se borrarán también sus documentos.`,
      confirmLabel: 'Eliminar',
      cancelLabel: 'Cancelar',
      variant: 'danger',
    });
    if (!ok) return;
    this.svc.eliminar(id).subscribe({
      next: () => this.router.navigate(['/app/vehiculos']),
      error: (e) => this.err.set(e?.error?.message || 'No se pudo eliminar'),
    });
  }

  cargarRequisitos(): void {
    const id = this.vehiculoId();
    if (!id) return;
    this.loadingReq.set(true);
    this.svc.documentosRequeridos(id).subscribe({
      next: (res) => {
        this.docsRequeridos.set(res.documentos || []);
        this.claseDoc.set(res.clase || null);
        this.sinClaseDoc.set(!!res.sinClase);
        this.diasAvisoGlobal.set(res.diasAvisoVencimiento ?? 30);
        this.tiposDocConfig.set(res.tiposDocumento || []);
        this.loadingReq.set(false);
      },
      error: () => {
        this.loadingReq.set(false);
      },
    });
  }

  registrarRequisito(doc: DocumentoRequeridoVehiculo): void {
    if (doc.subido && doc.docId) {
      const reg = this.documentos().find((d) => d._id === doc.docId);
      if (reg) {
        this.editarDoc(reg);
        return;
      }
    }
    this.docEdit.set(null);
    this.docForm.set({
      idDocVehi: doc.id,
      documento: doc.nombre,
    });
    this.docArchivo.set(null);
    this.docModalOpen.set(true);
  }

  iconLabelReq(codigo: string): string {
    const c = codigo.toUpperCase();
    if (c.includes('SOAT')) return 'SO';
    if (c.includes('TRANSITO')) return 'LT';
    if (c.includes('TECNOMEC')) return 'RT';
    if (c.includes('PROP')) return 'TP';
    if (c.includes('SERV')) return 'TS';
    if (c.includes('BIOMET')) return 'BM';
    return codigo.slice(0, 2).toUpperCase() || 'D';
  }

  cardToneReq(i: number): string {
    const tones = ['tone-blue', 'tone-teal', 'tone-purple', 'tone-orange'];
    return tones[i % tones.length];
  }

  abrirDocRequerido(doc: DocumentoRequeridoVehiculo): void {
    const u = this.fotoUrl(doc.urlArchivo);
    if (u) window.open(u, '_blank', 'noopener');
  }

  fotoUrl(url?: string | null): string | null {
    if (!url) return null;
    if (/^https?:\/\//i.test(url)) return url;
    return `${this.uploads}/${url.replace(/^\/+/, '')}`;
  }

  abrirDocNuevo(): void {
    this.docEdit.set(null);
    this.docForm.set({});
    this.docArchivo.set(null);
    this.docModalOpen.set(true);
  }

  editarDoc(doc: DocVehiculoDto): void {
    this.docEdit.set(doc);
    this.docForm.set({ ...doc });
    this.docArchivo.set(null);
    this.docModalOpen.set(true);
  }

  cerrarDocModal(): void {
    this.docModalOpen.set(false);
    this.docEdit.set(null);
    this.docForm.set({});
    this.docArchivo.set(null);
  }

  onDocArchivo(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    this.docArchivo.set(input.files?.[0] || null);
  }

  guardarDocumento(): void {
    const id = this.vehiculoId();
    if (!id) return;
    const data = { ...this.docForm() };
    if (!data.documento?.trim()) {
      this.err.set('Seleccione o indique el tipo de documento');
      return;
    }
    const controla = this.docControlaVencimiento();
    if (controla) {
      if (!data.fechaExp) {
        this.err.set('Indique la fecha de expedición del documento.');
        return;
      }
      if (!data.fechaVence) {
        this.err.set('Indique la fecha de vencimiento del documento.');
        return;
      }
    }
    this.docSaving.set(true);
    const archivo = this.docArchivo() || undefined;
    const edit = this.docEdit();
    const save$ = edit?._id
      ? this.svc.actualizarDocumento(id, edit._id, data, archivo)
      : this.svc.crearDocumento(id, data, archivo);

    save$.subscribe({
      next: (doc) => {
        this.docSaving.set(false);
        if (edit?._id) {
          this.documentos.update((list) => list.map((d) => (d._id === doc._id ? doc : d)));
        } else {
          this.documentos.update((list) => [...list, doc]);
        }
        this.cerrarDocModal();
        this.cargarRequisitos();
        this.msg.set('Documento guardado');
      },
      error: (e) => {
        this.docSaving.set(false);
        this.err.set(e?.error?.message || 'Error al guardar documento');
      },
    });
  }

  async eliminarDoc(doc: DocVehiculoDto): Promise<void> {
    const id = this.vehiculoId();
    if (!id || !doc._id) return;
    const ok = await this.confirm.open({
      title: 'Eliminar documento',
      message: `¿Eliminar «${doc.documento}»?`,
      confirmLabel: 'Eliminar',
      cancelLabel: 'Cancelar',
      variant: 'danger',
    });
    if (!ok) return;
    this.svc.eliminarDocumento(id, doc._id).subscribe({
      next: () => {
        this.documentos.update((list) => list.filter((d) => d._id !== doc._id));
        if (this.docEdit()?._id === doc._id) this.cerrarDocModal();
        this.cargarRequisitos();
      },
      error: (e) => this.err.set(e?.error?.message || 'No se pudo eliminar'),
    });
  }

  docEstadoClass(doc: DocVehiculoDto): string {
    if (doc.vencido) return 'doc-vencido';
    if (doc.faltaFechaVence) return 'doc-pronto';
    if (doc.vencePronto) return 'doc-pronto';
    return '';
  }

  estadoChipClass(estado?: string): string {
    const e = String(estado || '').toLowerCase();
    if (e.includes('libre') || e.includes('activ') || e.includes('dispon')) return 'veh-chip--ok';
    if (e.includes('ocup') || e.includes('uso') || e.includes('ruta')) return 'veh-chip--busy';
    if (e.includes('manten') || e.includes('taller') || e.includes('repar')) return 'veh-chip--warn';
    if (e.includes('baja') || e.includes('inactiv') || e.includes('retir')) return 'veh-chip--off';
    return 'veh-chip--neutral';
  }

  capId = capId;
}
