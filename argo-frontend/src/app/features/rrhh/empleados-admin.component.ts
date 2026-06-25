import { CommonModule } from '@angular/common';
import { ArgoDateInputComponent } from '../../shared/argo-date-input/argo-date-input.component';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';

import {
  Empleado,
  EmpleadoDto,
  EmpleadoService,
  ModoAccesoEmpleado,
} from '../../core/services/empleado.service';
import { RrhhCatalogService } from '../../core/services/rrhh-catalog.service';
import { Usuario, UsuarioService } from '../../core/services/usuario.service';
import { loginMostrable } from '../../core/utils/usuario-login.helpers';
import { ConfirmDialogService } from '../../shared/confirm-dialog/confirm-dialog.service';
import { AuthService } from '../../core/services/auth.service';
import { SedeDto, SedeService } from '../../core/services/sede.service';
import { inicialesNombre, readVistaLista, saveVistaLista, VistaLista } from '../../core/utils/vista-lista.helpers';
import { environment } from '../../../environments/environment';
import { EmpleadoDocumentosPanelComponent } from './empleado-documentos-panel.component';

type FormSeccion = 'datos' | 'documentos';

@Component({
  selector: 'argo-empleados-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, EmpleadoDocumentosPanelComponent,
    ArgoDateInputComponent,
  ],
  templateUrl: './empleados-admin.component.html',
  styleUrls: ['./empleados-admin.component.scss', './rrhh-catalog-admin.component.scss', './rrhh-shared.scss'],
})
export class EmpleadosAdminComponent implements OnInit {
  private svc = inject(EmpleadoService);
  private cat = inject(RrhhCatalogService);
  private usuarioSvc = inject(UsuarioService);
  private confirm = inject(ConfirmDialogService);
  private auth = inject(AuthService);
  private sedeSvc = inject(SedeService);
  private route = inject(ActivatedRoute);

  uploads = environment.uploadsUrl;
  fotoFile = signal<File | null>(null);
  fotoPreview = signal<string | null>(null);

  empleados = signal<Empleado[]>([]);
  cargos = signal<any[]>([]);
  departamentos = signal<any[]>([]);
  eps = signal<any[]>([]);
  afp = signal<any[]>([]);
  arl = signal<any[]>([]);
  cajas = signal<any[]>([]);
  sedes = signal<SedeDto[]>([]);
  usuarios = signal<Usuario[]>([]);

  modoAcceso = signal<ModoAccesoEmpleado>('auto');
  idUsuarioVincular = signal('');

  cargoSeleccionado = computed(() => {
    const id = this.form().cargoId;
    if (!id) return null;
    return this.cargos().find((c) => Number(c.idCargo) === Number(id)) ?? null;
  });

  cargoSugiereAcceso = computed(() => {
    const n = String(this.cargoSeleccionado()?.nombre || '').toLowerCase();
    return /\bcajer/i.test(n) || /\binstructor/i.test(n);
  });

  /** Usuarios que se pueden vincular: sin empleado activo o ya ligados al empleado en edición. */
  usuariosDisponibles = computed(() => {
    const ed = this.editando();
    const edId = ed?.idEmpleado != null ? Number(ed.idEmpleado) : null;
    return this.usuarios().filter((u) => {
      const uid = this.usuarioId(u);
      const empVinculado = this.empleados().find(
        (e) =>
          (uid && String(e.idUsuario || '') === uid) ||
          (u.idEmpleado != null && Number(u.idEmpleado) === Number(e.idEmpleado)),
      );
      if (!empVinculado) return true;
      return edId != null && Number(empVinculado.idEmpleado) === edId;
    });
  });

  esAdmin = computed(() => this.auth.isAdmin());

  vinculoActual = computed(() => {
    const e = this.editando();
    if (!e?.usuarioLogin) return null;
    return { login: e.usuarioLogin, rol: e.usuarioRol || null };
  });

  loading = signal(false);
  saving = signal(false);
  msg = signal<string | null>(null);
  msgError = signal(false);
  busqueda = signal('');
  vista = signal<VistaLista>(readVistaLista('argo-empleados-vista'));
  editando = signal<Empleado | null>(null);
  mostrarForm = signal(false);
  formSeccion = signal<FormSeccion>('datos');

  readonly tiposDocumento = ['CC', 'CE', 'TI', 'PAS'];
  readonly sexos = ['Masculino', 'Femenino', 'Otro'];
  readonly estados = ['activo', 'retirado', 'suspendido'];
  readonly tiposContrato = ['indefinido', 'fijo', 'obra labor', 'aprendizaje'];

  form = signal<EmpleadoDto>(this.formVacio());

  ngOnInit(): void {
    this.cargarCatalogos();
    this.cargarSedes();
    if (this.esAdmin()) this.cargarUsuarios();
    this.route.queryParamMap.subscribe(() => this.aplicarQueryEmpleado());
    this.cargar();
  }

