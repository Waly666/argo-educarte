import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  HojaMigracion,
  LoteMigracion,
  ProgresoOperacion,
  ReporteValidacion,
  ResultadoImportacion,
  SistemaService,
} from '../../core/services/sistema.service';
import { ConfirmDialogService } from '../../shared/confirm-dialog/confirm-dialog.service';
import { MigracionMovimientosService, ConfigMigracion } from '../../core/services/migracion-movimientos.service';
import { BackupResetRestoreNavComponent } from './backup-reset-restore-nav.component';

interface OpcionHoja {
  clave: HojaMigracion;
  etiqueta: string;
  detalle: string;
}

@Component({
  selector: 'argo-sistema-migracion',
  standalone: true,
  imports: [CommonModule, FormsModule, BackupResetRestoreNavComponent],
  templateUrl: './sistema-migracion.component.html',
  styleUrls: ['./sistema-migracion.component.scss'],
})
export class SistemaMigracionComponent implements OnInit, OnDestroy {
  private svc = inject(SistemaService);
  private migCfgSvc = inject(MigracionMovimientosService);
  private confirm = inject(ConfirmDialogService);
  private pollId: ReturnType<typeof setInterval> | null = null;

  /** Qué migrar: dinámico según lo que entregue cada cliente. */
  readonly opcionesHojas: OpcionHoja[] = [
    { clave: 'programas', etiqueta: 'Programas y servicios', detalle: 'Catálogo de programas con sus tarifas (se crean si no existen)' },
    { clave: 'alumnos', etiqueta: 'Alumnos', detalle: 'Datos personales y de contacto' },
    { clave: 'matriculas', etiqueta: 'Matrículas y saldos', detalle: 'Ligados al programa y su servicio: valor, pagado y saldo pendiente' },
    { clave: 'pagos', etiqueta: 'Pagos históricos', detalle: 'Recibos del sistema anterior' },
    { clave: 'certificados', etiqueta: 'Certificados', detalle: 'Certificados ya emitidos' },
  ];
  seleccion = signal<Record<HojaMigracion, boolean>>({
    programas: true,
    alumnos: true,
    matriculas: true,
    pagos: true,
    certificados: true,
  });

  archivo = signal<File | null>(null);
  reporte = signal<ReporteValidacion | null>(null);
  resultado = signal<ResultadoImportacion | null>(null);
  lotes = signal<LoteMigracion[]>([]);
  validando = signal(false);
  importando = signal(false);
  progreso = signal<ProgresoOperacion | null>(null);
  msg = signal<string | null>(null);
  msgError = signal(false);

  actualizarExistentes = false;
  /** Modo histórico: certificados sin alumno/programa obligatorios. */
  certificadosHistoricos = false;

  configMigracion = signal<ConfigMigracion | null>(null);
  guardandoConfig = signal(false);

  ngOnInit(): void {
    this.cargarLotes();
    this.cargarConfigMigracion();
    this.sugerirModoHistorico();
  }

  cargarConfigMigracion() {
    this.migCfgSvc.obtenerConfig().subscribe({
      next: (c) => this.configMigracion.set(c),
      error: () => this.configMigracion.set({ movimientosHabilitados: false, prefijoRecibo: 'MIG-' }),
    });
  }

  guardarConfigMigracion() {
    const c = this.configMigracion();
    if (!c) return;
    this.guardandoConfig.set(true);
    this.migCfgSvc.guardarConfig(c).subscribe({
      next: (r) => {
        this.configMigracion.set(r);
        this.guardandoConfig.set(false);
        this.toast('Configuración de migración guardada.');
      },
      error: (e) => {
        this.guardandoConfig.set(false);
        this.toast(e?.error?.message || 'No se pudo guardar la configuración', true);
      },
    });
  }

  ngOnDestroy(): void {
    this.detenerPolling();
  }

  private iniciarPolling() {
    this.detenerPolling();
    this.progreso.set(null);
    this.pollId = setInterval(() => {
      this.svc.progresoOperacion().subscribe({
        next: (p) => this.progreso.set(p),
        error: () => {},
      });
    }, 700);
  }

  private detenerPolling() {
    if (this.pollId) {
      clearInterval(this.pollId);
      this.pollId = null;
    }
  }

  private toast(texto: string, esError = false) {
    this.msg.set(texto);
    this.msgError.set(esError);
    if (!esError) setTimeout(() => this.msg.set(null), 6000);
  }

