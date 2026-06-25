import { CommonModule } from '@angular/common';
import { ArgoDateInputComponent } from '../../shared/argo-date-input/argo-date-input.component';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { CertificadoJornadaAlertService } from '../../core/services/certificado-jornada-alert.service';
import { JornadaCapService } from '../../core/services/jornada-cap.service';
import {
  TIPOS_ALUMNO_DEF,
  TIPO_JORNADAS_CAPACITACION,
  TipoAlumno,
  fechaInput,
  normalizarTipoAlumno,
} from '../alumnos/catalogo.helpers';
import { ConfirmDialogService } from '../../shared/confirm-dialog/confirm-dialog.service';
import { FormModalComponent } from '../../shared/form-modal/form-modal.component';
import {
  CatalogoEnumBuscarComponent,
  EnumBuscarOption,
} from '../../shared/catalogo-enum-buscar/catalogo-enum-buscar.component';
import { esFechaHoy } from './jornada-calendario.util';
import { coincideBusquedaDocumento, coincideBusquedaTexto } from '../../core/utils/busqueda-alumno.helpers';
import {
  capAlumnoNombre,
  capCertCodigo,
  capCliente,
  capCodContrato,
  capDocAsis,
  capFechaJor,
  capHorasCert,
  capUbicacionJornada,
  rowCertificadoHoyClass,
  ubicacionJornadaLabel,
} from './jornada-ui.util';

export interface CertificadoJornadaItem {
  _id: string;
  codigoCert?: string;
  nombreCompleto?: string;
  numDoc?: number;
  encabezado?: string;
  horasCert?: string;
  fechaEmision?: string;
  fechaVencimiento?: string | null;
  observaciones?: string;
  numActa?: string;
  numFolio?: string;
  numRunt?: string;
  tipoCertificado?: string;
  municipio?: string;
  direccion?: string;
  ubicacionJornada?: string;
  codContrato?: string;
}

