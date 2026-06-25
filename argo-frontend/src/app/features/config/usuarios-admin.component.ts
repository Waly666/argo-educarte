import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AuthService } from '../../core/services/auth.service';
import { SedeDto, SedeService } from '../../core/services/sede.service';
import { Usuario, UsuarioDto, UsuarioService } from '../../core/services/usuario.service';
import { ConfirmDialogService } from '../../shared/confirm-dialog/confirm-dialog.service';
import { readVistaLista, saveVistaLista, VistaLista } from '../../core/utils/vista-lista.helpers';
import {
  documentoUsuario,
  esLoginNumerico,
  loginMostrable,
} from '../../core/utils/usuario-login.helpers';

@Component({
  selector: 'argo-usuarios-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './usuarios-admin.component.html',
  styleUrls: ['./usuarios-admin.component.scss'],
})
export class UsuariosAdminComponent implements OnInit {
  private svc = inject(UsuarioService);
  private sedeSvc = inject(SedeService);
  private auth = inject(AuthService);
  private confirm = inject(ConfirmDialogService);

  usuarios = signal<Usuario[]>([]);
  sedesCatalogo = signal<SedeDto[]>([]);
  roles = signal<{ id: string; label: string }[]>([]);
  loading = signal(false);
  saving = signal(false);
  msg = signal<string | null>(null);
  msgError = signal(false);
  filtro = signal('');
  editando = signal<Usuario | null>(null);
  mostrarForm = signal(false);
  vista = signal<VistaLista>(readVistaLista('argo-usuarios-vista'));

  resumen = computed(() => {
    const list = this.usuarios();
    return {
      total: list.length,
      activos: list.filter((u) => u.activo !== false).length,
      inactivos: list.filter((u) => u.activo === false).length,
    };
  });

  usuariosFiltrados = computed(() => {
    const q = this.filtro().trim().toLowerCase();
    const list = this.usuarios();
    if (!q) return list;
    return list.filter((u) => {
      const nombre = this.nombreCompleto(u).toLowerCase();
      const login = loginMostrable(u).toLowerCase();
      const doc = documentoUsuario(u).toLowerCase();
      const email = (u.email || '').toLowerCase();
      const rol = this.labelRol(u.rol).toLowerCase();
      const sede = this.labelSedes(u).toLowerCase();
      return (
        nombre.includes(q) ||
        login.includes(q) ||
        doc.includes(q) ||
        email.includes(q) ||
        rol.includes(q) ||
        sede.includes(q)
      );
    });
  });

  form = signal<UsuarioDto>({
    username: '',
    password: '',
    nombres: '',
    apellidos: '',
    email: '',
    rol: 'usuario',
    activo: true,
    numeroDocumento: '',
    sedesPermitidas: [],
  });

  ngOnInit(): void {
    this.cargar();
    this.svc.roles().subscribe({ next: (r) => this.roles.set(r || []) });
    this.sedeSvc.listar().subscribe({
      next: (s) => this.sedesCatalogo.set((s || []).filter((x) => x.activa !== false)),
      error: () => undefined,
    });
  }

  cargar() {
    this.loading.set(true);
    this.svc.listar().subscribe({
      next: (r) => {
        this.usuarios.set(r || []);
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.msgError.set(true);
        this.msg.set(e?.error?.message || 'Error cargando usuarios');
      },
    });
  }

  setVista(v: VistaLista) {
    this.vista.set(v);
    saveVistaLista('argo-usuarios-vista', v);
  }

  nombreCompleto(u: Usuario): string {
    return `${u.nombres || ''} ${u.apellidos || ''}`.trim() || loginMostrable(u);
  }

  loginLabel = loginMostrable;
  docLabel = documentoUsuario;

  nuevo() {
    const principal = this.sedesCatalogo().find((s) => s.esPrincipal) || this.sedesCatalogo()[0];
    this.editando.set(null);
    this.form.set({
      username: '',
      password: '',
      nombres: '',
      apellidos: '',
      email: '',
      rol: 'usuario',
      activo: true,
      numeroDocumento: '',
      sedesPermitidas: principal ? [principal.idSede] : [],
    });
    this.mostrarForm.set(true);
    this.msg.set(null);
    this.msgError.set(false);
  }

  editar(u: Usuario) {
    this.editando.set(u);
    const login = esLoginNumerico(u.username) ? '' : u.username;
    this.form.set({
      username: login,
      password: '',
      nombres: u.nombres || '',
      apellidos: u.apellidos || '',
      email: u.email || '',
      rol: u.rol || 'usuario',
      activo: u.activo !== false,
      numeroDocumento: documentoUsuario(u),
      sedesPermitidas: u.sedesPermitidas?.length ? [u.sedesPermitidas[0]] : [],
    });
    this.mostrarForm.set(true);
    this.msg.set(null);
    this.msgError.set(false);
  }

