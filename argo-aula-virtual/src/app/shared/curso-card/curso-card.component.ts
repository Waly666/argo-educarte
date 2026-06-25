import { CommonModule } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { resolveUploadUrl } from '../../core/upload-url.util';
import { CursoVirtual } from '../../core/models';

@Component({
  selector: 'av-curso-card',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './curso-card.component.html',
  styleUrl: './curso-card.component.scss',
})
export class CursoCardComponent {
  curso = input.required<CursoVirtual>();
  modo = input<'tienda' | 'cursos'>('cursos');
  logoUrl = input<string | null>(null);

  btnLabel = computed(() => (this.modo() === 'tienda' ? 'Comprar' : 'Ver curso'));

  fmtPrecio(n: number) {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n || 0);
  }

  labelNivel(n?: string | null) {
    if (!n) return '';
    return n.charAt(0) + n.slice(1).toLowerCase();
  }

  excerpt(text?: string | null, max = 140) {
    const t = String(text || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!t) return '';
    if (t.length <= max) return t;
    return `${t.slice(0, max).trim()}…`;
  }

  inicialAutor(nombre?: string | null) {
    const n = String(nombre || 'E').trim();
    return (n.charAt(0) || 'E').toUpperCase();
  }

  portadaUrl(c: CursoVirtual) {
    return resolveUploadUrl(c.urlPortadaAbsoluta || c.urlPortadaVirtual);
  }
}
