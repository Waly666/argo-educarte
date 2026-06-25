import { CommonModule } from '@angular/common';
import { ArgoDateInputComponent } from '../../shared/argo-date-input/argo-date-input.component';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { Empleado, EmpleadoService } from '../../core/services/empleado.service';
import { RrhhCatalogService } from '../../core/services/rrhh-catalog.service';
import { ConfirmDialogService } from '../../shared/confirm-dialog/confirm-dialog.service';
import { readVistaLista, saveVistaLista, VistaLista } from '../../core/utils/vista-lista.helpers';

@Component({
  selector: 'argo-contratos-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink,
    ArgoDateInputComponent,
  ],
  templateUrl: './contratos-admin.component.html',
  styleUrls: ['./rrhh-catalog-admin.component.scss', './rrhh-shared.scss'],
})
export class ContratosAdminComponent implements OnInit {
  private cat = inject(RrhhCatalogService);
  private empSvc = inject(EmpleadoService);
  private confirm = inject(ConfirmDialogService);

  rows = signal<any[]>([]);
  empleados = signal<Empleado[]>([]);
  loading = signal(false);
  saving = signal(false);
  msg = signal<string | null>(null);
  msgError = signal(false);
  vista = signal<VistaLista>(readVistaLista('argo-contratos-vista'));
  mostrarForm = signal(false);
  editando = signal<any | null>(null);
  form = signal<Record<string, unknown>>({
    empleadoId: '',
    numeroContrato: '',
    tipoContrato: '',
    fechaInicio: '',
    fechaFin: '',
    salario: 0,
    auxilioTransporte: false,
    horasSemanales: 48,
    estado: 'activo',
  });

  ngOnInit(): void {
    this.empSvc.listar().subscribe({ next: (e) => this.empleados.set(e || []) });
    this.cargar();
  }

  cargar() {
    this.loading.set(true);
    this.cat.listar('contratos').subscribe({
      next: (r) => {
        this.rows.set(r || []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  setVista(v: VistaLista) {
    this.vista.set(v);
    saveVistaLista('argo-contratos-vista', v);
  }

  patch(k: string, v: unknown) {
    this.form.update((f) => ({ ...f, [k]: v }));
  }

  nuevo() {
    this.editando.set(null);
    this.mostrarForm.set(true);
  }

  editar(r: any) {
    this.editando.set(r);
    this.form.set({
      empleadoId: r.empleadoId,
      numeroContrato: r.numeroContrato || '',
      tipoContrato: r.tipoContrato || '',
      fechaInicio: r.fechaInicio ? String(r.fechaInicio).slice(0, 10) : '',
      fechaFin: r.fechaFin ? String(r.fechaFin).slice(0, 10) : '',
      salario: r.salario || 0,
      auxilioTransporte: !!r.auxilioTransporte,
      horasSemanales: r.horasSemanales || 48,
      estado: r.estado || 'activo',
    });
    this.mostrarForm.set(true);
  }

  guardar() {
    const f = this.form();
    if (!f['empleadoId']) {
      this.inform('Seleccione empleado.', true);
      return;
    }
    this.saving.set(true);
    const ed = this.editando();
    const req = ed
      ? this.cat.actualizar('contratos', ed.idContrato, f)
      : this.cat.crear('contratos', f);
    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.mostrarForm.set(false);
        this.cargar();
      },
      error: (e) => {
        this.saving.set(false);
        this.inform(e?.error?.message || 'Error', true);
      },
    });
  }

  async eliminar(r: any) {
    const ok = await this.confirm.open({
      title: 'Eliminar contrato',
      message: '¿Eliminar este contrato?',
      variant: 'danger',
      confirmLabel: 'Eliminar',
    });
    if (!ok) return;
    this.cat.eliminar('contratos', r.idContrato).subscribe({ next: () => this.cargar() });
  }

  private inform(text: string | null, isErr = false): void {
    this.msg.set(text);
    this.msgError.set(isErr);
  }
}
