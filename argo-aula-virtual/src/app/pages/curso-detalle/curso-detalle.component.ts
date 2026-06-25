import { CommonModule } from '@angular/common';

import { Component, inject, OnInit, signal } from '@angular/core';

import { ActivatedRoute, Router, RouterLink } from '@angular/router';



import { AulaApiService } from '../../core/aula-api.service';

import { CursoVirtual, EstadoInscripcionVirtual, PortalConfig } from '../../core/models';
import { PortalAuthService } from '../../core/portal-auth.service';
import { PortalSeoService } from '../../core/portal-seo.service';
import { resolveUploadUrl } from '../../core/upload-url.util';



@Component({

  selector: 'av-curso-detalle',

  standalone: true,

  imports: [CommonModule, RouterLink],

  templateUrl: './curso-detalle.component.html',

  styleUrl: './curso-detalle.component.scss',

})

export class CursoDetalleComponent implements OnInit {

  private api = inject(AulaApiService);

  private route = inject(ActivatedRoute);

  private router = inject(Router);

  auth = inject(PortalAuthService);
  private seo = inject(PortalSeoService);
  private portalConfig = signal<PortalConfig | null>(null);



  curso = signal<CursoVirtual | null>(null);

  inscripcion = signal<EstadoInscripcionVirtual | null>(null);

  logoUrl = signal<string | null>(null);

  tab = signal<'descripcion' | 'plan'>('descripcion');

  error = signal('');

  msg = signal('');

  matriculando = signal(false);
  pagando = signal(false);
  pasarelaActiva = signal(false);



  ngOnInit() {

    const id = this.route.snapshot.paramMap.get('id') || '';

    this.api.config().subscribe({
      next: (cfg) => {
        this.portalConfig.set(cfg);
        this.logoUrl.set(resolveUploadUrl(cfg.urlLogoAbsoluta || cfg.urlLogo));
      },
    });

    this.api.pasarelaPublica().subscribe({
      next: (p) => this.pasarelaActiva.set(p.activo === true),
      error: () => this.pasarelaActiva.set(false),
    });

    this.api.curso(id).subscribe({

      next: (c) => {
        this.curso.set(c);
        this.seo.applyCursoDetalle(this.portalConfig(), c);
        if (this.auth.isLoggedIn()) this.cargarInscripcion(id);
      },

      error: (e) => this.error.set(e?.error?.message || 'Curso no disponible'),

    });

  }



  cargarInscripcion(id: string) {

    this.api.inscripcion(id).subscribe({

      next: (ins) => this.inscripcion.set(ins),

      error: () => this.inscripcion.set(null),

    });

  }



  matricular() {

    const c = this.curso();

    if (!c || this.matriculando()) return;

    this.matriculando.set(true);

    this.msg.set('');

    this.api.matricular(c.idPrograma).subscribe({

      next: (res) => {

        this.matriculando.set(false);

        this.msg.set(res.message);

        this.cargarInscripcion(String(c.idPrograma));

      },

      error: (e) => {

        this.matriculando.set(false);

        this.msg.set(e?.error?.message || 'No se pudo matricular');

      },

    });

  }



  pagarEnLinea() {
    const c = this.curso();
    if (!c || this.pagando()) return;
    this.pagando.set(true);
    this.msg.set('');
    const redirectUrl = `${window.location.origin}/cursos/${c.idPrograma}?pago=ok`;
    this.api.iniciarPagoEnLinea(c.idPrograma, redirectUrl).subscribe({
      next: (res) => {
        this.pagando.set(false);
        if (res.checkoutUrl) {
          window.location.href = res.checkoutUrl;
        } else {
          this.msg.set('No se pudo iniciar el pago en línea.');
        }
      },
      error: (e) => {
        this.pagando.set(false);
        this.msg.set(e?.error?.message || 'No se pudo iniciar el pago en línea.');
      },
    });
  }



  irAlCurso() {

    this.router.navigate(['/aula']);

  }



  fmtPrecio(n: number) {

    return new Intl.NumberFormat('es-CO', {

      style: 'currency',

      currency: 'COP',

      minimumFractionDigits: 2,

      maximumFractionDigits: 2,

    }).format(n || 0);

  }



  labelNivel(n?: string | null) {

    if (!n) return '';

    return n.charAt(0) + n.slice(1).toLowerCase();

  }



  inicialAutor(nombre?: string | null) {

    const n = String(nombre || 'E').trim();

    return (n.charAt(0) || 'E').toUpperCase();

  }

  portadaUrl(c: CursoVirtual) {
    return resolveUploadUrl(c.urlPortadaAbsoluta || c.urlPortadaVirtual);
  }

}

