import { CommonModule } from '@angular/common';
import { ArgoDateInputComponent } from '../../shared/argo-date-input/argo-date-input.component';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { CertificadoService, CertificadoListItem } from '../../core/services/certificado.service';
import { ClienteService, Cliente } from '../../core/services/cliente.service';
import { TIPOS_CERTIFICADO } from '../../core/constants/tipos-certificado';

@Component({
  selector: 'argo-certificados-vencidos',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink,
    ArgoDateInputComponent,
  ],
  templateUrl: './certificados-vencidos.component.html',
  styleUrls: ['./certificados-vencidos.component.scss'],
})
export class CertificadosVencidosComponent implements OnInit, OnDestroy {
  private certSvc = inject(CertificadoService);
  private clienteSvc = inject(ClienteService);
  private router = inject(Router);

  readonly porPagina = 100;
  readonly tiposFormato = TIPOS_CERTIFICADO.filter((t) => t.id !== 'jornada_capacitacion');

  loading = signal(false);
  exportando = signal(false);
  certificados = signal<CertificadoListItem[]>([]);
  totalRegistros = signal(0);
  totalPaginas = signal(1);
  paginaActual = signal(1);
  filtro = signal('');
  tipoFormato = signal('');
  vencimientoDesde = signal('');
  vencimientoHasta = signal('');
  msg = signal<string | null>(null);

  empresaFiltroId = signal<string | null>(null);
  empresaFiltroNombre = signal('');
  empresaSugerencias = signal<Cliente[]>([]);
  empresaDropdown = signal(false);
  empresaCargando = signal(false);

  ngOnInit() {
    this.cargar();
  }
  ngOnDestroy() {}

  private paramsFiltro() {
    return {
      q: this.filtro().trim() || undefined,
      tipoFormatoCert: this.tipoFormato() || undefined,
      empresaId: this.empresaFiltroId() || undefined,
      vencimientoDesde: this.vencimientoDesde() || undefined,
      vencimientoHasta: this.vencimientoHasta() || undefined,
    };
  }

  private fechasVencimientoValidas(): boolean {
    const desde = this.vencimientoDesde();
    const hasta = this.vencimientoHasta();
    if (!desde || !hasta) return true;
    return desde <= hasta;
  }

  cargar(silencioso = false) {
    if (!this.fechasVencimientoValidas()) {
      this.msg.set('La fecha «Venció desde» no puede ser posterior a «Venció hasta».');
      return;
    }
    if (!silencioso) this.loading.set(true);
    this.msg.set(null);
    this.certSvc
      .listarVencidos({
        ...this.paramsFiltro(),
        page: this.paginaActual(),
        limit: this.porPagina,
        cacheBust: Date.now(),
      })
      .subscribe({
        next: (res) => {
          this.certificados.set(res.items || []);
          this.totalRegistros.set(res.total || 0);
          this.totalPaginas.set(res.totalPages || 1);
          this.loading.set(false);
        },
        error: (e) => {
          this.loading.set(false);
          this.msg.set(e?.error?.message || 'No se pudieron cargar los certificados vencidos.');
        },
      });
  }

  buscarEmpresaFiltro(q: string) {
    this.empresaFiltroNombre.set(q);
    if (!q.trim()) {
      this.empresaSugerencias.set([]);
      this.empresaDropdown.set(false);
      if (!q) this.seleccionarEmpresaFiltro(null);
      return;
    }
    this.empresaCargando.set(true);
    this.clienteSvc.listar(q.trim()).subscribe({
      next: (rows) => {
        this.empresaSugerencias.set(rows.slice(0, 8));
        this.empresaDropdown.set(rows.length > 0);
        this.empresaCargando.set(false);
      },
      error: () => this.empresaCargando.set(false),
    });
  }

