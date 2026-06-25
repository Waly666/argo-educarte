/** Espejo de argo-aula-virtual/src/app/core/catalogo.helpers.ts */

export function catValor(item: Record<string, unknown>): string {
  const v =
    item['idTipoDoc'] ??
    item['idGenero'] ??
    item['id'] ??
    item['codigo'] ??
    item['_id'];
  return v != null ? String(v) : '';
}

export function catEtiqueta(item: Record<string, unknown>): string {
  const d = item['descripcion'] ?? item['nombre'];
  const v = catValor(item);
  if (d) {
    const s = String(d).trim();
    if (/^\d+\)\s/.test(s)) return s;
    if (v && /^\d+$/.test(v)) return `${v}) ${s}`;
    return s;
  }
  return v;
}

export function etiquetaGenero(item: Record<string, unknown>): string {
  const v = catValor(item).toUpperCase();
  if (v === 'M') return 'Masculino (M)';
  if (v === 'F') return 'Femenino (F)';
  return catEtiqueta(item);
}

export const TIPOS_DOC_FALLBACK: Record<string, unknown>[] = [
  { idTipoDoc: '1', descripcion: '1) CEDULA DE CIUDADANÍA' },
  { idTipoDoc: '2', descripcion: '2) TARJETA DE IDENTIDAD' },
  { idTipoDoc: '3', descripcion: '3) REGISTRO CIVIL' },
  { idTipoDoc: '4', descripcion: '4) CEDULA DE EXTRANJERIA' },
  { idTipoDoc: '5', descripcion: '5) PASAPORTE' },
  { idTipoDoc: '6', descripcion: '6) NUMERO DE IDENTIFICACION TRIBUTARIA' },
];

export const GENEROS_FALLBACK: Record<string, unknown>[] = [
  { idGenero: 'M', descripcion: 'M' },
  { idGenero: 'F', descripcion: 'F' },
];
