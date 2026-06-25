import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';

import {
  CatalogoAdminService,
  CatalogoListadoAdmin,
  CatalogoMetaItem,
} from '../../core/services/catalogo-admin.service';
import { CatalogoService } from '../../core/services/catalogo.service';
import { SedeDto, SedeService } from '../../core/services/sede.service';
import { capEstado, capId, capTipoServ } from '../../core/utils/capsule.util';
import {
  coerceNumberInput,
  formatNumericCell,
  inputTypeForField,
  isMoneyField,
  isNumericField,
} from '../../core/utils/numeric-fields.util';
import { ConfirmDialogService } from '../../shared/confirm-dialog/confirm-dialog.service';
import {
  CatalogoEnumBuscarComponent,
  EnumBuscarOption,
} from '../../shared/catalogo-enum-buscar/catalogo-enum-buscar.component';
import { readVistaLista, saveVistaLista, VistaLista } from '../../core/utils/vista-lista.helpers';
import { CLASES_SERVICIO, CLASE_SERV_DEFAULT } from '../../core/constants/clase-servicio';
import { ClaseVehiculo, VehiculoService } from '../../core/services/vehiculo.service';
import {
  CATEGORIAS_LICENCIA_VEHICULO,
  labelCategoriasLicencia,
} from '../../core/constants/categorias-licencia-vehiculo';
import {
  SECCIONES_CARACT_INSPECCION,
  labelSeccionCaractInspeccion,
} from '../../core/constants/inspeccion-preop-catalogo';

interface ClaseRow {
  idClase: string;
  label: string;
}

interface ItemInspeccionOpcion {
  idItem: string;
  item: string;
  tipos: string;
  label: string;
}

@Component({
  selector: 'argo-catalogos-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, CatalogoEnumBuscarComponent],
  templateUrl: './catalogos-admin.component.html',
  styleUrls: ['./catalogos-admin.component.scss'],
})
export class CatalogosAdminComponent implements OnInit {
  private svc = inject(CatalogoAdminService);
  private catCache = inject(CatalogoService);
  private confirm = inject(ConfirmDialogService);
  private vehSvc = inject(VehiculoService);
  private route = inject(ActivatedRoute);
  private sedeSvc = inject(SedeService);

  catalogos = signal<CatalogoMetaItem[]>([]);
  seleccionado = signal<string | null>(null);
  listado = signal<CatalogoListadoAdmin | null>(null);
  loading = signal(false);
  saving = signal(false);
  msg = signal<string | null>(null);
  msgError = signal(false);
  filtroSidebar = signal('');
  busqueda = signal('');

  catalogosFiltrados = computed(() => {
    const q = this.filtroSidebar().trim().toLowerCase();
    const list = this.catalogos();
    if (!q) return list;
    return list.filter(
      (c) =>
        String(c.label || '').toLowerCase().includes(q) ||
        String(c.nombre || '').toLowerCase().includes(q),
    );
  });
  pagina = signal(0);
  readonly pageSize = 20;

  mostrarForm = signal(false);
  editandoId = signal<string | null>(null);
  formDoc = signal<Record<string, string>>({});
  clasesVehiculo = signal<ClaseRow[]>([]);
  formIdClases = signal<string[]>([]);
  formTiposVehiculo = signal<string[]>([]);
  filtroTiposVehiculo = signal('');
  itemsInspeccionOpciones = signal<ItemInspeccionOpcion[]>([]);
  cargandoItemsInspeccion = signal(false);
  formControlaVencimiento = signal(true);
  formLicenciaCats = signal<Record<string, boolean>>({});
  sedesCatalogo = signal<SedeDto[]>([]);

  importJson = signal('');
  mostrarImport = signal(false);
  vista = signal<VistaLista>(readVistaLista('argo-catalogos-vista'));

