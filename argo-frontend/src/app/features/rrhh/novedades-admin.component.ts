import { CommonModule } from '@angular/common';
import { ArgoDateInputComponent } from '../../shared/argo-date-input/argo-date-input.component';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { Empleado, EmpleadoService } from '../../core/services/empleado.service';
import { NominaService, PeriodoNomina } from '../../core/services/nomina.service';
import { RrhhCatalogService } from '../../core/services/rrhh-catalog.service';
import { ConfirmDialogService } from '../../shared/confirm-dialog/confirm-dialog.service';
import { readVistaLista, saveVistaLista, VistaLista } from '../../core/utils/vista-lista.helpers';

const CODIGOS_PILA = [
  { codigo: 'IGE', label: 'Incapacidad general (IGE)' },
  { codigo: 'LMA', label: 'Licencia maternidad/paternidad (LMA)' },
  { codigo: 'SLN', label: 'Suspensión / licencia no remunerada (SLN)' },
  { codigo: 'VAC_LR', label: 'Vacaciones o licencia remunerada' },
  { codigo: 'IRL', label: 'Incapacidad riesgo laboral (IRL)' },
];

@Component({
  selector: 'argo-novedades-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink,
    ArgoDateInputComponent,
  ],
  templateUrl: './novedades-admin.component.html',
  styleUrls: [
    './rrhh-catalog-admin.component.scss',
    './nomina-admin.component.scss',
    './rrhh-shared.scss',
  ],
})
export class NovedadesAdminComponent implements OnInit {
  private cat = inject(RrhhCatalogService);
  private empSvc = inject(EmpleadoService);
  private nominaSvc = inject(NominaService);
  private route = inject(ActivatedRoute);
  private confirm = inject(ConfirmDialogService);

  readonly codigosPila = CODIGOS_PILA;

  rows = signal<any[]>([]);
  empleados = signal<Empleado[]>([]);
  periodos = signal<PeriodoNomina[]>([]);
  filtroPeriodo = signal<number | null>(null);
  loading = signal(false);
  saving = signal(false);
  msg = signal<string | null>(null);
  msgError = signal(false);
  vista = signal<VistaLista>(readVistaLista('argo-novedades-vista'));
  mostrarForm = signal(false);
  editando = signal<any | null>(null);
  form = signal<Record<string, unknown>>({
    empleadoId: '',
    idPeriodo: '',
    tipoNovedad: '',
    codigoPila: '',
    diasNovedad: '',
    fechaInicioNovedad: '',
    fechaFinNovedad: '',
    subtipoVacLic: '',
    naturaleza: 'devengo',
    descripcion: '',
    valor: 0,
    fecha: new Date().toISOString().slice(0, 10),
    estado: 'activo',
  });

  ngOnInit(): void {
    this.empSvc.listar().subscribe({ next: (e) => this.empleados.set(e || []) });
    this.nominaSvc.listarPeriodos().subscribe({ next: (p) => this.periodos.set(p || []) });
    this.route.queryParamMap.subscribe((qp) => {
      const id = qp.get('idPeriodo');
      this.filtroPeriodo.set(id ? Number(id) : null);
      this.cargar();
    });
  }

  esPila(f: Record<string, unknown>): boolean {
    return !!f['codigoPila'];
  }

