import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

import { JornadaCapDto } from '../../core/services/jornada-cap.service';
import { textoCumplimientoContrato, textoCumplimientoJornada } from './jornada-cumplimiento.util';

@Component({
  selector: 'argo-jornada-cumplimiento-alerta',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './jornada-cumplimiento-alerta.component.html',
  styleUrls: ['./jornada-cumplimiento-alerta.component.scss'],
})
export class JornadaCumplimientoAlertaComponent {
  @Input({ required: true }) jornada!: JornadaCapDto;
  @Input() titulo = '';

  textoContrato = () => textoCumplimientoContrato(this.jornada);
  textoJornada = () => textoCumplimientoJornada(this.jornada);
}