@Component({
  selector: 'argo-certificados-jornada-lista',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, FormModalComponent, CatalogoEnumBuscarComponent,
    ArgoDateInputComponent,
  ],
  templateUrl: './certificados-jornada-lista.component.html',
  styleUrls: ['./certificados-jornada-lista.component.scss'],
})
export class CertificadosJornadaListaComponent implements OnInit {
  private jornadaSvc = inject(JornadaCapService);
  private alertSvc = inject(CertificadoJornadaAlertService);
  private confirmSvc = inject(ConfirmDialogService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  loading = signal(false);
  guardando = signal(false);
  filtro = signal('');
  certificados = signal<CertificadoJornadaItem[]>([]);
  msg = signal<string | null>(null);
  msgError = signal(false);

  modalEditar = signal(false);
  editId = signal('');
  editEncabezado = signal('');
  editTipoCertificado = signal<TipoAlumno>(TIPO_JORNADAS_CAPACITACION);
  editNumActa = signal('');
  editNumFolio = signal('');
  editNumRunt = signal('');
  editObservaciones = signal('');
  editFechaEmision = signal('');
  editFechaVencimiento = signal('');

  readonly tiposCertificadoCat = TIPOS_ALUMNO_DEF;

  opcionesTipoCertificado = computed<EnumBuscarOption[]>(() =>
    this.tiposCertificadoCat.map((t) => ({ value: t, label: t })),
  );

  textoTipoCertificadoEdit = computed(() => this.editTipoCertificado() || '');
  readonly capCertCodigo = capCertCodigo;
  readonly capAlumnoNombre = capAlumnoNombre;
  readonly capDocAsis = capDocAsis;
  readonly capCliente = capCliente;
  readonly capCodContrato = capCodContrato;
  readonly capUbicacionJornada = capUbicacionJornada;
  readonly ubicacionJornadaLabel = ubicacionJornadaLabel;
  readonly capHorasCert = capHorasCert;
  readonly capFechaJor = capFechaJor;
  readonly rowCertificadoHoyClass = rowCertificadoHoyClass;
  readonly esFechaHoy = esFechaHoy;

  certificadoEdit = computed(() => this.certificados().find((c) => c._id === this.editId()) || null);
  certsHoyCount = computed(
    () => this.certificados().filter((c) => esFechaHoy(c.fechaEmision)).length,
  );

  filtrados = computed(() => {
    const q = this.filtro().trim();
    const list = this.certificados();
    if (!q) return list;
    return list.filter((c) => {
      const enc = String(c.encabezado || '');
      const cod = String(c.codigoCert || '');
      const contrato = String(c.codContrato || '');
      const ubicacion = String(c.ubicacionJornada || ubicacionJornadaLabel(c.municipio, c.direccion));
      return (
        coincideBusquedaTexto(c.nombreCompleto, q) ||
        coincideBusquedaTexto(enc, q) ||
        coincideBusquedaTexto(cod, q) ||
        coincideBusquedaDocumento(c.numDoc, q) ||
        coincideBusquedaTexto(contrato, q) ||
        coincideBusquedaTexto(ubicacion, q)
      );
    });
  });

  ngOnInit() {
    this.cargar();
  }

  cargar() {
    this.loading.set(true);
    this.jornadaSvc.listarCertificadosJornada().subscribe({
      next: (rows) => {
        this.certificados.set(rows || []);
        this.alertSvc.marcarConocidos((rows || []).map((c) => String(c._id)));
        this.loading.set(false);
        const id = this.route.snapshot.queryParamMap.get('editar');
        if (id) this.abrirEditar(id);
      },
      error: (e) => {
        this.loading.set(false);
        this.msgError.set(true);
        this.msg.set(e?.error?.message || 'No se pudo cargar los certificados.');
      },
    });
  }

  onTipoCertPick(opt: EnumBuscarOption): void {
    this.editTipoCertificado.set(normalizarTipoAlumno(String(opt.value)) as TipoAlumno);
  }

  onTipoCertLimpiar(): void {
    this.editTipoCertificado.set(TIPO_JORNADAS_CAPACITACION);
  }

  abrirEditar(id: string) {
    const c = this.certificados().find((x) => x._id === id);
    if (!c) return;
    this.editId.set(c._id);
    this.editEncabezado.set(c.encabezado || '');
    this.editTipoCertificado.set(normalizarTipoAlumno(c.tipoCertificado));
    this.editNumActa.set(c.numActa || '');
    this.editNumFolio.set(c.numFolio || '');
    this.editNumRunt.set(c.numRunt || '');
    this.editObservaciones.set(c.observaciones || '');
    this.editFechaEmision.set(fechaInput(c.fechaEmision));
    this.editFechaVencimiento.set(fechaInput(c.fechaVencimiento || undefined));
    this.modalEditar.set(true);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { editar: id },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  cerrarEditar() {
    this.modalEditar.set(false);
    this.editId.set('');
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { editar: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  guardarEditar() {
    const id = this.editId();
    if (!id) return;
    this.guardando.set(true);
    this.jornadaSvc
      .actualizarCertificadoJornada(id, {
        encabezado: this.editEncabezado().trim(),
        tipoCertificado: this.editTipoCertificado(),
        numActa: this.editNumActa().trim(),
        numFolio: this.editNumFolio().trim(),
        numRunt: this.editNumRunt().trim(),
        observaciones: this.editObservaciones().trim(),
        fechaEmision: this.editFechaEmision() || undefined,
        fechaVencimiento: this.editFechaVencimiento() || null,
      })
      .subscribe({
        next: (c) => {
          this.guardando.set(false);
          this.certificados.update((list) => list.map((x) => (x._id === id ? { ...x, ...c } : x)));
          this.msgError.set(false);
          this.msg.set('Certificado actualizado.');
          this.cerrarEditar();
        },
        error: (e) => {
          this.guardando.set(false);
          this.msgError.set(true);
          this.msg.set(e?.error?.message || 'No se pudo guardar.');
        },
      });
  }

  async eliminar(c: CertificadoJornadaItem) {
    const ok = await this.confirmSvc.open({
      title: 'Eliminar certificado',
      message: `¿Eliminar el certificado ${c.codigoCert || c._id} de ${c.nombreCompleto || 'el alumno'}?`,
      confirmLabel: 'Eliminar',
      variant: 'danger',
    });
    if (!ok) return;
    this.jornadaSvc.eliminarCertificadoJornada(c._id).subscribe({
      next: () => {
        this.certificados.update((list) => list.filter((x) => x._id !== c._id));
        this.alertSvc.descartar(c._id);
        this.msgError.set(false);
        this.msg.set('Certificado eliminado.');
      },
      error: (e) => {
        this.msgError.set(true);
        this.msg.set(e?.error?.message || 'No se pudo eliminar.');
      },
    });
  }

  imprimir(c: CertificadoJornadaItem) {
    this.jornadaSvc.imprimirCertificadoJornada(c._id, (m) => {
      this.msgError.set(true);
      this.msg.set(m);
    });
  }

  fmtFecha(f?: string) {
    if (!f) return '—';
    return new Date(f).toLocaleDateString('es-CO');
  }
}
