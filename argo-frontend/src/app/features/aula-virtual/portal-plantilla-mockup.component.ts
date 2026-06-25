import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

import { PortalTemaPreset } from '../../core/constants/portal-plantillas.types';

@Component({
  selector: 'argo-portal-plantilla-mockup',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './portal-plantilla-mockup.component.html',
  styleUrl: './portal-plantilla-mockup.component.scss',
})
export class PortalPlantillaMockupComponent {
  @Input({ required: true }) tema!: PortalTemaPreset;
  @Input() heroTitulo = 'Título del sitio';
  @Input() heroSubtitulo = 'Subtítulo descriptivo del portal.';
  @Input() compact = false;
  @Input() selected = false;
}
