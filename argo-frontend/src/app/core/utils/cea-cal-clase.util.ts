import {
  ClaseProgramadaCeaDto,
  labelTipoClaseCea,
} from '../services/programacion-cea.service';
import { horasSesionClase } from './cea-horario.util';

export type UbicacionCalFn = (c: ClaseProgramadaCeaDto) => string;

export function programaLabelCal(c: ClaseProgramadaCeaDto): string {
  return String(c.programaLabel || c.idProg || '').trim();
}

export function horasClaseCal(c: ClaseProgramadaCeaDto): number {
  return horasSesionClase(c.tipoClase, {
    duracionHoras: c.duracionHoras,
    horasDescuento: c.horasDescuento,
  });
}

export function horasClaseCalLabel(c: ClaseProgramadaCeaDto): string {
  const h = horasClaseCal(c);
  return h > 0 ? `${h} h` : '';
}

export function chipClaseCalCorto(c: ClaseProgramadaCeaDto, ubicacion: UbicacionCalFn): string {
  const prog = programaLabelCal(c);
  const tipo = labelTipoClaseCea(c.tipoClase);
  const extra = c.temaNombre || ubicacion(c);
  const parts = [prog, tipo];
  if (extra && extra !== '—') parts.push(extra);
  return parts.filter(Boolean).join(' · ');
}

export function chipClaseCal(c: ClaseProgramadaCeaDto, ubicacion: UbicacionCalFn): string {
  const mid = chipClaseCalCorto(c, ubicacion);
  const horas = horasClaseCalLabel(c);
  const inst = (c.instructorNombre || '').trim();
  const withHoras = horas ? `${mid} · ${horas}` : mid;
  return inst && inst !== '—' ? `${withHoras} · ${inst}` : withHoras;
}
