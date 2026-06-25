import type { ProgramaDto } from '../services/programa.service';

const NUMERIC_KEYS: (keyof ProgramaDto)[] = [
  'semestres',
  'horas',
  'horasTeoria',
  'horasPractica',
  'horasTaller',
  'valorMatricula',
  'tarifa1',
  'tarifa2',
  'tarifa3',
  'tarifaVirtual',
  'tarifaHoraPractica',
  'diasVencimiento',
  'iva',
];

export function coerceProgramaNumeric<K extends keyof ProgramaDto>(
  key: K,
  value: ProgramaDto[K],
): ProgramaDto[K] {
  if (NUMERIC_KEYS.includes(key)) {
    const n = Number(value);
    return (Number.isFinite(n) ? n : 0) as ProgramaDto[K];
  }
  return value;
}
