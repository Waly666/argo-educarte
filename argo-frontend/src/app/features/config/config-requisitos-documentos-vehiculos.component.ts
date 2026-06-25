import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  ConfigRequisitosDocumentosVehiculos,
  ConfigRequisitosDocumentosVehiculosService,
  RequisitoPorClase,
  TipoDocumentoRequisitoVehi,
} from '../../core/services/config-requisitos-documentos-vehiculos.service';
import { ClaseVehiculo, VehiculoService } from '../../core/services/vehiculo.service';

interface ClaseRow {
  idClase: string;
  label: string;
}

@Component({
  selector: 'argo-config-requisitos-documentos-vehiculos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './config-requisitos-documentos-vehiculos.component.html',
  styleUrls: ['./config-requisitos-documentos-vehiculos.component.scss'],
})
export class ConfigRequisitosDocumentosVehiculosComponent implements OnInit {
  private cfgSvc = inject(ConfigRequisitosDocumentosVehiculosService);
  private vehSvc = inject(VehiculoService);

  tiposDocumento = signal<TipoDocumentoRequisitoVehi[]>([]);
  requisitosPorClase = signal<RequisitoPorClase[]>([]);
  clases = signal<ClaseRow[]>([]);
  diasAvisoVencimiento = signal(30);

  saving = signal(false);
  loading = signal(true);
  msg = signal<string | null>(null);
  msgError = signal(false);

  tiposActivos = computed(() => this.tiposDocumento().filter((t) => t.activo !== false));

  ngOnInit(): void {
    this.vehSvc.listarClases().subscribe({
      next: (rows) => {
        const caps = (rows || []).map((r: ClaseVehiculo) => ({
          idClase: String(r.idClase ?? '').trim(),
          label: String(r.descripcion || r.idClase || '').trim(),
        })).filter((c) => c.idClase);
        this.clases.set(caps);
        this.syncRequisitosConClases();
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

  private applyConfig(c: ConfigRequisitosDocumentosVehiculos) {
    this.tiposDocumento.set([...(c.tiposDocumento || [])]);
    this.requisitosPorClase.set([...(c.requisitosPorClase || [])]);
    this.diasAvisoVencimiento.set(c.diasAvisoVencimiento ?? 30);
    this.syncRequisitosConClases();
  }

  private syncRequisitosConClases() {
    const caps = this.clases();
    if (!caps.length) return;
    const map = new Map(this.requisitosPorClase().map((r) => [r.idClase, r]));
    const merged: RequisitoPorClase[] = caps.map((c) => {
      const prev = map.get(c.idClase);
      return prev || { idClase: c.idClase, idDocumentos: [] };
    });
    this.requisitosPorClase.set(merged);
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
      controlaVencimiento: true,
      diasAvisoVencimiento: null,
    });
    this.tiposDocumento.set(list);
  }

  quitarTipo(i: number) {
    const list = [...this.tiposDocumento()];
    const id = list[i]?.id;
    list.splice(i, 1);
    this.tiposDocumento.set(list);
    if (!id) return;
    this.requisitosPorClase.update((rows) =>
      rows.map((r) => ({
        ...r,
        idDocumentos: r.idDocumentos.filter((d) => d !== id),
      })),
    );
  }

  patchTipo(i: number, field: keyof TipoDocumentoRequisitoVehi, value: unknown) {
    this.tiposDocumento.update((list) => {
      const copy = [...list];
      copy[i] = { ...copy[i], [field]: value };
      return copy;
    });
  }

  requisitoClase(idClase: string): RequisitoPorClase {
    return this.requisitosPorClase().find((r) => r.idClase === idClase) || { idClase, idDocumentos: [] };
  }

  toggleDocClase(idClase: string, idDoc: string, checked: boolean) {
    this.requisitosPorClase.update((rows) =>
      rows.map((r) => {
        if (r.idClase !== idClase) return r;
        const set = new Set(r.idDocumentos);
        if (checked) set.add(idDoc);
        else set.delete(idDoc);
        return { ...r, idDocumentos: [...set] };
      }),
    );
  }

  tieneDocClase(idClase: string, idDoc: string): boolean {
    return this.requisitoClase(idClase).idDocumentos.includes(idDoc);
  }

  patchTipoDiasAviso(i: number, raw: string) {
    const v = String(raw ?? '').trim();
    this.patchTipo(i, 'diasAvisoVencimiento', v ? Number(v) : null);
  }

  guardar() {
    const tipos = this.tiposDocumento().filter((t) => t.nombre?.trim());
    if (!tipos.length) {
      this.setMsg('Defina al menos un tipo de documento con nombre.', true);
      return;
    }
    for (const t of tipos) {
      if (!t.codigo?.trim()) {
        this.setMsg(`El documento «${t.nombre}» necesita un código (ej. SOAT).`, true);
        return;
      }
    }

    this.saving.set(true);
    this.setMsg(null, false);
    this.cfgSvc
      .guardar({
        tiposDocumento: tipos,
        requisitosPorClase: this.requisitosPorClase(),
        diasAvisoVencimiento: this.diasAvisoVencimiento(),
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
