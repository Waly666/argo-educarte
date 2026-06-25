import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import {
  AulaVirtualAdminService,
  CategoriaVirtual,
  CursoVirtualAdmin,
  GuardarCursoVirtualBody,
  NIVELES_VIRTUAL,
  SesionMeet,
  VirtualConfig,
} from '../../core/services/aula-virtual-admin.service';
import { environment } from '../../../environments/environment';
import { AulaVirtualProgresoAlumnosComponent } from './aula-virtual-progreso-alumnos.component';

type TabCurso = 'portal' | 'reglas' | 'contenido' | 'alumnos';

@Component({
  selector: 'argo-aula-virtual-curso-detalle',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AulaVirtualProgresoAlumnosComponent],
  templateUrl: './aula-virtual-curso-detalle.component.html',
  styleUrls: ['./aula-virtual-curso-detalle.component.scss'],
})
export class AulaVirtualCursoDetalleComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private svc = inject(AulaVirtualAdminService);

  readonly niveles = NIVELES_VIRTUAL;

  tab = signal<TabCurso>('portal');
  loading = signal(true);
  error = signal<string | null>(null);
  saving = signal(false);
  msg = signal<string | null>(null);
  err = signal(false);

  curso = signal<CursoVirtualAdmin | null>(null);
  config = signal<VirtualConfig | null>(null);
  categorias = signal<CategoriaVirtual[]>([]);

  ficha = {
    descripcionVirtual: '',
    horas: null as number | null,
    urlPortadaAbsoluta: null as string | null,
  };

  nuevaSesion: SesionMeet = { titulo: '', url: '', fecha: '', obligatoria: false };

  programaId = computed(() => this.curso()?.idPrograma ?? '');

  tabs: { key: TabCurso; label: string }[] = [
    { key: 'portal', label: 'Ficha portal' },
    { key: 'reglas', label: 'Reglas y acceso' },
    { key: 'contenido', label: 'Contenido' },
    { key: 'alumnos', label: 'Seguimiento alumnos' },
  ];

  ngOnInit(): void {
    this.svc.listarCategorias().subscribe({
      next: (rows) => this.categorias.set(rows),
    });

    this.route.paramMap.subscribe((pm) => {
      const id = pm.get('id') || '';
      if (id) this.cargar(id);
    });

    this.route.queryParamMap.subscribe((q) => {
      const t = q.get('tab');
      if (t === 'portal' || t === 'reglas' || t === 'contenido' || t === 'alumnos') {
        this.tab.set(t);
      }
    });
  }

  private cargar(id: string) {
    this.loading.set(true);
    this.error.set(null);
    this.svc.listarCursos().subscribe({
      next: (rows) => {
        const found = rows.find((r) => String(r.idPrograma) === String(id));
        if (!found) {
          this.error.set('Curso virtual no encontrado.');
          this.loading.set(false);
          return;
        }
        this.aplicarCurso(found);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar el curso.');
        this.loading.set(false);
      },
    });
  }

  private aplicarCurso(c: CursoVirtualAdmin) {
    this.curso.set(c);
    const cfg = c.config || {
      idPrograma: String(c.idPrograma),
      publicadoPortal: false,
      modoCertificado: 'al_pagar' as const,
      requierePagoParaCursar: false,
      pctMinCompletitud: 80,
      pctMinEvaluaciones: 60,
      intentosMaxEval: 3,
      indexHtml: 'index.html',
      idCategorias: [...(c.idCategorias ?? [])],
      nivel: c.nivel ?? null,
      materiales: [],
      sesionesMeet: [],
    };
    this.config.set({
      ...cfg,
      idCategorias: [...(cfg.idCategorias ?? c.idCategorias ?? [])],
      nivel: cfg.nivel ?? c.nivel ?? null,
    });
    this.ficha.descripcionVirtual = c.descripcionVirtual || '';
    this.ficha.horas = c.horas ?? null;
    this.ficha.urlPortadaAbsoluta = this.absolutaPortada(c.urlPortadaAbsoluta, c.urlPortadaVirtual);
  }

  setTab(key: TabCurso) {
    this.tab.set(key);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: key },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  volver() {
    void this.router.navigate(['/app/aula-virtual'], { queryParams: { tab: 'cursos' } });
  }

  editarPrograma() {
    const id = this.programaId();
    if (id) {
      void this.router.navigate(['/app/programas'], { queryParams: { editar: id } });
    }
  }

  autorPreview(): string {
    return this.curso()?.autor?.trim() || '—';
  }

  guardarCurso() {
    const sel = this.curso();
    const cfg = this.config();
    if (!sel || !cfg) return;
    const body: GuardarCursoVirtualBody = {
      ...cfg,
      descripcionVirtual: this.ficha.descripcionVirtual,
      horas: this.ficha.horas,
    };
    this.saving.set(true);
    this.svc.guardarConfig(sel.idPrograma, body).subscribe({
      next: (res) => {
        this.config.set({
          ...res.config,
          idCategorias: [...(res.config.idCategorias ?? cfg.idCategorias ?? [])],
          nivel: res.config.nivel ?? cfg.nivel ?? null,
        });
        this.saving.set(false);
        this.toast('Curso guardado');
        this.refrescarCurso();
      },
      error: (e) => {
        this.saving.set(false);
        this.toast(e?.error?.message || 'Error al guardar', true);
      },
    });
  }

  reintegrarBridge() {
    const sel = this.curso();
    if (!sel || this.saving()) return;
    this.saving.set(true);
    this.svc.reintegrarBridge(sel.idPrograma).subscribe({
      next: (res) => {
        this.saving.set(false);
        const extra = res.storagePrefix ? ` Prefijo: ${res.storagePrefix}.` : '';
        this.toast(`${res.message}${extra}`);
        this.refrescarCurso();
      },
      error: (e) => {
        this.saving.set(false);
        this.toast(e?.error?.message || 'No se pudo reintegrar ARGO', true);
      },
    });
  }

  onZip(ev: Event) {
    const sel = this.curso();
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!sel || !file) return;
    this.saving.set(true);
    this.svc.subirPaquete(sel.idPrograma, file).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.toast(res.message || 'Paquete subido');
        input.value = '';
        this.refrescarCurso();
      },
      error: (e) => {
        this.saving.set(false);
        input.value = '';
        this.toast(this.mensajeErrorSubida(e) || 'Error al subir ZIP', true);
      },
    });
  }

  onPortada(ev: Event) {
    const sel = this.curso();
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!sel || !file) return;
    this.saving.set(true);
    this.svc.subirPortada(sel.idPrograma, file).subscribe({
      next: (res) => {
        this.saving.set(false);
        input.value = '';
        this.ficha.urlPortadaAbsoluta = this.absolutaPortada(null, res.urlPortadaVirtual);
        this.toast(res.message || 'Portada actualizada');
        this.refrescarCurso();
      },
      error: (e) => {
        this.saving.set(false);
        input.value = '';
        this.toast(e?.error?.message || 'Error al subir portada', true);
      },
    });
  }

  quitarPortada() {
    const sel = this.curso();
    if (!sel) return;
    this.saving.set(true);
    this.svc.quitarPortada(sel.idPrograma).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.ficha.urlPortadaAbsoluta = null;
        this.toast(res.message || 'Portada eliminada');
        this.refrescarCurso();
      },
      error: (e) => {
        this.saving.set(false);
        this.toast(e?.error?.message || 'Error', true);
      },
    });
  }

  onMaterial(ev: Event) {
    const sel = this.curso();
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!sel || !file) return;
    this.saving.set(true);
    this.svc.subirMaterial(sel.idPrograma, file).subscribe({
      next: (res) => {
        this.config.set(res.config);
        this.saving.set(false);
        this.toast(res.message || 'Material agregado');
        input.value = '';
      },
      error: (e) => {
        this.saving.set(false);
        input.value = '';
        this.toast(e?.error?.message || 'Error al subir material', true);
      },
    });
  }

  quitarMaterial(id: string) {
    const sel = this.curso();
    if (!sel) return;
    this.svc.eliminarMaterial(sel.idPrograma, id).subscribe({
      next: (res) => {
        this.config.set(res.config);
        this.toast('Material eliminado');
      },
      error: (e) => this.toast(e?.error?.message || 'Error', true),
    });
  }

  agregarSesion() {
    const cfg = this.config();
    if (!cfg || !this.nuevaSesion.titulo.trim() || !this.nuevaSesion.url.trim()) return;
    const sesiones = [...(cfg.sesionesMeet || []), { ...this.nuevaSesion }];
    this.config.set({ ...cfg, sesionesMeet: sesiones });
    this.nuevaSesion = { titulo: '', url: '', fecha: '', obligatoria: false };
  }

  quitarSesion(i: number) {
    const cfg = this.config();
    if (!cfg) return;
    const sesiones = [...(cfg.sesionesMeet || [])];
    sesiones.splice(i, 1);
    this.config.set({ ...cfg, sesionesMeet: sesiones });
  }

  labelNivel(n: string | null | undefined) {
    if (!n) return '—';
    return n.charAt(0) + n.slice(1).toLowerCase();
  }

  tieneCategoria(id: number): boolean {
    return (this.config()?.idCategorias || []).includes(id);
  }

  toggleCategoria(id: number, ev: Event) {
    const cfg = this.config();
    if (!cfg) return;
    const checked = (ev.target as HTMLInputElement).checked;
    let ids = [...(cfg.idCategorias || [])];
    if (checked) {
      if (!ids.includes(id)) ids.push(id);
    } else {
      ids = ids.filter((x) => x !== id);
    }
    this.config.set({ ...cfg, idCategorias: ids });
  }

  private refrescarCurso() {
    const id = this.programaId();
    if (!id) return;
    this.svc.listarCursos().subscribe({
      next: (rows) => {
        const found = rows.find((r) => String(r.idPrograma) === String(id));
        if (found) this.aplicarCurso(found);
      },
    });
  }

  private absolutaPortada(abs?: string | null, rel?: string | null) {
    if (abs) return abs;
    const r = String(rel || '').trim().replace(/^\/+/, '');
    if (!r) return null;
    const base = environment.uploadsUrl?.replace(/\/+$/, '') || '';
    return r.startsWith('http') ? r : `${base}/${r}`;
  }

  private toast(text: string, isErr = false) {
    this.msg.set(text);
    this.err.set(isErr);
    setTimeout(() => this.msg.set(null), 4000);
  }

  private mensajeErrorSubida(err: unknown): string | null {
    const e = err as { status?: number; error?: { message?: string } | string; message?: string };
    if (typeof e?.error === 'string' && e.error.trim()) return e.error;
    if (e?.error && typeof e.error === 'object' && e.error.message) return e.error.message;
    if (e?.message && !String(e.message).startsWith('Http failure')) return e.message;
    if (e?.status === 0) {
      return 'No hubo respuesta del servidor (red, timeout o subida cancelada). Intente de nuevo.';
    }
    if (e?.status === 413) return 'El ZIP supera el tamaño máximo permitido en el servidor.';
    if (e?.status === 502 || e?.status === 504) {
      return 'El servidor cortó la subida (timeout o proxy). Pruebe un ZIP más liviano o reintente.';
    }
    return null;
  }
}