  seleccionarEmpresaFiltro(c: Cliente | null) {
    if (!c) {
      this.empresaFiltroId.set(null);
      this.empresaFiltroNombre.set('');
      this.empresaSugerencias.set([]);
      this.empresaDropdown.set(false);
    } else {
      const nombre =
        c.razonSocial?.trim() || c.nombreComercial?.trim() || c.nombres?.trim() || c.identificacion || '';
      this.empresaFiltroId.set(c._id || null);
      this.empresaFiltroNombre.set(nombre);
      this.empresaSugerencias.set([]);
      this.empresaDropdown.set(false);
    }
    this.paginaActual.set(1);
    this.cargar(true);
  }

  onEmpresaFiltroBlur() {
    setTimeout(() => this.empresaDropdown.set(false), 200);
  }

  onFiltroChange(val: string) {
    this.filtro.set(val);
    this.paginaActual.set(1);
    this.cargar(true);
  }

  onTipoChange(val: string) {
    this.tipoFormato.set(val);
    this.paginaActual.set(1);
    this.cargar(true);
  }

  onVencimientoDesdeChange(val: string) {
    this.vencimientoDesde.set(val || '');
    this.paginaActual.set(1);
    this.cargar(true);
  }

  onVencimientoHastaChange(val: string) {
    this.vencimientoHasta.set(val || '');
    this.paginaActual.set(1);
    this.cargar(true);
  }

  limpiar() {
    this.filtro.set('');
    this.tipoFormato.set('');
    this.vencimientoDesde.set('');
    this.vencimientoHasta.set('');
    this.empresaFiltroId.set(null);
    this.empresaFiltroNombre.set('');
    this.empresaSugerencias.set([]);
    this.empresaDropdown.set(false);
    this.paginaActual.set(1);
    this.cargar();
  }

  exportarExcel() {
    if (this.exportando() || this.totalRegistros() <= 0) return;
    this.exportando.set(true);
    this.msg.set(null);
    this.certSvc.exportarVencidos(this.paramsFiltro()).subscribe({
      next: (blob) => {
        this.exportando.set(false);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `certificados-vencidos-${new Date().toISOString().slice(0, 10)}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: async (e) => {
        this.exportando.set(false);
        let mensaje = 'No se pudo exportar a Excel.';
        try {
          const text = await e?.error?.text?.();
          if (text) {
            const parsed = JSON.parse(text);
            if (parsed?.message) mensaje = parsed.message;
          }
        } catch {
          /* ignore */
        }
        this.msg.set(mensaje);
      },
    });
  }

  irPagina(p: number) {
    const pag = Math.max(1, Math.min(p, this.totalPaginas()));
    if (pag === this.paginaActual()) return;
    this.paginaActual.set(pag);
    this.cargar(true);
  }

  pagHasta(): number {
    return Math.min(this.paginaActual() * this.porPagina, this.totalRegistros());
  }

  paginasVisibles(): number[] {
    const total = this.totalPaginas();
    const actual = this.paginaActual();
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: number[] = [];
    const start = Math.max(2, actual - 2);
    const end = Math.min(total - 1, actual + 2);
    pages.push(1);
    if (start > 2) pages.push(-1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < total - 1) pages.push(-1);
    pages.push(total);
    return pages;
  }

  abrirAlumno(c: CertificadoListItem) {
    if (!c.alumnoId) return;
    void this.router.navigate(['/app/alumnos', c.alumnoId], { queryParams: { tab: 'certificados' } });
  }

  fecha(iso?: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('es-CO');
  }

  diasDesdeVencimiento(iso?: string | null): number | null {
    if (!iso) return null;
    const fv = new Date(iso);
    fv.setHours(0, 0, 0, 0);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const diff = Math.floor((hoy.getTime() - fv.getTime()) / 86400000);
    return diff >= 0 ? diff : null;
  }

  etiquetaDias(iso?: string | null): string {
    const d = this.diasDesdeVencimiento(iso);
    if (d === null) return '—';
    if (d === 0) return 'hoy';
    if (d === 1) return 'ayer';
    return `hace ${d} días`;
  }

  claseDias(iso?: string | null): string {
    const d = this.diasDesdeVencimiento(iso);
    if (d === null) return '';
    if (d <= 7) return 'dias-chip dias-chip--warn';
    if (d <= 30) return 'dias-chip dias-chip--orange';
    return 'dias-chip dias-chip--red';
  }
}
