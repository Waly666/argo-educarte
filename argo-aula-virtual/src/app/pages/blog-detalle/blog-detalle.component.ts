import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AulaApiService } from '../../core/aula-api.service';
import { BlogPost, PortalConfig } from '../../core/models';
import { mergePortalLanding } from '../../core/portal-landing';
import { PortalSeoService } from '../../core/portal-seo.service';
import { resolveUploadUrl } from '../../core/upload-url.util';

@Component({
  selector: 'av-blog-detalle',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './blog-detalle.component.html',
  styleUrl: './blog-detalle.component.scss',
})
export class BlogDetalleComponent implements OnInit {
  private api = inject(AulaApiService);
  private seo = inject(PortalSeoService);
  private route = inject(ActivatedRoute);

  config = signal<PortalConfig | null>(null);
  post = signal<BlogPost | null>(null);
  loading = signal(true);
  error = signal('');

  landing = computed(() => mergePortalLanding(this.config()?.landing));
  blogLabel = computed(() => this.landing().blog.titulo || 'Blog');

  ngOnInit() {
    this.api.config().subscribe({
      next: (c) => this.config.set(c),
      error: () => undefined,
    });

    this.route.paramMap.subscribe((params) => {
      const slug = params.get('slug') || '';
      if (!slug) {
        this.error.set('Artículo no encontrado.');
        this.loading.set(false);
        return;
      }

      this.loading.set(true);
      this.error.set('');
      this.api.blogPost(slug).subscribe({
        next: (row) => {
          this.post.set(row);
          this.loading.set(false);
          this.seo.applyBlogPost(this.config(), row);
        },
        error: (e) => {
          this.post.set(null);
          this.loading.set(false);
          this.error.set(e?.error?.message || 'Artículo no encontrado.');
        },
      });
    });
  }

  fecha(post: BlogPost): string {
    const raw = post.publicadoAt || post.createdAt;
    if (!raw) return '';
    try {
      return new Date(raw).toLocaleDateString('es-CO', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  }

  imagenUrl(rel: string): string | null {
    return resolveUploadUrl(rel) || rel || null;
  }

  parrafos(contenido: string): string[] {
    return (contenido || '')
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);
  }
}
