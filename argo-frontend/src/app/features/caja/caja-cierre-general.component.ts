import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { ArgoDateInputComponent } from '../../shared/argo-date-input/argo-date-input.component';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { ConfigRecibo, ConfigService } from '../../core/services/config.service';
import {
  CajaAbiertaItem,
  CajaCierreGeneral,
  CajaSesionService,
  ResumenCaja,
  EstadoCierreGeneralDia,
  ResumenCierreGeneral,
} from '../../core/services/caja-sesion.service';
import { CajaInformePrintService } from '../../core/services/caja-informe-print.service';
import { ConfirmDialogService } from '../../shared/confirm-dialog/confirm-dialog.service';
import { SedeService } from '../../core/services/sede.service';
import { CajaResumenServiciosComponent } from './caja-resumen-servicios.component';

type FichaAdmin = 'abiertas' | 'consolidado';

interface CierrePendiente {
  idSesion: number;
  usuario?: string;
  efectivoEsperado: number;
  efectivoContado: number | null;
}

@Component({
  selector: 'argo-caja-cierre-general',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, CurrencyPipe, DatePipe, CajaResumenServiciosComponent,
    ArgoDateInputComponent,
  ],
  templateUrl: './caja-cierre-general.component.html',
  styleUrls: ['./caja-cierre-general.component.scss'],
})
export class CajaCierreGeneralComponent implements OnInit {
  private cajaSvc = inject(CajaSesionService);
  private configSvc = inject(ConfigService);
  private informePrint = inject(CajaInformePrintService);
  private confirm = inject(ConfirmDialogService);
  readonly sedeSvc = inject(SedeService);

  ficha = signal<FichaAdmin>('abiertas');

  cajasAbiertas = signal<CajaAbiertaItem[]>([]);
  cierresPendientes = signal<CierrePendiente[]>([]);
  mostrarCierreMultiple = signal(false);
  msgAbiertas = signal<string | null>(null);

  fecha = signal(new Date().toISOString().slice(0, 10));
  estadoDia = signal<EstadoCierreGeneralDia | null>(null);
  observaciones = signal('');
  preview = signal<ResumenCierreGeneral | null>(null);
  historial = signal<CajaCierreGeneral[]>([]);
  msgConsolidado = signal<string | null>(null);

  empresaConfig = signal<ConfigRecibo | null>(null);
  loading = signal(false);

  hayCajasAbiertas = computed(() => this.cajasAbiertas().length > 0);
  sesionesCerradas = computed(() =>
    (this.preview()?.detalleSesiones ?? []).filter((s) => s.estado === 'cerrada' || s.fechaCierre),
  );
  puedeInforme = computed(() => this.sesionesCerradas().length > 0);
  cierreYaRegistrado = computed(() => this.estadoDia()?.registrado === true);
  puedeRegistrar = computed(() => this.puedeInforme() && !this.cierreYaRegistrado());

  ngOnInit(): void {
    this.configSvc.obtenerReciboEncabezado().subscribe({
      next: (c) => this.empresaConfig.set(c),
      error: () => this.empresaConfig.set(null),
    });
    this.cargarAbiertas();
    this.cargarHistorial();
    this.cargarEstadoDia();
  }

  setFecha(f: string): void {
    this.fecha.set(f);
    this.cargarEstadoDia();
    this.preview.set(null);
  }

  cargarEstadoDia(): void {
    this.cajaSvc.estadoCierreGeneralDia(this.fecha()).subscribe({
      next: (e) => this.estadoDia.set(e),
      error: () => this.estadoDia.set(null),
    });
  }

  setFicha(f: FichaAdmin): void {
    this.ficha.set(f);
    if (f === 'consolidado' && !this.preview()) {
      this.cargarDia();
    }
    if (f === 'abiertas') {
      this.cargarAbiertas();
    }
  }

  cargarAbiertas(): void {
    this.cajaSvc.listarAbiertas().subscribe({
      next: (r) => {
        this.cajasAbiertas.set(r || []);
        this.cierresPendientes.set(
          (r || []).map((item) => ({
            idSesion: item.sesion.idSesion,
            usuario: item.sesion.usuario,
            efectivoEsperado: item.resumenParcial.efectivoEsperado ?? item.resumenParcial.saldoTeorico ?? 0,
            efectivoContado: item.resumenParcial.efectivoEsperado ?? null,
          })),
        );
      },
    });
  }

  actualizarContado(idSesion: number, valor: string | number): void {
    const n = valor === '' || valor == null ? null : Number(valor);
    this.cierresPendientes.update((rows) =>
      rows.map((r) => (r.idSesion === idSesion ? { ...r, efectivoContado: n } : r)),
    );
  }

