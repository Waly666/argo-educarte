import { CommonModule } from '@angular/common';
import { ArgoDateInputComponent } from '../../../shared/argo-date-input/argo-date-input.component';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Router } from '@angular/router';

import { AlumnoStore } from '../../../core/services/alumno-store.service';
import { AlumnoService } from '../../../core/services/alumno.service';
import type { DocumentoPendienteRes } from '../../../core/services/config-requisitos-documentos.service';
import { CertificadoService } from '../../../core/services/certificado.service';
import { CertificadoJornadaAlertService } from '../../../core/services/certificado-jornada-alert.service';
import { labelOrientacion, labelTipoCert } from '../../../core/constants/tipos-certificado';
import {
  TIPOS_ALUMNO_DEF,
  TIPO_ALUMNO_DEFAULT,
  TIPO_JORNADAS_CAPACITACION,
  fechaInput,
  normalizarTipoAlumno,
} from '../catalogo.helpers';
import {
  ConfigCertificadoService,
  PlantillaCertificado,
} from '../../../core/services/config-certificado.service';
import { ConfirmDialogService } from '../../../shared/confirm-dialog/confirm-dialog.service';
import { SupervisorAuthService } from '../../../shared/supervisor-auth/supervisor-auth.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'argo-certificados',
  standalone: true,
  imports: [CommonModule, FormsModule,
    ArgoDateInputComponent,
  ],
  templateUrl: './certificados.component.html',
  styleUrls: ['./certificados.component.scss'],
})
export class CertificadosComponent {
  store = inject(AlumnoStore);
  private router = inject(Router);
  private certSvc = inject(CertificadoService);
  private alumnoSvc = inject(AlumnoService);
  private cfgCertSvc = inject(ConfigCertificadoService);
  private confirmSvc = inject(ConfirmDialogService);
  private certAlertSvc = inject(CertificadoJornadaAlertService);
  private supervisorAuth = inject(SupervisorAuthService);
  private auth = inject(AuthService);

  elegibles = signal<any[]>([]);
  certificados = signal<any[]>([]);
  plantillas = signal<PlantillaCertificado[]>([]);

  idLiquidacion = signal<string>('');
  idPlantilla = signal<string>('');
  numActa = signal<string>('');
  numFolio = signal<string>('');
  numRunt = signal<string>('');
  observaciones = signal<string>('');
  fechaEmision = signal<string>('');

  readonly tiposCertificadoCat = TIPOS_ALUMNO_DEF;

  editId = signal<string>('');
  editTipoCertificado = signal<string>(TIPO_ALUMNO_DEFAULT);
  editEncabezado = signal<string>('');
  editNumActa = signal<string>('');
  editNumFolio = signal<string>('');
  editNumRunt = signal<string>('');
  editObservaciones = signal<string>('');
  editFechaEmision = signal<string>('');
  editFechaVencimiento = signal<string>('');

  loading = signal(false);
  saving = signal(false);
  savingEdit = signal(false);
  msg = signal<string | null>(null);
  msgEsError = signal(false);
  docsPendientes = signal<DocumentoPendienteRes[]>([]);

  elegibleSel = computed(() => this.elegibles().find((e) => e._id === this.idLiquidacion()));

  plantillaActiva = computed(() => {
    const id = this.idPlantilla();
    if (!id) return undefined;
    return this.plantillas().find((p) => p._id === id);
  });

  labelTipo = labelTipoCert;
  labelOrientacion = labelOrientacion;

  /** Al emitir: Jornada si el programa es Cap Jornada Capacitacion; si no, tipo del alumno */
  tipoCertNuevo = computed(() => {
    const es = this.elegibleSel();
    if (es?.tipoFormatoCert === 'jornada_capacitacion') return TIPO_JORNADAS_CAPACITACION;
    return normalizarTipoAlumno(this.store.alumno()?.tipoAlumno);
  });

  constructor() {
    this.cfgCertSvc.listarPlantillasTodas().subscribe({
      next: (r) => this.plantillas.set(r || []),
    });

    effect(() => {
      const nd = this.store.numDoc();
      const _docTouch = this.store.alumno()?.fechaMod;
      if (nd) this.recargar(nd);
      else {
        this.elegibles.set([]);
        this.certificados.set([]);
      }
    });
  }

  onSeleccionarElegible(id: string) {
    this.idLiquidacion.set(id);
    const es = this.elegibles().find((e) => e._id === id);
    if (es?.plantillaSugeridaId) {
      this.idPlantilla.set(es.plantillaSugeridaId);
    } else {
      this.idPlantilla.set('');
    }
  }

