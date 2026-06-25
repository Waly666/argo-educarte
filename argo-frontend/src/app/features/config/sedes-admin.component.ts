import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { CatalogoService, MunicipioDivipola } from '../../core/services/catalogo.service';
import { JornadaCapService } from '../../core/services/jornada-cap.service';
import { Programa, ProgramaService } from '../../core/services/programa.service';
import { SedeCatalogoMode, SedeDto, SedeService } from '../../core/services/sede.service';
import { ServicioCatalogo, ServicioCatalogoService } from '../../core/services/servicio-catalogo.service';
import { MunicipioBuscarComponent } from '../alumnos/municipio-buscar.component';
import {
  CoordsGeorefEvent,
  DeteGeorefe,
  etiquetaDeteGeorefe,
} from '../jornadas/jornada-georefe.util';
import { JornadaMapaPickerComponent } from '../jornadas/jornada-mapa-picker.component';

type SedeTab = 'general' | 'ubicacion' | 'catalogo';

interface TipoCapRow {
  id: string;
  label: string;
}

interface TipoServRow {
  codigo: string;
  label: string;
}

interface ModoOption {
  id: SedeCatalogoMode;
  titulo: string;
  desc: string;
}

interface SedeForm {
  idSede: string;
  nombre: string;
  codigo: string;
  direccion: string;
  ciudad: string;
  departamento: string;
  codMunicipio: string;
  lat: string;
  lng: string;
  deteGeorefe: DeteGeorefe;
  telefono: string;
  activa: boolean;
  esPrincipal: boolean;
  programasMode: SedeCatalogoMode;
  programasTiposPermitidos: string[];
  programasIdsPermitidos: number[];
  serviciosMode: SedeCatalogoMode;
  serviciosTiposPermitidos: string[];
  serviciosIdsPermitidos: number[];
}

@Component({
  selector: 'argo-sedes-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, MunicipioBuscarComponent, JornadaMapaPickerComponent],
  templateUrl: './sedes-admin.component.html',
  styleUrls: ['./sedes-admin.component.scss'],
})
export class SedesAdminComponent implements OnInit {
  private svc = inject(SedeService);
  private catSvc = inject(CatalogoService);
  private progSvc = inject(ProgramaService);
  private servSvc = inject(ServicioCatalogoService);
  private jornadaSvc = inject(JornadaCapService);

  readonly modosCatalogo: ModoOption[] = [
    { id: 'todos', titulo: 'Todo el catálogo', desc: 'Sin restricciones para esta sede' },
    { id: 'tipos', titulo: 'Por tipo', desc: 'Solo categorías seleccionadas (CUR, DIP, etc.)' },
    { id: 'especificos', titulo: 'Lista específica', desc: 'Elegir ítems uno a uno' },
  ];

  sedes = signal<SedeDto[]>([]);
  tiposCap = signal<TipoCapRow[]>([]);
  tiposServ = signal<TipoServRow[]>([]);
  programas = signal<Programa[]>([]);
  servicios = signal<ServicioCatalogo[]>([]);
  loading = signal(false);
  saving = signal(false);
  msg = signal<string | null>(null);
  editando = signal<SedeDto | null>(null);
  mostrarNuevo = signal(false);
  tabActiva = signal<SedeTab>('general');
  geoResolviendo = signal(false);
  buscarProgramas = signal('');
  buscarServicios = signal('');
  syncAviso = signal<string | null>(null);

  form = signal<SedeForm>(this.formVacio());
  etiquetaDeteGeorefe = etiquetaDeteGeorefe;

  editorVisible = computed(() => this.mostrarNuevo() || !!this.editando());

  programasFiltrados = computed(() => {
    const q = this.buscarProgramas().trim().toLowerCase();
    const list = this.programas();
    if (!q) return list;
    return list.filter(
      (p) =>
        String(p.nombreProg || '').toLowerCase().includes(q) ||
        String(p.codigoProg || '').toLowerCase().includes(q) ||
        String(p.idPrograma || '').includes(q),
    );
  });

  serviciosFiltrados = computed(() => {
    const q = this.buscarServicios().trim().toLowerCase();
    const list = this.servicios();
    if (!q) return list;
    return list.filter(
      (s) =>
        String(s.descrServicio || '').toLowerCase().includes(q) ||
        String(s.tipoServ || '').toLowerCase().includes(q) ||
        String(s.idServ || '').includes(q),
    );
  });