  cargar() {
    this.loading.set(true);
    const idP = this.filtroPeriodo();
    this.cat.listar<any>('novedades-nomina', idP != null ? { idPeriodo: idP } : {}).subscribe({
      next: (r) => {
        this.rows.set(r || []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  setVista(v: VistaLista) {
    this.vista.set(v);
    saveVistaLista('argo-novedades-vista', v);
  }

  patch(k: string, v: unknown) {
    this.form.update((f) => {
      const next = { ...f, [k]: v };
      if (k === 'codigoPila' && v) {
        next['tipoNovedad'] = v;
        next['naturaleza'] = 'devengo';
        next['valor'] = 0;
      }
      return next;
    });
  }

  nuevo() {
    this.editando.set(null);
    const idP = this.filtroPeriodo();
    this.form.set({
      empleadoId: '',
      idPeriodo: idP ?? '',
      tipoNovedad: '',
      codigoPila: '',
      diasNovedad: '',
      fechaInicioNovedad: '',
      fechaFinNovedad: '',
      subtipoVacLic: '',
      naturaleza: 'devengo',
      descripcion: '',
      valor: 0,
      fecha: new Date().toISOString().slice(0, 10),
      estado: 'activo',
    });
    this.mostrarForm.set(true);
  }

  nuevaPila(codigo: string) {
    this.nuevo();
    this.patch('codigoPila', codigo);
  }

  editar(r: any) {
    if (r.autoGenerada) {
      this.inform('Las novedades automáticas se regeneran desde Nómina → Generar novedades.');
      return;
    }
    this.editando.set(r);
    this.form.set({
      empleadoId: r.empleadoId,
      idPeriodo: r.idPeriodo ?? '',
      tipoNovedad: r.tipoNovedad || '',
      codigoPila: r.codigoPila || '',
      diasNovedad: r.diasNovedad ?? '',
      fechaInicioNovedad: r.fechaInicioNovedad ? String(r.fechaInicioNovedad).slice(0, 10) : '',
      fechaFinNovedad: r.fechaFinNovedad ? String(r.fechaFinNovedad).slice(0, 10) : '',
      subtipoVacLic: r.subtipoVacLic || '',
      naturaleza: r.naturaleza || 'devengo',
      descripcion: r.descripcion || '',
      valor: r.valor || 0,
      fecha: r.fecha ? String(r.fecha).slice(0, 10) : '',
      estado: r.estado || 'activo',
    });
    this.mostrarForm.set(true);
  }

  guardar() {
    const f = this.form();
    if (!f['empleadoId']) {
      this.inform('Empleado es obligatorio.', true);
      return;
    }
    if (!f['codigoPila'] && !f['tipoNovedad']) {
      this.inform('Indique tipo de novedad o código PILA.', true);
      return;
    }
    this.saving.set(true);
    const ed = this.editando();
    const payload = { ...f };
    if (payload['codigoPila'] && !payload['diasNovedad'] && payload['fechaInicioNovedad'] && payload['fechaFinNovedad']) {
      const a = new Date(String(payload['fechaInicioNovedad']));
      const b = new Date(String(payload['fechaFinNovedad']));
      const dias = Math.floor((b.getTime() - a.getTime()) / 86400000) + 1;
      if (dias > 0) payload['diasNovedad'] = Math.min(30, dias);
    }
    const req = ed
      ? this.cat.actualizar('novedades-nomina', ed.idNovedad, payload)
      : this.cat.crear('novedades-nomina', payload);
    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.mostrarForm.set(false);
        this.cargar();
        this.inform(
          f['codigoPila']
            ? 'Novedad PILA guardada. Regeneré novedades automáticas y liquide de nuevo.'
            : 'Novedad guardada.',
        );
      },
      error: (e) => {
        this.saving.set(false);
        this.inform(e?.error?.message || 'Error', true);
      },
    });
  }

  async eliminar(r: any) {
    if (r.autoGenerada) {
      this.inform('Regeneré desde Nómina.');
      return;
    }
    const ok = await this.confirm.open({
      title: 'Eliminar novedad',
      message: '¿Eliminar esta novedad manual?',
      variant: 'danger',
      confirmLabel: 'Eliminar',
    });
    if (!ok) return;
    this.cat.eliminar('novedades-nomina', r.idNovedad).subscribe({
      next: () => this.cargar(),
      error: (e) => this.inform(e?.error?.message || 'Error', true),
    });
  }

  private inform(text: string | null, isErr = false): void {
    this.msg.set(text);
    this.msgError.set(isErr);
  }

  labelPila(codigo: string): string {
    return CODIGOS_PILA.find((c) => c.codigo === codigo)?.label || codigo;
  }
}
