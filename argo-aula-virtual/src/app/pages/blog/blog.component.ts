import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AulaApiService } from '../../core/aula-api.service';
import { BlogPost, PortalConfig } from '../../core/models';
import { mergePortalLanding } from '../../core/portal-landing';
import { PortalSeoService } from '../../core/portal-seo.service';
import { resolveUploadUrl } from '../../core/upload-url.util';

const BLOG_TEXTO_DEFAULT = {
  kicker: 'Blog',
  titulo: 'Noticias y artículos',
  lead: 'Novedades, consejos y contenido de interés sobre capacitación y seguridad vial.',
  emptyTitulo: 'Próximamente publicaremos artículos',
  emptyTexto: 'Vuelva pronto para leer las últimas noticias de la institución.',
};

@Component({
  selector: 'av-blog',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './blog.component.html',
  styleUrl: './blog.component.scss',
})
export class BlogComponent implements OnInit {
  private api = inject(AulaApiService);
  private seo = inject(PortalSeoService);

  config = signal<PortalConfig | null>(null);
  posts = signal<BlogPost[]>([]);
  postsLoading = signal(true);
  postsError = signal('');

  landing = computed(() => mergePortalLanding(this.config()?.landing));
  blog = computed(() => ({ ...BLOG_TEXTO_DEFAULT, ...this.landing().blog }));

  ngOnInit() {
    this.api.config().subscribe({
      next: (c) => {
        this.config.set(c);
        this.seo.applyBlog(c);
      },
      error: () => this.seo.applyBlog(null),
    });

    this.api.listarBlog().subscribe({
      next: (rows) => {
        this.posts.set(rows);
        this.postsLoading.set(false);
      },
      error: () => {
        this.postsError.set('No se pudieron cargar los artículos en este momento.');
        this.postsLoading.set(false);
      },
    });
  }

  excerpt(post: BlogPost): string {
    const text = (post.contenido || '').replace(/\s+/g, ' ').trim();
    if (!text) return '';
    return text.length > 180 ? `${text.slice(0, 177)}…` : text;
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

  cover(post: BlogPost): string | null {
    const url = post.imagenes?.[0]?.url;
    if (!url) return null;
    return resolveUploadUrl(url) || url;
  }
}
