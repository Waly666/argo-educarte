import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  ConfigRequisitosDocumentosEmpleados,
  ConfigRequisitosDocumentosEmpleadosService,
  RequisitoPorCargo,
  TipoDocumentoRequisitoEmp,
} from '../../core/services/config-requisitos-documentos-empleados.service';

interface CargoRow {
  idCargo: string;
  label: string;
}

@Component({
  selector: 'argo-config-requisitos-documentos-empleados',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './config-requisitos-documentos-empleados.component.html',
  styleUrls: ['./config-requisitos-documentos-empleados.component.scss'],
})
export class ConfigRequisitosDocumentosEmpleadosComponent implements OnInit {
  private cfgSvc = inject(ConfigRequisitosDocumentosEmpleadosService);

  tiposDocumento = signal<TipoDocumentoRequisitoEmp[]>([]);
  requisitosPorCargo = signal<RequisitoPorCargo[]>([]);
  cargos = signal<CargoRow[]>([]);
  diasAvisoVencimiento = signal(30);

  saving = signal(false);
  loading = signal(true);
  msg = signal<string | null>(null);
  msgError = signal(false);

  tiposActivos = computed(() => this.tiposDocumento().filter((t) => t.activo !== false));

  ngOnInit(): void {
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

  private applyConfig(c: ConfigRequisitosDocumentosEmpleados) {
    this.tiposDocumento.set([...(c.tiposDocumento || [])]);
    this.requisitosPorCargo.set([...(c.requisitosPorCargo || [])]);
    this.diasAvisoVencimiento.set(c.diasAvisoVencimiento ?? 30);
    const cargosResp = c.cargos?.length ? c.cargos : this.cargos();
    this.cargos.set([...cargosResp]);
    this.syncRequisitosConCargos();
  }

  private syncRequisitosConCargos() {
    const caps = this.cargos();
    if (!caps.length) return;
    const map = new Map(this.requisitosPorCargo().map((r) => [r.idCargo, r]));
    const merged: RequisitoPorCargo[] = caps.map((c) => {
      const prev = map.get(c.idCargo);
      return prev || { idCargo: c.idCargo, idDocumentos: [] };
    });
    this.requisitosPorCargo.set(merged);
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
    this.requisitosPorCargo.update((rows) =>
      rows.map((r) => ({
        ...r,
        idDocumentos: r.idDocumentos.filter((d) => d !== id),
      })),
    );
  }

  patchTipo(i: number, field: keyof TipoDocumentoRequisitoEmp, value: unknown) {
    this.tiposDocumento.update((list) => {
      const copy = [...list];
      copy[i] = { ...copy[i], [field]: value };
      return copy;
    });
  }

  requisitoCargo(idCargo: string): RequisitoPorCargo {
    return this.requisitosPorCargo().find((r) => r.idCargo === idCargo) || { idCargo, idDocumentos: [] };
  }

  toggleDocCargo(idCargo: string, idDoc: string, checked: boolean) {
    this.requisitosPorCargo.update((rows) =>
      rows.map((r) => {
        if (r.idCargo !== idCargo) return r;
        const set = new Set(r.idDocumentos);
        if (checked) set.add(idDoc);
        else set.delete(idDoc);
        return { ...r, idDocumentos: [...set] };
      }),
    );
  }

  tieneDocCargo(idCargo: string, idDoc: string): boolean {
    return this.requisitoCargo(idCargo).idDocumentos.includes(idDoc);
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
        this.setMsg(`El documento «${t.nombre}» necesita un código (ej. CEDULA).`, true);
        return;
      }
    }

    this.saving.set(true);
    this.setMsg(null, false);
    this.cfgSvc
      .guardar({
        tiposDocumento: tipos,
        requisitosPorCargo: this.requisitosPorCargo(),
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
