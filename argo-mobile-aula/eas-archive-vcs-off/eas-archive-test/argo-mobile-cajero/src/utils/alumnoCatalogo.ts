import type { CatalogoItem } from '../api/domain';

export const TIPOS_ALUMNO = ['Regular', 'Jornadas de Capacitación', 'Virtual'] as const;
export const TIPO_ALUMNO_DEFAULT = 'Regular';

export const TIPOS_DOC_DEF: CatalogoItem[] = [
  { idTipoDoc: '1', descripcion: '1) CEDULA DE CIUDADANÍA' },
  { idTipoDoc: '2', descripcion: '2) TARJETA DE IDENTIDAD' },
  { idTipoDoc: '3', descripcion: '3) REGISTRO CIVIL' },
  { idTipoDoc: '4', descripcion: '4) CEDULA DE EXTRANJERIA' },
  { idTipoDoc: '5', descripcion: '5) PASAPORTE' },
  { idTipoDoc: '6', descripcion: '6) NUMERO DE IDENTIFICACION TRIBUTARIA' },
];

export const GENEROS_DEF: CatalogoItem[] = [
  { idGenero: 'M', descripcion: 'M' },
  { idGenero: 'F', descripcion: 'F' },
];

export const TIPO_SANGRE_DEF: CatalogoItem[] = [
  { id: 'A+', descripcion: 'A+' },
  { id: 'A-', descripcion: 'A-' },
  { id: 'B+', descripcion: 'B+' },
  { id: 'B-', descripcion: 'B-' },
  { id: 'AB+', descripcion: 'AB+' },
  { id: 'AB-', descripcion: 'AB-' },
  { id: 'O+', descripcion: 'O+' },
  { id: 'O-', descripcion: 'O-' },
];

export const JORNADAS_DEF: CatalogoItem[] = [
  { idJornada: '1', descripcion: '1) DIURNA' },
  { idJornada: '2', descripcion: '2) NOCTURNA' },
  { idJornada: '3', descripcion: '3) FIN DE SEMANA' },
];

export const ESTADOS_CIVIL_DEF: CatalogoItem[] = [
  { idEstadoCivil: '1', descripcion: '1) SOLTERO' },
  { idEstadoCivil: '2', descripcion: '2) CASADO' },
  { idEstadoCivil: '3', descripcion: '3) UNIÓN LIBRE' },
  { idEstadoCivil: '4', descripcion: '4) SEPARADO' },
  { idEstadoCivil: '5', descripcion: '5) VIUDO' },
  { idEstadoCivil: '6', descripcion: '6) DIVORCIADO' },
  { idEstadoCivil: '7', descripcion: '7) SIN INFORMACIÓN' },
];

export const ESTRATOS_DEF: CatalogoItem[] = [
  { idEstrato: '1', descripcion: '1) 1' },
  { idEstrato: '2', descripcion: '2) 2' },
  { idEstrato: '3', descripcion: '3) 3' },
  { idEstrato: '4', descripcion: '4) 4' },
  { idEstrato: '5', descripcion: '5) 5' },
  { idEstrato: '6', descripcion: '6) 6' },
  { idEstrato: '99', descripcion: '7) 99' },
];

export const REGIMEN_SALUD_DEF: CatalogoItem[] = [
  { idRegimen: '1', descripcion: '1) CONTRIBUTIVO' },
  { idRegimen: '2', descripcion: '2) SUBSIDIADO' },
  { idRegimen: '3', descripcion: '3) ESPECIAL' },
  { idRegimen: '4', descripcion: '4) NO AFILIADO' },
];

export const NIVEL_FORMACION_DEF: CatalogoItem[] = [
  { idNivel: '1', descripcion: '1) PREESCOLAR' },
  { idNivel: '2', descripcion: '2) BÁSICA PRIMARIA' },
  { idNivel: '3', descripcion: '3) BÁSICA SECUNDARIA' },
  { idNivel: '4', descripcion: '4) MEDIA' },
  { idNivel: '5', descripcion: '5) PREGRADO' },
  { idNivel: '6', descripcion: '6) POSTGRADO' },
  { idNivel: '7', descripcion: '7) SIN ESTUDIOS' },
  { idNivel: '8', descripcion: '8) TÉCNICO LABORAL' },
];

