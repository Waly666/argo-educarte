import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, signal } from '@angular/core';

import {
  PORTAL_PLANTILLA_FAMILIAS,
  PORTAL_PLANTILLAS,
  PortalPlantilla,
  PortalPlantillaFamilia,
  contarSeccionesPlantilla,
  temaDePlantilla,
} from '../../core/constants/portal-plantillas';
import { PortalTemaPreset } from '../../core/constants/portal-plantillas.types';
import { FormModalComponent } from '../../shared/form-modal/form-modal.component';
import { PortalPlantillaMockupComponent } from './portal-plantilla-mockup.component';

@Component({
  selector: 'argo-portal-plantilla-galeria',
  standalone: true,
  imports: [CommonModule, FormModalComponent, PortalPlantillaMockupComponent],
  templateUrl: './portal-plantilla-galeria.component.html',
  styleUrl: './portal-plantilla-galeria.component.scss',
})
export class PortalPlantillaGaleriaComponent {
  @Input({ required: true }) open = false;
  @Output() closed = new EventEmitter<void>();
  @Output() applied = new EventEmitter<PortalPlantilla>();

  readonly familias = PORTAL_PLANTILLA_FAMILIAS;
  readonly plantillas = PORTAL_PLANTILLAS;

  filtroFamilia = signal<PortalPlantillaFamilia | 'todos'>('todos');
  seleccionada = signal<PortalPlantilla>(PORTAL_PLANTILLAS[0]);

  plantillasFiltradas(): PortalPlantilla[] {
    const f = this.filtroFamilia();
    if (f === 'todos') return this.plantillas;
    return this.plantillas.filter((p) => p.familia === f);
  }

  seleccionar(p: PortalPlantilla): void {
    this.seleccionada.set(p);
  }

  contarSecciones(p: PortalPlantilla): number {
    return contarSeccionesPlantilla(p);
  }

  tema(p: PortalPlantilla): PortalTemaPreset {
    return (
      temaDePlantilla(p) ?? {
        colorPrimario: '#2563eb',
        colorPrimarioOscuro: '#1d4ed8',
        colorAcento: '#60a5fa',
        colorFondo: '#0b1224',
        colorSuperficie: '#121c33',
        colorTexto: '#eef3ff',
        colorTextoSecundario: '#94a3b8',
        fuente: 'Inter',
      }
    );
  }

  cerrar(): void {
    this.closed.emit();
  }

  aplicar(): void {
    this.applied.emit(this.seleccionada());
  }

  familiaActiva(id: PortalPlantillaFamilia | 'todos'): boolean {
    return this.filtroFamilia() === id;
  }

  setFamilia(id: PortalPlantillaFamilia | 'todos'): void {
    this.filtroFamilia.set(id);
    const visibles = this.plantillasFiltradas();
    if (visibles.length && !visibles.some((p) => p.id === this.seleccionada().id)) {
      this.seleccionada.set(visibles[0]);
    }
  }

  familiaLabel(p: PortalPlantilla): string {
    return this.familias.find((f) => f.id === p.familia)?.label ?? p.familia;
  }
}
