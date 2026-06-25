import { CommonModule } from '@angular/common';
import { Component, Input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  FUNDACION_LANDING_DEFAULTS,
  mergeFundacionLanding,
  PortalFundacionLanding,
} from '../../core/constants/fundacion-landing-defaults';

@Component({
  selector: 'argo-portal-fundacion-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './portal-fundacion-editor.component.html',
  styleUrl: './portal-fundacion-editor.component.scss',
})
export class PortalFundacionEditorComponent {
  @Input({ required: true }) fundacion!: PortalFundacionLanding;
  @Input() nombreEmpresa = '';

  bloque = signal<string | null>('hero');

  toggleBloque(id: string) {
    this.bloque.update((actual) => (actual === id ? null : id));
  }

  restaurarDefaults() {
    Object.assign(this.fundacion, mergeFundacionLanding(FUNDACION_LANDING_DEFAULTS));
  }

  addDestacado() {
    this.fundacion.quienes.destacados.push({ icon: '📍', label: '', text: '' });
  }

  removeDestacado(i: number) {
    this.fundacion.quienes.destacados.splice(i, 1);
  }

  addBloque() {
    this.fundacion.quienes.bloques.push({ icon: '✦', titulo: '', texto: '' });
  }

  removeBloque(i: number) {
    this.fundacion.quienes.bloques.splice(i, 1);
  }

  addLinea() {
    this.fundacion.lineas.items.push({ icon: '🎓', title: '', text: '' });
  }

  removeLinea(i: number) {
    this.fundacion.lineas.items.splice(i, 1);
  }
}
