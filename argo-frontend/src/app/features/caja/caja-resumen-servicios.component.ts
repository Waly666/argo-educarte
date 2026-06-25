import { CommonModule, CurrencyPipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';

import { ResumenServicioIngreso, ResumenServicioPorSesion } from '../../core/services/caja-sesion.service';

@Component({
  selector: 'argo-caja-resumen-servicios',
  standalone: true,
  imports: [CommonModule, CurrencyPipe],
  templateUrl: './caja-resumen-servicios.component.html',
  styleUrls: ['./caja-resumen-servicios.component.scss'],
})
export class CajaResumenServiciosComponent {
  servicios = input<ResumenServicioIngreso[]>([]);
  serviciosPorSesion = input<ResumenServicioPorSesion[]>([]);
  /** compacto = Servicio + Total (consolidado, sin sesión). agrupado = con recibos/efectivo/otros. */
  modo = input<'agrupado' | 'compacto'>('agrupado');
  titulo = input('Resumen por servicios');

  filas = computed(() => [...(this.servicios() ?? [])].sort((a, b) => (b.total ?? 0) - (a.total ?? 0)));

  filasCompacto = computed(() => {
    const map = new Map<string, number>();
    const agregar = (nombre: string | undefined, total: number | undefined) => {
      const key = String(nombre || 'Ingreso').trim() || 'Ingreso';
      map.set(key, (map.get(key) || 0) + (Number(total) || 0));
    };
    for (const s of this.servicios() ?? []) {
      agregar(s.descripcion || s.servicio, s.total);
    }
    if (!map.size) {
      for (const s of this.serviciosPorSesion() ?? []) {
        agregar(s.servicio, s.total);
      }
    }
    return [...map.entries()]
      .map(([servicio, total]) => ({ servicio, total }))
      .sort((a, b) => b.total - a.total);
  });

  totales = computed(() => {
    const rows = this.filas();
    return {
      cantidad: rows.reduce((a, s) => a + (s.cantidad ?? 0), 0),
      efectivo: rows.reduce((a, s) => a + (s.efectivo ?? 0), 0),
      otros: rows.reduce((a, s) => a + (s.otros ?? 0), 0),
      total: rows.reduce((a, s) => a + (s.total ?? 0), 0),
    };
  });

  totalCompacto = computed(() => this.filasCompacto().reduce((a, s) => a + s.total, 0));

  hayDatos = computed(() =>
    this.modo() === 'compacto' ? this.filasCompacto().length > 0 : this.filas().length > 0,
  );
}
