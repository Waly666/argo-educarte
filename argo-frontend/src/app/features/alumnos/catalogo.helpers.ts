/** Valor guardado en BD para un ítem de catálogo */
export function catValor(item: Record<string, unknown>): string {
  const v =
    item['idTipoDoc'] ??
    item['idTipCap'] ??
    item['idRegimen'] ??
    item['idJornada'] ??
    item['idEstrato'] ??
    item['idNivel'] ??
    item['idOcupacion'] ??
    item['idDiscapacidad'] ??
    item['idEstadoCivil'] ??
    item['idGenero'] ??
    item['id'] ??
    item['codigo'] ??
    item['_id'];
  return v != null ? String(v) : '';
}

/** Texto visible en select — formato esquema: "1) CEDULA DE CIUDADANÍA" */
export function catEtiqueta(item: Record<string, unknown>): string {
  const d = item['descripcion'] ?? item['nombre'] ?? item['tipo'] ?? item['tipoCap'];
  const v = catValor(item);
  if (d) {
    const s = String(d).trim();
    if (/^\d+\)\s/.test(s)) return s;
    if (v && /^\d+$/.test(v)) return `${v}) ${s}`;
    return s;
  }
  return v;
}

/** Aplica etiquetas indexadas a ítems traídos del API */
export function catalogoConEtiquetas(
  items: Record<string, unknown>[],
  fallback: Record<string, unknown>[],
): Record<string, unknown>[] {
  if (!items?.length) return fallback;
  return items.map((item) => {
    const valor = catValor(item);
    const fb = fallback.find((f) => catValor(f) === valor);
    const descripcion = fb ? catEtiqueta(fb) : catEtiqueta(item);
    return { ...item, descripcion };
  });
}

/** Mapa código → etiqueta visible para listados */
export function buildCatalogoLabelMap(
  items: Record<string, unknown>[],
  fallback: Record<string, unknown>[],
  codeFields: string[] = [],
): Map<string, string> {
  const map = new Map<string, string>();
  const seen = new Set<string>();

  const registrar = (codigo: string, etiqueta: string) => {
    if (!codigo || !etiqueta) return;
    const c = codigo.trim();
    const e = etiqueta.trim();
    map.set(c, e);
    const m = c.match(/^(\d+)/);
    if (m) map.set(m[1], e);
  };

  const todos = [...fallback, ...(items || [])];
  for (const raw of todos) {
    const item = catalogoConEtiquetas([raw], fallback)[0] ?? raw;
    const sig = JSON.stringify(item);
    if (seen.has(sig)) continue;
    seen.add(sig);

    const etiqueta = catEtiqueta(item);
    let codigo = '';
    for (const f of codeFields) {
      if (item[f] != null && item[f] !== '') {
        codigo = String(item[f]).trim();
        break;
      }
    }
    if (!codigo) codigo = normalizarEnum(String(item['descripcion'] ?? ''));
    const v = catValor(item);
    if (!codigo && v && !/^[a-f0-9]{24}$/i.test(v) && v.length <= 6) codigo = v;

    registrar(codigo, etiqueta);
    const desc = String(item['descripcion'] ?? '').trim();
    if (desc) registrar(desc, etiqueta);
  }
  return map;
}

export function catalogoLabel(map: Map<string, string>, valor?: string | null): string {
  if (!valor) return '';
  const v = String(valor).trim();
  if (map.has(v)) return map.get(v)!;
  const norm = normalizarEnum(v);
  if (map.has(norm)) return map.get(norm)!;
  return v;
}

/** Nombres y apellidos siempre en mayúsculas */
export function nombreEnMayusculas(val?: string | null): string {
  if (!val) return '';
  return String(val).trim().toUpperCase().replace(/\s+/g, ' ');
}

/** Normaliza valores legacy tipo "1) SOLTERO" → "1" */
export function normalizarEnum(val?: string): string {
  if (!val) return '';
  const m = String(val).match(/^(\d+)/);
  return m ? m[1] : String(val).trim();
}

/** OCR / texto libre → M | F */
export function normalizarGenero(val?: string): string {
  const t = String(val || '').toUpperCase().trim();
  if (t === 'M' || t.startsWith('MASC')) return 'M';
  if (t === 'F' || t.startsWith('FEM')) return 'F';
  return t === 'M' || t === 'F' ? t : '';
}

