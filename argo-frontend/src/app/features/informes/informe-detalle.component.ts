import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { ArgoDateInputComponent } from '../../shared/argo-date-input/argo-date-input.component';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { TIPOS_CERTIFICADO } from '../../core/constants/tipos-certificado';
import { CatalogoService } from '../../core/services/catalogo.service';
import {
  FiltroInformeDef,
  InformeDef,
  InformesService,
  ResultadoInforme,
} from '../../core/services/informes.service';
import { ProgramaService } from '../../core/services/programa.service';
import { ServicioCatalogoService } from '../../core/services/servicio-catalogo.service';
import {
  CatalogoEnumBuscarComponent,
  EnumBuscarOption,
} from '../../shared/catalogo-enum-buscar/catalogo-enum-buscar.component';
import { TIPOS_ALUMNO_DEF, catEtiqueta, catValor } from '../alumnos/catalogo.helpers';
import { imprimirInformeTabla } from './informe-print.util';
import { ConfigService } from '../../core/services/config.service';

@Component({
  selector: 'argo-informe-detalle',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    CurrencyPipe,
    DatePipe,
    CatalogoEnumBuscarComponent,
  
    ArgoDateInputComponent,
  ],
  templateUrl: './informe-detalle.component.html',
  styleUrls: ['./informe-detalle.component.scss'],
})
export class InformeDetalleComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private svc = inject(InformesService);
  private progSvc = inject(ProgramaService);
  private servSvc = inject(ServicioCatalogoService);
  private catSvc = inject(CatalogoService);
  private configSvc = inject(ConfigService);

  informe = signal<InformeDef | null>(null);
  resultado = signal<ResultadoInforme | null>(null);
  loading = signal(false);
  generando = signal(false);
  exportando = signal(false);
  msg = signal<string | null>(null);
  msgError = signal(false);

  /** Valores actuales de filtros (clave → string). */
  filtrosVal = signal<Record<string, string>>({});
  /** Etiquetas visibles en combobox (clave → label). */
  etiquetasFiltro = signal<Record<string, string>>({});
  skip = signal(0);
  readonly pageSize = 100;

  idInforme = computed(() => this.informe()?.id || '');

  pageLabel = computed(() => {
    const r = this.resultado();
    if (!r) return '';
    const desde = r.total ? r.skip + 1 : 0;
    const hasta = Math.min(r.skip + r.items.length, r.total);
    return `${desde}–${hasta} de ${r.total}`;
  });

  readonly opcionesPagada: EnumBuscarOption[] = [
    { value: 'No Pago', label: 'No pago' },
    { value: 'Pago Parcial', label: 'Pago parcial' },
    { value: 'Pagado', label: 'Pagado' },
  ];

  readonly opcionesTipoAlumno: EnumBuscarOption[] = TIPOS_ALUMNO_DEF.map((t) => ({
    value: t,
    label: t,
  }));

  readonly opcionesTipoCert: EnumBuscarOption[] = TIPOS_CERTIFICADO.filter(
    (t) => t.id !== 'jornada_capacitacion',
  ).map((t) => ({ value: t.id, label: t.label }));

  opcionesJornada = signal<EnumBuscarOption[]>([]);
  opcionesTipoCap = signal<EnumBuscarOption[]>([]);
  opcionesPrograma = signal<EnumBuscarOption[]>([]);
  /** Servicios de vínculo general (sin programa / no capacitación). */
  opcionesServicioGeneral = signal<EnumBuscarOption[]>([]);
  /** Servicios vinculados a programa (matrícula / capacitación). */
  opcionesServicioPrograma = signal<EnumBuscarOption[]>([]);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') || '';
    this.svc.obtener(id).subscribe({
      next: (def) => {
        this.informe.set(def);
        const inicial: Record<string, string> = {};
        for (const f of def.filtros) {
          if (f.tipo === 'booleano') {
            inicial[f.clave] = f.default === false ? 'false' : 'true';
          } else {
            inicial[f.clave] = '';
          }
        }
        this.filtrosVal.set(inicial);
        this.etiquetasFiltro.set({});
      },
      error: () => {
        this.msgError.set(true);
        this.msg.set('Informe no encontrado.');
      },
    });

    this.catSvc.list<Record<string, unknown>>('jornada').subscribe({
      next: (rows) => {
        this.opcionesJornada.set(
          rows.map((r) => ({ value: catValor(r), label: catEtiqueta(r) })).filter((o) => o.value),
        );
      },
    });

    this.catSvc.list<Record<string, unknown>>('catTipoCapacitacion').subscribe({
      next: (rows) => {
        this.opcionesTipoCap.set(
          rows
            .map((r): EnumBuscarOption | null => {
              const idRaw = r['idTipCap'] ?? r['id'];
              if (idRaw == null || idRaw === '') return null;
              const label = catEtiqueta(r) || String(r['tipoCap'] ?? r['descripcion'] ?? idRaw).trim();
              return { value: String(idRaw), label: label || String(idRaw) };
            })
            .filter((o): o is EnumBuscarOption => o != null),
        );
      },
    });

    this.progSvc.listar({ activos: false, catalogo: true }).subscribe({
      next: (list) => {
        this.opcionesPrograma.set(
          list.map((p) => ({
            value: String(p.idPrograma),
            label: p.codigoProg ? `${p.codigoProg} — ${p.nombreProg}` : String(p.nombreProg || ''),
          })),
        );
      },
    });

    this.servSvc.listar({ sinPrograma: true, catalogo: true }).subscribe({
      next: (list) => {
        this.opcionesServicioGeneral.set(
          list.map((s) => ({
            value: String(s.idServ),
            label: String(s.descrServicio || s.idServ),
          })),
        );
      },
    });

    this.servSvc.listar({ soloPrograma: true, catalogo: true }).subscribe({
      next: (list) => {
        this.opcionesServicioPrograma.set(
          list.map((s) => ({
            value: String(s.idServ),
            label: `${s.programaCodigo ? s.programaCodigo + ' · ' : ''}${s.descrServicio || s.idServ}`,
            hint: String(s.idProg ?? ''),
          })),
        );
      },
    });
  }

  vinculoServicioFiltro(clave: string): 'general' | 'programa' {
    const f = this.informe()?.filtros.find((x) => x.clave === clave);
    return f?.servicioVinculo === 'general' ? 'general' : 'programa';
  }

  /** Catálogos locales precargados (sin búsqueda remota al abrir). */
  opcionesCombo(clave: string, tipo: string): EnumBuscarOption[] {
    switch (tipo) {
      case 'programa':
        return this.opcionesPrograma();
      case 'servicio': {
        const vinculo = this.vinculoServicioFiltro(clave);
        const base =
          vinculo === 'general' ? this.opcionesServicioGeneral() : this.opcionesServicioPrograma();
        if (vinculo === 'programa') {
          const idProg = this.valorFiltro('idPrograma');
          if (idProg) return base.filter((o) => o.hint === idProg);
        }
        return base;
      }
      default:
        return this.opcionesSelect(tipo);
    }
  }

  comboAncho(tipo: string): boolean {
    return ['tipoCap', 'tipoCert', 'programa', 'servicio'].includes(tipo);
  }

  textoComboFiltro(clave: string, tipo: string): string {
    const etiqueta = this.etiquetasFiltro()[clave];
    if (etiqueta) return etiqueta;
    const val = this.valorFiltro(clave);
    if (!val) return '';
    const op = this.opcionesCombo(clave, tipo).find((o) => String(o.value) === val);
    return op?.label ?? val;
  }

  opcionesSelect(tipo: string): EnumBuscarOption[] {
    switch (tipo) {
      case 'jornada':
        return this.opcionesJornada();
      case 'tipoCap':
        return this.opcionesTipoCap();
      case 'tipoCert':
        return this.opcionesTipoCert;
      case 'tipoAlumno':
        return this.opcionesTipoAlumno;
      case 'pagada':
        return this.opcionesPagada;
      default:
        return [];
    }
  }

  valorFiltro(clave: string): string {
    return this.filtrosVal()[clave] ?? '';
  }

  setFiltro(clave: string, valor: string) {
    this.filtrosVal.update((s) => ({ ...s, [clave]: valor }));
    this.resultado.set(null);
  }

  toggleBooleano(clave: string) {
    const actual = this.valorFiltro(clave) !== 'false';
    this.setFiltro(clave, actual ? 'false' : 'true');
  }

  booleanoActivo(clave: string): boolean {
    return this.valorFiltro(clave) !== 'false';
  }

  etiquetaFiltro(clave: string): string {
    return this.etiquetasFiltro()[clave] ?? '';
  }

  onSeleccionEnum(clave: string, op: EnumBuscarOption) {
    this.setFiltro(clave, String(op.value));
    this.etiquetasFiltro.update((s) => ({ ...s, [clave]: op.label }));
    if (clave === 'idPrograma' && this.valorFiltro('idServicio')) {
      this.onLimpiarEnum('idServicio');
    }
  }

  onLimpiarEnum(clave: string) {
    this.setFiltro(clave, '');
    this.etiquetasFiltro.update((s) => ({ ...s, [clave]: '' }));
  }

  limpiarFiltros() {
    const def = this.informe();
    if (!def) return;
    const inicial: Record<string, string> = {};
    for (const f of def.filtros) {
      if (f.tipo === 'booleano') {
        inicial[f.clave] = f.default === false ? 'false' : 'true';
      } else {
        inicial[f.clave] = '';
      }
    }
    this.filtrosVal.set(inicial);
    this.etiquetasFiltro.set({});
    this.resultado.set(null);
    this.skip.set(0);
  }

  paramsEjecucion(): Record<string, string | number | boolean> {
    const out: Record<string, string | number | boolean> = {};
    const vals = this.filtrosVal();
    const def = this.informe();
    if (!def) return out;
    for (const f of def.filtros) {
      const v = vals[f.clave];
      if (v === '' || v == null) continue;
      if (f.tipo === 'booleano') {
        out[f.clave] = v !== 'false';
      } else {
        out[f.clave] = v;
      }
    }
    out['skip'] = this.skip();
    out['limit'] = this.pageSize;
    return out;
  }

  subtituloFiltros(): string {
    const partes: string[] = [];
    const def = this.informe();
    if (!def) return '';
    for (const f of def.filtros) {
      const v = this.valorFiltro(f.clave);
      if (!v || f.tipo === 'booleano') continue;
      partes.push(`${f.etiqueta}: ${v}`);
    }
    return partes.join(' · ');
  }

  generarDesdeInicio() {
    this.skip.set(0);
    this.generar();
  }

  generar() {
    const id = this.idInforme();
    if (!id) return;
    this.generando.set(true);
    this.msg.set(null);
    this.svc.ejecutar(id, this.paramsEjecucion()).subscribe({
      next: (r) => {
        this.resultado.set(r);
        this.generando.set(false);
      },
      error: (e) => {
        this.generando.set(false);
        this.msgError.set(true);
        this.msg.set(e?.error?.message || 'No se pudo generar el informe.');
      },
    });
  }

  paginaAnterior() {
    const s = this.skip();
    if (s <= 0) return;
    this.skip.set(Math.max(0, s - this.pageSize));
    this.generar();
  }

  paginaSiguiente() {
    const r = this.resultado();
    if (!r || r.skip + r.items.length >= r.total) return;
    this.skip.set(r.skip + this.pageSize);
    this.generar();
  }

  exportarExcel() {
    const id = this.idInforme();
    if (!id) return;
    this.exportando.set(true);
    const params = { ...this.paramsEjecucion() };
    delete params['skip'];
    delete params['limit'];
    this.svc.exportarExcel(id, params).subscribe({
      next: (blob) => {
        this.exportando.set(false);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `informe-${id}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => {
        this.exportando.set(false);
        this.msgError.set(true);
        this.msg.set('No se pudo exportar a Excel.');
      },
    });
  }

  imprimir() {
    const r = this.resultado();
    const def = this.informe();
    if (!r || !def) return;
    this.configSvc.obtenerReciboEncabezado().subscribe({
      next: (empresa) => {
        imprimirInformeTabla({
          titulo: def.etiqueta,
          subtitulo: this.subtituloFiltros() || undefined,
          columnas: r.columnas,
          filas: r.items,
          empresa,
        });
      },
      error: () => {
        imprimirInformeTabla({
          titulo: def.etiqueta,
          subtitulo: this.subtituloFiltros() || undefined,
          columnas: r.columnas,
          filas: r.items,
        });
      },
    });
  }

  esCombo(tipo: string): boolean {
    return ['programa', 'servicio', 'jornada', 'tipoAlumno', 'pagada', 'tipoCert', 'tipoCap'].includes(tipo);
  }

  esTipo(f: FiltroInformeDef, tipos: string[]): boolean {
    return tipos.includes(f.tipo);
  }

  celdaValor(row: Record<string, unknown>, col: { clave: string; tipo: string }): unknown {
    return row[col.clave];
  }
}
