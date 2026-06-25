import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Combo, ComboService } from '../../core/services/combo.service';
import { CatalogoService } from '../../core/services/catalogo.service';

type Modo = 'lista' | 'form';

interface ProgItem {
  id: string;
  nombre: string;
  codigo: string;
  seleccionado: boolean;
}

@Component({
  selector: 'argo-combos-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './combos-admin.component.html',
  styleUrls: ['./combos-admin.component.scss'],
})
export class CombosAdminComponent implements OnInit {
  private svc = inject(ComboService);
  private catSvc = inject(CatalogoService);

  modo = signal<Modo>('lista');
  combos = signal<Combo[]>([]);
  loading = signal(false);
  guardando = signal(false);
  msg = signal<string | null>(null);
  esError = signal(false);

  programas = signal<any[]>([]);
  editandoId: string | null = null;
  /** Signal: el filtro debe ser reactivo para que `progFiltrados` se recalcule al escribir. */
  busquedaProg = signal('');

  form = {
    nombre: '',
    descripcion: '',
    activo: true,
    programasSeleccionados: new Set<string>(),
  };

  progItems = computed<ProgItem[]>(() =>
    [...this.programas()]
      .sort((a, b) => {
        const ca = String(a.codigoProg || a.idPrograma || '').trim();
        const cb = String(b.codigoProg || b.idPrograma || '').trim();
        return ca.localeCompare(cb, 'es', { sensitivity: 'base', numeric: true });
      })
      .map((p) => {
        const id = String(p.idPrograma ?? p._id);
        const nombre = String(p.nombreProg || p.descripcion || '').trim();
        const codigo = String(p.codigoProg || '').trim();
        return { id, nombre, codigo, seleccionado: this.form.programasSeleccionados.has(id) };
      }),
  );

  progFiltrados = computed<ProgItem[]>(() => {
    const q = this.busquedaProg().trim().toLowerCase();
    if (!q) return this.progItems();
    return this.progItems().filter(
      (p) => p.nombre.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q),
    );
  });

  seleccionados = computed<ProgItem[]>(() =>
    this.progItems().filter((p) => this.form.programasSeleccionados.has(p.id)),
  );

  totalSeleccionados = computed(() => this.form.programasSeleccionados.size);

  ngOnInit() {
    this.catSvc.list('programas').subscribe((d) => this.programas.set(d || []));
    this.cargar();
  }

  cargar() {
    this.loading.set(true);
    this.svc.listarTodos().subscribe({
      next: (list) => { this.combos.set(list); this.loading.set(false); },
      error: () => { this.toast('No se pudo cargar combos', true); this.loading.set(false); },
    });
  }

  nuevoCombo() {
    this.editandoId = null;
    this.busquedaProg.set('');
    this.form = { nombre: '', descripcion: '', activo: true, programasSeleccionados: new Set() };
    this.msg.set(null);
    this.modo.set('form');
  }

  editarCombo(c: Combo) {
    this.editandoId = c.id;
    this.busquedaProg.set('');
    this.form = {
      nombre: c.nombre,
      descripcion: c.descripcion || '',
      activo: c.activo,
      programasSeleccionados: new Set(c.programas || []),
    };
    this.msg.set(null);
    this.modo.set('form');
  }

  cancelar() {
    this.modo.set('lista');
    this.editandoId = null;
    this.msg.set(null);
  }

  togglePrograma(id: string) {
    const s = new Set(this.form.programasSeleccionados);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    this.form.programasSeleccionados = s;
  }

  estaSeleccionado(id: string): boolean {
    return this.form.programasSeleccionados.has(id);
  }

  deseleccionarTodos() {
    this.form.programasSeleccionados = new Set();
  }

  /** Nombre de un programa por su id (para la tarjeta del combo en lista) */
  nombreProg(id: string): string {
    const prog = this.programas().find((p) => String(p.idPrograma ?? p._id) === id);
    if (!prog) return id;
    const cod = String(prog.codigoProg || '').trim();
    const nom = String(prog.nombreProg || prog.descripcion || id).trim();
    return cod ? `${nom} (${cod})` : nom;
  }

  guardar() {
    const nombre = this.form.nombre.trim();
    if (!nombre) { this.toast('El nombre del combo es obligatorio', true); return; }
    if (this.form.programasSeleccionados.size < 2) {
      this.toast('Seleccione al menos 2 programas para el combo', true);
      return;
    }
    if (this.guardando()) return;
    this.guardando.set(true);
    this.msg.set(null);

    const body = {
      nombre,
      descripcion: this.form.descripcion.trim(),
      programas: [...this.form.programasSeleccionados],
      activo: this.form.activo,
    };

    const req$ = this.editandoId
      ? this.svc.actualizar(this.editandoId, body)
      : this.svc.crear(body);

    req$.subscribe({
      next: (res) => {
        this.guardando.set(false);
        this.toast(res.message);
        this.cargar();
        this.modo.set('lista');
      },
      error: (e) => {
        this.guardando.set(false);
        this.toast(e?.error?.message || 'Error al guardar', true);
      },
    });
  }

  eliminarCombo(c: Combo) {
    if (!confirm(`¿Eliminar el combo "${c.nombre}"?\nEsta acción no se puede deshacer.`)) return;
    this.svc.eliminar(c.id).subscribe({
      next: (r) => { this.toast(r.message); this.cargar(); },
      error: (e) => this.toast(e?.error?.message || 'No se pudo eliminar', true),
    });
  }

  toggleActivo(c: Combo) {
    this.svc.actualizar(c.id, { activo: !c.activo }).subscribe({
      next: () => this.cargar(),
      error: (e) => this.toast(e?.error?.message || 'Error', true),
    });
  }

  private toast(text: string, err = false) {
    this.msg.set(text);
    this.esError.set(err);
  }
}
