import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import {
  AulaVirtualAdminService,
  BlogImagen,
  BlogPostAdmin,
} from '../../core/services/aula-virtual-admin.service';

@Component({
  selector: 'app-blog-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './blog-admin.component.html',
  styleUrl: './blog-admin.component.scss',
})
export class BlogAdminComponent implements OnInit {
  private api = inject(AulaVirtualAdminService);
  private uploads = environment.uploadsUrl.replace(/\/+$/, '');

  posts = signal<BlogPostAdmin[]>([]);
  loading = signal(true);
  saving = signal(false);
  uploading = signal(false);
  msg = signal('');
  err = signal(false);

  modo = signal<'lista' | 'editar'>('lista');
  editId = signal<string | null>(null);

  form = {
    titulo: '',
    slug: '',
    contenido: '',
    publicado: false,
    imagenes: [] as BlogImagen[],
  };

  postsFiltrados = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    const rows = this.posts();
    if (!q) return rows;
    return rows.filter(
      (p) =>
        p.titulo.toLowerCase().includes(q) ||
        p.autorNombre.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q),
    );
  });

  busqueda = signal('');

  ngOnInit() {
    this.cargar();
  }

  cargar() {
    this.loading.set(true);
    this.api
      .listarBlogPosts()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (rows) => this.posts.set(rows),
        error: (e) => this.flash(e?.error?.message || 'No se pudo cargar el blog', true),
      });
  }

  nuevo() {
    this.editId.set(null);
    this.form.titulo = '';
    this.form.slug = '';
    this.form.contenido = '';
    this.form.publicado = false;
    this.form.imagenes = [];
    this.modo.set('editar');
    this.msg.set('');
    this.err.set(false);
  }

  editar(post: BlogPostAdmin) {
    this.editId.set(post._id);
    this.form.titulo = post.titulo;
    this.form.slug = post.slug;
    this.form.contenido = post.contenido || '';
    this.form.publicado = !!post.publicado;
    this.form.imagenes = (post.imagenes || []).map((i) => ({ ...i }));
    this.modo.set('editar');
    this.msg.set('');
    this.err.set(false);
  }

  cancelar() {
    this.modo.set('lista');
    this.editId.set(null);
  }

  guardar() {
    const titulo = this.form.titulo.trim();
    if (!titulo) {
      this.flash('El título es obligatorio', true);
      return;
    }

    const body = {
      titulo,
      slug: this.form.slug.trim() || undefined,
      contenido: this.form.contenido.trim(),
      publicado: this.form.publicado,
      imagenes: this.form.imagenes.filter((i) => i.url?.trim()),
    };

    this.saving.set(true);
    const id = this.editId();
    const req = id
      ? this.api.actualizarBlogPost(id, body)
      : this.api.crearBlogPost(body);

    req.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (res) => {
        this.flash(res.message || 'Guardado', false);
        const post = res.post;
        this.posts.update((rows) => {
          const idx = rows.findIndex((r) => r._id === post._id);
          if (idx === -1) return [post, ...rows];
          const next = [...rows];
          next[idx] = post;
          return next;
        });
        this.modo.set('lista');
        this.editId.set(null);
      },
      error: (e) => this.flash(e?.error?.message || 'No se pudo guardar', true),
    });
  }

  confirmarEliminar(post: BlogPostAdmin) {
    if (!confirm(`¿Eliminar el artículo «${post.titulo}» y sus imágenes del servidor?`)) return;
    this.api.eliminarBlogPost(post._id).subscribe({
      next: (res) => {
        this.posts.update((rows) => rows.filter((r) => r._id !== post._id));
        this.flash(res.message || 'Artículo eliminado', false);
        if (this.editId() === post._id) this.cancelar();
      },
      error: (e) => this.flash(e?.error?.message || 'No se pudo eliminar', true),
    });
  }

  onImagenSelected(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    this.uploading.set(true);
    this.api
      .subirImagenBlog(file)
      .pipe(finalize(() => this.uploading.set(false)))
      .subscribe({
        next: (res) => {
          this.form.imagenes.push({ url: res.url, leyenda: '' });
        },
        error: (e) => this.flash(e?.error?.message || 'No se pudo subir la imagen', true),
      });
  }

  quitarImagen(i: number) {
    this.form.imagenes.splice(i, 1);
  }

  imagenUrl(rel: string): string {
    if (!rel) return '';
    if (/^https?:\/\//i.test(rel)) return rel;
    const path = rel.replace(/^\/+/, '').replace(/^uploads\//, '');
    return `${this.uploads}/${path}`;
  }

  fecha(post: BlogPostAdmin): string {
    const raw = post.publicadoAt || post.createdAt;
    if (!raw) return '—';
    try {
      return new Date(raw).toLocaleDateString('es-CO', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return '—';
    }
  }

  private flash(text: string, isErr: boolean) {
    this.msg.set(text);
    this.err.set(isErr);
  }
}
