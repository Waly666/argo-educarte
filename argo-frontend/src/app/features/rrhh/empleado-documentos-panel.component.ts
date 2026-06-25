import { CommonModule } from '@angular/common';
import { ArgoDateInputComponent } from '../../shared/argo-date-input/argo-date-input.component';
import { Component, Input, OnChanges, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  DocEmpleadoDto,
  EmpleadoService,
} from '../../core/services/empleado.service';
import type {
  DocumentoRequeridoEmpleado,
  TipoDocumentoRequisitoEmp,
} from '../../core/services/config-requisitos-documentos-empleados.service';
import { ConfirmDialogService } from '../../shared/confirm-dialog/confirm-dialog.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'argo-empleado-documentos-panel',
  standalone: true,
  imports: [CommonModule, FormsModule,
    ArgoDateInputComponent,
  ],
  templateUrl: './empleado-documentos-panel.component.html',
  styleUrls: ['./empleado-documentos-panel.component.scss'],
})
export class EmpleadoDocumentosPanelComponent implements OnChanges {
  private svc = inject(EmpleadoService);
  private confirm = inject(ConfirmDialogService);

  @Input({ required: true }) idEmpleado!: number;
  @Input() cargoId?: number | null;

  uploads = environment.uploadsUrl;
  loadingReq = signal(false);
  docSaving = signal(false);
  err = signal<string | null>(null);
  docsRequeridos = signal<DocumentoRequeridoEmpleado[]>([]);
  cargoDoc = signal<{ idCargo: string; label: string } | null>(null);
  sinCargoDoc = signal(false);
  diasAvisoGlobal = signal(30);
  tiposDocConfig = signal<TipoDocumentoRequisitoEmp[]>([]);
  documentos = signal<DocEmpleadoDto[]>([]);
  docEdit = signal<DocEmpleadoDto | null>(null);
  docForm = signal<Partial<DocEmpleadoDto>>({});
  docArchivo = signal<File | null>(null);

  docReqActivo = computed(() => {
    const id = String(this.docForm().idDocumento ?? '');
    if (!id) return null;
    return this.docsRequeridos().find((d) => String(d.id) === id) ?? null;
  });

  docControlaVencimiento = computed(() => {
    const id = String(this.docForm().idDocumento ?? '');
    if (!id) return false;
    const req = this.docReqActivo();
    if (req) return req.controlaVencimiento !== false;
    const meta = this.tiposDocConfig().find((t) => String(t.id) === id);
    return meta ? meta.controlaVencimiento !== false : false;
  });

  ngOnChanges(): void {
    if (this.idEmpleado) this.cargarTodo();
  }

  cargarTodo(): void {
    this.cargarRequisitos();
    this.svc.listarDocumentos(this.idEmpleado).subscribe({
      next: (rows) => this.documentos.set(rows || []),
      error: () => this.documentos.set([]),
    });
  }

  cargarRequisitos(): void {
    this.loadingReq.set(true);
    this.svc.documentosRequeridos(this.idEmpleado).subscribe({
      next: (res) => {
        this.docsRequeridos.set(res.documentos || []);
        this.cargoDoc.set(res.cargo);
        this.sinCargoDoc.set(!!res.sinCargo);
        this.diasAvisoGlobal.set(res.diasAvisoVencimiento ?? 30);
        this.tiposDocConfig.set(res.tiposDocumento || []);
        this.loadingReq.set(false);
      },
      error: (e) => {
        this.loadingReq.set(false);
        this.err.set(e?.error?.message || 'No se pudieron cargar requisitos');
      },
    });
  }

  registrarRequisito(doc: DocumentoRequeridoEmpleado): void {
    this.docEdit.set(doc.subido && doc.docId ? { _id: doc.docId, idDocumento: doc.id, documento: doc.nombre, numero: doc.numero, fechaExp: doc.fechaExp, fechaVence: doc.fechaVence, urlArchivo: doc.urlArchivo } : null);
    this.docForm.set({
      idDocumento: doc.id,
      documento: doc.nombre,
      numero: doc.numero || '',
      fechaExp: doc.fechaExp ? String(doc.fechaExp).slice(0, 10) : '',
      fechaVence: doc.fechaVence ? String(doc.fechaVence).slice(0, 10) : '',
      urlArchivo: doc.urlArchivo,
    });
    this.docArchivo.set(null);
  }

