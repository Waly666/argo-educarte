import { CommonModule } from '@angular/common';
import { Component, effect, inject, signal } from '@angular/core';

import { environment } from '../../../../environments/environment';
import { AlumnoService } from '../../../core/services/alumno.service';
import { AlumnoStore } from '../../../core/services/alumno-store.service';
import type { DocumentoRequeridoAlumno } from '../../../core/services/config-requisitos-documentos.service';

@Component({
  selector: 'argo-documentos',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './documentos.component.html',
  styleUrls: ['./documentos.component.scss'],
})
export class DocumentosComponent {
  store = inject(AlumnoStore);
  private alumnoSvc = inject(AlumnoService);

  uploads = environment.uploadsUrl;
  loading = signal(false);
  msg = signal('');
  err = signal(false);
  saving = signal<string | null>(null);
  previewLocal = signal<Record<string, string>>({});

  documentos = signal<DocumentoRequeridoAlumno[]>([]);
  tiposCap = signal<{ idTipCap: string; label: string; programas: string[] }[]>([]);
  sinMatriculas = signal(false);

  constructor() {
    effect(() => {
      const id = this.store.alumno()?._id;
      if (id) this.cargar(id);
    });
  }

  actualizar() {
    const a = this.store.alumno();
    if (!a?._id) return;
    this.previewLocal.set({});
    this.cargar(a._id);
    this.alumnoSvc.porId(a._id).subscribe({
      next: (alumno) => this.store.setAlumno(alumno),
      error: () => {},
    });
  }

  cargar(id: string) {
    this.loading.set(true);
    this.setMsg('', false);
    this.alumnoSvc.documentosRequeridos(id).subscribe({
      next: (res) => {
        this.documentos.set(res.documentos || []);
        this.tiposCap.set(res.tiposCapacitacion || []);
        this.sinMatriculas.set(!!res.sinMatriculas);
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.setMsg(e?.error?.message || 'No se pudieron cargar los requisitos.', true);
      },
    });
  }

  urlDoc(path?: string): string | null {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    return `${this.uploads}/${path}`;
  }

  preview(doc: DocumentoRequeridoAlumno): string | null {
    return this.previewLocal()[doc.id] ?? this.urlDoc(doc.url) ?? null;
  }

  tiene(doc: DocumentoRequeridoAlumno): boolean {
    return !!this.preview(doc);
  }

  onFile(doc: DocumentoRequeridoAlumno, ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      this.setMsg('Seleccione una imagen (JPEG, PNG, etc.).', true);
      return;
    }
    const r = new FileReader();
    r.onload = () => {
      this.previewLocal.update((p) => ({ ...p, [doc.id]: r.result as string }));
    };
    r.readAsDataURL(file);
    this.subir(doc.id, file);
  }

  subir(idDoc: string, file: File) {
    const a = this.store.alumno();
    if (!a?._id) return;
    this.saving.set(idDoc);
    this.setMsg('', false);
    this.alumnoSvc.subirDocumentoRequerido(a._id, idDoc, file).subscribe({
      next: (res) => {
        if (res.alumno) this.store.setAlumno(res.alumno);
        this.documentos.set(res.documentos || []);
        this.tiposCap.set(res.tiposCapacitacion || []);
        this.sinMatriculas.set(!!res.sinMatriculas);
        this.previewLocal.update((p) => {
          const copy = { ...p };
          delete copy[idDoc];
          return copy;
        });
        this.saving.set(null);
        this.setMsg('Documento guardado correctamente.', false);
      },
      error: (e) => {
        this.saving.set(null);
        this.previewLocal.update((p) => {
          const copy = { ...p };
          delete copy[idDoc];
          return copy;
        });
        this.setMsg(e?.error?.message || 'No se pudo guardar el archivo.', true);
      },
    });
  }

  abrir(doc: DocumentoRequeridoAlumno) {
    const u = this.preview(doc);
    if (u) window.open(u, '_blank', 'noopener');
  }

  cardTone(i: number): string {
    const tones = ['tone-blue', 'tone-teal', 'tone-purple', 'tone-orange'];
    return tones[i % tones.length];
  }

  iconLabel(codigo: string): string {
    const c = codigo.toUpperCase();
    if (c.includes('CEDULA')) return 'ID';
    if (c.includes('LICENCIA')) return 'LC';
    if (c.includes('DIPLOMA') || c.includes('BACH')) return 'DB';
    return codigo.slice(0, 2).toUpperCase() || 'D';
  }

  private setMsg(text: string, isErr: boolean) {
    this.msg.set(text);
    this.err.set(isErr);
  }
}
