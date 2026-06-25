import { CommonModule, CurrencyPipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ProgramaDetalle } from '../../../core/services/programa.service';
import { labelTipoCert } from '../../../core/constants/tipos-certificado';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'argo-programa-datos-tab',
  standalone: true,
  imports: [CommonModule, RouterLink, CurrencyPipe],
  templateUrl: './programa-datos-tab.component.html',
  styleUrls: ['./programa-datos-tab.component.scss'],
})
export class ProgramaDatosTabComponent {
  detalle = input.required<ProgramaDetalle>();
  uploads = environment.uploadsUrl;
  labelTipoCert = labelTipoCert;

  num(v: unknown): number {
    if (v == null) return 0;
    if (typeof v === 'object' && v !== null && '$numberDecimal' in v) {
      return Number((v as { $numberDecimal: string }).$numberDecimal) || 0;
    }
    return Number(v) || 0;
  }

  portadaUrl(rel?: string | null): string | null {
    if (!rel) return null;
    const p = String(rel).replace(/^\//, '');
    return `${this.uploads}/${p}`;
  }
}
