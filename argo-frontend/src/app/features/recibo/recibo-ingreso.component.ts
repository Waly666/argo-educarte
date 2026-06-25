import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { esMediaCarta, ReciboIngresoData, ReciboService } from '../../core/services/recibo.service';

@Component({
  selector: 'argo-recibo-ingreso',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './recibo-ingreso.component.html',
  styleUrls: ['./recibo-ingreso.component.scss'],
})
export class ReciboIngresoComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private reciboSvc = inject(ReciboService);

  data = signal<ReciboIngresoData | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);
  usaMediaCarta = signal(false);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('ingresoId');
    if (!id) {
      this.error.set('ID de ingreso no válido');
      this.loading.set(false);
      return;
    }
    this.reciboSvc.datos(id).subscribe({
      next: (d) => {
        const mediaCarta = esMediaCarta(d.config.formatoComprobanteIngreso);
        this.usaMediaCarta.set(mediaCarta);
        this.data.set(d);
        this.loading.set(false);
        if (mediaCarta) {
          this.reciboSvc.abrirHtml(id, (m) => this.error.set(m));
        }
      },
      error: (e) => {
        this.loading.set(false);
        this.error.set(e?.error?.message || 'No se pudo cargar el recibo');
      },
    });
  }

  imprimir() {
    const id = this.route.snapshot.paramMap.get('ingresoId');
    if (id) this.reciboSvc.abrirHtml(id, (m) => this.error.set(m));
  }

  abrirHtml() {
    const id = this.route.snapshot.paramMap.get('ingresoId');
    if (id) this.reciboSvc.abrirHtml(id);
  }

  volver() {
    window.history.length > 1 ? window.history.back() : this.router.navigate(['/app/alumnos']);
  }

  fmtMoney(v: unknown): string {
    const n = Number(v) || 0;
    return n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
  }

  fmtFecha(v: unknown): string {
    if (!v) return '';
    const d = new Date(String(v));
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
  }

  linea(): string {
    return '────────────────────────────────';
  }
}
