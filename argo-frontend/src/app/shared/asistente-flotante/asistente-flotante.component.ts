import { CommonModule } from '@angular/common';
import { Component, ViewEncapsulation, computed, inject } from '@angular/core';

import { ASISTENTE_MODULO_LABELS } from '../../core/constants/asistente.types';
import { AsistenteContextoService } from '../../core/services/asistente-contexto.service';

@Component({
  selector: 'argo-asistente-flotante',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './asistente-flotante.component.html',
  styleUrls: ['./asistente-flotante.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class AsistenteFlotanteComponent {
  asistente = inject(AsistenteContextoService);

  totalTips = computed(() => this.asistente.contexto()?.tips.length ?? 0);
  indiceHumano = computed(() => this.asistente.indiceTip() + 1);
  moduloLabel = computed(() => {
    const m = this.asistente.contexto()?.modulo;
    return m ? ASISTENTE_MODULO_LABELS[m] ?? 'Ayuda' : 'Ayuda';
  });
}
