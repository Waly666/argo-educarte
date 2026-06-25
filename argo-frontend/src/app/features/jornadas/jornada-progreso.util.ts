export interface ProgresoCertResp {
  sesiones: number;
  numSesCert: number;
  cumplio: boolean;
  faltan: number;
  certificado?: { _id?: string; codigoCert?: string } | null;
}

export function etiquetaProgresoCert(p: ProgresoCertResp, nombre?: string): string {
  const pref = nombre?.trim() ? `${nombre.trim()}: ` : '';
  const cod = p.certificado?.codigoCert;
  if (cod) {
    return `${pref}${p.sesiones}/${p.numSesCert} sesiones — certificado emitido (${cod})`;
  }
  if (p.cumplio) {
    return `${pref}${p.sesiones}/${p.numSesCert} sesiones — cumplió el requisito del contrato`;
  }
  return `${pref}${p.sesiones}/${p.numSesCert} sesiones — faltan ${p.faltan} para certificado automático`;
}