  cancelar() {
    this.mostrarForm.set(false);
    this.editando.set(null);
  }

  patch<K extends keyof UsuarioDto>(k: K, v: UsuarioDto[K]) {
    this.form.update((f) => ({ ...f, [k]: v }));
  }

  esRolAdmin(rol?: string): boolean {
    const r = String(rol || '').toLowerCase();
    return r === 'admin' || r.includes('admin');
  }

  /** Primera sede del formulario (asignación única en UI). */
  sedeFormId(): string {
    return (this.form().sedesPermitidas || [])[0] || '';
  }

  onSedeFormChange(idSede: string): void {
    if (this.esRolAdmin(this.form().rol)) return;
    const id = String(idSede || '').trim();
    this.patch('sedesPermitidas', id ? [id] : []);
  }

  labelSedes(u: Usuario): string {
    const ids = u.sedesPermitidas || [];
    if (!ids.length) {
      return this.esRolAdmin(u.rol) ? 'Todas (admin)' : 'Principal';
    }
    const id = ids[0];
    const s = this.sedesCatalogo().find((x) => x.idSede === id);
    return s ? s.nombre : id;
  }

  guardar() {
    const f = this.form();
    const ed = this.editando();
    if (!f.username?.trim()) {
      this.msgError.set(true);
      this.msg.set('El nombre de usuario (login) es obligatorio.');
      return;
    }
    if (esLoginNumerico(f.username)) {
      this.msgError.set(true);
      this.msg.set('Use un nombre de usuario (ej. jose o walter.aguilar), no el documento.');
      return;
    }
    if (!ed && (!f.password || f.password.length < 4)) {
      this.msgError.set(true);
      this.msg.set('La contraseña es obligatoria al crear (mín. 4 caracteres).');
      return;
    }
    if (!this.esRolAdmin(f.rol) && !(f.sedesPermitidas || []).length) {
      this.msgError.set(true);
      this.msg.set('Seleccione la sede del usuario.');
      return;
    }
    this.saving.set(true);
    this.msg.set(null);
    this.msgError.set(false);
    const payload: UsuarioDto = { ...f };
    if (this.esRolAdmin(f.rol)) payload.sedesPermitidas = [];
    const req = ed
      ? this.svc.actualizar(ed._id, payload)
      : this.svc.crear(payload);
    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.mostrarForm.set(false);
        this.cargar();
        this.msgError.set(false);
        this.msg.set(ed ? 'Usuario actualizado.' : 'Usuario creado.');
      },
      error: (e) => {
        this.saving.set(false);
        this.msgError.set(true);
        this.msg.set(e?.error?.message || 'Error al guardar.');
      },
    });
  }

  esUsuarioActual(u: Usuario): boolean {
    const me = this.auth.user()?._id;
    return !!me && String(me) === String(u._id);
  }

  async desactivar(u: Usuario) {
    const ok = await this.confirm.open({
      title: '¿Desactivar usuario?',
      message: `El usuario «${loginMostrable(u)}» no podrá iniciar sesión.`,
      variant: 'danger',
      confirmLabel: 'Desactivar',
    });
    if (!ok) return;
    this.svc.desactivar(u._id).subscribe({
      next: () => this.cargar(),
      error: (e) => {
        this.msgError.set(true);
        this.msg.set(e?.error?.message || 'Error.');
      },
    });
  }

  async borrar(u: Usuario) {
    const ok = await this.confirm.open({
      title: '¿Eliminar usuario?',
      message: `Se borrará permanentemente «${loginMostrable(u)}». Esta acción no se puede deshacer.`,
      variant: 'danger',
      icon: 'delete',
      confirmLabel: 'Sí, eliminar',
    });
    if (!ok) return;
    this.svc.borrar(u._id).subscribe({
      next: (r) => {
        if (this.editando()?._id === u._id) this.cancelar();
        this.cargar();
        this.msgError.set(false);
        this.msg.set(r.message || 'Usuario eliminado.');
      },
      error: (e) => {
        this.msgError.set(true);
        this.msg.set(e?.error?.message || 'No se pudo eliminar.');
      },
    });
  }

  labelRol(id?: string): string {
    return this.roles().find((r) => r.id === id)?.label || id || '—';
  }

  rolBadgeClass(rol?: string): string {
    const r = String(rol || '').toLowerCase();
    if (r === 'admin' || r.includes('admin')) return 'usr-rol-badge--admin';
    if (r.includes('instructor') || r.includes('caja') || r.includes('rrhh')) return 'usr-rol-badge--staff';
    if (r === 'usuario' || r.includes('usuario')) return 'usr-rol-badge--user';
    return 'usr-rol-badge--other';
  }

  iniciales(u: Usuario): string {
    const nombre = this.nombreCompleto(u);
    const parts = nombre.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    const login = loginMostrable(u);
    return login.slice(0, 2).toUpperCase() || '??';
  }
}