  recargar(numDoc: number | string) {
    this.loading.set(true);
    const alumnoId = this.store.alumno()?._id;
    if (alumnoId) {
      this.alumnoSvc.validarDocumentos(alumnoId).subscribe({
        next: (v) => this.docsPendientes.set(v.ok ? [] : v.pendientes || []),
        error: () => this.docsPendientes.set([]),
      });
    } else {
      this.docsPendientes.set([]);
    }
    this.certSvc.elegibles(numDoc).subscribe({
      next: (r) => this.elegibles.set(r || []),
      error: (e) => {
        this.elegibles.set([]);
        this.setMsg(
          e?.error?.message || 'No se pudo cargar los programas elegibles. Revise la conexión o contacte soporte.',
          true,
        );
      },
    });
    this.certSvc.listarPorAlumno(numDoc).subscribe({
      next: (r) => {
        this.certificados.set(r || []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  emitir() {
    const nd = this.store.numDoc();
    if (!nd) {
      this.setMsg('Selecciona un alumno primero.', true);
      return;
    }
    if (!this.idLiquidacion()) {
      this.setMsg('Selecciona un programa elegible.', true);
      return;
    }
    const es = this.elegibleSel();
    if (!this.idPlantilla()) {
      this.setMsg(
        es?.tipoFormatoCertLabel
          ? `No hay formato configurado para «${es.tipoFormatoCertLabel}». Configúrelo en Config. Certificados.`
          : 'No hay formato de certificado configurado.',
        true,
      );
      return;
    }
    this.saving.set(true);
    this.setMsg(null, false);
    this.certSvc
      .crear({
        numDoc: nd,
        idLiquidacion: this.idLiquidacion(),
        idPlantilla: this.idPlantilla() || undefined,
        numActa: this.numActa() || undefined,
        numFolio: this.numFolio() || undefined,
        numRunt: this.numRunt() || undefined,
        observaciones: this.observaciones() || undefined,
        fechaEmision: this.fechaEmision() || undefined,
      })
      .subscribe({
        next: (cert) => {
          this.saving.set(false);
          this.idLiquidacion.set('');
          this.idPlantilla.set('');
          this.numActa.set('');
          this.numFolio.set('');
          this.numRunt.set('');
          this.observaciones.set('');
          this.fechaEmision.set('');
          this.recargar(nd);
          this.certAlertSvc.notificarDesdeRespuesta(cert, this.store.nombreCompleto() || cert?.nombreCompleto);
          this.setMsg('Certificado emitido.', false);
        },
        error: (e) => this.setMsg(e?.error?.message || 'Error emitiendo certificado.', true),
      });
  }

  irDocumentos() {
    this.router.navigate([], { queryParams: { tab: 'documentos' }, queryParamsHandling: 'merge' });
  }

  private setMsg(text: string | null, isErr: boolean) {
    this.msg.set(text);
    this.msgEsError.set(isErr);
  }

  abrirEditar(c: any) {
    this.editId.set(c._id);
    this.editTipoCertificado.set(normalizarTipoAlumno(c.tipoCertificado));
    this.editEncabezado.set(c.encabezado || c.nomCert || c.programaDescr || '');
    this.editNumActa.set(c.numActa || '');
    this.editNumFolio.set(c.numFolio || '');
    this.editNumRunt.set(c.numRunt || '');
    this.editObservaciones.set(c.observaciones || '');
    this.editFechaEmision.set(fechaInput(c.fechaEmision));
    this.editFechaVencimiento.set(fechaInput(c.fechaVencimiento));
    this.msg.set(null);
  }

  cancelarEditar() {
    this.editId.set('');
  }

  guardarEdicion() {
    const id = this.editId();
    const nd = this.store.numDoc();
    if (!id || !nd) return;
    if (!this.editFechaEmision()) {
      this.msg.set('La fecha de emisión es obligatoria.');
      return;
    }
    this.savingEdit.set(true);
    this.msg.set(null);
    this.certSvc
      .actualizar(id, {
        tipoCertificado: normalizarTipoAlumno(this.editTipoCertificado()),
        encabezado: this.editEncabezado() || undefined,
        numActa: this.editNumActa() || undefined,
        numFolio: this.editNumFolio() || undefined,
        numRunt: this.editNumRunt() || undefined,
        observaciones: this.editObservaciones() || undefined,
        fechaEmision: this.editFechaEmision(),
        fechaVencimiento: this.editFechaVencimiento() || null,
      })
      .subscribe({
        next: () => {
          this.savingEdit.set(false);
          this.editId.set('');
          this.recargar(nd);
          this.msg.set('Certificado actualizado.');
        },
        error: (e) => {
          this.savingEdit.set(false);
          this.msg.set(e?.error?.message || 'Error al guardar cambios.');
        },
      });
  }

  async anular(c: any) {
    const nd = this.store.numDoc();
    if (!nd) return;
    const prog = c.programaDescr || c.idProg || 'certificado';
    const ok = await this.confirmSvc.open({
      title: '¿Anular este certificado?',
      message: `Se anulará el certificado del programa «${prog}». Esta acción no se puede deshacer.`,
      variant: 'danger',
      icon: 'delete',
      confirmLabel: 'Sí, anular',
    });
    if (!ok) return;
    let auth: { autorizadoUsername?: string; autorizadoPassword?: string } | undefined;
    if (!this.auth.isAdmin()) {
      const cred = await this.supervisorAuth.solicitar({
        title: 'Autorización para anular certificado',
        message: `Anular el certificado del programa «${prog}» requiere autorización de un administrador.`,
        confirmLabel: 'Autorizar y anular',
      });
      if (!cred) return;
      auth = cred;
    }
    this.certSvc.eliminar(c._id, auth).subscribe({
      next: () => this.recargar(nd),
      error: (e) => this.msg.set(e?.error?.message || 'Error anulando.'),
    });
  }

  esAnulado(c: { estado?: string }): boolean {
    return String(c?.estado || '').trim().toLowerCase() === 'anulado';
  }

  imprimir(c: { _id: string }) {
    this.certSvc.abrirHtml(c._id, (m) => this.msg.set(m));
  }

  fmt(v: any): string {
    if (v == null) return '';
    if (typeof v === 'object' && v.$numberDecimal != null) v = Number(v.$numberDecimal);
    const n = Number(v) || 0;
    return n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
  }
  fecha(f?: string) {
    if (!f) return '';
    return new Date(f).toLocaleDateString('es-CO');
  }
}