export const OCUPACIONES_DEF: CatalogoItem[] = [
  { idOcupacion: '1', descripcion: '1) EMPLEADO' },
  { idOcupacion: '2', descripcion: '2) ESTUDIANTE. BÁSICA / MEDIA' },
  { idOcupacion: '3', descripcion: '3) ESTUDIANTE SUPERIOR' },
  { idOcupacion: '4', descripcion: '4) DESEMPLEADO' },
  { idOcupacion: '5', descripcion: '5) INDEPENDIENTE' },
];

export const DISCAPACIDADES_DEF: CatalogoItem[] = [
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

export const MULTICULTURALIDAD_DEF: CatalogoItem[] = [
  { id: 'INDIGENA', descripcion: 'INDIGENA' },
  { id: 'AFRODESCENDIENTE', descripcion: 'AFRODESCENDIENTE' },
  { id: 'DESPLAZADO', descripcion: 'DESPLAZADO' },
  { id: 'POBLACION_FRONTERA', descripcion: 'POBLACIÓN DE FRONTERA' },
  { id: 'CABEZA_FAMILIA', descripcion: 'CABEZA DE FAMILIA' },
  { id: 'REINSERTADO', descripcion: 'REINSERTADO' },
  { id: 'POBLACION_ROM', descripcion: 'POBLACIÓN ROM' },
  { id: 'NO_APLICA', descripcion: 'NO APLICA' },
];

export type CatalogoOption = { value: string; label: string };

export function catValor(item: CatalogoItem): string {
  const r = item as Record<string, unknown>;
  const v =
    r.idTipoDoc ??
    r.idRegimen ??
    r.idJornada ??
    r.idEstrato ??
    r.idNivel ??
    r.idOcupacion ??
    r.idDiscapacidad ??
    r.idEstadoCivil ??
    r.idGenero ??
    r.id ??
    r.codigo ??
    r._id;
  return v != null ? String(v) : '';
}

export function catEtiqueta(item: CatalogoItem): string {
  const d = item.descripcion ?? item.nombre;
  const v = catValor(item);
  if (d) {
    const s = String(d).trim();
    if (/^\d+\)\s/.test(s)) return s;
    if (v && /^\d+$/.test(v)) return `${v}) ${s}`;
    return s;
  }
  return v;
}

export function mapCatalogoOpciones(items: CatalogoItem[]): CatalogoOption[] {
  return items.map((item) => ({ value: catValor(item), label: catEtiqueta(item) }));
}

export function etiquetaCatalogo(items: CatalogoItem[], valor?: string | null): string {
  const v = String(valor ?? '').trim();
  if (!v) return '';
  const hit = items.find((i) => catValor(i) === v || String(i.codigo ?? '') === v);
  return hit ? catEtiqueta(hit) : v;
}

export function normalizarEnum(val?: string): string {
  if (!val) return '';
  const m = String(val).match(/^(\d+)/);
  return m ? m[1] : String(val).trim();
}

export function normalizarGenero(val?: string): string {
  const t = String(val || '').toUpperCase().trim();
  if (t === 'M' || t.startsWith('MASC')) return 'M';
  if (t === 'F' || t.startsWith('FEM')) return 'F';
  return t === 'M' || t === 'F' ? t : '';
}

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

export function normalizarTipoAlumno(val?: string | null): string {
  const t = String(val ?? '').trim();
  if (!t) return TIPO_ALUMNO_DEFAULT;
  const exact = TIPOS_ALUMNO.find((x) => x.toLowerCase() === t.toLowerCase());
  if (exact) return exact;
  if (/jornadas?\s*de\s*capacitaci[oó]n/i.test(t)) return 'Jornadas de Capacitación';
  if (/^virtual$/i.test(t) || /aula\s*virtual/i.test(t)) return 'Virtual';
  return TIPO_ALUMNO_DEFAULT;
}

export function catalogoConFallback(api: CatalogoItem[], fallback: CatalogoItem[]): CatalogoItem[] {
  if (!api?.length) return fallback;
  return api.map((item) => {
    const valor = catValor(item);
    const fb = fallback.find((f) => catValor(f) === valor);
    return fb ? { ...item, descripcion: catEtiqueta(fb) } : item;
  });
}
