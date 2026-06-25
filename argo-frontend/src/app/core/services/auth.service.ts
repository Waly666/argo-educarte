import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { destinoTrasRevocar } from '../utils/auth-routes.util';
import { PermisoService } from './permiso.service';
import { AlarmaService } from './alarma.service';
import { SedeService } from './sede.service';

export interface AuthEmpleadoResumen {
  idEmpleado: number;
  nombreCompleto: string;
  numeroDocumento?: string;
  idUsuario?: string;
  /** Cargo RRHH corresponde a instructor (requerido para portal API). */
  esInstructor?: boolean;
}

export interface AuthUser {
  _id: string;
  username: string;
  nombres?: string;
  apellidos?: string;
  rol?: string;
  rolNombre?: string;
  permisos?: string[];
  alarmas?: string[];
  /** ISO timestamp del rol en BD; cambia al guardar permisos. */
  permisosRev?: string | null;
  email?: string;
  idEmpleado?: number;
  empleado?: AuthEmpleadoResumen;
  /** true si puede llamar /api/instructor-portal (permisos + cargo instructor). */
  puedeUsarPortalInstructor?: boolean;
  /** Cuenta de soporte maestro (break-glass), no está en la BD. */
  soporteMaestro?: boolean;
  sedes?: { idSede: string; nombre: string; codigo?: string; esPrincipal?: boolean }[];
  sedesPermitidas?: string[];
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

export type StaffLoginStep = 'complete' | 'mfa_verify' | 'mfa_setup';

export interface StaffLoginResponse {
  step: StaffLoginStep;
  token?: string;
  user?: AuthUser;
  mfaToken?: string;
  setupToken?: string;
  username?: string;
  qrDataUrl?: string;
  manualSecret?: string;
  issuer?: string;
  recoveryCodes?: string[];
  recoveryRemaining?: number;
}

export interface VerificarAdminResponse {
  ok: boolean;
  username: string;
  nombreAutoriza: string;
  idUsuario: string;
}

const TOKEN_KEY = 'argo_token';
const USER_KEY = 'argo_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private permisoSvc = inject(PermisoService);
  private alarmaSvc = inject(AlarmaService);
  private sedeSvc = inject(SedeService);

  private _token = signal<string | null>(this.read(TOKEN_KEY));
  private _user = signal<AuthUser | null>(this.readJson<AuthUser>(USER_KEY));

  constructor() {
    const cached = this._user();
    if (cached?.sedes?.length) {
      this.sedeSvc.initDesdeUsuario(cached.sedes, { filtrarComoAdmin: this.usuarioFiltraPorSede(cached) });
    }
  }

  /** Admin u operador con permiso de ver todas las sedes puede filtrar por sede. */
  private usuarioFiltraPorSede(user?: AuthUser | null): boolean {
    if (!user) return false;
    if (user.permisos?.includes('*')) return true;
    const r = String(user.rol || '').toLowerCase();
    if (r === 'admin' || r.includes('admin')) return true;
    return user.permisos?.includes('sedes.ver_todas') === true;
  }

  token = computed(() => this._token());
  user = computed(() => this._user());
  isAuth = computed(() => !!this._token());
  isAdmin = computed(() => {
    const p = this._user()?.permisos;
    if (p?.includes('*')) return true;
    const r = String(this._user()?.rol || '').toLowerCase();
    return r === 'admin' || r.includes('admin');
  });

  puedeUsarPortalInstructor = computed(() => this._user()?.puedeUsarPortalInstructor === true);

  /** Cuenta break-glass (soporte-argo / variables SOPORTE_MASTER_*). */
  isSoporteMaestro = computed(() => this._user()?.soporteMaestro === true);

  tienePermiso(clave: string | string[]): boolean {
    return this.permisoSvc.tiene(clave);
  }

  refreshMe(): Observable<AuthUser> {
    return this.http.get<AuthUser>(`${environment.apiUrl}/auth/me`).pipe(
      tap((user) => this.aplicarUsuarioSesion(user, { corregirRuta: true })),
    );
  }