/** OCR / texto libre → A+, O-, etc. */
export function normalizarTipoSangre(val?: string): string {
  const valid = new Set(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']);
  const t = String(val || '').toUpperCase().replace(/\s/g, '');
  const m = t.match(/^(AB|A|B|O)(\+|-)$/);
  if (m) {
    const k = `${m[1]}${m[2]}`;
    return valid.has(k) ? k : '';
  }
  return valid.has(t) ? t : '';
}

export function fechaInput(d?: string | Date | null): string {
  if (!d) return '';
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(dt.getTime())) return '';
  return dt.toISOString().slice(0, 10);
}

export function fechaHoraDisplay(d?: string | Date | null): string {
  if (!d) return '—';
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(dt.getTime())) return '—';
  return dt.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
}

/** Enums datosAlumnos — descripción con índice como en el esquema */
/** tipoAlumno en datosAlumnos */
export const TIPOS_ALUMNO_DEF = ['Regular', 'Jornadas de Capacitación', 'Virtual'] as const;
export type TipoAlumno = (typeof TIPOS_ALUMNO_DEF)[number];
export const TIPO_ALUMNO_DEFAULT: TipoAlumno = 'Regular';
export const TIPO_JORNADAS_CAPACITACION: TipoAlumno = 'Jornadas de Capacitación';
export const TIPO_VIRTUAL: TipoAlumno = 'Virtual';

export function normalizarTipoAlumno(val?: string | null): TipoAlumno {
  const t = String(val ?? '').trim();
  if (!t) return TIPO_ALUMNO_DEFAULT;
  const exact = TIPOS_ALUMNO_DEF.find((x) => x.toLowerCase() === t.toLowerCase());
  if (exact) return exact;
  if (/jornadas?\s*de\s*capacitaci[oó]n/i.test(t) || t === 'Jornada Capacitacion') {
    return TIPO_JORNADAS_CAPACITACION;
  }
  if (/^virtual$/i.test(t) || /aula\s*virtual/i.test(t)) return TIPO_VIRTUAL;
  return TIPO_ALUMNO_DEFAULT;
}

/** Tarifa 4 — matrícula aula virtual (portal en línea). */
export const TARIFA_VIRTUAL = 4;

export function esTarifaVirtualMatricula(tarifa?: number | string | null): boolean {
  return Number(tarifa) === TARIFA_VIRTUAL;
}

export function esLiquidacionVirtual(it?: {
  esVirtual?: boolean;
  tarifaMatricula?: number | null;
}): boolean {
  return !!it?.esVirtual || esTarifaVirtualMatricula(it?.tarifaMatricula);
}

export const TIPOS_DOC_DEF = [
  { idTipoDoc: '1', descripcion: '1) CEDULA DE CIUDADANÍA' },
  { idTipoDoc: '2', descripcion: '2) TARJETA DE IDENTIDAD' },
  { idTipoDoc: '3', descripcion: '3) REGISTRO CIVIL' },
  { idTipoDoc: '4', descripcion: '4) CEDULA DE EXTRANJERIA' },
  { idTipoDoc: '5', descripcion: '5) PASAPORTE' },
  { idTipoDoc: '6', descripcion: '6) NUMERO DE IDENTIFICACION TRIBUTARIA' },
];

export const GENEROS_DEF = [
  { idGenero: 'M', descripcion: 'M' },
  { idGenero: 'F', descripcion: 'F' },
];

export const TIPO_SANGRE_DEF = [
  { id: 'A+', descripcion: 'A+' },
  { id: 'A-', descripcion: 'A-' },
  { id: 'B+', descripcion: 'B+' },
  { id: 'B-', descripcion: 'B-' },
  { id: 'AB+', descripcion: 'AB+' },
  { id: 'AB-', descripcion: 'AB-' },
  { id: 'O+', descripcion: 'O+' },
  { id: 'O-', descripcion: 'O-' },
];

export const JORNADAS_DEF = [
  { idJornada: '1', descripcion: '1) DIURNA' },
  { idJornada: '2', descripcion: '2) NOCTURNA' },
  { idJornada: '3', descripcion: '3) FIN DE SEMANA' },
];

