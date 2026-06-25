import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { TurnstileComponent } from '../../components/turnstile/turnstile.component';
import { AulaApiService } from '../../core/aula-api.service';

const TIPOS = ['Petición', 'Queja', 'Reclamo', 'Sugerencia', 'Felicitación'] as const;

@Component({
  selector: 'av-pqr-form',
  standalone: true,
  imports: [CommonModule, FormsModule, TurnstileComponent],
  templateUrl: './pqr-form.component.html',
  styleUrl: './pqr-form.component.scss',
})
export class PqrFormComponent implements OnInit {
  private api = inject(AulaApiService);

  turnstile = viewChild(TurnstileComponent);

  readonly tipos = TIPOS;

  activo = signal(false);
  cargandoConfig = signal(true);
  turnstileSiteKey = signal('');
  turnstileToken = signal('');
  error = signal('');
  ok = signal('');
  enviando = signal(false);

  form = {
    nombre: '',
    email: '',
    telefono: '',
    numDoc: '',
    tipo: 'Petición' as string,
    mensaje: '',
  };

  ngOnInit() {
    this.api.config().subscribe({
      next: (c) => {
        this.activo.set(!!c.formularioPqrActivo);
        this.turnstileSiteKey.set(c.turnstileSiteKey || '');
        this.cargandoConfig.set(false);
      },
      error: () => this.cargandoConfig.set(false),
    });
  }

  private tokenActual(): string {
    return this.turnstileToken() || this.turnstile()?.getToken() || '';
  }

  enviar() {
    this.error.set('');
    this.ok.set('');

    const token = this.tokenActual();
    if (this.turnstileSiteKey() && !token) {
      this.error.set('Complete la verificación de seguridad');
      return;
    }

    this.enviando.set(true);
    this.api
      .enviarPqr(
        {
          nombre: this.form.nombre.trim(),
          email: this.form.email.trim(),
          telefono: this.form.telefono.trim(),
          numDoc: this.form.numDoc.trim(),
          tipo: this.form.tipo,
          mensaje: this.form.mensaje.trim(),
        },
        token || undefined,
      )
      .subscribe({
        next: (res) => {
          this.enviando.set(false);
          this.ok.set(res.message || 'Su PQR fue enviado correctamente.');
          this.form = { nombre: '', email: '', telefono: '', numDoc: '', tipo: 'Petición', mensaje: '' };
          this.turnstileToken.set('');
          this.turnstile()?.reset();
        },
        error: (e) => {
          this.enviando.set(false);
          this.error.set(e?.error?.message || 'No se pudo enviar el PQR. Intente más tarde.');
          this.turnstileToken.set('');
          this.turnstile()?.reset();
        },
      });
  }
}
