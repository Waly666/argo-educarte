import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  MetaLimpiezaTablas,
  RegistrosTabla,
  SistemaService,
  TablaColeccion,
} from '../../core/services/sistema.service';
import { ConfirmDialogService } from '../../shared/confirm-dialog/confirm-dialog.service';

import { BackupResetRestoreNavComponent } from './backup-reset-restore-nav.component';

type AccionLimpieza = 'vaciar' | 'borrar';

@Component({
  selector: 'argo-sistema-limpieza-tablas',
  standalone: true,
  imports: [CommonModule, FormsModule, BackupResetRestoreNavComponent],
  templateUrl: './sistema-limpieza-tablas.component.html',
  styleUrls: ['./sistema-limpieza-tablas.component.scss'],
})
export class SistemaLimpiezaTablasComponent implements OnInit {
  private svc = inject(SistemaService);
  private confirm = inject(ConfirmDialogService);

  tablas = signal<TablaColeccion[]>([]);
  filtroTablas = signal('');
  meta = signal<MetaLimpiezaTablas | null>(null);
  seleccionada = signal<string | null>(null);
  registros = signal<RegistrosTabla | null>(null);
  pagina = signal(1);
  buscar = signal('');
  buscarInput = '';
  seleccionIds = signal<Record<string, boolean>>({});
  cargandoTablas = signal(false);
  cargandoRegistros = signal(false);
  ejecutando = signal(false);
  msg = signal<string | null>(null);
  msgError = signal(false);

  password = '';
  codigoMfa = '';
  confirmacion = '';

  tablasFiltradas = computed(() => {
    const q = this.filtroTablas().trim().toLowerCase();
    const lista = this.tablas();
    if (!q) return lista;
    return lista.filter((t) => t.nombre.toLowerCase().includes(q));
  });

  seleccionadosCount = computed(() => {
    const sel = this.seleccionIds();
    return Object.values(sel).filter(Boolean).length;
  });

  ngOnInit(): void {
    this.svc.metaLimpiezaTablas().subscribe({
      next: (m) => this.meta.set(m),
      error: () => {},
    });
    this.cargarTablas();
  }

  cargarTablas(): void {
    this.cargandoTablas.set(true);
    this.svc.listarTablas().subscribe({
      next: ({ tablas }) => {
        this.tablas.set(tablas);
        this.cargandoTablas.set(false);
      },
      error: () => {
        this.cargandoTablas.set(false);
        this.mostrarMsg('No se pudo cargar la lista de tablas', true);
      },
    });
  }

  elegirTabla(nombre: string): void {
    this.seleccionada.set(nombre);
    this.pagina.set(1);
    this.buscar.set('');
    this.buscarInput = '';
    this.seleccionIds.set({});
    this.cargarRegistros();
  }

  cargarRegistros(): void {
    const nombre = this.seleccionada();
    if (!nombre) return;
    this.cargandoRegistros.set(true);
    this.svc.registrosTabla(nombre, this.pagina(), 50, this.buscar()).subscribe({
      next: (r: RegistrosTabla) => {
        this.registros.set(r);
        this.seleccionIds.set({});
        this.cargandoRegistros.set(false);
      },
      error: (e: { error?: { message?: string } }) => {
        this.cargandoRegistros.set(false);
        this.mostrarMsg(e?.error?.message || 'Error al cargar registros', true);
      },
    });
  }

  aplicarBusqueda(): void {
    this.buscar.set(this.buscarInput.trim());
    this.pagina.set(1);
    this.cargarRegistros();
  }

  irPagina(n: number): void {
    const total = this.registros()?.totalPaginas || 1;
    const p = Math.min(Math.max(1, n), total);
    this.pagina.set(p);
    this.cargarRegistros();
  }

  toggleFila(id: string, valor: boolean): void {
    this.seleccionIds.update((s) => ({ ...s, [id]: valor }));
  }

  togglePagina(valor: boolean): void {
    const filas = this.registros()?.filas || [];
    this.seleccionIds.update((s) => {
      const next = { ...s };
      for (const f of filas) next[f['_id']] = valor;
      return next;
    });
  }

  async vaciarTabla(): Promise<void> {
    const nombre = this.seleccionada();
    if (!nombre) return;
    const ok = await this.confirm.open({
      title: `¿Vaciar tabla "${nombre}"?`,
      message:
        'Se eliminarán TODOS los registros de esta tabla. Recomendamos crear un backup antes. ' +
        'Esta acción no se puede deshacer.',
      confirmLabel: 'Continuar',
      variant: 'danger',
    });
    if (!ok) return;
    await this.ejecutarAccion('vaciar');
  }

  async borrarSeleccionados(): Promise<void> {
    const nombre = this.seleccionada();
    const ids = Object.entries(this.seleccionIds())
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (!nombre || !ids.length) {
      this.mostrarMsg('Seleccione al menos un registro', true);
      return;
    }
    const ok = await this.confirm.open({
      title: `¿Eliminar ${ids.length} registro(s)?`,
      message: `Tabla "${nombre}". Los registros seleccionados se borrarán permanentemente.`,
      confirmLabel: 'Continuar',
      variant: 'danger',
    });
    if (!ok) return;
    await this.ejecutarAccion('borrar', ids);
  }

  private async ejecutarAccion(tipo: AccionLimpieza, ids: string[] = []): Promise<void> {
    const nombre = this.seleccionada();
    const meta = this.meta();
    if (!nombre || !meta) return;

    const frase = tipo === 'vaciar' ? meta.fraseVaciar : meta.fraseBorrar;
    if (!this.password.trim()) {
      this.mostrarMsg('Escriba su contraseña de administrador', true);
      return;
    }
    if (this.confirmacion.trim().toUpperCase() !== frase) {
      this.mostrarMsg(`Debe escribir exactamente: ${frase}`, true);
      return;
    }

    this.ejecutando.set(true);
    const cred = {
      password: this.password,
      codigoMfa: this.codigoMfa,
      confirmacion: this.confirmacion.trim().toUpperCase(),
    };

    const req =
      tipo === 'vaciar'
        ? this.svc.vaciarTabla(nombre, cred)
        : this.svc.borrarRegistrosTabla(nombre, ids, cred);

    req.subscribe({
      next: (r) => {
        this.ejecutando.set(false);
        this.password = '';
        this.codigoMfa = '';
        this.confirmacion = '';
        this.mostrarMsg(r.mensaje || 'Operación completada', false);
        this.cargarTablas();
        this.cargarRegistros();
      },
      error: (e: { error?: { message?: string } }) => {
        this.ejecutando.set(false);
        this.mostrarMsg(e?.error?.message || 'Error en la operación', true);
      },
    });
  }

  esCritica(nombre: string | null): boolean {
    if (!nombre) return false;
    return !!this.meta()?.coleccionesCriticas.includes(nombre);
  }

  private mostrarMsg(texto: string, error: boolean): void {
    this.msg.set(texto);
    this.msgError.set(error);
  }
}