  serviciosVinculadosProgramas = computed(() => {
    const f = this.form();
    if (f.programasMode !== 'especificos' || !f.programasIdsPermitidos.length) return [];
    const ids = new Set(f.programasIdsPermitidos);
    return this.servicios().filter((s) => {
      const idProg = s.idProg != null && s.idProg !== '' ? +s.idProg : null;
      return idProg != null && ids.has(idProg);
    });
  });

  ngOnInit(): void {
    this.cargar();
    this.catSvc.list<any>('catTipoCapacitacion').subscribe({
      next: (rows) => {
        this.tiposCap.set(
          (rows || [])
            .map((r) => ({
              id: String(r.idTipCap ?? r.id ?? '').trim(),
              label: String(r.tipoCap || r.descripcion || r.idTipCap || '').trim(),
            }))
            .filter((t) => t.id && t.label),
        );
      },
    });
    this.catSvc.list<any>('catTipServicio').subscribe({
      next: (rows) => {
        this.tiposServ.set(
          (rows || [])
            .map((r) => ({
              codigo: String(r.tipoServ || '').trim().toUpperCase(),
              label: String(r.descTipoServ || r.tipoServ || '').trim(),
            }))
            .filter((t) => t.codigo),
        );
      },
    });
    this.progSvc.listar({ catalogo: true }).subscribe({ next: (r) => this.programas.set(r || []) });
    this.servSvc.listar({ catalogo: true }).subscribe({ next: (r) => this.servicios.set(r || []) });
  }

  private formVacio(): SedeForm {
    return {
      idSede: '',
      nombre: '',
      codigo: '',
      direccion: '',
      ciudad: '',
      departamento: '',
      codMunicipio: '',
      lat: '',
      lng: '',
      deteGeorefe: '',
      telefono: '',
      activa: true,
      esPrincipal: false,
      programasMode: 'todos',
      programasTiposPermitidos: [],
      programasIdsPermitidos: [],
      serviciosMode: 'todos',
      serviciosTiposPermitidos: [],
      serviciosIdsPermitidos: [],
    };
  }

  cargar(seleccionarId?: string): void {
    this.loading.set(true);
    this.svc.listar().subscribe({
      next: (r) => {
        const lista = r || [];
        this.sedes.set(lista);
        this.loading.set(false);
        if (seleccionarId) {
          const s = lista.find((x) => x.idSede === seleccionarId);
          if (s) this.abrirEditor(s, false);
        }
      },
      error: (e) => {
        this.loading.set(false);
        this.msg.set(e?.error?.message || 'Error cargando sedes');
      },
    });
  }

  nuevo(): void {
    this.editando.set(null);
    this.mostrarNuevo.set(true);
    this.form.set(this.formVacio());
    this.tabActiva.set('general');
    this.buscarProgramas.set('');
    this.buscarServicios.set('');
    this.msg.set(null);
  }

  abrirEditor(s: SedeDto, resetTab = true): void {
    this.editando.set(s);
    this.mostrarNuevo.set(false);
    this.form.set({
      idSede: s.idSede,
      nombre: s.nombre || '',
      codigo: s.codigo || s.idSede,
      direccion: s.direccion || '',
      ciudad: s.ciudad || '',
      departamento: s.departamento || '',
      codMunicipio: s.codMunicipio || '',
      lat: s.lat != null ? String(s.lat) : '',
      lng: s.lng != null ? String(s.lng) : '',
      deteGeorefe: (s.deteGeorefe as DeteGeorefe) || '',
      telefono: s.telefono || '',
      activa: s.activa !== false,
      esPrincipal: !!s.esPrincipal,
      programasMode: s.programasMode || 'todos',
      programasTiposPermitidos: [...(s.programasTiposPermitidos || [])],
      programasIdsPermitidos: [...(s.programasIdsPermitidos || [])],
      serviciosMode: s.serviciosMode || 'todos',
      serviciosTiposPermitidos: [...(s.serviciosTiposPermitidos || [])],
      serviciosIdsPermitidos: [...(s.serviciosIdsPermitidos || [])],
    });
    if (resetTab) this.tabActiva.set('general');
    this.buscarProgramas.set('');
    this.buscarServicios.set('');
    this.syncAviso.set(null);
    this.msg.set(null);

    if (s.programasMode === 'especificos' && s.serviciosMode === 'especificos') {
      this.form.update((f) => ({
        ...f,
        serviciosIdsPermitidos: this.syncServicioIdsConProgramas(
          new Set(f.programasIdsPermitidos),
          f.serviciosIdsPermitidos,
        ),
      }));
    }
  }

  cerrarEditor(): void {
    this.mostrarNuevo.set(false);
    this.editando.set(null);
  }

  setTab(tab: SedeTab): void {
    this.tabActiva.set(tab);
  }

