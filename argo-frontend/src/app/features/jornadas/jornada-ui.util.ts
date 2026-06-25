/** Cápsulas, etiquetas y mensajes del módulo Jornadas de Capacitación. */

import { esFechaHoy } from './jornada-calendario.util';

export type JorMsgTipo = 'ok' | 'error' | 'info' | 'warn';

export function tituloJorMsg(tipo: JorMsgTipo): string {
  switch (tipo) {
    case 'ok':
      return 'Listo';
    case 'error':
      return 'Acción no completada';
    case 'warn':
      return 'Atención';
    default:
      return 'Información';
  }
}

export function iconoJorMsg(tipo: JorMsgTipo): string {
  switch (tipo) {
    case 'ok':
      return '✓';
    case 'error':
      return '✕';
    case 'warn':
      return '!';
    default:
      return 'i';
  }
}

/** Sufijo de color (calendario, chips sin clase base). */
export function capEstadoJornadaColor(estado?: string | null): string {
  const e = String(estado ?? '').toUpperCase();
  if (e === 'EN PROCESO') return 'cap-emerald';
  if (e === 'FINALIZADO') return 'cap-slate';
  if (e === 'INACTIVO') return 'cap-amber';
  return 'cap-slate';
}

export function capEstadoJornada(estado?: string | null): string {
  return `cap ${capEstadoJornadaColor(estado)}`;
}

export function capEstadoClase(estado?: string | null): string {
  const e = String(estado ?? '').toUpperCase();
  if (e === 'CREADO') return 'cap cap-amber cap-sm cap-text';
  if (e === 'EN PROCESO') return 'cap cap-emerald cap-sm cap-text';
  if (e === 'FINALIZADO') return 'cap cap-slate cap-sm cap-text';
  return 'cap cap-indigo cap-sm cap-text';
}

export function capUbicacionClase(ubicacion?: string | null): string {
  const u = String(ubicacion ?? '').toLowerCase();
  if (u === 'carpa') return 'cap cap-orange cap-sm cap-text';
  if (u === 'domo') return 'cap cap-purple cap-sm cap-text';
  if (u === 'empresa') return 'cap cap-teal cap-sm cap-text';
  if (u === 'colegio' || u === 'auditorio') return 'cap cap-blue cap-sm cap-text';
  return 'cap cap-cyan cap-sm cap-text';
}

export function capDeteGeorefe(v?: string | null): string {
  switch (v) {
    case 'MAPA':
      return 'cap cap-blue cap-sm cap-text';
    case 'DISPOSITIVO_MOVIL':
      return 'cap cap-cyan cap-sm cap-text';
    case 'MANUAL':
      return 'cap cap-violet cap-sm cap-text';
    default:
      return 'cap cap-slate cap-sm cap-text';
  }
}

export function capCodContrato(v?: string | null): string {
  return v?.trim() ? 'cap cap-indigo cap-mono cap-sm' : 'cap cap-slate cap-sm';
}

export function capCliente(_v?: string | null): string {
  return 'cap cap-text cap-sm';
}

export function capMunicipioJor(v?: string | null): string {
  return v?.trim() ? 'cap cap-teal cap-sm cap-text' : 'cap cap-slate cap-sm';
}

/** Municipio y dirección de jornada en una sola línea. */
export function ubicacionJornadaLabel(municipio?: string | null, direccion?: string | null): string {
  const m = String(municipio || '').trim();
  const d = String(direccion || '').trim();
  if (m && d) return `${m} — ${d}`;
  return m || d || '';
}

export function capUbicacionJornada(municipio?: string | null, direccion?: string | null): string {
  return ubicacionJornadaLabel(municipio, direccion) ? 'cap cap-teal cap-sm cap-text' : 'cap cap-slate cap-sm';
}

export function capFechaJor(_v?: string | null): string {
  return 'cap cap-slate cap-sm cap-mono';
}