  abrirDocNuevo(): void {
    this.docEdit.set(null);
    this.docForm.set({});
    this.docArchivo.set(null);
  }

  patchDoc<K extends keyof DocEmpleadoDto>(key: K, value: DocEmpleadoDto[K]): void {
    this.docForm.update((f) => ({ ...f, [key]: value }));
  }

  onTipoDocChange(raw: string): void {
    const id = String(raw || '').trim();
    const meta = this.tiposDocConfig().find((t) => String(t.id) === id);
    this.docForm.update((f) => ({
      ...f,
      idDocumento: id,
      documento: meta?.nombre || f.documento,
    }));
  }

  onDocArchivo(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    this.docArchivo.set(input.files?.[0] || null);
  }

  archivoUrl(url?: string | null): string | null {
    if (!url) return null;
    if (/^https?:\/\//i.test(url)) return url;
    return `${this.uploads}/${url.replace(/^\/+/, '')}`;
  }

  docEstadoClass(d: DocEmpleadoDto): string {
    if (d.vencido) return 'doc-vencido';
    if (d.faltaFechaVence) return 'doc-pronto';
    if (d.vencePronto) return 'doc-pronto';
    return '';
  }

  guardarDocumento(): void {
    const data = { ...this.docForm() };
    if (!data.documento?.trim()) {
      this.err.set('Seleccione o indique el tipo de documento');
      return;
    }
    if (this.docControlaVencimiento()) {
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
    this.err.set(null);
    const archivo = this.docArchivo() || undefined;
    const edit = this.docEdit();
    const save$ = edit?._id
      ? this.svc.actualizarDocumento(this.idEmpleado, edit._id, data, archivo)
      : this.svc.crearDocumento(this.idEmpleado, data, archivo);

    save$.subscribe({
      next: (doc) => {
        this.docSaving.set(false);
        if (edit?._id) {
          this.documentos.update((list) => list.map((d) => (d._id === doc._id ? doc : d)));
        } else {
          this.documentos.update((list) => [...list, doc]);
        }
        this.abrirDocNuevo();
        this.cargarRequisitos();
      },
      error: (e) => {
        this.docSaving.set(false);
        this.err.set(e?.error?.message || 'Error al guardar documento');
      },
    });
  }

  async eliminarDoc(doc: DocEmpleadoDto): Promise<void> {
    if (!doc._id) return;
    const ok = await this.confirm.open({
      title: 'Eliminar documento',
      message: `¿Eliminar «${doc.documento}»?`,
      confirmLabel: 'Eliminar',
      cancelLabel: 'Cancelar',
      variant: 'danger',
    });
    if (!ok) return;
    this.svc.eliminarDocumento(this.idEmpleado, doc._id).subscribe({
      next: () => {
        this.documentos.update((list) => list.filter((d) => d._id !== doc._id));
        this.cargarRequisitos();
      },
      error: (e) => this.err.set(e?.error?.message || 'No se pudo eliminar'),
    });
  }

  editarDoc(doc: DocEmpleadoDto): void {
    this.docEdit.set(doc);
    this.docForm.set({
      ...doc,
      fechaExp: doc.fechaExp ? String(doc.fechaExp).slice(0, 10) : '',
      fechaVence: doc.fechaVence ? String(doc.fechaVence).slice(0, 10) : '',
    });
    this.docArchivo.set(null);
  }

  abrirArchivo(doc: DocEmpleadoDto | DocumentoRequeridoEmpleado): void {
    const u = this.archivoUrl(doc.urlArchivo);
    if (u) window.open(u, '_blank', 'noopener');
  }
}