  patch<K extends keyof SedeForm>(k: K, v: SedeForm[K]): void {
    this.form.update((f) => ({ ...f, [k]: v }));
  }

  tituloEditor(): string {
    if (this.mostrarNuevo()) return 'Nueva sede';
    return this.editando()?.nombre || 'Editar sede';
  }

  textoMunicipioInicial(): string {
    const f = this.form();
    if (f.ciudad && f.departamento) return `${f.ciudad}, ${f.departamento}`;
    return f.ciudad || '';
  }

  onMunicipio(m: MunicipioDivipola): void {
    this.form.update((f) => ({
      ...f,
      ciudad: m.nombreMunicipio,
      departamento: m.nombreDepto,
      codMunicipio: m.codMunicipio,
      deteGeorefe:
        f.deteGeorefe === 'MAPA' || f.deteGeorefe === 'DISPOSITIVO_MOVIL' ? f.deteGeorefe : 'MANUAL',
    }));
  }

  latNum(): number | null {
    const n = Number(this.form().lat);
    return Number.isFinite(n) ? n : null;
  }

  lngNum(): number | null {
    const n = Number(this.form().lng);
    return Number.isFinite(n) ? n : null;
  }

  onMapaCoords(ev: CoordsGeorefEvent): void {
    this.form.update((f) => ({
      ...f,
      lat: String(ev.lat),
      lng: String(ev.lng),
      deteGeorefe: ev.deteGeorefe,
    }));
    this.resolverMunicipioDesdeCoords(ev.lat, ev.lng);
  }

  onCoordsManualChange(): void {
    const lat = this.latNum();
    const lng = this.lngNum();
    if (lat == null || lng == null) {
      this.patch('deteGeorefe', '');
      return;
    }
    if (!this.form().deteGeorefe) this.patch('deteGeorefe', 'MANUAL');
    this.resolverMunicipioDesdeCoords(lat, lng, 500);
  }

  private resolverMunicipioDesdeCoords(lat: number, lng: number, delayMs = 300): void {
    this.geoResolviendo.set(true);
    setTimeout(() => {
      this.jornadaSvc.resolverMunicipioGeoref(lat, lng).subscribe({
        next: (r) => {
          this.geoResolviendo.set(false);
          if (!r?.municipio) return;
          this.form.update((f) => ({
            ...f,
            ciudad: r.municipio || f.ciudad,
            departamento: r.depto || f.departamento,
            codMunicipio: r.codMunicipio || f.codMunicipio,
          }));
        },
        error: () => this.geoResolviendo.set(false),
      });
    }, delayMs);
  }

  setModoProgramas(mode: SedeCatalogoMode): void {
    this.patch('programasMode', mode);
    this.syncAviso.set(null);
  }

  setModoServicios(mode: SedeCatalogoMode): void {
    this.form.update((f) => {
      const next = { ...f, serviciosMode: mode };
      if (
        mode === 'especificos' &&
        f.programasMode === 'especificos' &&
        f.programasIdsPermitidos.length
      ) {
        next.serviciosIdsPermitidos = this.syncServicioIdsConProgramas(
          new Set(f.programasIdsPermitidos),
          f.serviciosIdsPermitidos,
        );
      }
      return next;
    });
    this.syncAviso.set(null);
  }

  serviciosDePrograma(idPrograma: number): ServicioCatalogo[] {
    return this.servicios().filter((s) => {
      const idProg = s.idProg != null && s.idProg !== '' ? +s.idProg : null;
      return idProg === idPrograma;
    });
  }

  cantidadServiciosPrograma(idPrograma: number): number {
    return this.serviciosDePrograma(idPrograma).length;
  }

  servicioVinculadoPrograma(s: ServicioCatalogo): boolean {
    const f = this.form();
    if (f.programasMode !== 'especificos') return false;
    const idProg = s.idProg != null && s.idProg !== '' ? +s.idProg : null;
    return idProg != null && f.programasIdsPermitidos.includes(idProg);
  }

  private syncServicioIdsConProgramas(
    progIds: Set<number>,
    serviciosActuales: number[],
  ): number[] {
    const servIds = new Set(serviciosActuales);
    for (const idProg of progIds) {
      for (const s of this.serviciosDePrograma(idProg)) {
        if (s.idServ != null) servIds.add(+s.idServ);
      }
    }
    for (const s of this.servicios()) {
      const idProg = s.idProg != null && s.idProg !== '' ? +s.idProg : null;
      if (idProg != null && !progIds.has(idProg) && s.idServ != null) {
        servIds.delete(+s.idServ);
      }
    }
    return [...servIds];
  }