export function capHoraJor(v?: string | null): string {
  return v && v !== '—' ? 'cap cap-cyan cap-sm cap-mono' : 'cap cap-slate cap-sm';
}

export function capMetaNum(v?: number | null): string {
  if (v == null || Number.isNaN(v)) return 'cap cap-slate cap-sm';
  return 'cap cap-cyan cap-sm cap-mono';
}

export function capSesCert(v?: number | null): string {
  if (v == null) return 'cap cap-slate cap-sm';
  return 'cap cap-violet cap-sm cap-mono';
}

export function capHorasCert(v?: string | number | null): string {
  return v != null && String(v).trim() ? 'cap cap-violet cap-sm' : 'cap cap-slate cap-sm';
}

export function capCertCodigo(_v?: string | null): string {
  return 'cap cap-indigo cap-mono cap-sm';
}

export function capDocAsis(_v?: string | number | null): string {
  return 'cap cap-indigo cap-mono cap-sm';
}

export function capAlumnoNombre(_v?: string | null): string {
  return 'cap cap-text cap-sm';
}

export function capGenerado(v?: boolean): string {
  return v ? 'cap cap-emerald cap-sm cap-text' : 'cap cap-amber cap-sm cap-text';
}

export function etiquetaGenerado(v?: boolean): string {
  return v ? 'Programadas' : 'Pendiente';
}

export function capPrograma(_v?: string | null): string {
  return 'cap cap-blue cap-sm cap-text';
}

const CAP_INSTRUCTOR_PALETTE = [
  'cap-orange',
  'cap-blue',
  'cap-purple',
  'cap-teal',
  'cap-pink',
  'cap-indigo',
  'cap-violet',
  'cap-amber',
  'cap-cyan',
  'cap-emerald',
  'cap-red',
] as const;

