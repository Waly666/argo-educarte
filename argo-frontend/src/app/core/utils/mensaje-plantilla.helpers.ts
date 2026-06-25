/** Sustituye {clave} en plantillas de mensajes configurables */
export function aplicarPlantillaMensaje(
  plantilla: string,
  vars: Record<string, string | number | null | undefined>,
): string {
  let out = String(plantilla || '');
  for (const [k, v] of Object.entries(vars)) {
    const val = v == null ? '' : String(v);
    out = out.replace(new RegExp(`\\{${k}\\}`, 'gi'), val);
  }
  return out.replace(/\n{3,}/g, '\n\n').trim();
}

export function nombreCompletoAlumno(a: {
  nombreCompleto?: string;
  nombre1?: string;
  nombre2?: string;
  apellido1?: string;
  apellido2?: string;
}): string {
  const ap = [a.apellido1, a.apellido2].filter(Boolean).join(' ').trim();
  const n = [a.nombre1, a.nombre2].filter(Boolean).join(' ').trim();
  return [ap, n].filter(Boolean).join(' ').trim() || '—';
}