  private avisarSyncServicios(cantidad: number, accion: 'agregados' | 'quitados'): void {
    if (cantidad <= 0) return;
    const txt =
      accion === 'agregados'
        ? `Se marcaron ${cantidad} servicio(s) vinculado(s) al programa.`
        : `Se quitaron ${cantidad} servicio(s) del programa desmarcado.`;
    this.syncAviso.set(txt);
  }

  toggleTipoPrograma(id: string, checked: boolean): void {
    this.form.update((f) => {
      const cur = [...f.programasTiposPermitidos];
      const i = cur.indexOf(id);
      if (checked && i < 0) cur.push(id);
      if (!checked && i >= 0) cur.splice(i, 1);
      return { ...f, programasTiposPermitidos: cur };
    });
  }

  togglePrograma(id: number, checked: boolean): void {
    const vinculados = this.serviciosDePrograma(id).length;
    this.form.update((f) => {
      const progIds = new Set(f.programasIdsPermitidos);
      if (checked) progIds.add(id);
      else progIds.delete(id);

      let servIds = f.serviciosIdsPermitidos;
      if (f.serviciosMode === 'especificos') {
        servIds = this.syncServicioIdsConProgramas(progIds, f.serviciosIdsPermitidos);
      }

      return { ...f, programasIdsPermitidos: [...progIds], serviciosIdsPermitidos: servIds };
    });

    const f = this.form();
    if (f.programasMode !== 'especificos') return;
    if (f.serviciosMode === 'especificos') {
      if (vinculados > 0) this.avisarSyncServicios(vinculados, checked ? 'agregados' : 'quitados');
    } else if (checked && vinculados > 0) {
      this.syncAviso.set(
        `Este programa incluye ${vinculados} servicio(s) vinculado(s); quedarán disponibles en la sede.`,
      );
    } else if (!checked) {
      this.syncAviso.set(null);
    }
  }

  marcarProgramasVisibles(checked: boolean): void {
    const ids = this.programasFiltrados().map((p) => +p.idPrograma);
    this.form.update((f) => {
      const progIds = new Set(f.programasIdsPermitidos);
      for (const id of ids) {
        if (checked) progIds.add(id);
        else progIds.delete(id);
      }
      let servIds = f.serviciosIdsPermitidos;
      if (f.serviciosMode === 'especificos') {
        servIds = this.syncServicioIdsConProgramas(progIds, f.serviciosIdsPermitidos);
      }
      return { ...f, programasIdsPermitidos: [...progIds], serviciosIdsPermitidos: servIds };
    });
    if (this.form().serviciosMode === 'especificos' && checked) {
      this.syncAviso.set('Servicios vinculados actualizados según programas visibles marcados.');
    }
  }

  toggleTipoServicio(codigo: string, checked: boolean): void {
    this.form.update((f) => {
      const cur = [...f.serviciosTiposPermitidos];
      const i = cur.indexOf(codigo);
      if (checked && i < 0) cur.push(codigo);
      if (!checked && i >= 0) cur.splice(i, 1);
      return { ...f, serviciosTiposPermitidos: cur };
    });
  }

  toggleServicio(id: number, checked: boolean): void {
    this.form.update((f) => {
      const cur = [...f.serviciosIdsPermitidos];
      const i = cur.indexOf(id);
      if (checked && i < 0) cur.push(id);
      if (!checked && i >= 0) cur.splice(i, 1);
      return { ...f, serviciosIdsPermitidos: cur };
    });
  }

  marcarServiciosVisibles(checked: boolean): void {
    const ids = this.serviciosFiltrados().map((s) => +s.idServ!);
    this.form.update((f) => {
      const cur = new Set(f.serviciosIdsPermitidos);
      for (const id of ids) {
        if (Number.isFinite(id)) {
          if (checked) cur.add(id);
          else cur.delete(id);
        }
      }
      return { ...f, serviciosIdsPermitidos: [...cur] };
    });
  }

  resumenProgramas(): string {
    const f = this.form();
    if (f.programasMode === 'todos') return 'Todos los programas';
    if (f.programasMode === 'tipos') {
      return `${f.programasTiposPermitidos.length} tipo(s) de capacitación`;
    }
    return `${f.programasIdsPermitidos.length} programa(s) seleccionado(s)`;
  }

  resumenServicios(): string {
    const f = this.form();
    if (f.serviciosMode === 'todos') return 'Todos los servicios';
    if (f.serviciosMode === 'tipos') {
      return `${f.serviciosTiposPermitidos.length} tipo(s) de servicio`;
    }
    return `${f.serviciosIdsPermitidos.length} servicio(s) seleccionado(s)`;
  }

