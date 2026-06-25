import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import {
  InscribirClaseCeaCtx,
  ProgramaCeaDto,
  ProgramacionCeaService,
  ProgramarClaseCeaCtx,
  TipoClaseCea,
} from '../../core/services/programacion-cea.service';
import { ProgramacionCeaClasesComponent, type ModoClasesCea } from './programacion-cea-clases.component';

@Component({
  selector: 'argo-programacion-cea-clases-page',
  standalone: true,
  imports: [CommonModule, RouterLink, ProgramacionCeaClasesComponent],
  templateUrl: './programacion-cea-clases-page.component.html',
  styleUrls: ['./programacion-cea-clases-page.component.scss'],
})
export class ProgramacionCeaClasesPageComponent implements OnInit {
  private svc = inject(ProgramacionCeaService);
  private route = inject(ActivatedRoute);

  programas = signal<ProgramaCeaDto[]>([]);
  loading = signal(true);
  modoClases = signal<ModoClasesCea>('grupal');
  pageTitle = signal('Clases CEA');
  pageHint = signal('');

  claseQueryId: string | null = null;
  fechaQuery: string | null = null;
  programarCtx = signal<ProgramarClaseCeaCtx | null>(null);
  inscribirCtx = signal<InscribirClaseCeaCtx | null>(null);

  ngOnInit(): void {
    this.route.data.subscribe((d) => {
      const modo = d['modoClases'] as ModoClasesCea | undefined;
      if (modo === 'grupal' || modo === 'practica') this.modoClases.set(modo);
      this.pageTitle.set(String(d['pageTitle'] || (modo === 'practica' ? 'Clases práctica CEA' : 'Clases grupales CEA')));
      this.pageHint.set(String(d['pageHint'] || ''));
    });

    this.svc.programas().subscribe({
      next: (p) => {
        this.programas.set(p || []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });

    this.route.queryParamMap.subscribe((qp) => {
      this.claseQueryId = qp.get('clase');
      this.fechaQuery = qp.get('fecha');
      if (qp.get('programar') === '1') {
        const tipo = qp.get('tipoClase');
        this.programarCtx.set({
          numDoc: qp.get('numDoc') || undefined,
          idProg: qp.get('idProg') || undefined,
          tipoClase:
            tipo && ['teoria', 'taller', 'practica'].includes(tipo) ? (tipo as TipoClaseCea) : undefined,
          origenHoras:
            qp.get('origenHoras') === 'hora_practica_extra'
              ? 'hora_practica_extra'
              : qp.get('origenHoras') === 'matricula'
                ? 'matricula'
                : undefined,
          alumnoNombre: qp.get('alumnoNombre') || undefined,
        });
        this.inscribirCtx.set(null);
      } else if (qp.get('inscribir') === '1' && qp.get('numDoc')) {
        const tipo = qp.get('tipoClase');
        this.inscribirCtx.set({
          numDoc: qp.get('numDoc')!,
          idProg: qp.get('idProg') || undefined,
          tipoClase:
            tipo && ['teoria', 'taller'].includes(tipo) ? (tipo as TipoClaseCea) : undefined,
          origenHoras:
            qp.get('origenHoras') === 'hora_practica_extra'
              ? 'hora_practica_extra'
              : qp.get('origenHoras') === 'matricula'
                ? 'matricula'
                : undefined,
          alumnoNombre: qp.get('alumnoNombre') || undefined,
        });
        this.programarCtx.set(null);
      } else {
        this.programarCtx.set(null);
        this.inscribirCtx.set(null);
      }
    });
  }
}
