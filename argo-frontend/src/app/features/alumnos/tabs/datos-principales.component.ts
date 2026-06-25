import { CommonModule } from '@angular/common';

import { ArgoDateInputComponent } from '../../../shared/argo-date-input/argo-date-input.component';
import {
  Component,
  OnInit,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';

import { FormsModule } from '@angular/forms';

import { ActivatedRoute, Router } from '@angular/router';

import { firstValueFrom } from 'rxjs';



import { AlumnoDto, AlumnoService } from '../../../core/services/alumno.service';

import { AlumnoStore } from '../../../core/services/alumno-store.service';

import { CatalogoService } from '../../../core/services/catalogo.service';

import { ConfigRecibo, ConfigService } from '../../../core/services/config.service';

import { ClienteService, Cliente } from '../../../core/services/cliente.service';

import { ConfirmDialogService } from '../../../shared/confirm-dialog/confirm-dialog.service';

import { environment } from '../../../../environments/environment';

import { MunicipioBuscarComponent } from '../municipio-buscar.component';

import {
  CatalogoEnumBuscarComponent,
  EnumBuscarOption,
} from '../../../shared/catalogo-enum-buscar/catalogo-enum-buscar.component';

import {

  DISCAPACIDADES_DEF,

  ESTADOS_CIVIL_DEF,

  ESTRATOS_DEF,

  GENEROS_DEF,

  JORNADAS_DEF,

  MULTICULTURALIDAD_DEF,

  NIVEL_FORMACION_DEF,

  OCUPACIONES_DEF,

  REGIMEN_SALUD_DEF,

  TIPOS_ALUMNO_DEF,

  TIPO_JORNADAS_CAPACITACION,

  TIPOS_DOC_DEF,

  TIPO_SANGRE_DEF,

  normalizarTipoAlumno,

  catEtiqueta,
  catalogoConEtiquetas,
  catValor,

  fechaHoraDisplay,

  fechaInput,

  normalizarEnum,
  normalizarGenero,
  normalizarTipoSangre,
  nombreEnMayusculas,

} from '../catalogo.helpers';

import {
  formatNumDoc,
  NUM_DOC_MAX_DIGITS,
  numDocValidationHint,
  parseNumDocForApi,
  sanitizeNumDocInput,
} from '../../../core/utils/num-doc.helpers';

import {
  aplicarPlantillaMensaje,
  nombreCompletoAlumno,
} from '../../../core/utils/mensaje-plantilla.helpers';
import { ModoAlumnos, rutasAlumnos } from '../alumnos-rutas.helpers';

@Component({

  selector: 'argo-datos-principales',

  standalone: true,

  imports: [CommonModule, FormsModule, MunicipioBuscarComponent, CatalogoEnumBuscarComponent,
    ArgoDateInputComponent,
  ],

  templateUrl: './datos-principales.component.html',

  styleUrls: ['./datos-principales.component.scss'],

})

export class DatosPrincipalesComponent implements OnInit {

  /** Alumno cargado por la ficha (input desde alumno-detalle). */
  alumno = input<AlumnoDto | null>(null);

  /** general | jornadas — define lista y rutas de vuelta */
  modo = input<ModoAlumnos>('general');

  private rutasAlumno = computed(() => rutasAlumnos(this.modo()));

  private alumnoSvc = inject(AlumnoService);

  private catSvc = inject(CatalogoService);

  private router = inject(Router);
  private route = inject(ActivatedRoute);

  private confirm = inject(ConfirmDialogService);

  private configSvc = inject(ConfigService);

  store = inject(AlumnoStore);

  readonly numDocMaxLength = NUM_DOC_MAX_DIGITS;
  readonly numDocHint = numDocValidationHint();

  private configRecibo = signal<ConfigRecibo | null>(null);



  uploads = environment.uploadsUrl;



  form = signal<AlumnoDto>(this.emptyForm());

  fotoFile = signal<File | null>(null);

  fotoPreview = signal<string | null>(null);



  readonly tiposAlumno = TIPOS_ALUMNO_DEF;
  readonly normalizarTipoAlumno = normalizarTipoAlumno;

  tiposDoc = signal<Record<string, unknown>[]>(TIPOS_DOC_DEF);

  generos = signal<Record<string, unknown>[]>(GENEROS_DEF);

  tiposSangre = signal<Record<string, unknown>[]>(TIPO_SANGRE_DEF);

  jornadas = signal<Record<string, unknown>[]>(JORNADAS_DEF);

  estadosCiviles = signal<Record<string, unknown>[]>(ESTADOS_CIVIL_DEF);

  estratos = signal<Record<string, unknown>[]>(ESTRATOS_DEF);

  regimenesSalud = signal<Record<string, unknown>[]>(REGIMEN_SALUD_DEF);

  nivelesFormacion = signal<Record<string, unknown>[]>(NIVEL_FORMACION_DEF);

  ocupaciones = signal<Record<string, unknown>[]>(OCUPACIONES_DEF);

  discapacidades = signal<Record<string, unknown>[]>(DISCAPACIDADES_DEF);

  multiCulturalidades = signal<Record<string, unknown>[]>(MULTICULTURALIDAD_DEF);

  opcionesTipoAlumno = computed<EnumBuscarOption[]>(() =>
    this.tiposAlumno.map((t) => ({ value: t, label: t })),
  );
  opcionesTiposDoc = computed<EnumBuscarOption[]>(() => this.mapOpcionesCatalogo(this.tiposDoc()));
  opcionesGeneros = computed<EnumBuscarOption[]>(() => this.mapOpcionesCatalogo(this.generos()));
  opcionesTiposSangre = computed<EnumBuscarOption[]>(() => this.mapOpcionesCatalogo(this.tiposSangre()));
  opcionesJornadas = computed<EnumBuscarOption[]>(() => this.mapOpcionesCatalogo(this.jornadas()));
  opcionesEstadosCivil = computed<EnumBuscarOption[]>(() => this.mapOpcionesCatalogo(this.estadosCiviles()));
  opcionesEstratos = computed<EnumBuscarOption[]>(() => this.mapOpcionesCatalogo(this.estratos()));
  opcionesRegimenSalud = computed<EnumBuscarOption[]>(() => this.mapOpcionesCatalogo(this.regimenesSalud()));
  opcionesNivelFormacion = computed<EnumBuscarOption[]>(() => this.mapOpcionesCatalogo(this.nivelesFormacion()));
  opcionesOcupaciones = computed<EnumBuscarOption[]>(() => this.mapOpcionesCatalogo(this.ocupaciones()));
  opcionesDiscapacidades = computed<EnumBuscarOption[]>(() => this.mapOpcionesCatalogo(this.discapacidades()));
  opcionesMultiCulturalidad = computed<EnumBuscarOption[]>(() =>
    this.mapOpcionesCatalogo(this.multiCulturalidades()),
  );



  expedidaTexto = signal('');

  munOrigenTexto = signal('');



  saving = signal(false);

  message = signal<string | null>(null);

  docDuplicado = signal<{ _id: string; nombreCompleto?: string } | null>(null);

  /** Escaneo OCR de cédula (solo nuevo alumno o relleno manual) */
  scanVisible = signal(true);
  scanPreview = signal<string | null>(null);
  scanFile = signal<File | null>(null);
  scanning = signal(false);
  scanWarnings = signal<string[]>([]);
  scanApplied = signal(false);

  /** Empresa — combobox de búsqueda incremental */
  private clienteSvc    = inject(ClienteService);
  empresaBusqueda       = signal('');
  empresaSugerencias    = signal<Cliente[]>([]);
  empresaCargando       = signal(false);
  empresaDropdownOpen   = signal(false);

  buscarEmpresa(q: string) {
    this.empresaBusqueda.set(q);
    if (!q.trim()) {
      this.empresaSugerencias.set([]);
      this.empresaDropdownOpen.set(false);
      if (!q) {
        this.form.update((f) => ({ ...f, empresaId: null, empresaNombre: null }));
      }
      return;
    }
    this.empresaCargando.set(true);
    this.clienteSvc.listar(q.trim()).subscribe({
      next: (rows) => {
        this.empresaSugerencias.set(rows.slice(0, 10));
        this.empresaDropdownOpen.set(rows.length > 0);
        this.empresaCargando.set(false);
      },
      error: () => this.empresaCargando.set(false),
    });
  }

  seleccionarEmpresa(c: Cliente) {
    const nombre = c.razonSocial?.trim() || c.nombreComercial?.trim() || c.nombres?.trim() || c.identificacion || '';
    this.empresaBusqueda.set(nombre);
    this.form.update((f) => ({ ...f, empresaId: c._id || null, empresaNombre: nombre || null }));
    this.empresaDropdownOpen.set(false);
    this.empresaSugerencias.set([]);
  }

  limpiarEmpresa() {
    this.empresaBusqueda.set('');
    this.empresaSugerencias.set([]);
    this.empresaDropdownOpen.set(false);
    this.form.update((f) => ({ ...f, empresaId: null, empresaNombre: null }));
  }

  onEmpresaBlur() {
    setTimeout(() => this.empresaDropdownOpen.set(false), 200);
  }

  /** Firma del último estado guardado (o vacío en alumno nuevo) */
  private lineaBase = signal('');

  saveAlarmFlash = signal(false);

  formSinGuardar = computed(() => {
    const base = this.lineaBase();
    const cur = this.firmaEstadoActual();
    if (!base) return this.tieneDatosDigitados();
    return cur !== base;
  });

  saveAlarmVisible = computed(() => this.formSinGuardar() && !this.saving());

  saveAlarmTexto = computed(() =>
    this.isEdit() ? 'Cambios sin guardar' : 'Guarde con Crear para continuar',
  );

  isEdit = computed(() => !!this.form()._id);

  /** Alta desde Jornadas Cap. (query esJornadaCap / tipoAlumno). */
  private origenJornadaCap = signal(
    DatosPrincipalesComponent.esJornadaDesdeQuery(inject(ActivatedRoute).snapshot.queryParamMap),
  );

  esAlumnoJornada = computed(
    () =>
      this.modo() === 'jornadas' ||
      this.origenJornadaCap() ||
      normalizarTipoAlumno(this.form().tipoAlumno) === TIPO_JORNADAS_CAPACITACION,
  );

  catValor = catValor;

  catEtiqueta = catEtiqueta;

  fechaHoraDisplay = fechaHoraDisplay;



  private static esJornadaDesdeQuery(q: { get: (k: string) => string | null }): boolean {
    const flag = q.get('esJornadaCap');
    if (flag === 'true' || flag === '1') return true;
    return normalizarTipoAlumno(q.get('tipoAlumno')) === TIPO_JORNADAS_CAPACITACION;
  }

  constructor() {
    afterNextRender(() => this.sincronizarDesdeAlumno());

    effect(() => {
      const a = this.alumno() ?? this.store.alumno();
      this.sincronizarDesdeAlumno(a);
    });

    effect(() => {
      this.store.setDatosSinGuardar(this.formSinGuardar());
    });

    effect(() => {
      const tick = this.store.saveAlarmTick();
      if (!tick) return;
      this.saveAlarmFlash.set(true);
      const t = setTimeout(() => this.saveAlarmFlash.set(false), 3200);
      return () => clearTimeout(t);
    });

  }



  ngOnInit(): void {
    this.route.queryParamMap.subscribe((q) => {
      const esJ = DatosPrincipalesComponent.esJornadaDesdeQuery(q);
      this.origenJornadaCap.set(esJ);
      if (esJ && !this.isEdit()) {
        this.form.update((f) => ({ ...f, tipoAlumno: TIPO_JORNADAS_CAPACITACION }));
        this.lineaBase.set(
          this.firmaEstadoActual({ ...this.form(), tipoAlumno: TIPO_JORNADAS_CAPACITACION }),
        );
      }
    });

    this.cargarCatalogo('catTipoDoc', this.tiposDoc, TIPOS_DOC_DEF);
    this.cargarCatalogo('catRegimenSalud', this.regimenesSalud, REGIMEN_SALUD_DEF);

    this.configSvc.obtenerRecibo().subscribe({
      next: (c) => this.configRecibo.set(c),
      error: () => this.configRecibo.set(null),
    });

  }



  private resolverTextoMunOrigen(cod?: string) {

    if (!cod) {

      this.munOrigenTexto.set('');

      return;

    }

    this.catSvc.municipioPorCodigo(cod).subscribe({

      next: (m) => this.munOrigenTexto.set(m.label),

      error: () => this.munOrigenTexto.set(cod),

    });

  }



  onExpedidaSel(m: { nombreMunicipio: string; label: string }) {

    this.expedidaTexto.set(m.label);

    this.patch('expedida', m.nombreMunicipio);

  }

  onExpedidaLimpiar(): void {
    this.expedidaTexto.set('');
    this.patch('expedida', '');
  }

  onExpedidaTexto(v: string): void {
    this.expedidaTexto.set(v);
    this.patch('expedida', v);
  }



  onMunOrigenSel(m: { codMunicipio: string; label: string }) {
    this.munOrigenTexto.set(m.label);
    const cod = m.codMunicipio;
    this.form.update((f) => ({ ...f, munOrigen: cod, codMunicipio: cod }));
  }

  onMunOrigenLimpiar(): void {
    this.munOrigenTexto.set('');
    this.form.update((f) => ({ ...f, munOrigen: '', codMunicipio: '' }));
  }

  mapOpcionesCatalogo(items: Record<string, unknown>[]): EnumBuscarOption[] {
    return items.map((item) => ({ value: catValor(item), label: catEtiqueta(item) }));
  }

  etiquetaCatalogo(items: Record<string, unknown>[], valor?: string | null): string {
    const v = String(valor ?? '').trim();
    if (!v) return '';
    const norm = normalizarEnum(v);
    const hit = items.find((i) => {
      const cv = catValor(i);
      const cod = String(i['codigo'] ?? '').trim();
      return (
        cv === v
        || cv === norm
        || (cod && (cod === v || cod.toUpperCase() === v.toUpperCase()))
        || catEtiqueta(i).toUpperCase() === v.toUpperCase()
      );
    });
    return hit ? catEtiqueta(hit) : v;
  }

  onCatalogoPick<K extends keyof AlumnoDto>(campo: K, opt: EnumBuscarOption): void {
    this.patch(campo, String(opt.value) as AlumnoDto[K]);
  }

  onCatalogoLimpiar<K extends keyof AlumnoDto>(campo: K, valorVacio: AlumnoDto[K] = '' as AlumnoDto[K]): void {
    this.patch(campo, valorVacio);
  }

  onTipoAlumnoPick(opt: EnumBuscarOption): void {
    this.patch('tipoAlumno', String(opt.value));
  }

  onTipoAlumnoLimpiar(): void {
    if (this.esAlumnoJornada()) return;
    this.patch('tipoAlumno', normalizarTipoAlumno(undefined));
  }



  private cargarCatalogo(

    nombre: string,

    target: ReturnType<typeof signal<Record<string, unknown>[]>>,

    fallback: Record<string, unknown>[],

  ) {

    this.catSvc.list(nombre, { refresh: true }).subscribe((d) => {
      target.set(catalogoConEtiquetas(d || [], fallback));
    });

  }



  patch<K extends keyof AlumnoDto>(k: K, v: AlumnoDto[K]) {
    let valor = v;
    if (k === 'apellido1' || k === 'apellido2' || k === 'nombre1' || k === 'nombre2') {
      valor = nombreEnMayusculas(String(v ?? '')) as AlumnoDto[K];
    }
    if (k === 'numDoc') {
      valor = sanitizeNumDocInput(v) as AlumnoDto[K];
    }
    if (k === 'alertaPagoFrecuencia' && !v) {
      this.form.update((f) => ({ ...f, alertaPagoFrecuencia: '', alertaPago: null }));
      return;
    }
    this.form.update((f) => ({ ...f, [k]: valor }));

    if (k === 'numDoc') this.verificarDoc();
  }



  verificarDoc() {
    const nd = parseNumDocForApi(this.form().numDoc);
    if (nd == null) {
      this.docDuplicado.set(null);
      return;
    }
    this.alumnoSvc.verificarDocumento(nd, this.form()._id).subscribe({
      next: (r) => {
        if (r.existe && r._id && String(r._id) !== String(this.form()._id || '')) {
          this.docDuplicado.set({ _id: String(r._id), nombreCompleto: r.nombreCompleto });
          if (!this.isEdit()) {
            this.message.set(
              `El documento ${formatNumDoc(nd)} ya está registrado. Abra el alumno existente o use otro número.`,
            );
          }
        } else {
          this.docDuplicado.set(null);
        }
      },
    });
  }



  irAlDuplicado() {

    const d = this.docDuplicado();

    if (d?._id) void this.router.navigate([this.rutasAlumno().ficha(d._id)]);

  }



  onFoto(ev: Event) {

    const file = (ev.target as HTMLInputElement).files?.[0];

    if (!file) return;

    this.fotoFile.set(file);

    const r = new FileReader();

    r.onload = () => this.fotoPreview.set(r.result as string);

    r.readAsDataURL(file);

  }

  onCedulaScan(ev: Event) {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.scanFile.set(file);
    this.scanApplied.set(false);
    this.scanWarnings.set([]);
    const r = new FileReader();
    r.onload = () => this.scanPreview.set(r.result as string);
    r.readAsDataURL(file);
  }

  omitirEscaneo() {
    this.scanVisible.set(false);
    this.scanPreview.set(null);
    this.scanFile.set(null);
    this.scanWarnings.set([]);
  }

  volverEscaneo() {
    this.scanVisible.set(true);
    this.scanApplied.set(false);
    this.scanWarnings.set([]);
  }

  escanearCedula() {
    const file = this.scanFile();
    if (!file) {
      this.message.set('Seleccione una imagen del frente de la cédula.');
      return;
    }
    this.scanning.set(true);
    this.message.set(null);
    this.alumnoSvc.escanearCedula(file).subscribe({
      next: (res) => {
        this.scanning.set(false);
        this.aplicarSugeridoOcr(res.sugerido);
        this.scanWarnings.set(res.meta?.advertencias || []);
        this.scanApplied.set(true);
        this.scanVisible.set(false);
        this.message.set('Datos sugeridos aplicados. Revise y corrija antes de guardar.');
      },
      error: (err) => {
        this.scanning.set(false);
        this.message.set(err?.error?.message || 'No se pudo leer la cédula. Intente otra foto o digite manualmente.');
      },
    });
  }

  private aplicarSugeridoOcr(s: Partial<AlumnoDto>) {
    const genero = normalizarGenero(s.genero);
    const tipoSangre = normalizarTipoSangre(s.tipoSangre);
    this.form.update((f) => ({
      ...f,
      tipoDoc: s.tipoDoc || f.tipoDoc || '1',
      numDoc: s.numDoc != null ? formatNumDoc(s.numDoc) : f.numDoc,
      expedida: s.expedida?.trim() || f.expedida,
      apellido1: nombreEnMayusculas(s.apellido1 || f.apellido1),
      apellido2: nombreEnMayusculas(s.apellido2 || f.apellido2),
      nombre1: nombreEnMayusculas(s.nombre1 || f.nombre1),
      nombre2: nombreEnMayusculas(s.nombre2 || f.nombre2),
      fechaNac: s.fechaNac || f.fechaNac,
      genero: genero || f.genero,
      tipoSangre: tipoSangre || f.tipoSangre,
    }));
    if (s.expedida?.trim()) this.expedidaTexto.set(s.expedida.trim());
    if (formatNumDoc(s.numDoc)) this.verificarDoc();
  }

  guardar() {
    if (this.isEdit() && !this.formSinGuardar()) {
      this.dispararAlertaGuardar('No hay cambios pendientes por guardar.');
      return;
    }

    const f = { ...this.form() };
    if (!f.expedida?.trim() && this.expedidaTexto().trim()) {
      f.expedida = this.expedidaTexto().trim();
    }
    const nd = parseNumDocForApi(f.numDoc);
    if (nd == null || !f.nombre1 || !f.apellido1) {
      this.dispararAlertaGuardar(`numDoc válido (${this.numDocHint}), nombre1 y apellido1 son obligatorios.`);
      return;
    }

    if (this.isEdit()) {
      this.ejecutarGuardado(f);
      return;
    }

    this.saving.set(true);
    this.message.set(null);
    this.alumnoSvc.verificarDocumento(nd).subscribe({
      next: (r) => {
        if (r.existe && r._id) {
          this.saving.set(false);
          this.docDuplicado.set({
            _id: String(r._id),
            nombreCompleto: r.nombreCompleto,
          });
          this.message.set(
            `No se puede crear: el documento ${formatNumDoc(nd)} ya pertenece a otro alumno. Use «Abrir registro».`,
          );
          return;
        }
        this.docDuplicado.set(null);
        this.ejecutarGuardado(f);
      },
      error: () => {
        this.saving.set(false);
        this.message.set('No se pudo verificar el documento. Intente de nuevo.');
      },
    });
  }

  private ejecutarGuardado(f: AlumnoDto) {
    this.saving.set(true);
    this.message.set(null);
    const files = { foto: this.fotoFile() || undefined };
    const payload = this.toPayload(f);
    const creando = !this.isEdit();
    const obs = creando
      ? this.alumnoSvc.crear(payload, files)
      : this.alumnoSvc.actualizar(f._id!, payload, files);

    obs.subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.store.setAlumno(saved);
        if (creando) {
          void this.confirmarCreacionAlumno(saved).then(() => {
            if (saved._id) {
              void this.router.navigate([this.rutasAlumno().ficha(String(saved._id))], {
                replaceUrl: true,
              });
            }
          });
          return;
        }
        this.lineaBase.set(this.firmaEstadoActual(this.mapDesdeBd(saved as AlumnoDto & Record<string, unknown>), false));
        this.fotoFile.set(null);
        this.message.set('Datos guardados correctamente.');
      },
      error: (err) => {
        this.saving.set(false);
        const body = err?.error;
        if (err?.status === 409 && body?.existingId) {
          this.docDuplicado.set({
            _id: String(body.existingId),
            nombreCompleto: body.nombreCompleto,
          });
          this.message.set(body.message || 'Ese número de documento ya está registrado.');
          return;
        }
        this.message.set(body?.message || 'Error al guardar.');
      },
    });
  }

  private dispararAlertaGuardar(texto: string) {
    this.message.set(texto);
    this.saveAlarmFlash.set(true);
    setTimeout(() => this.saveAlarmFlash.set(false), 3200);
  }

  private firmaEstadoActual(f?: AlumnoDto, fotoNueva = !!this.fotoFile()): string {
    const src = f ?? this.form();
    const payload = this.toPayload({
      ...src,
      expedida: src.expedida?.trim() || this.expedidaTexto().trim() || '',
      munOrigen: src.munOrigen || src.codMunicipio || '',
      codMunicipio: src.codMunicipio || src.munOrigen || '',
    });
    return JSON.stringify({ ...payload, fotoNueva });
  }

  private tieneDatosDigitados(): boolean {
    const f = this.form();
    if (parseNumDocForApi(f.numDoc) != null) return true;
    if (String(f.nombre1 || '').trim()) return true;
    if (String(f.apellido1 || '').trim()) return true;
    if (String(f.nombre2 || '').trim()) return true;
    if (String(f.apellido2 || '').trim()) return true;
    if (String(f.correo || '').trim()) return true;
    if (String(f.celular || '').trim()) return true;
    if (String(f.direccion || '').trim()) return true;
    if (this.fotoFile()) return true;
    if (this.scanFile()) return true;
    return false;
  }

  private async confirmarCreacionAlumno(saved: AlumnoDto) {
    let cfg = this.configRecibo();
    if (!cfg) {
      try {
        cfg = await firstValueFrom(this.configSvc.obtenerRecibo());
        this.configRecibo.set(cfg);
      } catch {
        cfg = {};
      }
    }

    const nombre = nombreCompletoAlumno(saved);
    const numDoc = formatNumDoc(saved.numDoc);
    const empresa = cfg?.nombreEmpresa?.trim() || 'ARGO';
    const sloganRaw = cfg?.slogan1?.trim() || '';
    const slogan = sloganRaw ? `\n\n${sloganRaw}` : '';
    const vars = {
      nombre,
      numDoc,
      empresa,
      slogan,
      ciudad: cfg?.ciudad?.trim() || '',
      telefono: cfg?.telefono?.trim() || '',
    };

    const tituloDefault = '¡Alumno registrado!';
    const mensajeDefault =
      'Se registró correctamente a {nombre} con documento {numDoc}.\n\nBienvenido(a) a {empresa}.{slogan}';

    const title = aplicarPlantillaMensaje(
      cfg?.mensajeCreacionAlumnoTitulo?.trim() || tituloDefault,
      vars,
    );
    const message = aplicarPlantillaMensaje(
      cfg?.mensajeCreacionAlumno?.trim() || mensajeDefault,
      vars,
    );

    await this.confirm.open({
      title,
      message,
      variant: 'success',
      icon: 'check',
      confirmLabel: 'Aceptar',
      hideCancel: true,
    });
  }



  /** Solo campos del esquema datosAlumnos (sin auditoría de solo lectura) */

  private toPayload(f: AlumnoDto): AlumnoDto & { esJornadaCap?: string } {

    const esJornada = this.esAlumnoJornada();

    return {

      ...(esJornada && !this.isEdit() ? { esJornadaCap: 'true' } : {}),

      tipoAlumno: this.isEdit()
        ? normalizarTipoAlumno(f.tipoAlumno)
        : esJornada
          ? TIPO_JORNADAS_CAPACITACION
          : normalizarTipoAlumno(undefined),

      tipoDoc: f.tipoDoc,

      numDoc: parseNumDocForApi(f.numDoc) ?? f.numDoc,

      expedida: f.expedida,

      apellido1: nombreEnMayusculas(f.apellido1),

      apellido2: nombreEnMayusculas(f.apellido2),

      nombre1: nombreEnMayusculas(f.nombre1),

      nombre2: nombreEnMayusculas(f.nombre2),

      fechaNac: f.fechaNac,

      observaciones: f.observaciones,

      genero: f.genero,

      tipoSangre: f.tipoSangre,

      jornada: f.jornada,

      estadoCivil: f.estadoCivil,

      estrato: f.estrato,

      regimenSalud: f.regimenSalud,

      nivelFormacion: f.nivelFormacion,

      ocupacion: f.ocupacion,

      discapacidad: f.discapacidad,
      munOrigen: f.munOrigen || f.codMunicipio,
      codMunicipio: f.codMunicipio || f.munOrigen,
      correo: f.correo,
      direccion: f.direccion,
      celular: f.celular,
      multiCulturalidad: f.multiCulturalidad,

      urlFoto: f.urlFoto,

      empresaId: f.empresaId ?? null,

      alertaPagoFrecuencia: f.alertaPagoFrecuencia || '',
      alertaPago: f.alertaPago || '',

    };

  }



  toUrl(name: string) {

    if (!name) return '';

    if (name.startsWith('http')) return name;

    return `${this.uploads}/${name}`;

  }



  private sincronizarDesdeAlumno(src?: AlumnoDto | null): void {
    const a = src !== undefined ? src : this.alumno() ?? this.store.alumno();
    if (a?._id || (a?.numDoc != null && String(a.numDoc).trim() !== '')) {
      this.aplicarAlumnoEnForm(a as AlumnoDto & Record<string, unknown>);
    } else if (!a) {
      this.form.set(this.emptyForm());
      this.expedidaTexto.set('');
      this.munOrigenTexto.set('');
      this.fotoPreview.set(null);
      this.scanVisible.set(true);
      this.scanApplied.set(false);
      this.scanPreview.set(null);
      this.scanFile.set(null);
      this.scanWarnings.set([]);
      this.empresaBusqueda.set('');
      this.empresaSugerencias.set([]);
      this.empresaDropdownOpen.set(false);
      this.lineaBase.set('');
    }
    this.store.setDatosSinGuardar(false);
  }

  private aplicarAlumnoEnForm(raw: AlumnoDto & Record<string, unknown>): void {
    const mapped = this.mapDesdeBd(raw);
    this.form.set(mapped);
    this.expedidaTexto.set(mapped.expedida || '');
    this.resolverTextoMunOrigen(mapped.codMunicipio || mapped.munOrigen);
    this.fotoPreview.set(mapped.urlFoto ? this.toUrl(mapped.urlFoto) : null);
    this.fotoFile.set(null);
    this.docDuplicado.set(null);
    this.scanVisible.set(false);
    this.scanApplied.set(false);
    this.scanPreview.set(null);
    this.scanFile.set(null);
    this.scanWarnings.set([]);
    this.empresaBusqueda.set(mapped.empresaNombre || '');
    this.empresaDropdownOpen.set(false);
    this.empresaSugerencias.set([]);
    this.lineaBase.set(this.firmaEstadoActual(mapped, false));
  }

  /** Campos legacy nombres/apellidos (un solo string) → nombre1/nombre2, apellido1/apellido2 */
  private partirNombreLegacy(s: string): { p1: string; p2: string } {
    const partes = String(s || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!partes.length) return { p1: '', p2: '' };
    return { p1: partes[0], p2: partes.slice(1).join(' ') };
  }

  private mapDesdeBd(raw: AlumnoDto & Record<string, unknown>): AlumnoDto {
    let nombre1 = String(raw.nombre1 || '');
    let nombre2 = String(raw.nombre2 || '');
    if (!nombre1.trim() && raw['nombres']) {
      const n = this.partirNombreLegacy(String(raw['nombres']));
      nombre1 = n.p1;
      nombre2 = n.p2 || nombre2;
    }
    let apellido1 = String(raw.apellido1 || '');
    let apellido2 = String(raw.apellido2 || '');
    if (!apellido1.trim() && raw['apellidos']) {
      const ap = this.partirNombreLegacy(String(raw['apellidos']));
      apellido1 = ap.p1;
      apellido2 = ap.p2 || apellido2;
    }

    return {

      _id:
        raw._id != null
          ? String(raw._id)
          : raw['id'] != null
            ? String(raw['id'])
            : raw['idAlumno'] != null
              ? String(raw['idAlumno'])
              : undefined,

      fechaReg: raw.fechaReg as string,

      tipoAlumno: normalizarTipoAlumno(String(raw.tipoAlumno || '')),

      tipoDoc: normalizarEnum(String(raw.tipoDoc || '1')),

      numDoc: formatNumDoc(raw.numDoc),

      expedida: String(raw.expedida || ''),

      apellido1: nombreEnMayusculas(apellido1),

      apellido2: nombreEnMayusculas(apellido2),

      nombre1: nombreEnMayusculas(nombre1),

      nombre2: nombreEnMayusculas(nombre2),

      fechaNac: fechaInput(raw.fechaNac as string),

      observaciones: String(raw.observaciones || ''),

      genero: String(raw.genero || '').toUpperCase(),

      tipoSangre: String(raw.tipoSangre || ''),

      jornada: normalizarEnum(String(raw.jornada || '')),

      estadoCivil: normalizarEnum(String(raw.estadoCivil || '')),

      estrato: normalizarEnum(String(raw.estrato || '')),

      regimenSalud: normalizarEnum(String(raw.regimenSalud || '')),

      nivelFormacion: normalizarEnum(String(raw.nivelFormacion || '')),

      ocupacion: normalizarEnum(String(raw.ocupacion || '')),

      discapacidad: normalizarEnum(String(raw.discapacidad || '9')),
      munOrigen: String(raw.munOrigen || raw.codMunicipio || ''),
      codMunicipio: String(raw.codMunicipio || raw.munOrigen || ''),
      correo: String(raw.correo || ''),
      direccion: String(raw.direccion || ''),
      celular: String(raw.celular || ''),
      multiCulturalidad: String(raw.multiCulturalidad || 'NO_APLICA'),

      urlFoto: String(raw.urlFoto || (raw['foto'] as string) || ''),

      fechaAudi: raw.fechaAudi as string,

      userAddReg: String(raw.userAddReg || ''),

      userChangeRecord: String(raw.userChangeRecord || ''),

      fechaMod: raw.fechaMod as string,

      empresaId: raw['empresaId'] ? String(raw['empresaId']) : null,
      empresaNombre: raw['empresaNombre'] ? String(raw['empresaNombre']) : null,

      alertaPagoFrecuencia:
        raw['alertaPagoFrecuencia'] === 'quincenal' || raw['alertaPagoFrecuencia'] === 'mensual'
          ? raw['alertaPagoFrecuencia']
          : '',
      alertaPago: raw['alertaPago'] ? String(raw['alertaPago']).slice(0, 10) : null,

    };

  }



  private emptyForm(): AlumnoDto {
    const esJornada =
      this.modo() === 'jornadas' ||
      DatosPrincipalesComponent.esJornadaDesdeQuery(this.route.snapshot.queryParamMap);

    return {

      tipoAlumno: esJornada ? TIPO_JORNADAS_CAPACITACION : normalizarTipoAlumno(undefined),

      tipoDoc: '1',

      numDoc: '',

      expedida: '',

      apellido1: '',

      apellido2: '',

      nombre1: '',

      nombre2: '',

      fechaNac: '',

      observaciones: '',

      genero: '',

      tipoSangre: '',

      jornada: '',

      estadoCivil: '',

      estrato: '',

      regimenSalud: '',

      nivelFormacion: '',

      ocupacion: '',

      discapacidad: '9',
      munOrigen: '',
      codMunicipio: '',
      correo: '',
      direccion: '',
      celular: '',
      multiCulturalidad: 'NO_APLICA',

      urlFoto: '',

      alertaPagoFrecuencia: '',
      alertaPago: null,

    };

  }

}


