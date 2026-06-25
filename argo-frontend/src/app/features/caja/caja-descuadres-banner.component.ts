import { CommonModule, CurrencyPipe } from '@angular/common';
import { Component, OnInit, inject, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CajaDescuadre, CajaSesionService } from '../../core/services/caja-sesion.service';
import { AlarmaService } from '../../core/services/alarma.service';

@Component({
  selector: 'argo-caja-descuadres-banner',
  standalone: true,
  imports: [CommonModule, RouterLink, CurrencyPipe],
  template: `
    <section class="descuadres-banner card" *ngIf="pendientes().length && alarmas.tiene('alarmas.caja.descuadres')">
      <div class="banner-head">
        <strong>⚠ {{ pendientes().length }} descuadre(s) pendiente(s) de cuadrar</strong>
        <a routerLink="/app/caja/descuadres" class="link-admin">Ver reporte mensual</a>
      </div>
      <ul class="banner-list">
        <li *ngFor="let d of pendientes()">
          <span>
            Sesión #{{ d.idSesion }} · {{ d.usuarioCajero || 'Cajero' }} ·
            debe {{ d.montoDebe | currency: 'COP':'symbol-narrow':'1.0-0' }}
          </span>
          <a [routerLink]="['/app/cierres', d.idSesion]" class="link-cierre">Ir al cierre →</a>
        </li>
      </ul>
    </section>
  `,
  styles: [
    `
      .descuadres-banner {
        padding: 12px 14px;
        border-color: rgba(251, 189, 35, 0.45);
        background: rgba(251, 189, 35, 0.08);
      }
      .banner-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        margin-bottom: 8px;
      }
      .link-admin,
      .link-cierre {
        font-size: 0.82rem;
        color: var(--accent-2);
        text-decoration: none;
        white-space: nowrap;
      }
      .link-cierre {
        font-weight: 600;
      }
      .banner-list {
        margin: 0;
        padding: 0;
        list-style: none;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .banner-list li {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
        font-size: 0.88rem;
      }
    `,
  ],
})
export class CajaDescuadresBannerComponent implements OnInit {
  private cajaSvc = inject(CajaSesionService);
  readonly alarmas = inject(AlarmaService);

  pendientes = signal<CajaDescuadre[]>([]);
  loaded = output<number>();

  ngOnInit(): void {
    this.cajaSvc.listarDescuadres({ estado: 'pendiente', limit: 15 }).subscribe({
      next: (rows) => {
        const list = (rows || []).filter((d) => (d.montoDebe ?? 0) > 0 || (d.diferencia ?? 0) < 0);
        this.pendientes.set(list);
        this.loaded.emit(list.length);
      },
      error: () => this.pendientes.set([]),
    });
  }
}