  abrirCierreMultiple(): void {
    if (!this.cajasAbiertas().length) {
      this.msgAbiertas.set('No hay cajas abiertas');
      return;
    }
    this.mostrarCierreMultiple.set(true);
  }

  async cerrarTodasLasCajas(): Promise<void> {
    const pendientes = this.cierresPendientes();
    for (const p of pendientes) {
      if (p.efectivoContado == null || !Number.isFinite(p.efectivoContado)) {
        this.msgAbiertas.set(`Indique el efectivo contado para ${p.usuario || 'cajero'} (#${p.idSesion})`);
        return;
      }
    }
    const ok = await this.confirm.open({
      title: 'Cerrar cajas',
      message: `¿Cerrar ${pendientes.length} caja(s)?`,
      confirmLabel: 'Cerrar cajas',
      variant: 'warn',
    });
    if (!ok) return;

    this.loading.set(true);
    this.msgAbiertas.set(null);
    this.cajaSvc
      .cerrarMultiples({
        cierres: pendientes.map((p) => ({
          idSesion: p.idSesion,
          efectivoContado: p.efectivoContado!,
          observaciones: 'Cierre administrador',
        })),
      })
      .subscribe({
        next: () => {
          this.loading.set(false);
          this.mostrarCierreMultiple.set(false);
          this.msgAbiertas.set('Cajas cerradas. Vaya a «Cierre del día» para el informe.');
          this.cargarAbiertas();
          this.cargarDia();
          this.ficha.set('consolidado');
        },
        error: (e) => {
          this.loading.set(false);
          this.msgAbiertas.set(e?.error?.message || 'No se pudieron cerrar las cajas');
        },
      });
  }

  async cerrarAjena(item: CajaAbiertaItem): Promise<void> {
    const id = item.sesion?.idSesion;
    if (!id) return;
    const esperado = item.resumenParcial.efectivoEsperado ?? item.resumenParcial.saldoTeorico ?? 0;
    const raw = await this.confirm.openPrompt({
      title: 'Efectivo contado',
      message: `Cierre de caja de ${item.sesion.usuario}. Esperado: ${esperado.toLocaleString('es-CO')} COP.`,
      inputLabel: 'Efectivo contado (COP)',
      inputType: 'number',
      defaultValue: String(Math.round(esperado)),
      confirmLabel: 'Continuar',
      variant: 'primary',
    });
    if (raw == null) return;
    const contado = Number(raw);
    if (!Number.isFinite(contado)) {
      this.msgAbiertas.set('Valor inválido');
      return;
    }
    const ok = await this.confirm.open({
      title: 'Cerrar caja',
      message: `¿Cerrar caja de ${item.sesion.usuario}?`,
      confirmLabel: 'Cerrar caja',
      variant: 'warn',
    });
    if (!ok) return;
    this.cajaSvc.cerrar(id, { efectivoContado: contado, observaciones: 'Cierre administrador' }).subscribe({
      next: () => {
        this.msgAbiertas.set(`Caja #${id} cerrada`);
        this.cargarAbiertas();
        this.cargarDia();
      },
      error: (e) => this.msgAbiertas.set(e?.error?.message || 'No se pudo cerrar'),
    });
  }

  cargarDia(): void {
    const f = this.fecha();
    this.loading.set(true);
    this.msgConsolidado.set(null);
    this.cajaSvc.previewCierreGeneral(f).subscribe({
      next: (r) => {
        const { estadoDia, ...resumen } = r;
        this.preview.set(resumen);
        if (estadoDia) this.estadoDia.set(estadoDia);
        this.loading.set(false);
        if (this.cierreYaRegistrado()) {
          this.msgConsolidado.set(
            `Ya existe cierre general para el ${f} (#${estadoDia?.cierre?.idCierreGeneral}). Elija otra fecha o reimprima el historial.`,
          );
        } else if (!r.cantidadCajas) {
          this.msgConsolidado.set(
            'No hay cajas cerradas pendientes de cierre general. Todos los cajeros deben cerrar su sesión primero.',
          );
        } else if (r.sesionesDiasAnteriores && r.sesionesDiasAnteriores > 0) {
          this.msgConsolidado.set(
            `Se consolidan ${r.cantidadCajas} caja(s), incluidas ${r.sesionesDiasAnteriores} de día(s) anterior(es) sin cierre general.`,
          );
        } else if (r.tieneCajasAbiertas) {
          this.msgConsolidado.set(
            `Aún hay ${r.cajasAbiertas.length} caja(s) abierta(s). Ciérrelas en la ficha «Cajas abiertas».`,
          );
        }
      },
      error: (e) => {
        this.loading.set(false);
        this.preview.set(null);
        this.msgConsolidado.set(e?.error?.message || 'No se pudo cargar el consolidado');
      },
    });
  }

