import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  InformeIngresosEnLinea,
  InformeMatriculasVirtuales,
  PasarelaService,
} from '../../core/services/pasarela.service';
import { ArgoDateInputComponent } from '../../shared/argo-date-input/argo-date-input.component';

@Component({
  selector: 'argo-informes-virtuales',
  standalone: true,
  imports: [CommonModule, FormsModule, ArgoDateInputComponent],
  templateUrl: './informes-virtuales.component.html',
  styleUrls: ['./informes-virtuales.component.scss'],
})
export class InformesVirtualesComponent implements OnInit {
  private pasSvc = inject(PasarelaService);

  desde = '';
  hasta = '';
  loading = signal(false);
  matriculas = signal<InformeMatriculasVirtuales | null>(null);
  ingresos = signal<InformeIngresosEnLinea | null>(null);
  msg = signal<string | null>(null);

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.loading.set(true);
    this.msg.set(null);
    const d = this.desde || undefined;
    const h = this.hasta || undefined;
    this.pasSvc.informeMatriculas(d, h).subscribe({
      next: (m) => {
        this.matriculas.set(m);
        this.pasSvc.informeIngresos(d, h).subscribe({
          next: (i) => {
            this.ingresos.set(i);
            this.loading.set(false);
          },
          error: () => {
            this.loading.set(false);
            this.msg.set('No se pudieron cargar los ingresos en línea.');
          },
        });
      },
      error: () => {
        this.loading.set(false);
        this.msg.set('No se pudieron cargar las matrículas virtuales.');
      },
    });
  }

  fmt(v: number): string {
    return (v || 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
  }

  exportMatriculas(): void {
    this.pasSvc.exportMatriculas(this.desde || undefined, this.hasta || undefined).subscribe({
      next: (blob) => this.descargar(blob, 'matriculas-virtuales.csv'),
    });
  }

  exportIngresos(): void {
    this.pasSvc.exportIngresos(this.desde || undefined, this.hasta || undefined).subscribe({
      next: (blob) => this.descargar(blob, 'ingresos-en-linea.csv'),
    });
  }

  private descargar(blob: Blob, nombre: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    a.click();
    URL.revokeObjectURL(url);
  }
}
