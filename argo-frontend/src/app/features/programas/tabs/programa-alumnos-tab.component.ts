import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { MatriculaProgramaItem, ProgramaService } from '../../../core/services/programa.service';
import { formatNumDoc } from '../../../core/utils/num-doc.helpers';

@Component({
  selector: 'argo-programa-alumnos-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, CurrencyPipe, DatePipe],
  templateUrl: './programa-alumnos-tab.component.html',
  styleUrls: ['./programa-alumnos-tab.component.scss'],
})
export class ProgramaAlumnosTabComponent implements OnInit {
  private progSvc = inject(ProgramaService);

  programaId = input.required<string>();
  esVirtualPrograma = input(false);

  items = signal<MatriculaProgramaItem[]>([]);
  total = signal(0);
  loading = signal(false);
  busqueda = signal('');
  modalidad = signal<'todos' | 'virtual' | 'presencial'>('todos');
  pagada = signal('');

  resumenVirtual = computed(() => this.items().filter((i) => i.modalidad === 'virtual').length);
  resumenPresencial = computed(() => this.items().filter((i) => i.modalidad === 'presencial').length);

  ngOnInit(): void {
    this.cargar();
  }

  cargar() {
    const id = this.programaId();
    if (!id) return;
    this.loading.set(true);
    const mod = this.modalidad();
    this.progSvc
      .listarMatriculas(id, {
        q: this.busqueda().trim() || undefined,
        pagada: this.pagada() || undefined,
        modalidad: mod === 'todos' ? '' : mod,
        limit: 200,
      })
      .subscribe({
        next: (r) => {
          this.items.set(r.items || []);
          this.total.set(r.total || 0);
          this.loading.set(false);
        },
        error: () => {
          this.items.set([]);
          this.total.set(0);
          this.loading.set(false);
        },
      });
  }

  fmtDoc(v: number | string): string {
    return formatNumDoc(v);
  }

  fichaAlumno(item: MatriculaProgramaItem): string[] {
    return item.alumnoId ? ['/app/alumnos', item.alumnoId] : ['/app/alumnos'];
  }
}
