import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { CatalogoService } from '../../core/services/catalogo.service';
import {
  ConfigRequisitosDocumentos,
  ConfigRequisitosDocumentosService,
  RequisitoPorCap,
  TipoDocumentoRequisito,
} from '../../core/services/config-requisitos-documentos.service';

interface TipoCapRow {
  idTipCap: string;
  label: string;
}

@Component({
  selector: 'argo-config-requisitos-documentos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './config-requisitos-documentos.component.html',
  styleUrls: ['./config-requisitos-documentos.component.scss'],
})
export class ConfigRequisitosDocumentosComponent implements OnInit {
  private cfgSvc = inject(ConfigRequisitosDocumentosService);
  private catSvc = inject(CatalogoService);

  tiposDocumento = signal<TipoDocumentoRequisito[]>([]);
  requisitosPorCap = signal<RequisitoPorCap[]>([]);
  tiposCap = signal<TipoCapRow[]>([]);

  saving = signal(false);
  loading = signal(true);
  msg = signal<string | null>(null);
  msgError = signal(false);

  tiposActivos = computed(() => this.tiposDocumento().filter((t) => t.activo !== false));

  ngOnInit(): void {
    this.catSvc.list('catTipoCapacitacion').subscribe({
      next: (rows) => {
        const caps = (rows || []).map((r: Record<string, unknown>) => ({
          idTipCap: String(r['idTipCap'] ?? r['id'] ?? '').trim(),
          label: String(r['tipoCap'] || r['descripcion'] || r['nombre'] || r['idTipCap'] || '').trim(),
        })).filter((c) => c.idTipCap);
        this.tiposCap.set(caps);
        this.syncRequisitosConCaps();
      },
    });

    this.cfgSvc.obtener().subscribe({
      next: (c) => {
        this.applyConfig(c);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.setMsg('No se pudo cargar la configuración', true);
      },
    });
  }

  private applyConfig(c: ConfigRequisitosDocumentos) {
    this.tiposDocumento.set([...(c.tiposDocumento || [])]);
    this.requisitosPorCap.set([...(c.requisitosPorCap || [])]);
    this.syncRequisitosConCaps();
  }

  private syncRequisitosConCaps() {
    const caps = this.tiposCap();
    if (!caps.length) return;
    const map = new Map(this.requisitosPorCap().map((r) => [r.idTipCap, r]));
    const merged: RequisitoPorCap[] = caps.map((c) => {
      const prev = map.get(c.idTipCap);
      return prev || { idTipCap: c.idTipCap, idDocumentos: [] };
    });
    this.requisitosPorCap.set(merged);
  }

  agregarTipo() {
    const list = [...this.tiposDocumento()];
    let max = 0;
    for (const t of list) {
      const n = parseInt(t.id, 10);
      if (!Number.isNaN(n) && n > max) max = n;
    }
    list.push({
      id: String(max + 1),
      codigo: '',
      nombre: '',
      descripcion: '',
      activo: true,
    });
    this.tiposDocumento.set(list);
  }

  quitarTipo(i: number) {
    const list = [...this.tiposDocumento()];
    const id = list[i]?.id;
    list.splice(i, 1);
    this.tiposDocumento.set(list);
    if (!id) return;
    this.requisitosPorCap.update((rows) =>
      rows.map((r) => ({
        ...r,
        idDocumentos: r.idDocumentos.filter((d) => d !== id),
      })),
    );
  }

  patchTipo(i: number, field: keyof TipoDocumentoRequisito, value: unknown) {
    this.tiposDocumento.update((list) => {
      const copy = [...list];
      copy[i] = { ...copy[i], [field]: value };
      return copy;
    });
  }

  requisitoCap(idTipCap: string): RequisitoPorCap {
    return this.requisitosPorCap().find((r) => r.idTipCap === idTipCap) || { idTipCap, idDocumentos: [] };
  }

  toggleDocCap(idTipCap: string, idDoc: string, checked: boolean) {
    this.requisitosPorCap.update((rows) =>
      rows.map((r) => {
        if (r.idTipCap !== idTipCap) return r;
        const set = new Set(r.idDocumentos);
        if (checked) set.add(idDoc);
        else set.delete(idDoc);
        return { ...r, idDocumentos: [...set] };
      }),
    );
  }

  tieneDocCap(idTipCap: string, idDoc: string): boolean {
    return this.requisitoCap(idTipCap).idDocumentos.includes(idDoc);
  }

  guardar() {
    const tipos = this.tiposDocumento().filter((t) => t.nombre?.trim());
    if (!tipos.length) {
      this.setMsg('Defina al menos un tipo de documento con nombre.', true);
      return;
    }
    for (const t of tipos) {
      if (!t.codigo?.trim()) {
        this.setMsg(`El documento «${t.nombre}» necesita un código (ej. CEDULA).`, true);
        return;
      }
    }

    this.saving.set(true);
    this.setMsg(null, false);
    this.cfgSvc
      .guardar({
        tiposDocumento: tipos,
        requisitosPorCap: this.requisitosPorCap(),
      })
      .subscribe({
        next: (c) => {
          this.applyConfig(c);
          this.saving.set(false);
          this.setMsg('Configuración guardada.', false);
        },
        error: (e) => {
          this.saving.set(false);
          this.setMsg(e?.error?.message || 'Error al guardar', true);
        },
      });
  }

  private setMsg(text: string | null, isErr: boolean) {
    this.msg.set(text);
    this.msgError.set(isErr);
  }
}