function hashCapsuleKey(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (Math.imul(31, h) + key.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Cápsula con color estable por instructor (derivado de id empleado o nombre). */
export function capInstructor(nombre?: string | null, idEmpleado?: number | string | null): string {
  const id = idEmpleado != null && String(idEmpleado).trim() !== '' ? String(idEmpleado) : '';
  const nom = String(nombre ?? '').trim().toLowerCase();
  const key = id ? `emp:${id}` : nom;
  if (!key) return 'cap cap-slate cap-sm';
  const tone = CAP_INSTRUCTOR_PALETTE[hashCapsuleKey(key) % CAP_INSTRUCTOR_PALETTE.length];
  return `cap ${tone} cap-sm cap-text`;
}

export function capContratoLabel(_v?: string | null): string {
  return 'cap cap-indigo cap-sm cap-text';
}

export function esContratoEnEjecucion(estado?: string | null): boolean {
  return String(estado ?? '').trim() !== 'Ejecutado';
}

export function esJornadaEnProceso(estado?: string | null): boolean {
  return String(estado ?? '').trim().toUpperCase() === 'EN PROCESO';
}

export function labelEstadoContrato(estado?: string | null): string {
  return esContratoEnEjecucion(estado) ? 'En Ejecución' : 'Ejecutado';
}

export function estadoContratoLiveClass(estado?: string | null): string {
  return esContratoEnEjecucion(estado) ? 'estado-contrato-live' : 'cap cap-slate cap-sm cap-text';
}

export function rowContratoClass(estado?: string | null): string {
  return esContratoEnEjecucion(estado) ? 'row-contrato-ejecucion' : 'ejecutado';
}

export function estadoJornadaLiveClass(estado?: string | null): string {
  return esJornadaEnProceso(estado) ? 'estado-jornada-live' : capEstadoJornada(estado);
}

/** Calendario mensual: chip compacto por color de estado. */
export function estadoJornadaCalClass(estado?: string | null): string {
  return esJornadaEnProceso(estado) ? 'estado-jornada-live' : capEstadoJornadaColor(estado);
}

export function rowJornadaClass(estado?: string | null): string {
  return esJornadaEnProceso(estado) ? 'row-jornada-proceso' : '';
}

export function estadoClaseLiveClass(estado?: string | null): string {
  const e = String(estado ?? '').trim().toUpperCase();
  if (e === 'EN PROCESO') return 'estado-clase-live estado-clase-proceso';
  if (e === 'CREADO') return 'estado-clase-live estado-clase-creado';
  if (e === 'PROGRAMADA') return 'estado-clase-live estado-clase-programada';
  return capEstadoClase(estado);
}

/** Bloque semanal del calendario de clases (fondo por estado). */
export function estadoClaseCalBlockClass(estado?: string | null): string {
  const e = String(estado ?? '').trim().toUpperCase();
  if (e === 'EN PROCESO') return 'cal-clase-proceso';
  if (e === 'FINALIZADO') return 'cal-clase-finalizada';
  if (e === 'CREADO') return 'cal-clase-creado';
  return 'cal-clase-programada';
}

/** Color de bloque en calendario según tipo de hora/clase. */
export function tipoClaseCalBlockClass(tipo?: string | null): string {
  const t = String(tipo ?? '').trim().toLowerCase();
  if (t === 'taller') return 'cal-tipo-taller';
  if (t === 'practica') return 'cal-tipo-practica';
  return 'cal-tipo-teoria';
}

/** Acento visual por estado (sin cambiar el color base del tipo). */
export function estadoClaseCalAccentClass(estado?: string | null): string {
  const e = String(estado ?? '').trim().toUpperCase();
  if (e === 'EN PROCESO') return 'cal-est-en-proceso';
  if (e === 'FINALIZADO') return 'cal-est-finalizada';
  if (e === 'CANCELADA') return 'cal-est-cancelada';
  if (e === 'CREADO' || e === 'PROGRAMADA') return 'cal-est-pendiente';
  return '';
}

export function claseJornadaEstadoNorm(estado?: string | null): string {
  return String(estado ?? '').trim().toUpperCase();
}

export function claseJornadaEsFinalizada(estado?: string | null): boolean {
  return claseJornadaEstadoNorm(estado) === 'FINALIZADO';
}

/** Las clases finalizadas no se eliminan (historial y certificados). */
export function claseJornadaSePuedeEliminar(estado?: string | null): boolean {
  return !claseJornadaEsFinalizada(estado);
}

export function rowClaseClass(estado?: string | null): string {
  const e = String(estado ?? '').trim().toUpperCase();
  if (e === 'EN PROCESO') return 'row-clase-proceso';
  if (e === 'CREADO') return 'row-clase-creado';
  if (e === 'PROGRAMADA') return 'row-clase-programada';
  return '';
}

export function rowCertificadoHoyClass(fechaEmision?: string | Date | null): string {
  return esFechaHoy(fechaEmision) ? 'row-certificado-hoy' : '';
}

/** Opciones HH:mm cada `intervaloMin` minutos (00:00 … 23:45). */
export function listaOpcionesHora(intervaloMin = 15): string[] {
  const paso = Math.max(1, Math.min(60, Math.floor(intervaloMin)));
  const out: string[] = [];
  for (let m = 0; m < 24 * 60; m += paso) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    out.push(`${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
  }
  return out;
}

/** ISO/fecha → HH:mm para inputs de hora. */
export function isoAHoraInput(iso?: string | Date | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function validarHoraInput(val?: string | null): boolean {
  if (!val || !String(val).trim()) return true;
  return /^([01]?\d|2[0-3]):[0-5]\d$/.test(String(val).trim());
}

/** HH:mm → texto colombiano (ej. 17:10 → "5:10 p. m."). */
export function formatoHoraLegibleCo(hhmm?: string | null): string {
  const m = String(hhmm ?? '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return '';
  let h = Number(m[1]);
  const min = m[2];
  const suf = h >= 12 ? 'p. m.' : 'a. m.';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return min === '00' ? `${h} ${suf}` : `${h}:${min} ${suf}`;
}