  cajeroLabel(s: ResumenCaja): string {
    return s.nombreCajero || s.usuario || '—';
  }

  ingresosElectronicos(s: ResumenCaja): number {
    if (s.totalIngresosElectronicos != null) return Number(s.totalIngresosElectronicos) || 0;
    const total = Number(s.totalIngresos) || 0;
    const efectivo = Number(s.totalIngresosEfectivo) || 0;
    return Math.max(0, total - efectivo);
  }

  imprimirInforme(): void {
    const g = this.preview();
    if (!g?.detalleSesiones?.length) {
      this.msgConsolidado.set('No hay cierres para imprimir');
      return;
    }
    const soloCerradas: ResumenCierreGeneral = {
      ...g,
      detalleSesiones: this.sesionesCerradas(),
      cantidadCajas: this.sesionesCerradas().length,
      tieneCajasAbiertas: false,
      cajasAbiertas: [],
    };
    this.informePrint.imprimirGeneral(soloCerradas);
  }

  async registrarCierre(forzar = false): Promise<void> {
    if (this.cierreYaRegistrado()) {
      this.msgConsolidado.set('Este día ya tiene cierre general registrado.');
      return;
    }
    if (!this.puedeInforme()) {
      this.msgConsolidado.set('Debe haber al menos una caja cerrada pendiente');
      return;
    }

    const f = this.fecha();
    const n = this.sesionesCerradas().length;

    if (!forzar) {
      const ok = await this.confirm.open({
        title: 'Registrar cierre general',
        message: `Se consolidarán ${n} caja(s) cerrada(s) del día ${f} en un solo cierre general. El informe quedará guardado en el sistema.`,
        confirmLabel: 'Registrar cierre',
        variant: 'primary',
        icon: 'info',
      });
      if (!ok) return;
    }

    this.ejecutarRegistroCierreGeneral(f, forzar);
  }

  private ejecutarRegistroCierreGeneral(fechaDia: string, forzar: boolean): void {
    this.loading.set(true);
    this.msgConsolidado.set(null);
    this.cajaSvc
      .registrarCierreGeneral({
        fechaDia,
        observaciones: this.observaciones() || undefined,
        forzar,
      })
      .subscribe({
        next: (r) => {
          this.preview.set(r.resumen);
          this.loading.set(false);
          this.msgConsolidado.set(`Cierre general del ${fechaDia} guardado (#${r.cierre.idCierreGeneral})`);
          this.observaciones.set('');
          this.cargarHistorial();
          this.cargarEstadoDia();
        },
        error: (e) => {
          this.loading.set(false);
          const code = e?.error?.code;
          if (code === 'CIERRE_GENERAL_YA_EXISTE') {
            this.msgConsolidado.set(e.error?.message || 'Este día ya fue registrado');
            this.cargarEstadoDia();
            return;
          }
          if (e?.status === 409 && e?.error?.cajasAbiertas?.length) {
            void this.confirmarCierreConCajasAbiertas(e.error?.message || 'Hay cajas abiertas', fechaDia);
            return;
          }
          this.msgConsolidado.set(e?.error?.message || 'No se pudo registrar');
        },
      });
  }

  private async confirmarCierreConCajasAbiertas(mensaje: string, fechaDia: string): Promise<void> {
    const ok = await this.confirm.open({
      title: 'Cajas aún abiertas',
      message: `${mensaje}\n\n¿Desea registrar el cierre general de todos modos?`,
      confirmLabel: 'Registrar de todos modos',
      variant: 'warn',
      icon: 'warning',
    });
    if (!ok) return;
    this.ejecutarRegistroCierreGeneral(fechaDia, true);
  }

  reimprimirHistorial(c: CajaCierreGeneral): void {
    if (c.resumen) {
      this.informePrint.imprimirGeneral({ ...c.resumen, idSede: c.resumen.idSede ?? c.idSede });
      return;
    }
    const dia = c.fechaDia || String(c.periodoDesde).slice(0, 10);
    this.cajaSvc.previewCierreGeneral(dia).subscribe({
      next: (r) => this.informePrint.imprimirGeneral(r),
    });
  }

  cargarHistorial(): void {
    this.cajaSvc.listarCierresGenerales(20).subscribe({
      next: (r) => this.historial.set(r || []),
    });
  }
}