  cargarUsuarios() {
    if (!this.esAdmin()) {
      this.usuarios.set([]);
      return;
    }
    this.usuarioSvc.listar().subscribe({
      next: (r) => this.usuarios.set(r || []),
      error: () => this.usuarios.set([]),
    });
  }

  formVacio(): EmpleadoDto {
    const principal = this.sedes().find((s) => s.esPrincipal) || this.sedes()[0];
    return {
      tipoDocumento: 'CC',
      numeroDocumento: '',
      primerNombre: '',
      segundoNombre: '',
      primerApellido: '',
      segundoApellido: '',
      estado: 'activo',
      idSede: principal?.idSede,
    };
  }

  cargarSedes() {
    this.sedeSvc.listar().subscribe({
      next: (r) => this.sedes.set((r || []).filter((s) => s.activa !== false)),
      error: () => {
        this.sedeSvc.listarMias().subscribe({
          next: (r) => this.sedes.set(r || []),
          error: () => this.sedes.set([]),
        });
      },
    });
  }

  cargarCatalogos() {
    this.cat.listar('cargos').subscribe({ next: (r) => this.cargos.set(r || []) });
    this.cat.listar('departamentos').subscribe({ next: (r) => this.departamentos.set(r || []) });
    this.cat.listar('eps').subscribe({ next: (r) => this.eps.set(r || []) });
    this.cat.listar('afp').subscribe({ next: (r) => this.afp.set(r || []) });
    this.cat.listar('arl').subscribe({ next: (r) => this.arl.set(r || []) });
    this.cat.listar('cajas-compensacion').subscribe({ next: (r) => this.cajas.set(r || []) });
  }

  cargar() {
    this.loading.set(true);
    const q = this.busqueda().trim();
    this.svc.listar(q.length >= 2 ? { q } : {}).subscribe({
      next: (r) => {
        this.empleados.set(r || []);
        this.loading.set(false);
        this.aplicarQueryEmpleado();
      },
      error: (e) => {
        this.loading.set(false);
        this.inform(e?.error?.message || 'Error cargando empleados', true);
      },
    });
  }

  setVista(v: VistaLista) {
    this.vista.set(v);
    saveVistaLista('argo-empleados-vista', v);
  }

  iniciales(e: Empleado): string {
    return inicialesNombre(e.primerNombre, e.primerApellido);
  }

  fotoUrl(f?: string): string | null {
    if (!f) return null;
    if (f.startsWith('http')) return f;
    return `${this.uploads}/${f}`;
  }

  onFoto(ev: Event) {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.fotoFile.set(file);
    const r = new FileReader();
    r.onload = () => this.fotoPreview.set(r.result as string);
    r.readAsDataURL(file);
  }

  nuevo() {
    this.editando.set(null);
    this.formSeccion.set('datos');
    this.form.set(this.formVacio());
    this.modoAcceso.set('auto');
    this.idUsuarioVincular.set('');
    if (this.esAdmin()) this.cargarUsuarios();
    this.fotoFile.set(null);
    this.fotoPreview.set(null);
    this.mostrarForm.set(true);
    this.inform(null);
  }

  editar(e: Empleado, seccion: FormSeccion = 'datos') {
    this.editando.set(e);
    this.formSeccion.set(seccion);
    if (this.esAdmin()) this.cargarUsuarios();
    this.form.set({
      ...e,
      fechaNacimiento: e.fechaNacimiento ? String(e.fechaNacimiento).slice(0, 10) : '',
      fechaIngreso: e.fechaIngreso ? String(e.fechaIngreso).slice(0, 10) : '',
      fechaRetiro: e.fechaRetiro ? String(e.fechaRetiro).slice(0, 10) : '',
    });
    if (e.idUsuario) {
      this.modoAcceso.set('vincular');
      this.idUsuarioVincular.set(String(e.idUsuario));
    } else {
      this.modoAcceso.set(this.cargoSugiereAccesoDesde(e) ? 'auto' : 'ninguno');
      this.idUsuarioVincular.set('');
    }
    this.fotoFile.set(null);
    this.fotoPreview.set(e.urlFoto ? this.fotoUrl(e.urlFoto) : null);
    this.mostrarForm.set(true);
    this.inform(null);
  }

  private aplicarQueryEmpleado(): void {
    const idRaw = this.route.snapshot.queryParamMap.get('empleado');
    if (!idRaw) return;
    const emp = this.empleados().find((e) => String(e.idEmpleado) === idRaw);
    if (!emp) return;
    const seccion = this.route.snapshot.queryParamMap.get('seccion') === 'documentos' ? 'documentos' : 'datos';
    this.editar(emp, seccion);
  }

