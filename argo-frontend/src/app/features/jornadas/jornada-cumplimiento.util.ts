import { JornadaCapDto } from '../../core/services/jornada-cap.service';

export interface CumplimientoJornadaDto {
  numeroAlumnos?: number;
  numeObjeJornada?: number;
  certificadosContrato?: number;
  cumplidoContrato?: boolean;
  certificadosJornada?: number;
  cumplidoJornada?: boolean;
}

export function textoCumplimientoContrato(j: JornadaCapDto | CumplimientoJornadaDto & { codContrato?: string }): string {
  const cod = String(j.codContrato || 'Contrato').trim() || 'Contrato';
  const cert = j.certificadosContrato ?? 0;
  const meta = j.numeroAlumnos ?? 0;
  if (j.cumplidoContrato) {
    return `Contrato ${cod}: meta cumplida (${cert}/${meta} certificados)`;
  }
  return `Contrato ${cod}: ${cert}/${meta} alumnos certificados`;
}

export function textoCumplimientoJornada(j: JornadaCapDto | CumplimientoJornadaDto): string {
  const cert = j.certificadosJornada ?? 0;
  const meta = j.numeObjeJornada ?? 0;
  if (j.cumplidoJornada) {
    return `Meta jornada cumplida (${cert}/${meta} certificados)`;
  }
  return `Meta jornada: ${cert}/${meta} certificados`;
}

export function parseCumplimiento(raw: Record<string, unknown>): CumplimientoJornadaDto {
  return {
    numeroAlumnos: Number(raw['numeroAlumnos']) || 0,
    numeObjeJornada: Number(raw['numeObjeJornada']) || 0,
    certificadosContrato: Number(raw['certificadosContrato']) || 0,
    cumplidoContrato: !!raw['cumplidoContrato'],
    certificadosJornada: Number(raw['certificadosJornada']) || 0,
    cumplidoJornada: !!raw['cumplidoJornada'],
  };
}
