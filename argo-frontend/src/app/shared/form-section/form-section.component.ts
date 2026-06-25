import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

export type FormSectionVariant =
  | 'default'
  | 'primary'
  | 'horario'
  | 'recursos'
  | 'alumnos'
  | 'teoria'
  | 'taller'
  | 'practica'
  | 'success'
  | 'warning';

@Component({
  selector: 'argo-form-section',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './form-section.component.html',
  styleUrl: './form-section.component.scss',
})
export class FormSectionComponent {
  @Input() badge?: string | number;
  @Input() title = '';
  @Input() subtitle = '';
  @Input() variant: FormSectionVariant = 'default';
  @Input() grid = false;

  sectionClass(): Record<string, boolean> {
    return {
      'argo-form-section': true,
      [`variant-${this.variant}`]: this.variant !== 'default',
      [`section-${this.variant}`]: ['horario', 'recursos', 'alumnos', 'programa'].includes(this.variant),
      [`tipo-${this.variant}`]: ['teoria', 'taller', 'practica'].includes(this.variant),
    };
  }
}
