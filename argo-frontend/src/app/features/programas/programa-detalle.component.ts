import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { Programa, ProgramaDetalle, ProgramaService } from '../../core/services/programa.service';
import { labelTipoCert } from '../../core/constants/tipos-certificado';
import { ProgramaDatosTabComponent } from './tabs/programa-datos-tab.component';
import { ProgramaAlumnosTabComponent } from './tabs/programa-alumnos-tab.component';

type TabKey = 'datos' | 'alumnos';

@Component({
  selector: 'argo-programa-detalle',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    CurrencyPipe,
    DatePipe,
    ProgramaDatosTabComponent,
    ProgramaAlumnosTabComponent,
  ],
  templateUrl: './programa-detalle.component.html',
  styleUrls: ['./programa-detalle.component.scss'],
})
export class ProgramaDetalleComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private progSvc = inject(ProgramaService);

  tab = signal<TabKey>('datos');
  loading = signal(true);
  error = signal<string | null>(null);
  detalle = signal<ProgramaDetalle | null>(null);
  programaId = signal<string>('');

  programa = computed(() => this.detalle()?.programa ?? null);

  esVirtual = computed(() => !!this.programa()?.esCapacitacionVirtual);

  titulo = computed(() => this.programa()?.nombreProg || 'Ficha del programa');

  tabs: { key: TabKey; label: string }[] = [
    { key: 'datos', label: 'Datos del programa' },
    { key: 'alumnos', label: 'Alumnos matriculados' },
  ];

  ngOnInit(): void {
    this.route.paramMap.subscribe((pm) => {
      const id = pm.get('id') || '';
      this.programaId.set(id);
      if (id) this.cargar(id);
    });

    this.route.queryParamMap.subscribe((q) => {
      const t = q.get('tab');
      if (t === 'alumnos' || t === 'datos') this.tab.set(t);
    });
  }

  private cargar(id: string) {
    this.loading.set(true);
    this.error.set(null);
    this.progSvc.obtener(id).subscribe({
      next: (d) => {
        this.detalle.set(d);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar el programa.');
        this.loading.set(false);
      },
    });
  }

  setTab(key: TabKey) {
    this.tab.set(key);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: key },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  volver() {
    void this.router.navigate(['/app/programas']);
  }

  editarEnLista() {
    const p = this.programa();
    const id = p?._id || p?.idPrograma || this.programaId();
    void this.router.navigate(['/app/programas'], { queryParams: { editar: id } });
  }

  labelTipoCert = labelTipoCert;
}
