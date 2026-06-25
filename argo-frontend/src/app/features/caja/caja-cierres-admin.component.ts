import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { CajaSesion, CajaSesionService, ResumenCaja } from '../../core/services/caja-sesion.service';
import { SedeService } from '../../core/services/sede.service';
import {
  capFecha,
  capRol,
  capValorIngreso,
} from '../../core/utils/capsule.util';
import { saveVistaLista, VistaLista } from '../../core/utils/vista-lista.helpers';

const VISTA_KEY = 'argo-cierres-vista';

@Component({
  selector: 'argo-caja-cierres-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, DatePipe, RouterLink],
  templateUrl: './caja-cierres-admin.component.html',
  styleUrls: ['./caja-cierres-admin.component.scss'],
})
export class CajaCierresAdminComponent implements OnInit {
  private cajaSvc = inject(CajaSesionService);
  readonly sedeSvc = inject(SedeService);

  mes = signal(new Date().toISOString().slice(0, 7));
  filtroCajero = signal('');
  soloDescuadre = signal(false);
  cierres = signal<CajaSesion[]>([]);
  loading = signal(false);
  msg = signal<string | null>(null);
  msgError = signal(false);
  vista = signal<VistaLista>(
    (() => {
      try {
        const v = localStorage.getItem(VISTA_KEY);
        if (v === 'lista' || v === 'cards') return v;
      } catch {
        /* ignore */
      }
      return 'cards';
    })(),
  );

  capFecha = capFecha;
  capRol = capRol;
  capValorIngreso = capValorIngreso;
  capSesion = () => 'cap cap-indigo cap-mono cap-sm';

  cierresVisibles = computed(() => {
    const rows = this.cierres();
    if (!this.soloDescuadre()) return rows;
    return rows.filter((s) => s.descuadreEstado === 'pendiente');
  });

  totalPendientes = computed(
    () => this.cierres().filter((s) => s.descuadreEstado === 'pendiente').length,
  );

  ngOnInit(): void {
    this.cargar();
  }

  setVista(v: VistaLista): void {
    this.vista.set(v);
    saveVistaLista(VISTA_KEY, v);
  }

  capEstadoDescuadre(s: CajaSesion): string {
    switch (s.descuadreEstado) {
      case 'pendiente':
        return 'cap cap-amber cap-sm';
      case 'resuelto':
        return 'cap cap-emerald cap-sm';
      case 'en_nomina':
        return 'cap cap-violet cap-sm';
      case 'descontado_nomina':
        return 'cap cap-purple cap-sm';
      default:
        return 'cap cap-emerald cap-sm';
    }
  }

  capDiferencia(s: CajaSesion): string {
    const d = this.diferencia(s);
    if (d == null) return 'cap cap-slate cap-money cap-sm';
    if (d < 0) return 'cap cap-red cap-money cap-sm';
    if (d > 0) return 'cap cap-emerald cap-money cap-sm';
    return 'cap cap-emerald cap-money cap-sm';
  }

  cargar(): void {
    this.loading.set(true);
    this.inform(null);
    const mes = this.mes();
    const desde = `${mes}-01`;
    const [y, m] = mes.split('-').map(Number);
    const ultimo = new Date(y, m, 0).getDate();
    const hasta = `${mes}-${String(ultimo).padStart(2, '0')}`;
    const usuario = this.filtroCajero().trim();

    this.cajaSvc
      .listar({
        estado: 'cerrada',
        desde,
        hasta,
        limit: 200,
        todas: true,
        porCierre: true,
        usuario: usuario || undefined,
      })
      .subscribe({
        next: (rows) => {
          this.cierres.set(rows || []);
          this.loading.set(false);
        },
        error: (e) => {
          this.loading.set(false);
          this.inform(e?.error?.message || 'No se pudo cargar los cierres');
        },
      });
  }

  ventas(s: CajaSesion): number {
    const r = s.resumen as ResumenCaja | undefined;
    return r?.ventasBrutas ?? r?.totalIngresos ?? 0;
  }

  esperado(s: CajaSesion): number {
    const r = s.resumen as ResumenCaja | undefined;
    return r?.efectivoEsperado ?? (s.saldoFinal != null ? Number(s.saldoFinal) : 0);
  }

  contado(s: CajaSesion): number | null {
    if (s.efectivoContado != null) return s.efectivoContado;
    const r = s.resumen as ResumenCaja | undefined;
    return r?.efectivoContado ?? null;
  }

  diferencia(s: CajaSesion): number | null {
    if (s.descuadreDiferencia != null) return s.descuadreDiferencia;
    if (s.diferencia != null) return s.diferencia;
    const c = this.contado(s);
    return c != null ? c - this.esperado(s) : null;
  }

  montoDebe(s: CajaSesion): number {
    return s.descuadreMontoDebe ?? 0;
  }

  estadoLabel(s: CajaSesion): string {
    switch (s.descuadreEstado) {
      case 'pendiente':
        return 'Descuadre pendiente';
      case 'resuelto':
        return 'Cuadrado';
      case 'en_nomina':
        return 'En nómina';
      case 'descontado_nomina':
        return 'Descontado nómina';
      default:
        return 'Sin descuadre';
    }
  }

  tieneDescuadrePendiente(s: CajaSesion): boolean {
    return s.descuadreEstado === 'pendiente';
  }

  private inform(text: string | null, isErr?: boolean): void {
    this.msg.set(text);
    let err = !!isErr;
    if (!err && text) {
      const t = text.toLowerCase();
      err =
        t.includes('error') ||
        t.includes('no se') ||
        t.includes('inválid') ||
        t.includes('obligator') ||
        t.includes('indique') ||
        t.includes('seleccione') ||
        t.includes('ingrese') ||
        t.includes('solo puede') ||
        t.includes('adjunte') ||
        t.includes('verifique');
    }
    this.msgError.set(err);
  }

}
