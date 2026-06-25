import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { AulaApiService } from '../../core/aula-api.service';
import { CategoriaVirtual, CursoVirtual, PortalConfig } from '../../core/models';
import { CursoCardComponent } from '../../shared/curso-card/curso-card.component';
import { mergePortalLanding } from '../../core/portal-landing';
import { PortalSeoService } from '../../core/portal-seo.service';
import { resolveUploadUrl } from '../../core/upload-url.util';

@Component({
  selector: 'av-cursos',
  standalone: true,
  imports: [CommonModule, CursoCardComponent],
  templateUrl: './cursos.component.html',
  styleUrl: './cursos.component.scss',
})
export class CursosComponent implements OnInit {
  private api = inject(AulaApiService);
  private route = inject(ActivatedRoute);
  private seo = inject(PortalSeoService);

  modo = signal<'tienda' | 'cursos'>('cursos');
  config = signal<PortalConfig | null>(null);
  cursos = signal<CursoVirtual[]>([]);
  categorias = signal<CategoriaVirtual[]>([]);
  q = signal('');
  catSel = signal<number | null>(null);

  landing = computed(() => mergePortalLanding(this.config()?.landing));

  logoUrl = computed(() =>
    resolveUploadUrl(this.config()?.urlLogoAbsoluta || this.config()?.urlLogo),
  );

  ngOnInit() {
    const m = this.route.snapshot.data['modo'];
    this.modo.set(m === 'tienda' ? 'tienda' : 'cursos');
    this.api.config().subscribe({
      next: (cfg) => {
        this.config.set(cfg);
        this.seo.applyCursos(cfg, this.modo());
      },
      error: () => this.seo.applyCursos(null, this.modo()),
    });
    this.api.categorias().subscribe({ next: (rows) => this.categorias.set(rows) });
    this.cargar();
  }

  cargar() {
    this.api.cursos(this.q(), this.catSel()).subscribe({ next: (rows) => this.cursos.set(rows) });
  }

  filtrarCategoria(id: number | null) {
    this.catSel.set(id);
    this.cargar();
  }
}
