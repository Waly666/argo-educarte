import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { InformeDef, InformesService } from '../../core/services/informes.service';

@Component({
  selector: 'argo-informes-hub',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './informes-hub.component.html',
  styleUrls: ['./informes-hub.component.scss'],
})
export class InformesHubComponent implements OnInit {
  private svc = inject(InformesService);

  informes = signal<InformeDef[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  ngOnInit(): void {
    this.svc.catalogo().subscribe({
      next: (r) => {
        this.informes.set(r.informes || []);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('No se pudo cargar el catálogo de informes.');
      },
    });
  }
}
