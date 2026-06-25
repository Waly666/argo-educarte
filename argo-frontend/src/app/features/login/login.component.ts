import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

import { TurnstileComponent } from '../../components/turnstile/turnstile.component';
import { AuthService, StaffLoginResponse } from '../../core/services/auth.service';
import { rutaInicioApp } from '../../core/utils/auth-routes.util';
import { environment } from '../../../environments/environment';

type LoginUiStep = 'credentials' | 'mfa_verify' | 'mfa_setup' | 'mfa_recovery' | 'recovery_codes';

@Component({
  selector: 'argo-login',
  standalone: true,
  imports: [CommonModule, FormsModule, TurnstileComponent],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent implements AfterViewInit, OnDestroy {
  private auth = inject(AuthService);
  private router = inject(Router);
  private http = inject(HttpClient);

  @ViewChild('matrix', { static: true }) matrixRef!: ElementRef<HTMLCanvasElement>;

  turnstile = viewChild(TurnstileComponent);

  uiStep = signal<LoginUiStep>('credentials');
  username = signal('');
  password = signal('');
  mfaCode = signal('');
  recoveryCode = signal('');
  mfaToken = signal('');
  setupToken = signal('');
  qrDataUrl = signal('');
  manualSecret = signal('');
  recoveryCodes = signal<string[]>([]);
  displayName = signal('');

  turnstileSiteKey = signal('');
  turnstileToken = signal('');
  nombreEmpresa = signal('');
  logoUrl = signal('');
  loading = signal(false);
  error = signal<string | null>(null);

  readonly anioActual = new Date().getFullYear();

  private rafId: number | null = null;
  private resizeHandler = () => this.resizeCanvas();
  private drops: number[] = [];

  constructor() {
    this.http
      .get<{ turnstileSiteKey?: string; nombreEmpresa?: string; urlLogo?: string | null }>(
        `${environment.apiUrl}/auth/config`,
      )
      .subscribe({
        next: (c) => {
          this.turnstileSiteKey.set(c.turnstileSiteKey || '');
          this.nombreEmpresa.set(String(c.nombreEmpresa || '').trim());
          this.logoUrl.set(this.resolveLogoUrl(c.urlLogo));
        },
        error: () => {},
      });
  }

  private resolveLogoUrl(rel?: string | null): string {
    if (!rel) return '';
    if (/^https?:\/\//i.test(rel) || rel.startsWith('data:')) return rel;
    const serverBase = environment.apiUrl.replace(/\/api$/, '');
    if (rel.startsWith('/')) return `${serverBase}${rel}`;
    return `${environment.uploadsUrl}/${rel.replace(/^uploads\//, '')}`;
  }

  ngAfterViewInit(): void {
    this.resizeCanvas();
    window.addEventListener('resize', this.resizeHandler);
    this.startMatrix();
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.resizeHandler);
    if (this.rafId != null) cancelAnimationFrame(this.rafId);
  }

  submitCredentials() {
    if (!this.username() || !this.password()) {
      this.error.set('Ingresa usuario y contraseña');
      return;
    }
    const token = this.turnstileToken() || this.turnstile()?.getToken() || '';
    if (this.turnstileSiteKey() && !token) {
      this.error.set('Complete la verificación anti-bot.');
      return;
    }
    this.error.set(null);
    this.loading.set(true);
    this.auth.login(this.username().trim(), this.password(), token || undefined).subscribe({
      next: (res) => this.handleLoginStep(res),
      error: (err) => {
        this.loading.set(false);
        this.turnstile()?.reset();
        this.error.set(err?.error?.message || 'Credenciales inválidas');
      },
    });
  }

  submitMfaVerify() {
    const code = this.mfaCode().trim();
    if (!/^\d{6}$/.test(code)) {
      this.error.set('Ingrese el código de 6 dígitos');
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.auth.mfaVerify(this.mfaToken(), code).subscribe({
      next: (res) => this.handleLoginStep(res),
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.message || 'Código incorrecto');
      },
    });
  }

  submitMfaSetup() {
    const code = this.mfaCode().trim();
    if (!/^\d{6}$/.test(code)) {
      this.error.set('Ingrese el código de 6 dígitos de su app');
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.auth.mfaSetupConfirm(this.setupToken(), code).subscribe({
      next: (res) => this.handleLoginStep(res),
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.message || 'No se pudo activar 2FA');
      },
    });
  }

  submitRecovery() {
    const code = this.recoveryCode().trim();
    if (!code) {
      this.error.set('Ingrese un código de recuperación');
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.auth.mfaRecovery(this.mfaToken(), code).subscribe({
      next: (res) => this.handleLoginStep(res),
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.message || 'Código de recuperación inválido');
      },
    });
  }

  showRecovery() {
    this.uiStep.set('mfa_recovery');
    this.error.set(null);
    this.mfaCode.set('');
  }

  backToMfaVerify() {
    this.uiStep.set('mfa_verify');
    this.error.set(null);
    this.recoveryCode.set('');
  }

  continueAfterRecoveryCodes() {
    const u = this.auth.user();
    if (!u) return;
    this.router.navigateByUrl(
      rutaInicioApp(u.permisos, {
        puedeUsarPortalInstructor: u.puedeUsarPortalInstructor === true,
      }),
    );
  }

  private handleLoginStep(res: StaffLoginResponse) {
    this.loading.set(false);

    if (res.step === 'complete' && res.token && res.user) {
      this.auth.finalizeLogin(res);
      if (res.recoveryCodes?.length) {
        this.recoveryCodes.set(res.recoveryCodes);
        this.uiStep.set('recovery_codes');
        return;
      }
      this.enterApp(res);
      return;
    }

    if (res.step === 'mfa_verify' && res.mfaToken) {
      this.mfaToken.set(res.mfaToken);
      this.displayName.set(res.username || '');
      this.uiStep.set('mfa_verify');
      this.mfaCode.set('');
      return;
    }

    if (res.step === 'mfa_setup' && res.setupToken) {
      this.setupToken.set(res.setupToken);
      this.displayName.set(res.username || '');
      this.qrDataUrl.set(res.qrDataUrl || '');
      this.manualSecret.set(res.manualSecret || '');
      this.uiStep.set('mfa_setup');
      this.mfaCode.set('');
      return;
    }

    this.error.set('Respuesta de autenticación no reconocida');
  }

  private enterApp(res: StaffLoginResponse) {
    if (!res.token || !res.user) return;
    this.auth.finalizeLogin(res);
    this.router.navigateByUrl(
      rutaInicioApp(res.user.permisos, {
        puedeUsarPortalInstructor: res.user.puedeUsarPortalInstructor === true,
      }),
    );
  }

  private resizeCanvas() {
    const c = this.matrixRef?.nativeElement;
    if (!c) return;
    c.width = window.innerWidth;
    c.height = window.innerHeight;
    const fontSize = 16;
    const columns = Math.floor(c.width / fontSize);
    this.drops = new Array(columns).fill(0).map(() => Math.floor(Math.random() * -50));
  }

  private startMatrix() {
    const c = this.matrixRef.nativeElement;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const fontSize = 16;
    const chars = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎ0123456789ARGO';

    const draw = () => {
      ctx.fillStyle = 'rgba(3, 8, 26, 0.18)';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.font = `${fontSize}px "Exo", monospace`;

      for (let i = 0; i < this.drops.length; i++) {
        const text = chars.charAt(Math.floor(Math.random() * chars.length));
        const x = i * fontSize;
        const y = this.drops[i] * fontSize;

        const gradient = ctx.createLinearGradient(x, y - fontSize * 4, x, y);
        gradient.addColorStop(0, 'rgba(78, 163, 255, 0.05)');
        gradient.addColorStop(1, 'rgba(123, 208, 255, 0.95)');
        ctx.fillStyle = gradient;
        ctx.fillText(text, x, y);

        if (y > c.height && Math.random() > 0.975) this.drops[i] = 0;
        this.drops[i]++;
      }
      this.rafId = requestAnimationFrame(draw);
    };
    draw();
  }
}