  cargarLotes() {
    this.svc.lotesMigracion().subscribe({
      next: (l) => this.lotes.set(l),
      error: () => {},
    });
  }

  hojasSeleccionadas(): HojaMigracion[] {
    const sel = this.seleccion();
    return this.opcionesHojas.filter((o) => sel[o.clave]).map((o) => o.clave);
  }

  haySeleccion(): boolean {
    return this.hojasSeleccionadas().length > 0;
  }

  estaSeleccionada(clave: HojaMigracion): boolean {
    return this.seleccion()[clave];
  }

  toggleHoja(clave: HojaMigracion, valor: boolean) {
    this.seleccion.update((s) => ({ ...s, [clave]: valor }));
    this.reporte.set(null);
    this.resultado.set(null);
    this.sugerirModoHistorico();
  }

  /** Si migran certificados sin programas, activar modo histórico por defecto. */
  private sugerirModoHistorico() {
    const sel = this.hojasSeleccionadas();
    if (sel.includes('certificados') && !sel.includes('programas')) {
      this.certificadosHistoricos = true;
    }
  }

  opcionesIntegridad() {
    const sel = this.hojasSeleccionadas();
    const modoHistorico =
      this.certificadosHistoricos ||
      (sel.includes('certificados') && !sel.includes('programas'));
    return sel.includes('certificados') && modoHistorico
      ? { certificadosHistoricos: true, modoIntegridad: 'historica' as const }
      : undefined;
  }

  descargarPlantilla() {
    this.svc.descargarPlantilla(this.hojasSeleccionadas(), this.opcionesIntegridad()).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'plantilla-migracion-argo.xlsx';
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => this.toast('No se pudo descargar la plantilla', true),
    });
  }

  onArchivo(ev: Event) {
    const file = (ev.target as HTMLInputElement).files?.[0] || null;
    this.archivo.set(file);
    this.reporte.set(null);
    this.resultado.set(null);
  }

  validar() {
    const file = this.archivo();
    if (!file || !this.haySeleccion()) return;
    this.validando.set(true);
    this.reporte.set(null);
    this.resultado.set(null);
    this.svc.validarMigracion(file, this.hojasSeleccionadas(), this.opcionesIntegridad()).subscribe({
      next: (r) => {
        this.validando.set(false);
        this.reporte.set(r);
        if (r.errores.length) {
          this.toast(`Validación con ${r.errores.length} error(es). Corrija el archivo o importe solo las filas válidas.`, true);
        } else {
          this.toast('Archivo válido: puede importar.');
        }
      },
      error: (e) => {
        this.validando.set(false);
        this.toast(e?.error?.message || 'No se pudo validar el archivo', true);
      },
    });
  }

  totalValidos(): number {
    const r = this.reporte();
    if (!r) return 0;
    return this.hojasSeleccionadas().reduce((s, h) => s + (r.validos[h] || 0), 0);
  }

  etiquetaHoja(clave: HojaMigracion): string {
    return this.opcionesHojas.find((o) => o.clave === clave)?.etiqueta || clave;
  }

  async importar() {
    const file = this.archivo();
    const rep = this.reporte();
    if (!file || !rep) return;

    const conErrores = rep.errores.length
      ? ` Las ${rep.errores.length} filas con error se omitirán.`
      : '';
    const tipos = this.hojasSeleccionadas()
      .map((h) => this.etiquetaHoja(h).toLowerCase())
      .join(', ');
    const ok = await this.confirm.open({
      title: 'Importar datos',
      message:
        `Se importarán ${this.totalValidos()} registros (${tipos}).` +
        `${conErrores} ¿Continuar?`,
      variant: 'warn',
      confirmLabel: 'Sí, importar',
    });
    if (!ok) return;

    this.importando.set(true);
    this.iniciarPolling();
    this.svc.importarMigracion(
      file,
      this.hojasSeleccionadas(),
      this.actualizarExistentes,
      this.opcionesIntegridad(),
    ).subscribe({
      next: (r) => {
        this.importando.set(false);
        this.detenerPolling();
        this.resultado.set(r);
        this.archivo.set(null);
        this.reporte.set(null);
        this.toast(`Importación ${r.lote} completada.`);
        this.cargarLotes();
      },
      error: (e) => {
        this.importando.set(false);
        this.detenerPolling();
        this.toast(e?.error?.message || 'La importación falló', true);
      },
    });
  }
}