export const ESTADOS_CIVIL_DEF = [
  { idEstadoCivil: '1', descripcion: '1) SOLTERO' },
  { idEstadoCivil: '2', descripcion: '2) CASADO' },
  { idEstadoCivil: '3', descripcion: '3) UNIÓN LIBRE' },
  { idEstadoCivil: '4', descripcion: '4) SEPARADO' },
  { idEstadoCivil: '5', descripcion: '5) VIUDO' },
  { idEstadoCivil: '6', descripcion: '6) DIVORCIADO' },
  { idEstadoCivil: '7', descripcion: '7) SIN INFORMACIÓN' },
];

export const ESTRATOS_DEF = [
  { idEstrato: '1', descripcion: '1) 1' },
  { idEstrato: '2', descripcion: '2) 2' },
  { idEstrato: '3', descripcion: '3) 3' },
  { idEstrato: '4', descripcion: '4) 4' },
  { idEstrato: '5', descripcion: '5) 5' },
  { idEstrato: '6', descripcion: '6) 6' },
  { idEstrato: '99', descripcion: '7) 99' },
];

export const REGIMEN_SALUD_DEF = [
  { idRegimen: '1', descripcion: '1) CONTRIBUTIVO' },
  { idRegimen: '2', descripcion: '2) SUBSIDIADO' },
  { idRegimen: '3', descripcion: '3) ESPECIAL' },
  { idRegimen: '4', descripcion: '4) NO AFILIADO' },
];

export const NIVEL_FORMACION_DEF = [
  { idNivel: '1', descripcion: '1) PREESCOLAR' },
  { idNivel: '2', descripcion: '2) BÁSICA PRIMARIA' },
  { idNivel: '3', descripcion: '3) BÁSICA SECUNDARIA' },
  { idNivel: '4', descripcion: '4) MEDIA' },
  { idNivel: '5', descripcion: '5) PREGRADO' },
  { idNivel: '6', descripcion: '6) POSTGRADO' },
  { idNivel: '7', descripcion: '7) SIN ESTUDIOS' },
  { idNivel: '8', descripcion: '8) TÉCNICO LABORAL' },
];

export const OCUPACIONES_DEF = [
  { idOcupacion: '1', descripcion: '1) EMPLEADO' },
  { idOcupacion: '2', descripcion: '2) ESTUDIANTE. BÁSICA / MEDIA' },
  { idOcupacion: '3', descripcion: '3) ESTUDIANTE SUPERIOR' },
  { idOcupacion: '4', descripcion: '4) DESEMPLEADO' },
  { idOcupacion: '5', descripcion: '5) INDEPENDIENTE' },
];

export const DISCAPACIDADES_DEF = [
  { idDiscapacidad: '1', descripcion: '1) SORDERA PROFUNDA' },
  { idDiscapacidad: '2', descripcion: '2) HIPOACUSIA A BAJA AUDICION' },
  { idDiscapacidad: '3', descripcion: '3) BAJA VISION DIAGNOSTICA' },
  { idDiscapacidad: '4', descripcion: '4) CEGUERA' },
  { idDiscapacidad: '5', descripcion: '5) PARALISIS CEREBRAL' },
  { idDiscapacidad: '6', descripcion: '6) LESION NEUROMUSCULAR' },
  { idDiscapacidad: '7', descripcion: '7) DEFICIENCIA COGNITIVA(RETARDO EN EL DESARROLLO)' },
  { idDiscapacidad: '8', descripcion: '8) MULTIPLE' },
  { idDiscapacidad: '9', descripcion: '9) NO APLICA' },
];

export const MULTICULTURALIDAD_DEF = [
  { id: 'INDIGENA', descripcion: 'INDIGENA' },
  { id: 'AFRODESCENDIENTE', descripcion: 'AFRODESCENDIENTE' },
  { id: 'DESPLAZADO', descripcion: 'DESPLAZADO' },
  { id: 'POBLACION_FRONTERA', descripcion: 'POBLACIÓN DE FRONTERA' },
  { id: 'CABEZA_FAMILIA', descripcion: 'CABEZA DE FAMILIA' },
  { id: 'REINSERTADO', descripcion: 'REINSERTADO' },
  { id: 'POBLACION_ROM', descripcion: 'POBLACIÓN ROM' },
  { id: 'NO_APLICA', descripcion: 'NO APLICA' },
];
