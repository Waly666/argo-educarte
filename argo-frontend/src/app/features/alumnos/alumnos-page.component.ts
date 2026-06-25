import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';

import { AlumnoStore } from '../../core/services/alumno-store.service';
import { AlumnoBuscadorComponent } from './alumno-buscador.component';
import { DatosPrincipalesComponent } from './tabs/datos-principales.component';
import { ServiciosComponent } from './tabs/servicios.component';
import { PagosComponent } from './tabs/pagos.component';
import { CertificadosComponent } from './tabs/certificados.component';
import { DocumentosComponent } from './tabs/documentos.component';
import { environment } from '../../../environments/environment';

type TabKey = 'datos' | 'servicios' | 'pagos' | 'certificados' | 'documentos';

@Component({
  selector: 'argo-alumnos-page',
  standalone: true,
  imports: [
    CommonModule,
    AlumnoBuscadorComponent,
    DatosPrincipalesComponent,
    ServiciosComponent,
    PagosComponent,
    CertificadosComponent,
    DocumentosComponent,
  ],
  templateUrl: './alumnos-page.component.html',
  styleUrls: ['./alumnos-page.component.scss'],
})
export class AlumnosPageComponent {
  store = inject(AlumnoStore);

  tab = signal<TabKey>('datos');
  uploads = environment.uploadsUrl;

  alumno = computed(() => this.store.alumno());
  nombreCompleto = computed(() => this.store.nombreCompleto());

  tabs: { key: TabKey; label: string }[] = [
    { key: 'datos',        label: 'Datos Principales' },
    { key: 'servicios',    label: 'Servicios' },
    { key: 'pagos',        label: 'Pagos' },
    { key: 'certificados', label: 'Certificados' },
    { key: 'documentos',   label: 'Documentos' },
  ];

  setTab(t: TabKey) { this.tab.set(t); }

  fotoUrl(): string | null {
    const f = this.alumno()?.foto;
    if (!f) return null;
    if (f.startsWith('http')) return f;
    return `${this.uploads}/${f}`;
  }
}
