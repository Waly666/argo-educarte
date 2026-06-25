import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { ReciboEgresoData, ReciboService } from '../../core/services/recibo.service';

@Component({
  selector: 'argo-recibo-egreso',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './recibo-egreso.component.html',
  styleUrls: ['./recibo-ingreso.component.scss'],
})
export class ReciboEgresoComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private reciboSvc = inject(ReciboService);

  data = signal<ReciboEgresoData | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('egresoId');
    if (!id) {
      this.error.set('ID de egreso no válido');
      this.loading.set(false);
      return;
    }
    this.reciboSvc.datosEgreso(id).subscribe({
      next: (d) => {
        this.data.set(d);
        this.loading.set(false);
        if ((d.config.formatoComprobanteEgreso || 'validadora') === 'media_carta') {
          this.reciboSvc.abrirHtmlEgreso(id, (m) => this.error.set(m));
        }
      },
      error: (e) => {
        this.loading.set(false);
        this.error.set(e?.error?.message || 'No se pudo cargar el comprobante');
      },
    });
  }

  imprimir() {
    const id = this.route.snapshot.paramMap.get('egresoId');
    if (id) this.reciboSvc.abrirHtmlEgreso(id, (m) => this.error.set(m));
  }

  abrirHtml() {
    const id = this.route.snapshot.paramMap.get('egresoId');
    if (id) this.reciboSvc.abrirHtmlEgreso(id, (m) => this.error.set(m));
  }

  volver() {
    window.history.length > 1 ? window.history.back() : this.router.navigate(['/app/caja/egresos']);
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

  titulo(d: ReciboEgresoData): string {
    return d.config.mensajeEncabezadoEgreso || 'COMPROBANTE DE EGRESO';
  }

  pie(d: ReciboEgresoData): string {
    return d.config.mensajePieEgreso || d.config.mensajePie || '';
  }
}