  /** Aplica usuario/permisos en memoria; devuelve true si los permisos cambiaron. */
  aplicarUsuarioSesion(user: AuthUser, opts?: { corregirRuta?: boolean }): boolean {
    if (!this._token()) return false;
    const firmaAntes = this.permisoSvc.firma();
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    this._user.set(user);
    this.permisoSvc.setPermisos(user.permisos);
    this.alarmaSvc.setAlarmas(user.alarmas);
    this.sedeSvc.initDesdeUsuario(user.sedes, { filtrarComoAdmin: this.usuarioFiltraPorSede(user) });
    const cambio = this.permisoSvc.firma() !== firmaAntes;
    if (opts?.corregirRuta !== false && cambio) {
      this.corregirRutaTrasPermisos(user.permisos);
    }
    return cambio;
  }

  /** Si revocaron permiso estando en una pantalla, redirige sin bloquear. */
  corregirRutaTrasPermisos(permisos?: string[] | null): void {
    if (!this._token()) return;
    const ctx = { puedeUsarPortalInstructor: this.puedeUsarPortalInstructor() };
    const destino = destinoTrasRevocar(this.router.url, permisos ?? this.permisoSvc.permisos(), ctx);
    if (destino) {
      void this.router.navigateByUrl(destino, { replaceUrl: true });
    }
  }
  login(username: string, password: string, turnstileToken?: string): Observable<StaffLoginResponse> {
    return this.http.post<StaffLoginResponse>(`${environment.apiUrl}/auth/login`, {
      username,
      password,
      turnstileToken: turnstileToken || undefined,
    });
  }

  mfaVerify(mfaToken: string, code: string): Observable<StaffLoginResponse> {
    return this.http.post<StaffLoginResponse>(`${environment.apiUrl}/auth/mfa/verify`, { mfaToken, code });
  }

  mfaRecovery(mfaToken: string, recoveryCode: string): Observable<StaffLoginResponse> {
    return this.http.post<StaffLoginResponse>(`${environment.apiUrl}/auth/mfa/recovery`, {
      mfaToken,
      recoveryCode,
    });
  }

  mfaSetupConfirm(setupToken: string, code: string): Observable<StaffLoginResponse> {
    return this.http.post<StaffLoginResponse>(`${environment.apiUrl}/auth/mfa/setup/confirm`, {
      setupToken,
      code,
    });
  }

  finalizeLogin(res: StaffLoginResponse): void {
    if (!res.token || !res.user) return;
    localStorage.setItem(TOKEN_KEY, res.token);
    this._token.set(res.token);
    this.aplicarUsuarioSesion(res.user, { corregirRuta: false });
  }

  /** Valida credenciales de admin sin cerrar la sesión del cajero. */
  verificarAdmin(username: string, password: string): Observable<VerificarAdminResponse> {
    return this.http.post<VerificarAdminResponse>(`${environment.apiUrl}/auth/verificar-admin`, {
      username,
      password,
    });
  }

  logout(): void {
    const enApp = this.router.url.split('?')[0].startsWith('/app');
    if (!this._token() && !this._user()) {
      if (enApp) this.irLogin();
      return;
    }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this._token.set(null);
    this._user.set(null);
    this.permisoSvc.setPermisos([]);
    this.alarmaSvc.setAlarmas([]);
    this.sedeSvc.seleccionar(null);
    this.irLogin();
  }

  private irLogin(): void {
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/app')) {
      window.location.assign('/login');
      return;
    }
    void this.router.navigateByUrl('/login', { replaceUrl: true });
  }

  private read(key: string): string | null {
    try { return localStorage.getItem(key); } catch { return null; }
  }
  private readJson<T>(key: string): T | null {
    const raw = this.read(key);
    if (!raw) return null;
    try { return JSON.parse(raw) as T; } catch { return null; }
  }
}
