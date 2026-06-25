import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  ModuloReset,
  ProgresoOperacion,
  ResultadoReset,
  SistemaService,
} from '../../core/services/sistema.service';
import { ConfirmDialogService } from '../../shared/confirm-dialog/confirm-dialog.service';

import { BackupResetRestoreNavComponent } from './backup-reset-restore-nav.component';

@Component({
  selector: 'argo-sistema-reset',
  standalone: true,
  imports: [CommonModule, FormsModule, BackupResetRestoreNavComponent],
  templateUrl: './sistema-reset.component.html',
  styleUrls: ['./sistema-reset.component.scss'],
})
export class SistemaResetComponent implements OnInit, OnDestroy {
  private svc = inject(SistemaService);
  private confirm = inject(ConfirmDialogService);

  frase = signal('REINICIAR EMPRESA');
  modulos = signal<ModuloReset[]>([]);
  modoCompleto = signal(true);
  seleccion = signal<Record<string, boolean>>({});
  resultado = signal<ResultadoReset | null>(null);
  ejecutando = signal(false);
  msg = signal<string | null>(null);
  msgError = signal(false);
  progreso = signal<ProgresoOperacion | null>(null);

  modulosSeleccionados = computed(() => {
    const sel = this.seleccion();
    return this.modulos().filter((m) => sel[m.id]);
  });

  advertenciasActivas = computed(() => {
    const ids = new Set(this.modulosSeleccionados().map((m) => m.id));
    const avisos: string[] = [];
    for (const mod of this.modulosSeleccionados()) {
      for (const a of mod.advertencias || []) avisos.push(a);
    }
    if (!this.modoCompleto() && ids.has('contable') && !ids.has('academico')) {
      avisos.push('Contable sin Académico: pueden quedar recibos huérfanos.');
    }
    if (!this.modoCompleto() && ids.has('academico') && !ids.has('contable')) {
      avisos.push('Académico sin Contable: las matrículas conservarán saldos históricos.');
    }
    return [...new Set(avisos)];
  });

  private pollId: ReturnType<typeof setInterval> | null = null;

  password = '';
  codigoMfa = '';
  confirmacion = '';
  entendido = false;

  ngOnInit(): void {
    this.svc.infoReset().subscribe({
      next: (i) => {
        this.frase.set(i.fraseConfirmacion);
        this.modulos.set(i.modulos || []);
        const inicial: Record<string, boolean> = {};
        for (const m of i.modulos || []) inicial[m.id] = false;
        this.seleccion.set(inicial);
      },
      error: () => {},
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

  cambiarModo(completo: boolean) {
    this.modoCompleto.set(completo);
    if (completo) {
      this.seleccion.update((s) => {
        const next = { ...s };
        for (const k of Object.keys(next)) next[k] = false;
        return next;
      });
    }
  }

  estaSeleccionado(id: string): boolean {
    return this.seleccion()[id];
  }

  toggleModulo(id: string, valor: boolean) {
    this.seleccion.update((s) => ({ ...s, [id]: valor }));
  }

  seleccionarTodos() {
    this.seleccion.update((s) => {
      const next = { ...s };
      for (const k of Object.keys(next)) next[k] = true;
      return next;
    });
  }

  limpiarSeleccion() {
    this.seleccion.update((s) => {
      const next = { ...s };
      for (const k of Object.keys(next)) next[k] = false;
      return next;
    });
  }

  haySeleccionParcial(): boolean {
    return this.modulosSeleccionados().length > 0;
  }

  idsModulosEnvio(): string[] | undefined {
    if (this.modoCompleto()) return undefined;
    return this.modulosSeleccionados().map((m) => m.id);
  }

  etiquetasModulos(ids: string[] | undefined): string {
    if (!ids?.length) return '';
    const map = Object.fromEntries(this.modulos().map((m) => [m.id, m.etiqueta]));
    return ids.map((id) => map[id] || id).join(', ');
  }

  puedeEjecutar(): boolean {
    const credenciales =
      this.entendido &&
      !!this.password &&
      this.confirmacion.trim().toUpperCase() === this.frase() &&
      !this.ejecutando();
    if (!credenciales) return false;
    return this.modoCompleto() || this.haySeleccionParcial();
  }

  private mensajeConfirmacion(): string {
    if (this.modoCompleto()) {
      return (
        'Última confirmación: se borrarán TODOS los datos de la empresa actual (alumnos, pagos, ' +
        'certificados, caja, nómina…) y los consecutivos quedarán en 0. Se creará una copia de ' +
        'seguridad completa antes de borrar. ¿Ejecutar la puesta en cero?'
      );
    }
    const nombres = this.modulosSeleccionados().map((m) => m.etiqueta).join(', ');
    return (
      `Última confirmación: se borrarán solo los módulos seleccionados (${nombres}). ` +
      'El resto de datos se conservará. Se creará una copia de seguridad completa antes de borrar. ' +
      '¿Ejecutar el reset parcial?'
    );
  }

  async ejecutar() {
    const ok = await this.confirm.open({
      title: this.modoCompleto() ? 'Puesta en cero definitiva' : 'Reset parcial',
      message: this.mensajeConfirmacion(),
      variant: 'danger',
      confirmLabel: this.modoCompleto() ? 'Sí, poner en cero' : 'Sí, reset parcial',
    });
    if (!ok) return;

    this.ejecutando.set(true);
    this.msg.set(null);
    this.iniciarPolling();
    this.svc
      .resetEmpresa({
        password: this.password,
        codigoMfa: this.codigoMfa,
        confirmacion: this.confirmacion,
        modulos: this.idsModulosEnvio(),
      })
      .subscribe({
        next: (r) => {
          this.ejecutando.set(false);
          this.detenerPolling();
          this.progreso.set(null);
          this.resultado.set(r);
          this.msgError.set(false);
          this.msg.set(
            r.mensaje ||
              (r.tipoReset === 'parcial'
                ? `Reset parcial completado: ${r.coleccionesLimpiadas} tablas limpiadas.`
                : `Puesta en cero completada: ${r.coleccionesLimpiadas} tablas en cero, ${r.coleccionesConservadas} catálogos conservados.`),
          );
          this.password = '';
          this.codigoMfa = '';
          this.confirmacion = '';
          this.entendido = false;
        },
        error: (e) => {
          this.ejecutando.set(false);
          this.detenerPolling();
          this.progreso.set(null);
          this.msgError.set(true);
          const msg = e?.error?.message || 'La puesta en cero falló. No se borró nada.';
          this.msg.set(
            e?.error?.code === 'REAUTH_FAILED' || e?.status === 403
              ? `${msg} Su sesión sigue activa: corrija los datos e intente de nuevo.`
              : msg,
          );
        },
      });
  }
}