  clasesVehiculoFiltradas = computed(() => {
    const q = this.filtroTiposVehiculo().trim().toLowerCase();
    const rows = this.clasesVehiculo();
    if (!q) return rows;
    return rows.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.idClase.toLowerCase().includes(q) ||
        this.normTipoVehiculo(c.label).toLowerCase().includes(q),
    );
  });

  resumenTiposVehiculoInspeccion = computed(() => {
    const n = this.formTiposVehiculo().length;
    if (!n) {
      return { todos: true, count: 0, labels: [] as string[] };
    }
    const map = new Map(
      this.clasesVehiculo().map((c) => [this.normTipoVehiculo(c.label), c.label]),
    );
    const labels = this.formTiposVehiculo().map((t) => map.get(t) || t);
    return { todos: false, count: n, labels };
  });

  resumenClasesLegacyInspeccion = computed(() => {
    const n = this.formIdClases().length;
    if (!n) {
      return { todos: true, count: 0, labels: [] as string[] };
    }
    const map = new Map(this.clasesVehiculo().map((c) => [c.idClase, c.label]));
    const labels = this.formIdClases().map((id) => map.get(id) || id);
    return { todos: false, count: n, labels };
  });

  opcionesItemInspeccionForm = computed<EnumBuscarOption[]>(() =>
    this.itemsInspeccionOpciones().map((r) => ({
      value: r.idItem,
      label: r.label,
      hint: r.tipos,
    })),
  );

  textoItemInspeccionForm = computed(() => {
    const id = String(this.formDoc()['idItem'] ?? '').trim();
    if (!id) return '';
    const hit = this.itemsInspeccionOpciones().find((r) => r.idItem === id);
    return hit?.label || `#${id}`;
  });

  opcionesCaractSeccionForm = computed<EnumBuscarOption[]>(() =>
    SECCIONES_CARACT_INSPECCION.map((s) => ({
      value: s.value,
      label: s.label,
    })),
  );

  textoCaractSeccionForm = computed(() => {
    const v = String(this.formDoc()['caracteristica'] ?? '').trim();
    if (!v) return '';
    return labelSeccionCaractInspeccion(v);
  });

  itemInspeccionFormSeleccionado = computed(() => {
    const id = String(this.formDoc()['idItem'] ?? '').trim();
    if (!id) return null;
    return this.itemsInspeccionOpciones().find((r) => r.idItem === id) || null;
  });

  ngOnInit(): void {
    this.sedeSvc.listar().subscribe({
      next: (rows) => this.sedesCatalogo.set((rows || []).filter((s) => s.activa !== false)),
      error: () => this.sedesCatalogo.set([]),
    });
    this.vehSvc.listarClases().subscribe({
      next: (rows) => {
        const caps = (rows || [])
          .map((r: ClaseVehiculo) => ({
            idClase: String(r.idClase ?? '').trim(),
            label: String(r.descripcion || r.idClase || '').trim(),
          }))
          .filter((c) => c.idClase);
        this.clasesVehiculo.set(caps);
      },
    });

    this.svc.meta().subscribe({
      next: (r) => {
        const list = r.catalogos || [];
        this.catalogos.set(list);
        const pref = String(this.route.snapshot.queryParamMap.get('cat') || '').trim();
        const hit = pref ? list.find((c) => c.nombre === pref) : null;
        if (hit) {
          this.seleccionar(hit.nombre);
        } else if (list.length) {
          this.seleccionar(list[0].nombre);
        }
      },
      error: (e) => {
        this.msgError.set(true);
        this.msg.set(e?.error?.message || 'Error cargando catálogos');
      },
    });
  }

  seleccionar(nombre: string) {
    this.seleccionado.set(nombre);
    this.pagina.set(0);
    this.mostrarForm.set(false);
    this.mostrarImport.set(false);
    this.msg.set(null);
    this.msgError.set(false);
    if (nombre === 'caractInspeccion') {
      this.cargarItemsInspeccionOpciones();
    }
    this.cargar();
  }

  cargarItemsInspeccionOpciones() {
    this.cargandoItemsInspeccion.set(true);
    this.svc.listar('itemsInspeccion', { limit: 500 }).subscribe({
      next: (res) => {
        const rows = (res.rows || [])
          .map((r) => {
            const idItem = String(r['idItem'] ?? '').trim();
            const item = String(r['item'] ?? '').trim();
            if (!idItem) return null;
            const tipos = this.formatTiposVehiculo(r['tiposVehiculo'] ?? r['claseVehiculo']);
            return {
              idItem,
              item,
              tipos,
              label: `#${idItem} · ${item}`,
            } satisfies ItemInspeccionOpcion;
          })
          .filter((r): r is ItemInspeccionOpcion => !!r)
          .sort((a, b) => Number(a.idItem) - Number(b.idItem));
        this.itemsInspeccionOpciones.set(rows);
        this.cargandoItemsInspeccion.set(false);
      },
      error: () => {
        this.cargandoItemsInspeccion.set(false);
        this.itemsInspeccionOpciones.set([]);
      },
    });
  }

  etiquetaItemInspeccion(idItem: unknown): string {
    const id = String(idItem ?? '').trim();
    if (!id) return '—';
    const hit = this.itemsInspeccionOpciones().find((r) => r.idItem === id);
    if (hit) return hit.label;
    return `#${id}`;
  }

  tiposVehiculoPorItemId(idItem: unknown): string {
    const id = String(idItem ?? '').trim();
    if (!id) return '—';
    const hit = this.itemsInspeccionOpciones().find((r) => r.idItem === id);
    if (!hit) return '—';
    return hit.tipos || 'Todos los tipos';
  }

  cargar() {
    const nombre = this.seleccionado();
    if (!nombre) return;
    this.loading.set(true);
    this.svc
      .listar(nombre, {
        q: this.busqueda().trim().length >= 2 ? this.busqueda().trim() : undefined,
        skip: this.pagina() * this.pageSize,
        limit: this.pageSize,
      })
      .subscribe({
        next: (r) => {
          this.listado.set(r);
          this.loading.set(false);
        },
        error: (e) => {
          this.loading.set(false);
          this.msgError.set(true);
          this.msg.set(e?.error?.message || 'Error cargando datos');
        },
      });
  }

  setVista(v: VistaLista) {
    this.vista.set(v);
    saveVistaLista('argo-catalogos-vista', v);
  }

  cardTitulo(row: Record<string, unknown>): string {
    const campos = this.camposTabla();
    if (!campos.length) return 'Registro';
    return this.valorCelda(row, campos[0]) || 'Registro';
  }

  labelActual(): string {
    const n = this.seleccionado();
    return this.catalogos().find((c) => c.nombre === n)?.label || n || '';
  }

  labelColumna(campo: string): string {
    if (this.esCatalogoAula()) {
      const map: Record<string, string> = {
        idAula: 'Código',
        nombre: 'Nombre del aula',
        estado: 'Estado',
        idSede: 'Sede',
      };
      if (map[campo]) return map[campo];
    }
    if (this.esCatalogoTaller()) {
      const map: Record<string, string> = {
        idTaller: 'Código',
        nombre: 'Nombre',
        ubicacion: 'Ubicación',
        activo: 'Activo',
        idSede: 'Sede',
      };
      if (map[campo]) return map[campo];
    }
    if (this.esCatalogoTipServicio() || this.esCatalogoInspeccion() || this.esCatalogoDocumento()) {
      return this.labelCampo(campo);
    }
    return campo;
  }

  camposTabla(): string[] {
    const L = this.listado();
    if (!L?.campos?.length) return [];
    let campos = L.campos.filter((c) => c !== '_id');
    if (this.esCatalogoInspeccion()) {
      if (this.esCatalogoItemsInspeccion()) {
        campos = campos.filter((c) => c !== 'idClases' && c !== 'tiposVehiculo' && c !== 'claseVehiculo');
      } else if (this.esCatalogoCaractInspeccion()) {
        campos = campos.filter((c) => c !== 'idClases' && c !== 'claseVehiculo' && c !== 'tiposVehiculo');
      } else {
        campos = campos.filter((c) => c !== 'claseVehiculo' && c !== 'tiposVehiculo' && c !== 'idClases');
      }
    }
    if (this.esCatalogoDocumento()) {
      campos = campos.filter((c) => c !== 'controlaVencimiento');
    }
    if (this.esCatalogoClaseVehiculo()) {
      campos = campos.filter((c) => !CATEGORIAS_LICENCIA_VEHICULO.includes(c as typeof CATEGORIAS_LICENCIA_VEHICULO[number]));
    }
    return campos.slice(0, 8);
  }

  columnasInspeccion(): string[] {
    if (this.esCatalogoItemsInspeccion()) {
      const cols = this.camposTabla();
      const idx = cols.indexOf('item');
      if (idx >= 0) {
        const out = [...cols];
        out.splice(idx + 1, 0, 'tiposVehiculo');
        return out;
      }
      return [...cols, 'tiposVehiculo'];
    }
    if (this.esCatalogoCaractInspeccion()) {
      const cols = this.camposTabla();
      const idx = cols.indexOf('idItem');
      if (idx >= 0) {
        const out = [...cols];
        out.splice(idx + 1, 0, 'tiposVehiculoItem');
        return out;
      }
      return ['tiposVehiculoItem', ...cols];
    }
    return ['idClases', ...this.camposTabla()];
  }

  columnasDocumento(): string[] {
    return ['controlaVencimiento', ...this.camposTabla()];
  }

  columnasListado(): string[] {
    if (this.esCatalogoInspeccion()) return this.columnasInspeccion();
    if (this.esCatalogoDocumento()) return this.columnasDocumento();
    if (this.esCatalogoClaseVehiculo()) return [...this.camposTabla(), 'licenciasCap'];
    return this.camposTabla();
  }

  columnasCards(): string[] {
    if (this.esCatalogoItemsInspeccion()) return this.columnasListado();
    return this.camposTabla();
  }

  valorCelda(row: Record<string, unknown>, campo: string): string {
    if (campo === 'idClases') return this.formatIdClases(row[campo]);
    if (campo === 'idItem' && this.esCatalogoCaractInspeccion()) {
      return this.etiquetaItemInspeccion(row[campo]);
    }
    if (campo === 'caracteristica' && this.esCatalogoCaractInspeccion()) {
      return String(row[campo] ?? '').trim() || '—';
    }
    if (campo === 'tiposVehiculoItem' && this.esCatalogoCaractInspeccion()) {
      return this.tiposVehiculoPorItemId(row['idItem']);
    }
    if (campo === 'claseVehiculo') {
      const v = String(row[campo] ?? '').trim();
      return v || 'Todos los tipos';
    }
    if (campo === 'tiposVehiculo') return this.formatTiposVehiculo(row[campo] ?? row['claseVehiculo']);
    if (campo === 'controlaVencimiento') return this.formatControlaVencimiento(row[campo]);
    if (campo === 'licenciasCap') return labelCategoriasLicencia(row);
    return formatNumericCell(campo, row[campo]);
  }

  formatControlaVencimiento(v: unknown): string {
    if (v === false || v === 0 || v === '0' || v === 'false' || v === 'no') return 'No vence';
    return 'Con vencimiento';
  }

  esCatalogoInspeccion(): boolean {
    const n = this.seleccionado();
    if (!n) return false;
    const meta = this.catalogos().find((c) => c.nombre === n);
    if (meta?.esInspeccionChecklist != null) return meta.esInspeccionChecklist;
    return ['itemsInspeccion', 'caractInspeccion', 'itemsEstGral', 'aspecto1', 'aspecto2', 'adaptaciones'].includes(n);
  }

  esCatalogoItemsInspeccion(): boolean {
    return this.seleccionado() === 'itemsInspeccion';
  }

  esCatalogoCaractInspeccion(): boolean {
    return this.seleccionado() === 'caractInspeccion';
  }

  esCatalogoInspeccionLegacy(): boolean {
    return ['itemsEstGral', 'aspecto1', 'aspecto2', 'adaptaciones'].includes(this.seleccionado() || '');
  }

  esCatalogoDocumento(): boolean {
    const n = this.seleccionado();
    if (!n) return false;
    const meta = this.catalogos().find((c) => c.nombre === n);
    if (meta?.esCatalogoDocumento != null) return meta.esCatalogoDocumento;
    return n === 'itemDocumentosVehiculo' || n === 'itemDocumentosInstructores';
  }

  esCatalogoClaseVehiculo(): boolean {
    return this.seleccionado() === 'claseVehiculo';
  }

  esCatalogoTipServicio(): boolean {
    return this.seleccionado() === 'catTipServicio';
  }

  clasesServicioOpciones = CLASES_SERVICIO;

  categoriasLicenciaLista = CATEGORIAS_LICENCIA_VEHICULO;

  private parseIdClasesValor(v: unknown): string[] {
    if (v == null || v === '') return [];
    if (Array.isArray(v)) return [...new Set(v.map((c) => String(c).trim()).filter(Boolean))];
    if (typeof v === 'string') {
      const t = v.trim();
      if (!t) return [];
      if (t.startsWith('[')) {
        try {
          const parsed = JSON.parse(t);
          if (Array.isArray(parsed)) return this.parseIdClasesValor(parsed);
        } catch {
          /* ignore */
        }
      }
      return [t];
    }
    return [String(v).trim()].filter(Boolean);
  }

  formatIdClases(v: unknown): string {
    const ids = this.parseIdClasesValor(v);
    if (!ids.length) return 'Todas las clases';
    const map = new Map(this.clasesVehiculo().map((c) => [c.idClase, c.label]));
    return ids.map((id) => map.get(id) || id).join(', ');
  }

  private normTipoVehiculo(label: string): string {
    return String(label || '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, ' ');
  }

  formatTiposVehiculo(v: unknown): string {
    const tipos = this.parseTiposVehiculoValor(v);
    if (!tipos.length) return 'Todos los tipos';
    const map = new Map(
      this.clasesVehiculo().map((c) => [this.normTipoVehiculo(c.label), c.label]),
    );
    return tipos.map((t) => map.get(t) || t).join(', ');
  }

  private parseTiposVehiculoValor(v: unknown): string[] {
    if (v == null || v === '') return [];
    if (Array.isArray(v)) {
      return [...new Set(v.map((t) => this.normTipoVehiculo(String(t))).filter(Boolean))];
    }
    const t = String(v).trim();
    if (!t) return [];
    return [this.normTipoVehiculo(t)];
  }

  tipoVehiculoMarcado(label: string): boolean {
    const key = this.normTipoVehiculo(label);
    return this.formTiposVehiculo().includes(key);
  }

  toggleTipoVehiculo(label: string, checked: boolean) {
    const key = this.normTipoVehiculo(label);
    this.formTiposVehiculo.update((list) => {
      const set = new Set(list);
      if (checked) set.add(key);
      else set.delete(key);
      return [...set];
    });
  }

  limpiarTiposVehiculo() {
    this.formTiposVehiculo.set([]);
  }

  marcarTiposVehiculoFiltrados() {
    const keys = this.clasesVehiculoFiltradas().map((c) => this.normTipoVehiculo(c.label));
    this.formTiposVehiculo.update((list) => [...new Set([...list, ...keys])]);
  }

  marcarClasesLegacyFiltradas() {
    const ids = this.clasesVehiculoFiltradas().map((c) => c.idClase);
    this.formIdClases.update((list) => [...new Set([...list, ...ids])]);
  }

  toggleTipoVehiculoChip(label: string) {
    const key = this.normTipoVehiculo(label);
    this.formTiposVehiculo.update((list) => {
      const set = new Set(list);
      if (set.has(key)) set.delete(key);
      else set.add(key);
      return [...set];
    });
  }

  toggleClaseLegacyChip(idClase: string) {
    this.formIdClases.update((list) => {
      const set = new Set(list);
      if (set.has(idClase)) set.delete(idClase);
      else set.add(idClase);
      return [...set];
    });
  }

  private resetFiltroTiposVehiculo() {
    this.filtroTiposVehiculo.set('');
  }

  onItemInspeccionPick(opt: EnumBuscarOption): void {
    this.patchCampo('idItem', String(opt.value));
  }

  onItemInspeccionLimpiar(): void {
    this.patchCampo('idItem', '');
  }

  onCaractSeccionPick(opt: EnumBuscarOption): void {
    this.patchCampo('caracteristica', String(opt.value));
  }

  onCaractSeccionLimpiar(): void {
    this.patchCampo('caracteristica', '');
  }

  esCampoSelectCaract(campo: string): boolean {
    return this.esCatalogoCaractInspeccion() && campo === 'idItem';
  }

  esCampoSelectClaseServ(campo: string): boolean {
    return this.esCatalogoTipServicio() && campo === 'claseServ';
  }

  esCampoSelectSede(campo: string): boolean {
    return (this.esCatalogoAula() || this.esCatalogoTaller()) && campo === 'idSede';
  }

  esCatalogoAula(): boolean {
    return this.seleccionado() === 'aulas';
  }

  esCatalogoTaller(): boolean {
    return this.seleccionado() === 'talleres';
  }

  private syncFormTiposVehiculo(row?: Record<string, unknown>) {
    if (!this.esCatalogoItemsInspeccion()) {
      this.formTiposVehiculo.set([]);
      return;
    }
    if (!row) {
      this.formTiposVehiculo.set([]);
      return;
    }
    const tipos = this.parseTiposVehiculoValor(row['tiposVehiculo'] ?? row['claseVehiculo']);
    this.formTiposVehiculo.set(tipos);
  }

  claseMarcada(idClase: string): boolean {
    return this.formIdClases().includes(idClase);
  }

  toggleClaseItem(idClase: string, checked: boolean) {
    this.formIdClases.update((list) => {
      const set = new Set(list);
      if (checked) set.add(idClase);
      else set.delete(idClase);
      return [...set];
    });
  }

  limpiarClasesItem() {
    this.formIdClases.set([]);
  }

  private syncFormIdClases(row?: Record<string, unknown>) {
    if (!this.esCatalogoInspeccionLegacy()) {
      this.formIdClases.set([]);
      return;
    }
    if (!row) {
      this.formIdClases.set([]);
      return;
    }
    const ids = this.parseIdClasesValor(row['idClases']);
    this.formIdClases.set(ids);
  }

  private syncFormControlaVencimiento(row?: Record<string, unknown>) {
    if (!this.esCatalogoDocumento()) {
      this.formControlaVencimiento.set(true);
      return;
    }
    if (!row) {
      this.formControlaVencimiento.set(true);
      return;
    }
    const v = row['controlaVencimiento'];
    this.formControlaVencimiento.set(
      !(v === false || v === 0 || v === '0' || v === 'false' || v === 'no'),
    );
  }

  campoEsTextoLargo(campo: string): boolean {
    return ['item', 'aspecto1', 'aspecto2', 'nombre', 'caracteristica'].includes(campo);
  }

  labelCampo(campo: string): string {
    const map: Record<string, string> = {
      idItem: 'Ítem de inspección',
      idCaracteristica: 'ID característica',
      idItemEsGral: 'ID ítem',
      item: 'Descripción del ítem',
      caracteristica: 'Característica a revisar',
      tiposVehiculo: 'Tipos de vehículo',
      tiposVehiculoItem: 'Tipos de vehículo',
      claseVehiculo: 'Tipo de vehículo',
      idAspecto1: 'ID',
      aspecto1: 'Texto del ítem',
      idAspecto2: 'ID',
      aspecto2: 'Texto del ítem',
      idAdaptacion: 'ID',
      nombre: 'Descripción',
      idClases: 'Clases de vehículo',
      controlaVencimiento: 'Vencimiento',
      licenciasCap: 'Licencias capacitación',
      tipoServ: 'Código (tipoServ)',
      descTipoServ: 'Descripción',
      idTipoServ: 'ID',
      claseServ: 'Clase de servicio',
    };
    return map[campo] || campo;
  }

  inputTypeCampo(campo: string): string {
    return inputTypeForField(campo);
  }

  esCampoMoneda(campo: string): boolean {
    return isMoneyField(campo);
  }

  campoEsNumerico(campo: string): boolean {
    return isNumericField(campo);
  }

  idMongo(row: Record<string, unknown>): string {
    return String(row['_id'] ?? '');
  }

  private camposFormBase(): string[] {
    const skip = new Set(['_id', '__v', 'idClases', 'controlaVencimiento', 'tiposVehiculo', 'claseVehiculo']);
    const fromList = this.listado()?.campos?.filter((c) => !skip.has(c)) || [];
    const campos = fromList.length ? fromList : this.camposFallbackCatalogo();
    return campos.filter((c) => c !== '_id');
  }

  private camposFallbackCatalogo(): string[] {
    const n = this.seleccionado();
    const map: Record<string, string[]> = {
      aulas: ['idAula', 'nombre', 'estado', 'idSede'],
      talleres: ['idTaller', 'nombre', 'ubicacion', 'activo', 'idSede'],
    };
    return map[n || ''] || [];
  }

  private idSedeDefaultForm(): string {
    const activa = this.sedeSvc.idSede();
    if (activa) return activa;
    const principal = this.sedesCatalogo().find((s) => s.esPrincipal);
    return principal?.idSede || this.sedesCatalogo()[0]?.idSede || '';
  }

  nuevo() {
    const campos = this.camposFormBase();
    const doc: Record<string, string> = {};
    for (const c of campos) doc[c] = '';
    if (this.esCatalogoAula() || this.esCatalogoTaller()) {
      doc['idSede'] = this.idSedeDefaultForm();
    }
    if (this.esCatalogoTipServicio()) doc['claseServ'] = CLASE_SERV_DEFAULT;
    this.editandoId.set(null);
    this.formDoc.set(doc);
    this.syncFormIdClases();
    this.syncFormTiposVehiculo();
    this.syncFormControlaVencimiento();
    this.syncFormLicenciaCats();
    this.resetFiltroTiposVehiculo();
    if (this.esCatalogoCaractInspeccion()) {
      this.cargarItemsInspeccionOpciones();
    }
    this.mostrarForm.set(true);
    this.msg.set(null);
    this.msgError.set(false);
  }

  editar(row: Record<string, unknown>) {
    const id = this.idMongo(row);
    const campos = this.camposFormBase();
    const doc: Record<string, string> = {};
    for (const c of campos) {
      if (c === 'idClases' || c === 'controlaVencimiento') continue;
      if (CATEGORIAS_LICENCIA_VEHICULO.includes(c as typeof CATEGORIAS_LICENCIA_VEHICULO[number])) continue;
      const v = row[c];
      if (this.esCatalogoCaractInspeccion() && c === 'idItem' && v != null && v !== '') {
        doc[c] = String(v);
        continue;
      }
      doc[c] = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
    }
    if (this.esCatalogoTipServicio() && !doc['claseServ']?.trim()) {
      doc['claseServ'] = CLASE_SERV_DEFAULT;
    }
    this.editandoId.set(id);
    this.formDoc.set(doc);
    this.syncFormIdClases(row);
    this.syncFormTiposVehiculo(row);
    this.syncFormControlaVencimiento(row);
    this.syncFormLicenciaCats(row);
    this.resetFiltroTiposVehiculo();
    if (this.esCatalogoCaractInspeccion()) {
      this.cargarItemsInspeccionOpciones();
    }
    this.mostrarForm.set(true);
  }

  syncFormLicenciaCats(row?: Record<string, unknown>) {
    const out: Record<string, boolean> = {};
    for (const c of CATEGORIAS_LICENCIA_VEHICULO) {
      const v = row?.[c];
      out[c] = v === true || v === 1 || v === '1' || v === 'true';
    }
    this.formLicenciaCats.set(out);
  }

  toggleLicenciaCat(cat: string, checked: boolean) {
    this.formLicenciaCats.update((m) => ({ ...m, [cat]: checked }));
  }

  licenciaCatMarcada(cat: string): boolean {
    return !!this.formLicenciaCats()[cat];
  }

  patchCampo(campo: string, valor: string) {
    this.formDoc.update((d) => ({ ...d, [campo]: valor }));
  }

  cancelar() {
    this.mostrarForm.set(false);
    this.editandoId.set(null);
    this.resetFiltroTiposVehiculo();
  }

  private parseDoc(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(this.formDoc())) {
      if (k === '_id' || k === '__v' || k === 'idClases' || k === 'controlaVencimiento' || k === 'tiposVehiculo' || k === 'claseVehiculo') continue;
      const t = v.trim();
      if (t === '') {
        out[k] = null;
        continue;
      }
      if (inputTypeForField(k) === 'number') {
        out[k] = coerceNumberInput(t);
        continue;
      }
      if (t === 'true' || t === 'false') {
        out[k] = t === 'true';
      } else if ((t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'))) {
        try {
          out[k] = JSON.parse(t);
        } catch {
          out[k] = t;
        }
      } else {
        out[k] = t;
      }
    }
    if (this.esCatalogoInspeccionLegacy()) {
      out['idClases'] = [...this.formIdClases()];
    }
    if (this.esCatalogoItemsInspeccion()) {
      out['tiposVehiculo'] = [...this.formTiposVehiculo()];
    }
    if (this.esCatalogoDocumento()) {
      out['controlaVencimiento'] = this.formControlaVencimiento();
    }
    if (this.esCatalogoClaseVehiculo()) {
      for (const c of CATEGORIAS_LICENCIA_VEHICULO) {
        out[c] = !!this.formLicenciaCats()[c];
      }
    }
    return out;
  }

  guardar() {
    const nombre = this.seleccionado();
    if (!nombre) return;
    if (this.esCatalogoAula() && !String(this.formDoc()['nombre'] ?? '').trim()) {
      this.msgError.set(true);
      this.msg.set('Indique el nombre del aula.');
      return;
    }
    if ((this.esCatalogoAula() || this.esCatalogoTaller()) && !String(this.formDoc()['idSede'] ?? '').trim()) {
      this.msgError.set(true);
      this.msg.set('Seleccione la sede del registro.');
      return;
    }
    const doc = this.parseDoc();
    const id = this.editandoId();
    this.saving.set(true);
    this.msg.set(null);
    this.msgError.set(false);
    const req = id ? this.svc.actualizar(nombre, id, doc) : this.svc.crear(nombre, doc);
    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.mostrarForm.set(false);
        this.catCache.invalidate(nombre);
        this.msgError.set(false);
        this.msg.set(id ? 'Registro actualizado.' : 'Registro creado.');
        this.cargar();
      },
      error: (e) => {
        this.saving.set(false);
        this.msgError.set(true);
        this.msg.set(e?.error?.message || 'Error al guardar');
      },
    });
  }

  async eliminar(row: Record<string, unknown>) {
    const nombre = this.seleccionado();
    const id = this.idMongo(row);
    if (!nombre || !id) return;
    const ok = await this.confirm.open({
      title: 'Eliminar registro',
      message: '¿Eliminar este registro del catálogo? Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar',
      variant: 'danger',
    });
    if (!ok) return;
    this.svc.eliminar(nombre, id).subscribe({
      next: () => {
        this.catCache.invalidate(nombre);
        this.msgError.set(false);
        this.msg.set('Registro eliminado.');
        this.cargar();
      },
      error: (e) => {
        this.msgError.set(true);
        this.msg.set(e?.error?.message || 'Error al eliminar');
      },
    });
  }

  toggleImport() {
    this.mostrarImport.update((v) => !v);
    this.importJson.set('');
  }

  onFileImport(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      this.importJson.set(String(reader.result || ''));
      input.value = '';
    };
    reader.readAsText(file);
  }

  ejecutarImport(modo: 'reemplazar' | 'agregar') {
    const nombre = this.seleccionado();
    if (!nombre) return;
    let rows: Record<string, unknown>[];
    try {
      const parsed = JSON.parse(this.importJson());
      rows = Array.isArray(parsed) ? parsed : parsed?.rows;
      if (!Array.isArray(rows)) throw new Error('Formato inválido');
    } catch {
      this.msgError.set(true);
      this.msg.set('JSON inválido. Use un arreglo de objetos o { "rows": [...] }.');
      return;
    }
    this.saving.set(true);
    this.svc.importar(nombre, rows, modo).subscribe({
      next: (r) => {
        this.saving.set(false);
        this.mostrarImport.set(false);
        this.catCache.invalidate(nombre);
        this.msgError.set(false);
        this.msg.set(r.message || `Importados ${r.insertados} registros.`);
        this.cargar();
      },
      error: (e) => {
        this.saving.set(false);
        this.msgError.set(true);
        this.msg.set(e?.error?.message || 'Error al importar');
      },
    });
  }

  async recargarExcel() {
    const nombre = this.seleccionado();
    const ok = await this.confirm.open({
      title: 'Recargar desde Excel',
      message: nombre
        ? `¿Reemplazar todos los datos de «${this.labelActual()}» desde excel/catalogos.xlsx?`
        : '¿Recargar TODOS los catálogos desde excel/catalogos.xlsx? Se sobrescriben las colecciones.',
      confirmLabel: 'Recargar',
      variant: 'danger',
    });
    if (!ok) return;
    this.saving.set(true);
    this.svc.recargarExcel(nombre || undefined).subscribe({
      next: (r) => {
        this.saving.set(false);
        this.catCache.invalidate();
        this.msgError.set(false);
        this.msg.set(r.message || 'Recarga desde Excel completada.');
        this.cargar();
      },
      error: (e) => {
        this.saving.set(false);
        this.msgError.set(true);
        this.msg.set(e?.error?.message || 'Error al recargar Excel');
      },
    });
  }

  paginaAnterior() {
    if (this.pagina() <= 0) return;
    this.pagina.update((p) => p - 1);
    this.cargar();
  }

  paginaSiguiente() {
    const L = this.listado();
    if (!L) return;
    if ((this.pagina() + 1) * this.pageSize >= L.total) return;
    this.pagina.update((p) => p + 1);
    this.cargar();
  }

  camposForm(): string[] {
    const L = this.listado();
    const keys = new Set(Object.keys(this.formDoc()));
    const omit = new Set([
      '__v',
      'idClases',
      'controlaVencimiento',
      'claseVehiculo',
      ...CATEGORIAS_LICENCIA_VEHICULO,
    ]);
    const fromList = L?.campos?.length
      ? L.campos.filter((c) => !omit.has(c) && keys.has(c))
      : [];
    if (fromList.length) return fromList;
    const fallback = this.camposFallbackCatalogo().filter((c) => keys.has(c));
    if (fallback.length) return fallback;
    return [...keys].filter((k) => k !== '_id' && !omit.has(k));
  }

  usarCapsula(campo: string): boolean {
    if (campo === 'idClases' || campo === 'controlaVencimiento' || campo === 'licenciasCap') return false;
    if (this.esCatalogoCaractInspeccion() && (campo === 'idItem' || campo === 'caracteristica' || campo === 'tiposVehiculoItem')) return false;
    return /estado|tipo|id/i.test(campo);
  }

  totalPaginas(): number {
    const L = this.listado();
    if (!L) return 0;
    return Math.max(1, Math.ceil(L.total / this.pageSize));
  }

  rangoRegistros(): { desde: number; hasta: number; total: number } {
    const L = this.listado();
    const total = L?.total ?? 0;
    if (!total) return { desde: 0, hasta: 0, total: 0 };
    const desde = this.pagina() * this.pageSize + 1;
    const hasta = Math.min((this.pagina() + 1) * this.pageSize, total);
    return { desde, hasta, total };
  }

  puedePaginaAnterior(): boolean {
    return this.pagina() > 0;
  }

  puedePaginaSiguiente(): boolean {
    const L = this.listado();
    if (!L) return false;
    return (this.pagina() + 1) * this.pageSize < L.total;
  }

  capParaCampo(campo: string, valor: string): string {
    const c = campo.toLowerCase();
    if (c.includes('estado') || c === 'activo') return capEstado(valor);
    if (c.includes('tiposerv') || c === 'tiposerv') return capTipoServ(valor);
    if (c.startsWith('id')) return capId(valor);
    return 'cap cap-slate cap-sm';
  }
}
