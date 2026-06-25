import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, switchMap } from 'rxjs';

import { AlumnoListItem, AlumnoService } from '../../core/services/alumno.service';
import { AlumnoStore } from '../../core/services/alumno-store.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'argo-alumno-buscador',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './alumno-buscador.component.html',
  styleUrls: ['./alumno-buscador.component.scss'],
})
export class AlumnoBuscadorComponent implements OnInit {
  private alumnoSvc = inject(AlumnoService);
  store = inject(AlumnoStore);

  query = signal('');
  open = signal(false);
  loading = signal(false);
  results = signal<AlumnoListItem[]>([]);

  uploads = environment.uploadsUrl;

  hasResults = computed(() => this.results().length > 0);

  private q$ = new Subject<string>();

  ngOnInit(): void {
    this.q$
      .pipe(
        debounceTime(220),
        distinctUntilChanged(),
        switchMap((q) => {
          this.loading.set(true);
          return this.alumnoSvc.buscar(q, 12);
        }),
      )
      .subscribe({
        next: (rows) => {
          this.loading.set(false);
          this.results.set(rows || []);
        },
        error: () => {
          this.loading.set(false);
          this.results.set([]);
        },
      });
  }

  onInput(v: string) {
    this.query.set(v);
    this.open.set(true);
    this.q$.next((v ?? '').trim());
  }

  focus() {
    this.open.set(true);
    if (!this.query().trim()) this.q$.next('');
  }

  seleccionar(item: AlumnoListItem) {
    this.alumnoSvc.porId(item._id).subscribe({
      next: (full) => {
        this.store.setAlumno(full);
        this.query.set(`${full.nombres} ${full.apellidos} · ${full.numDoc}`);
        this.open.set(false);
      },
    });
  }

  nuevo() {
    this.store.clear();
    this.query.set('');
    this.open.set(false);
  }

  fotoUrl(f?: string): string | null {
    if (!f) return null;
    if (f.startsWith('http')) return f;
    return `${this.uploads}/${f}`;
  }

  @HostListener('document:click', ['$event'])
  outsideClick(ev: MouseEvent) {
    const t = ev.target as HTMLElement;
    if (!t.closest('.buscador-host')) this.open.set(false);
  }
}
