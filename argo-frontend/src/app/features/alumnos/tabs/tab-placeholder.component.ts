import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'argo-tab-placeholder',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card ph">
      <h2>{{ titulo }}</h2>
      <p>Esta sección estará disponible próximamente.</p>
    </div>
  `,
  styles: [`
    .ph { text-align: center; padding: 40px 20px; }
    .ph h2 { letter-spacing: 1.5px; margin-bottom: 6px; }
    .ph p  { color: var(--text-dim); margin: 0; }
  `],
})
export class TabPlaceholderComponent {
  @Input() titulo = 'Sección';
}
