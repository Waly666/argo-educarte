import { CommonModule } from '@angular/common';
import { Component, inject, Input, OnInit, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { TurnstileComponent } from '../../components/turnstile/turnstile.component';
import { AulaApiService } from '../../core/aula-api.service';

@Component({
  selector: 'av-contacto-form',
  standalone: true,
  imports: [CommonModule, FormsModule, TurnstileComponent],
  templateUrl: './contacto-form.component.html',
  styleUrl: './contacto-form.component.scss',
})
export class ContactoFormComponent implements OnInit {
  @Input({ required: true }) origen!: 'fundacion' | 'acerca';

  private api = inject(AulaApiService);

  turnstile = viewChild(TurnstileComponent);

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
    asunto: '',
    mensaje: '',
  };

  ngOnInit() {
    this.api.config().subscribe({
      next: (c) => {
        this.activo.set(!!c.formularioContactoActivo);
        this.turnstileSiteKey.set(c.turnstileSiteKey || '');
        this.cargandoConfig.set(false);
      },
      error: () => this.cargandoConfig.set(false),
    });
  }

  private turnstileTokenActual(): string {
    return this.turnstileToken() || this.turnstile()?.getToken() || '';
  }

  enviar() {
    this.error.set('');
    this.ok.set('');

    const token = this.turnstileTokenActual();
    if (this.turnstileSiteKey() && !token) {
      this.error.set('Complete la verificación de seguridad');
      return;
    }

    this.enviando.set(true);
    this.api
      .enviarContacto(
        {
          nombre: this.form.nombre.trim(),
          email: this.form.email.trim(),
          telefono: this.form.telefono.trim(),
          asunto: this.form.asunto.trim(),
          mensaje: this.form.mensaje.trim(),
          origen: this.origen,
        },
        token || undefined,
      )
      .subscribe({
        next: (res) => {
          this.enviando.set(false);
          this.ok.set(res.message || 'Mensaje enviado correctamente.');
          this.form = { nombre: '', email: '', telefono: '', asunto: '', mensaje: '' };
          this.turnstileToken.set('');
          this.turnstile()?.reset();
        },
        error: (e) => {
          this.enviando.set(false);
          this.error.set(e?.error?.message || 'No se pudo enviar el mensaje. Intente más tarde.');
          this.turnstileToken.set('');
          this.turnstile()?.reset();
        },
      });
  }
}