  labelOferta(s: SedeDto): string {
    const p = s.programasMode || 'todos';
    const sv = s.serviciosMode || 'todos';
    if (p === 'todos' && sv === 'todos') return 'Catálogo completo';
    const parts: string[] = [];
    if (p === 'tipos') parts.push(`${s.programasTiposPermitidos?.length || 0} tipos prog.`);
    else if (p === 'especificos') parts.push(`${s.programasIdsPermitidos?.length || 0} prog.`);
    if (sv === 'tipos') parts.push(`${s.serviciosTiposPermitidos?.length || 0} tipos serv.`);
    else if (sv === 'especificos') parts.push(`${s.serviciosIdsPermitidos?.length || 0} serv.`);
    return parts.join(' · ') || 'Restringido';
  }

  ubicacionLabel(s: SedeDto): string {
    if (s.ciudad && s.departamento) return `${s.ciudad}, ${s.departamento}`;
    return s.ciudad || s.departamento || 'Sin ubicación';
  }

  capDeteGeorefe(v?: string | null): string {
    switch (v) {
      case 'MAPA':
        return 'cap-emerald';
      case 'DISPOSITIVO_MOVIL':
        return 'cap-blue';
      case 'MANUAL':
        return 'cap-amber';
      default:
        return 'cap-slate';
    }
  }

  private payloadFromForm(f: SedeForm): Partial<SedeDto> {
    const lat = f.lat.trim() ? Number(f.lat) : null;
    const lng = f.lng.trim() ? Number(f.lng) : null;
    return {
      nombre: f.nombre.trim(),
      codigo: f.codigo.trim(),
      direccion: f.direccion.trim(),
      ciudad: f.ciudad.trim(),
      departamento: f.departamento.trim(),
      codMunicipio: f.codMunicipio.trim(),
      lat: Number.isFinite(lat!) ? lat : null,
      lng: Number.isFinite(lng!) ? lng : null,
      deteGeorefe: f.deteGeorefe || '',
      telefono: f.telefono.trim(),
      activa: f.activa,
      esPrincipal: f.esPrincipal,
      programasMode: f.programasMode,
      programasTiposPermitidos: f.programasTiposPermitidos,
      programasIdsPermitidos: f.programasIdsPermitidos,
      serviciosMode: f.serviciosMode,
      serviciosTiposPermitidos: f.serviciosTiposPermitidos,
      serviciosIdsPermitidos: f.serviciosIdsPermitidos,
    };
  }

  guardar(): void {
    const f = this.form();
    const ed = this.editando();
    const esNuevo = this.mostrarNuevo();

    if (!f.nombre.trim()) {
      this.msg.set('El nombre de la sede es obligatorio.');
      this.tabActiva.set('general');
      return;
    }
    if (esNuevo && !f.codigo.trim()) {
      this.msg.set('El código es obligatorio al crear (ej. PRIN, NORTE).');
      this.tabActiva.set('general');
      return;
    }
    if (f.programasMode === 'tipos' && !f.programasTiposPermitidos.length) {
      this.msg.set('Seleccione al menos un tipo de programa.');
      this.tabActiva.set('catalogo');
      return;
    }
    if (f.programasMode === 'especificos' && !f.programasIdsPermitidos.length) {
      this.msg.set('Seleccione al menos un programa específico.');
      this.tabActiva.set('catalogo');
      return;
    }
    if (f.serviciosMode === 'tipos' && !f.serviciosTiposPermitidos.length) {
      this.msg.set('Seleccione al menos un tipo de servicio.');
      this.tabActiva.set('catalogo');
      return;
    }
    if (f.serviciosMode === 'especificos' && !f.serviciosIdsPermitidos.length) {
      this.msg.set('Seleccione al menos un servicio específico.');
      this.tabActiva.set('catalogo');
      return;
    }

    this.saving.set(true);
    this.msg.set(null);
    const payload = this.payloadFromForm(f);
    const idNuevo = f.codigo.trim().toUpperCase();

    const req = ed
      ? this.svc.actualizar(ed.idSede, payload)
      : this.svc.crear({ ...payload, idSede: idNuevo, codigo: idNuevo });

    req.subscribe({
      next: () => {
        this.saving.set(false);
        const id = ed?.idSede || idNuevo;
        this.cargar(id);
        this.msg.set(ed ? 'Sede actualizada.' : 'Sede creada.');
      },
      error: (e) => {
        this.saving.set(false);
        this.msg.set(e?.error?.message || 'Error al guardar.');
      },
    });
  }
}