  private cargoSugiereAccesoDesde(e: Empleado): boolean {
    const desdeNombre = String(e.cargoNombre || '').toLowerCase();
    if (desdeNombre) return /\bcajer/i.test(desdeNombre) || /\binstructor/i.test(desdeNombre);
    const c = this.cargos().find((x) => Number(x.idCargo) === Number(e.cargoId));
    const n = String(c?.nombre || '').toLowerCase();
    return /\bcajer/i.test(n) || /\binstructor/i.test(n);
  }

  onCargoChange(raw: number | null | undefined) {
    const id = raw == null || Number.isNaN(Number(raw)) ? undefined : Number(raw);
    this.patch('cargoId', id);
    if (!this.editando()?.idUsuario && this.modoAcceso() !== 'vincular') {
      this.modoAcceso.set(this.cargoSugiereAcceso() ? 'auto' : 'ninguno');
    }
  }

  usuarioId(u: Usuario): string {
    return String(u._id ?? '');
  }

  labelUsuario(u: Usuario): string {
    const nom = [u.nombres, u.apellidos].filter(Boolean).join(' ').trim();
    const login = loginMostrable(u);
    const rol = u.rol ? ` · ${u.rol}` : '';
    return nom ? `${login} — ${nom}${rol}` : `${login}${rol}`;
  }

  setModoAcceso(m: ModoAccesoEmpleado) {
    if (m === 'vincular' && !this.esAdmin()) return;
    this.modoAcceso.set(m);
    if (m !== 'vincular') this.idUsuarioVincular.set('');
  }

  cancelar() {
    this.mostrarForm.set(false);
    this.editando.set(null);
    this.formSeccion.set('datos');
  }

  setFormSeccion(sec: FormSeccion): void {
    if (sec === 'documentos' && !this.editando()?.idEmpleado) return;
    this.formSeccion.set(sec);
  }

  puedeDocumentos = computed(() => !!this.editando()?.idEmpleado);

  patch<K extends keyof EmpleadoDto>(k: K, v: EmpleadoDto[K]) {
    this.form.update((f) => ({ ...f, [k]: v }));
  }

  guardar() {
    const f = this.form();
    if (!f.primerNombre?.trim() || !f.primerApellido?.trim()) {
      this.inform('Primer nombre y primer apellido son obligatorios.', true);
      return;
    }
    if (!f.numeroDocumento?.trim()) {
      this.inform('numeroDocumento es obligatorio (enlace con egresos).', true);
      return;
    }
    if (!f.idSede?.trim()) {
      this.inform('Seleccione la sede del empleado.', true);
      return;
    }
    const modo = this.modoAcceso();
    if (modo === 'vincular' && !this.idUsuarioVincular().trim()) {
      this.inform('Seleccione el usuario existente a vincular.', true);
      return;
    }
    this.saving.set(true);
    const ed = this.editando();
    const files = this.fotoFile() ? { foto: this.fotoFile()! } : undefined;
    const payload: EmpleadoDto = {
      ...f,
      modoAcceso: modo,
      idUsuarioExistente: modo === 'vincular' ? this.idUsuarioVincular().trim() : undefined,
    };
    const req = ed ? this.svc.actualizar(ed.idEmpleado, payload, files) : this.svc.crear(payload, files);
    req.subscribe({
      next: (res) => {
        this.saving.set(false);
        this.fotoFile.set(null);
        this.mostrarForm.set(false);
        this.cargar();
        this.cargarUsuarios();
        let txt = ed ? 'Empleado actualizado.' : 'Empleado creado.';
        const ug = res?.usuarioGenerado;
        if (ug?.username) {
          if (ug.vinculado) {
            txt += ` Usuario vinculado — login: ${ug.username} (${ug.rol}).`;
          } else if (ug.existente) {
            txt += ` Usuario ya existía — login: ${ug.username} (${ug.rol}).`;
          } else {
            txt += ` Usuario creado — login: ${ug.username} (mismo número de documento, ${ug.rol}).`;
            if (ug.passwordInicial) {
              txt += ` Contraseña inicial: ${ug.passwordInicial}.`;
            }
          }
        } else if (modo === 'ninguno') {
          txt += ' Sin usuario de acceso vinculado.';
        }
        this.inform(txt);
      },
      error: (e) => {
        this.saving.set(false);
        this.inform(e?.error?.message || 'Error al guardar', true);
      },
    });
  }

  async eliminar(e: Empleado) {
    const ok = await this.confirm.open({
      title: 'Eliminar empleado',
      message: `¿Eliminar a ${e.nombreCompleto}?`,
      variant: 'danger',
      confirmLabel: 'Eliminar',
    });
    if (!ok) return;
    this.svc.eliminar(e.idEmpleado).subscribe({
      next: () => {
        this.cargar();
        this.inform('Empleado eliminado.');
      },
      error: (err) => this.inform(err?.error?.message || 'No se pudo eliminar', true),
    });
  }

  private inform(text: string | null, isErr = false): void {
    this.msg.set(text);
    this.msgError.set(isErr);
  }
}
