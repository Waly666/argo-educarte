import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import {
  DetalleEmpleadoNomina,
  LiquidacionNomina,
  NominaConfig,
  NominaService,
  PeriodoNomina,
} from '../../core/services/nomina.service';
import { ConfirmDialogService } from '../../shared/confirm-dialog/confirm-dialog.service';
import { readVistaLista, saveVistaLista, VistaLista } from '../../core/utils/vista-lista.helpers';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

@Component({
  selector: 'argo-nomina-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './nomina-admin.component.html',
  styleUrls: ['./nomina-admin.component.scss', './rrhh-catalog-admin.component.scss', './rrhh-shared.scss'],
})
export class NominaAdminComponent implements OnInit {
  private svc = inject(NominaService);
  private confirm = inject(ConfirmDialogService);

  periodos = signal<PeriodoNomina[]>([]);
  config = signal<NominaConfig | null>(null);
  loading = signal(false);
  msg = signal<string | null>(null);
  msgError = signal(false);
  sel = signal<PeriodoNomina | null>(null);
  liquidacion = signal<LiquidacionNomina | null>(null);
  detalleExpandido = signal<DetalleEmpleadoNomina | null>(null);

  vistaPeriodos = signal<VistaLista>(readVistaLista('argo-nomina-periodos-vista'));
  vistaLiquidacion = signal<VistaLista>(readVistaLista('argo-nomina-liquidacion-vista'));

  anoNuevo = signal(new Date().getFullYear());
  mesNuevo = signal(new Date().getMonth() + 1);

  readonly meses = MESES;

  ngOnInit(): void {
    this.svc.config().subscribe({ next: (c) => this.config.set(c) });
    this.cargar();
  }

  cargar() {
    this.loading.set(true);
    this.svc.listarPeriodos().subscribe({
      next: (r) => {
        this.periodos.set(r || []);
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.inform(e?.error?.message || 'Error', true);
      },
    });
  }

  setVistaPeriodos(v: VistaLista) {
    this.vistaPeriodos.set(v);
    saveVistaLista('argo-nomina-periodos-vista', v);
  }

  setVistaLiquidacion(v: VistaLista) {
    this.vistaLiquidacion.set(v);
    saveVistaLista('argo-nomina-liquidacion-vista', v);
  }

  crearPeriodo() {
    const ano = this.anoNuevo();
    const mes = this.mesNuevo();
    const futuro = this.esFuturo({ ano, mes } as PeriodoNomina);
    this.svc.crearPeriodo(ano, mes).subscribe({
      next: () => {
        this.inform(
          futuro
            ? 'Período creado (mes futuro — planificado). Causación y liquidación cuando llegue ese mes.'
            : 'Período creado.',
        );
        this.cargar();
      },
      error: (e) => this.inform(e?.error?.message || 'No se pudo crear', true),
    });
  }

  seleccionar(p: PeriodoNomina) {
    this.sel.set(p);
    this.detalleExpandido.set(null);
    if (p.estado === 'liquidado' || p.estado === 'cerrado' || p.estado === 'pagado') {
      this.svc.obtenerLiquidacion(p.idPeriodo).subscribe({
        next: (l) => this.liquidacion.set(l),
        error: () => this.liquidacion.set(p.liquidacion || null),
      });
    } else {
      this.liquidacion.set(p.liquidacion || null);
    }
  }

  async generarNovedades(p: PeriodoNomina) {
    const ok = await this.confirm.open({
      title: 'Generar novedades',
      message:
        'Se generan: salario, auxilio, salud/pensión 4%, FSP, retención en la fuente (si aplica), por cada empleado activo con contrato/salario. Se reemplazan las novedades automáticas del período.',
      confirmLabel: 'Generar',
      variant: 'primary',
    });
    if (!ok) return;
    this.svc.generarNovedades(p.idPeriodo).subscribe({
      next: (r) => {
        this.inform(`Novedades generadas: ${r.novedadesGeneradas}.`);
        this.cargar();
        if (r.periodo) this.seleccionar(r.periodo);
      },
      error: (e) => this.inform(e?.error?.message || 'Error', true),
    });
  }

  async liquidar(p: PeriodoNomina) {
    const ok = await this.confirm.open({
      title: 'Liquidar nómina',
      message:
        'Se recalcularán descuadres de caja pendientes del mes y se generarán deducciones por empleado. Luego se calcula devengos, deducciones y neto a pagar.',
      confirmLabel: 'Liquidar',
      variant: 'primary',
    });
    if (!ok) return;
    this.svc.liquidar(p.idPeriodo).subscribe({
      next: (l) => {
        this.liquidacion.set(l);
        this.inform(
          `Liquidación: ${l.cantidadEmpleados} empleados · Neto $${l.totalNeto.toLocaleString('es-CO')} · Patronal $${(l.totalPatronal || 0).toLocaleString('es-CO')} · Costo empresa $${(l.totalCostoEmpresa || 0).toLocaleString('es-CO')}`,
        );
        this.cargar();
        this.svc.obtenerPeriodo(p.idPeriodo).subscribe({ next: (per) => this.sel.set(per) });
      },
      error: (e) => this.inform(e?.error?.message || 'Error al liquidar', true),
    });
  }

  async cerrar(p: PeriodoNomina) {
    const ok = await this.confirm.open({
      title: 'Cerrar período',
      message: 'El período quedará cerrado. Podrá registrar el pago en caja después.',
      confirmLabel: 'Cerrar',
    });
    if (!ok) return;
    this.svc.cerrar(p.idPeriodo).subscribe({
      next: () => {
        this.inform('Período cerrado.');
        this.cargar();
      },
      error: (e) => this.inform(e?.error?.message || 'Error', true),
    });
  }

