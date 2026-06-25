import { CommonModule, CurrencyPipe } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ArqueoLinea } from '../../core/constants/caja-arqueo.constants';
import {
  lineasArqueoConSubtotal,
  totalArqueo,
} from '../../core/utils/caja-arqueo.helpers';

@Component({
  selector: 'argo-caja-arqueo-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe],
  templateUrl: './caja-arqueo-panel.component.html',
  styleUrls: ['./caja-arqueo-panel.component.scss'],
})
export class CajaArqueoPanelComponent {
  lineas = input<ArqueoLinea[]>([]);
  esperado = input<number | null>(null);
  lineasChange = output<ArqueoLinea[]>();

  filas = computed(() => lineasArqueoConSubtotal(this.lineas()));
  total = computed(() => totalArqueo(this.lineas()));
  diferencia = computed(() => {
    const esp = this.esperado();
    if (esp == null) return null;
    return this.total() - esp;
  });

  actualizarCantidad(idx: number, raw: string | number): void {
    const cantidad = Math.max(0, Math.round(Number(raw) || 0));
    const next = this.filas().map((l, i) =>
      i === idx ? { ...l, cantidad, subtotal: l.denominacion * cantidad } : l,
    );
    this.lineasChange.emit(next);
  }

  limpiar(): void {
    this.lineasChange.emit(
      this.filas().map((l) => ({ ...l, cantidad: 0, subtotal: 0 })),
    );
  }
}
