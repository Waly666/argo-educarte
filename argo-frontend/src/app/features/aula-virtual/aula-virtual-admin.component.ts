import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import {
  AulaVirtualAdminService,
  CursoVirtualAdmin,
  PortalAulaConfig,
  UsuarioPortalAdmin,
} from '../../core/services/aula-virtual-admin.service';
import { mergePortalLanding, PORTAL_LANDING_DEFAULTS } from '../../core/constants/portal-landing-defaults';
import { readVistaLista, saveVistaLista, VistaLista } from '../../core/utils/vista-lista.helpers';
import { environment } from '../../../environments/environment';
import { PortalLandingEditorComponent } from './portal-landing-editor.component';

type TabAula = 'cursos' | 'usuarios' | 'empresa' | 'portal';

@Component({
  selector: 'argo-aula-virtual-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, PortalLandingEditorComponent],
  templateUrl: './aula-virtual-admin.component.html',
  styleUrls: ['./aula-virtual-admin.component.scss'],
})
export class AulaVirtualAdminComponent implements OnInit {
  private svc = inject(AulaVirtualAdminService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly portalUrl = 'http://localhost:4202/';

  tab = signal<TabAula>('cursos');
  cursos = signal<CursoVirtualAdmin[]>([]);
  busqueda = signal('');
  vista = signal<VistaLista>(readVistaLista('argo-aula-virtual-vista'));

  cursosFiltrados = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    const rows = this.cursos();
    if (!q) return rows;
    return rows.filter(
      (c) =>
        c.nombreProg?.toLowerCase().includes(q) ||
        String(c.idPrograma).toLowerCase().includes(q) ||
        c.categoriaNombres?.some((n) => n.toLowerCase().includes(q)),
    );
  });

  usuarios = signal<UsuarioPortalAdmin[]>([]);
  usuariosTotal = signal(0);
  buscarUsuario = '';

  portalForm: PortalAulaConfig = {
    nombreEmpresa: '',
    nit: '',
    direccion: '',
    ciudad: '',
    telefono: '',
    email: '',
    heroTitulo: '',
    heroSubtitulo: '',
    acercaDeHtml: '',
    telefonoWhatsapp: '',
    emailContacto: '',
    emailConfirmacion: '',
    emailPqr: '',
    landing: mergePortalLanding(PORTAL_LANDING_DEFAULTS),
  };

  loading = signal(true);
  loadingUsuarios = signal(false);
  saving = signal(false);
  msg = signal<string | null>(null);
  err = signal(false);

  mostrarFormUsuario = false;
  creandoUsuario = signal(false);
  credencialesCreadas = signal<{ email: string; password: string; nombre: string; numDoc: number } | null>(null);
  nuevoUsuario = {
    tipoDoc: '1',
    numDoc: '',
    apellido1: '',
    apellido2: '',
    nombre1: '',
    nombre2: '',
    celular: '',
    email: '',
    password: '',
  };

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((q) => {
      const t = q.get('tab');
      if (t === 'cursos' || t === 'usuarios' || t === 'empresa' || t === 'portal') {
        this.tab.set(t);
        if (t === 'usuarios') this.cargarUsuarios();
      }
    });

    this.svc.listarCursos().subscribe({
      next: (rows) => {
        this.cursos.set(rows);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast('No se pudo cargar cursos virtuales', true);
      },
    });

    this.svc.obtenerPortal().subscribe({
      next: (p) => {
        Object.assign(this.portalForm, p);
        this.portalForm.landing = mergePortalLanding(p.landing);
      },
    });
  }

  setTab(t: TabAula) {
    this.tab.set(t);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: t },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    if (t === 'usuarios') this.cargarUsuarios();
  }

  setVista(v: VistaLista) {
    this.vista.set(v);
    saveVistaLista('argo-aula-virtual-vista', v);
  }

  fichaCursoLink(c: CursoVirtualAdmin): string[] {
    return ['/app/aula-virtual/cursos', String(c.idPrograma)];
  }

  labelNivel(n: string | null | undefined) {
    if (!n) return '—';
    return n.charAt(0) + n.slice(1).toLowerCase();
  }

  portadaUrl(c: CursoVirtualAdmin): string | null {
    const abs = String(c.urlPortadaAbsoluta || '').trim();
    if (abs) return abs;
    const rel = String(c.urlPortadaVirtual || '').trim().replace(/^\/+/, '');
    if (!rel) return null;
    const base = environment.uploadsUrl?.replace(/\/+$/, '') || '';
    return rel.startsWith('http') ? rel : `${base}/${rel}`;
  }

  cargarUsuarios() {
    this.loadingUsuarios.set(true);
    this.svc.listarUsuarios(this.buscarUsuario.trim()).subscribe({
      next: (res) => {
        this.usuarios.set(res.usuarios);
        this.usuariosTotal.set(res.total);
        this.loadingUsuarios.set(false);
      },
      error: () => {
        this.loadingUsuarios.set(false);
        this.toast('No se pudo cargar usuarios del portal', true);
      },
    });
  }

  eliminarUsuarioPortal(u: UsuarioPortalAdmin) {
    const etiqueta = u.nombreCompleto?.trim() || u.email;
    const ok = confirm(
      `¿Eliminar la cuenta del portal de ${etiqueta}?\n\n` +
        'La ficha del alumno en el ERP se conserva; solo se borra el acceso al aula virtual.',
    );
    if (!ok) return;
    this.svc.eliminarUsuario(u.id).subscribe({
      next: (r) => {
        this.toast(r.message || 'Usuario del portal eliminado');
        this.cargarUsuarios();
      },
      error: (e) => this.toast(e?.error?.message || 'No se pudo eliminar el usuario', true),
    });
  }

  crearUsuarioPortal() {
    const f = this.nuevoUsuario;
    const numDoc = f.numDoc.trim();
    const email = f.email.trim();
    const password = f.password.trim();
    if (!numDoc || !email || !password) {
      this.toast('Documento, correo y contraseña son obligatorios', true);
      return;
    }
    if (password.length < 6) {
      this.toast('La contraseña debe tener al menos 6 caracteres', true);
      return;
    }
    if (!f.apellido1.trim() || !f.nombre1.trim()) {
      this.toast('Apellido y nombre son obligatorios si el alumno no existe en ARGO', true);
      return;
    }
    if (this.creandoUsuario()) return;
    this.creandoUsuario.set(true);
    this.credencialesCreadas.set(null);
    this.svc
      .crearUsuario({
        email,
        password,
        alumno: {
          numDoc,
          tipoDoc: f.tipoDoc,
          apellido1: f.apellido1.trim(),
          apellido2: f.apellido2.trim(),
          nombre1: f.nombre1.trim(),
          nombre2: f.nombre2.trim(),
          celular: f.celular.trim(),
        },
      })
      .subscribe({
        next: (res) => {
          this.creandoUsuario.set(false);
          this.toast(res.message);
          this.credencialesCreadas.set({
            email: res.usuarioPortal.email,
            password,
            nombre: res.nombreCompleto,
            numDoc: res.numDoc,
          });
          this.cargarUsuarios();
        },
        error: (e) => {
          this.creandoUsuario.set(false);
          this.toast(e?.error?.message || 'No se pudo crear el usuario del portal', true);
        },
      });
  }

  limpiarFormUsuario() {
    this.nuevoUsuario = {
      tipoDoc: '1',
      numDoc: '',
      apellido1: '',
      apellido2: '',
      nombre1: '',
      nombre2: '',
      celular: '',
      email: '',
      password: '',
    };
    this.credencialesCreadas.set(null);
  }

  onLogo(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.saving.set(true);
    this.svc.subirLogoPortal(file).subscribe({
      next: (res) => {
        Object.assign(this.portalForm, res.config);
        this.portalForm.landing = mergePortalLanding(res.config.landing);
        this.saving.set(false);
        input.value = '';
        this.toast(res.message || 'Logo actualizado');
      },
      error: (e) => {
        this.saving.set(false);
        input.value = '';
        this.toast(e?.error?.message || 'Error al subir logo', true);
      },
    });
  }

  quitarLogo() {
    this.saving.set(true);
    this.svc.quitarLogoPortal().subscribe({
      next: (res) => {
        Object.assign(this.portalForm, res.config);
        this.portalForm.landing = mergePortalLanding(res.config.landing);
        this.saving.set(false);
        this.toast(res.message || 'Logo eliminado');
      },
      error: (e) => {
        this.saving.set(false);
        this.toast(e?.error?.message || 'Error al quitar logo', true);
      },
    });
  }

  guardarPortal() {
    this.saving.set(true);
    this.svc.guardarPortal(this.portalForm).subscribe({
      next: (res) => {
        this.svc.obtenerPortal().subscribe({
          next: (p) => Object.assign(this.portalForm, p),
        });
        this.saving.set(false);
        this.toast(res.message || 'Configuración guardada');
      },
      error: (e) => {
        this.saving.set(false);
        this.toast(e?.error?.message || 'Error al guardar portal', true);
      },
    });
  }

  fmtFecha(iso?: string | null) {
    if (!iso) return '—';
    try {
      return new Intl.DateTimeFormat('es-CO', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));
    } catch {
      return '—';
    }
  }

  private toast(text: string, isErr = false) {
    this.msg.set(text);
    this.err.set(isErr);
    setTimeout(() => this.msg.set(null), 4000);
  }
}