  async pagar(p: PeriodoNomina) {
    const ok = await this.confirm.open({
      title: 'Pagar nómina en caja',
      message:
        'Se creará un egreso por empleado con el neto a pagar (Flujo de caja). ¿Continuar?',
      confirmLabel: 'Registrar egresos',
      variant: 'warn',
    });
    if (!ok) return;
    this.svc.pagar(p.idPeriodo).subscribe({
      next: (r) => {
        this.inform(`Se registraron ${r.egresosCreados} egresos en caja.`);
        this.cargar();
      },
      error: (e) => this.inform(e?.error?.message || 'Error al pagar', true),
    });
  }

  labelMes(mes: number): string {
    return MESES[mes - 1] || String(mes);
  }

  esFuturo(p: PeriodoNomina): boolean {
    if (p.esFuturo != null) return p.esFuturo;
    const hoy = new Date();
    const finMesActual = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59, 999);
    const inicio = new Date(p.ano, p.mes - 1, 1);
    return inicio > finMesActual;
  }

  labelEstado(p: PeriodoNomina): string {
    if (this.esFuturo(p)) return 'planificado';
    return p.estado || 'abierto';
  }

  estadoClass(p: PeriodoNomina): string {
    if (this.esFuturo(p)) return 'muted';
    const e = (p.estado || '').toLowerCase();
    if (e === 'pagado') return 'ok';
    if (e === 'liquidado' || e === 'cerrado') return 'warn';
    if (e === 'novedades') return 'info';
    return '';
  }

  puedeGenerar(p: PeriodoNomina): boolean {
    return !this.esFuturo(p) && !['cerrado', 'pagado'].includes(p.estado);
  }

  puedeLiquidar(p: PeriodoNomina): boolean {
    return (
      !this.esFuturo(p) &&
      !['cerrado', 'pagado', 'liquidado'].includes(p.estado) &&
      (p.totalNovedades ?? 0) > 0
    );
  }

  puedeReabrir(p: PeriodoNomina): boolean {
    return !this.esFuturo(p) && ['liquidado', 'cerrado'].includes(p.estado);
  }

  async reabrir(p: PeriodoNomina) {
    const ok = await this.confirm.open({
      title: 'Reabrir período',
      message:
        'Quita la liquidación y deja el período en estado novedades/abierto para volver a causar o liquidar. ¿Continuar?',
      confirmLabel: 'Reabrir',
      variant: 'danger',
    });
    if (!ok) return;
    this.svc.reabrir(p.idPeriodo).subscribe({
      next: (r) => {
        this.liquidacion.set(null);
        this.inform(`Período reabierto (${r.estado}).`);
        this.cargar();
        if (r.periodo) this.seleccionar(r.periodo);
      },
      error: (e) => this.inform(e?.error?.message || 'No se pudo reabrir', true),
    });
  }

  verDetalle(d: DetalleEmpleadoNomina) {
    this.detalleExpandido.set(d);
  }

  diasPila(d: DetalleEmpleadoNomina): number | null {
    const n =
      d.diasPila ??
      d.pila?.diasCotizacion ??
      d.pila?.dias;
    return n != null && Number.isFinite(Number(n)) ? Number(n) : null;
  }

  etiquetaNovedadesPila(d: DetalleEmpleadoNomina): string {
    const n = d.novedadesPila;
    const p = d.pila;
    const tags: string[] = [];
    const push = (cod: string, flag?: string) => {
      if (flag) tags.push(cod);
    };
    if (n) {
      push('ING', n.ing);
      push('RET', n.ret);
      push('IGE', n.ige);
      push('LMA', n.lma);
      push('SLN', n.sln);
      if (n.vacLr) tags.push(n.vacLr === 'L' ? 'LIC' : 'VAC');
    } else if (p) {
      push('ING', p.novedadIng);
      push('RET', p.novedadRet);
      push('IGE', p.novedadIGE);
      push('LMA', p.novedadLMA);
      push('SLN', p.novedadSLN);
      if (p.novedadVAC_LR) tags.push(p.novedadVAC_LR === 'L' ? 'LIC' : 'VAC');
    }
    return tags.join(' ');
  }

  descargarPila(p: PeriodoNomina) {
    this.svc.descargarPila(p.idPeriodo).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `PILA_${p.nombre || p.idPeriodo}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        this.inform('Resumen PILA (CSV) descargado.');
      },
      error: (e) => this.inform(e?.error?.message || 'No se pudo exportar PILA', true),
    });
  }

  descargarPilaTxt(p: PeriodoNomina) {
    this.svc.descargarPilaTxt(p.idPeriodo).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `PILA_${p.nombre || p.idPeriodo}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        this.inform(
          'Planilla integrada (.txt) descargada. Valídela en el operador PILA antes de pagar.',
        );
      },
      error: (e) => this.inform(e?.error?.message || 'No se pudo exportar planilla PILA', true),
    });
  }

  abrirRecibo(p: PeriodoNomina, d: DetalleEmpleadoNomina) {
    this.svc.abrirReciboHtml(p.idPeriodo, d.empleadoId, (m) => this.inform(m, true));
  }

  private inform(text: string | null, isErr = false): void {
    this.msg.set(text);
    this.msgError.set(isErr);
  }
}
