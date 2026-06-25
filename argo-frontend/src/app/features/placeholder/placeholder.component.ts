import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'argo-placeholder',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="card ph">
      <h1>{{ titulo }}</h1>
      <p>Este módulo aún no está implementado. Estará disponible próximamente.</p>
    </section>
  `,
  styles: [`
    .ph { text-align: center; padding: 60px 30px; }
    .ph h1 { font-size: 2rem; letter-spacing: 2px; margin-bottom: 8px; }
    .ph p  { color: var(--text-dim); margin: 0; }
  `],
})
export class PlaceholderComponent {
  @Input() titulo = 'Módulo';

  constructor(route: ActivatedRoute) {
    const data = route.snapshot.data?.['title'];
    if (data) this.titulo = data;
  }
}
