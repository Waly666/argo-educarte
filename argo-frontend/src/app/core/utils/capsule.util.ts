/** Clases CSS de cápsulas de color (ver styles.scss). */

export function capEstado(estado?: string | null): string {
  const e = String(estado ?? '').toUpperCase();
  if (e === 'ACTIVO') return 'cap cap-emerald';
  if (e === 'INACTIVO') return 'cap cap-red';
  return 'cap cap-slate';
}

export function capEstadoVehiculo(estado?: string | null): string {
  if (/ocupado/i.test(String(estado ?? ''))) return 'cap cap-orange';
  return 'cap cap-emerald';
}

export function capPlaca(_placa?: string | null, tipoServicio?: string | null): string {
  const base = 'cap cap-placa';
  if (String(tipoServicio ?? '').toUpperCase() === 'PARTICULAR') {
    return `${base} cap-placa-amarilla`;
  }
  return `${base} cap-placa-blanca`;
}

export function capTipoServicioVehi(v?: string | null): string {
  const t = String(v ?? '').toUpperCase();
  if (t === 'PUBLICO') return 'cap cap-blue';
  if (t === 'PARTICULAR') return 'cap cap-emerald';
  if (t === 'OFICIAL') return 'cap cap-indigo';
  if (t === 'DIPLOMATICO') return 'cap cap-purple';
  return 'cap cap-slate';
}

export function capMarcaVehi(v?: string | null): string {
  if (!String(v ?? '').trim()) return 'cap cap-slate cap-sm cap-text';
  return 'cap cap-indigo cap-sm cap-text';
}

export function capLineaVehi(v?: string | null): string {
  if (!String(v ?? '').trim()) return 'cap cap-slate cap-sm cap-text';
  return 'cap cap-teal cap-sm cap-text';
}

export function capModeloVehi(v?: string | null): string {
  if (!String(v ?? '').trim()) return 'cap cap-slate cap-sm cap-text';
  return 'cap cap-amber cap-sm cap-mono';
}

export function capClaseVehi(v?: string | null): string {
  const t = String(v ?? '').toUpperCase();
  if (!t) return 'cap cap-slate cap-sm cap-text';
  if (/MOTOCICL|MOTOCARRO|MOTOTRIC|CUATRIM|BICICLETA/.test(t)) return 'cap cap-pink cap-sm cap-text';
  if (/CAMION|TRACTO|REMOLQUE|SEMIREMOLQUE|BUS|BUSETA|MICROBUS/.test(t)) return 'cap cap-orange cap-sm cap-text';
  if (/AUTOMOVIL|CAMPERO|CAMIONETA/.test(t)) return 'cap cap-blue cap-sm cap-text';
  if (/MAQ\.|INDUSTRIAL|AGRICOLA/.test(t)) return 'cap cap-violet cap-sm cap-text';
  return 'cap cap-cyan cap-sm cap-text';
}

export function capColorVehi(v?: string | null): string {
  const t = String(v ?? '').toLowerCase();
  if (!t) return 'cap cap-slate cap-sm cap-text';
  if (/azul|blue/.test(t)) return 'cap cap-blue cap-sm cap-text';
  if (/rojo|burgund|vino|coral/.test(t)) return 'cap cap-red cap-sm cap-text';
  if (/verde|green/.test(t)) return 'cap cap-emerald cap-sm cap-text';
  if (/amar|gold|dorad|beige|crema/.test(t)) return 'cap cap-amber cap-sm cap-text';
  if (/negro|black|gris|plata|plate|silver|plomo|blanc|white|perla/.test(t)) return 'cap cap-slate cap-sm cap-text';
  if (/naran|orange/.test(t)) return 'cap cap-orange cap-sm cap-text';
  if (/violet|morad|purp|lila/.test(t)) return 'cap cap-violet cap-sm cap-text';
  if (/ros|pink|fucs/.test(t)) return 'cap cap-pink cap-sm cap-text';
  if (/caf|marron|bronc|marr/.test(t)) return 'cap cap-orange cap-sm cap-text';
  return 'cap cap-cyan cap-sm cap-text';
}

export function capTipoServ(tipo?: string | number | null): string {
  const t = String(tipo ?? '').toUpperCase();
  const map: Record<string, string> = {
    CUR: 'cap cap-blue',
    DIP: 'cap cap-purple',
    TEC: 'cap cap-orange',
    SEG: 'cap cap-pink',
    CEA: 'cap cap-teal',
    CRC: 'cap cap-indigo',
    ASE: 'cap cap-violet',
    TRM: 'cap cap-amber',
    DET: 'cap cap-red',
    RUNT: 'cap cap-cyan',
    FNSV: 'cap cap-emerald',
  };
  return map[t] || 'cap cap-slate';
}

export function capTipoCapLabel(label?: string): string {
  const l = String(label ?? '').toLowerCase();
  if (/diplomado/.test(l)) return 'cap cap-purple';
  if (/tecnico|competenc/.test(l)) return 'cap cap-orange';
  if (/curso|no formal/.test(l)) return 'cap cap-blue';
  if (/licencia|conduccion/.test(l)) return 'cap cap-teal';
  return 'cap cap-indigo';
}

export function capCodigo(_cod?: string | number | null): string {
  return 'cap cap-indigo';
}

export function capMoneda(_v?: number | null): string {
  return 'cap cap-emerald';
}

export function capHoras(v?: number | null): string {
  if (v == null || v === 0) return 'cap cap-slate';
  if (Number(v) >= 100) return 'cap cap-violet';
  return 'cap cap-cyan';
}

export function capId(_v?: string | number | null): string {
  return 'cap cap-slate cap-mono';
}

export function capVinculo(esPrograma: boolean): string {
  return esPrograma ? 'cap cap-blue' : 'cap cap-teal';
}

export function capRol(rol?: string | null): string {
  const r = String(rol ?? '').toLowerCase();
  if (r.includes('admin')) return 'cap cap-purple';
  if (r.includes('caj')) return 'cap cap-emerald';
  if (r.includes('rec')) return 'cap cap-cyan';
  if (r.includes('inst')) return 'cap cap-orange';
  return 'cap cap-slate';
}

export function capDoc(_v?: string | number | null): string {
  return 'cap cap-indigo cap-mono';
}

export function capTipoDoc(_v?: string | null): string {
  return 'cap cap-slate cap-sm';
}

export function capCelular(_v?: string | null): string {
  return 'cap cap-cyan cap-sm';
}

export function capMunicipio(_v?: string | null): string {
  return _v ? 'cap cap-teal' : 'cap cap-slate cap-sm';
}

export function capEstrato(v?: string | null): string {
  const n = String(v ?? '').trim();
  if (!n) return 'cap cap-slate cap-sm';
  const e = parseInt(n, 10);
  if (e <= 2) return 'cap cap-amber cap-sm';
  if (e <= 4) return 'cap cap-blue cap-sm';
  return 'cap cap-emerald cap-sm';
}

export function capExpedida(_v?: string | null): string {
  return 'cap cap-violet cap-sm';
}

export function capGenero(_v?: string | null): string {
  return 'cap cap-pink cap-sm';
}

export function capSangre(_v?: string | null): string {
  return 'cap cap-red cap-sm';
}

export function capJornada(_v?: string | null): string {
  return 'cap cap-orange cap-sm';
}

export function capEstadoCivil(_v?: string | null): string {
  return 'cap cap-violet cap-sm';
}

export function capFecha(_v?: string | null): string {
  return 'cap cap-slate cap-sm cap-mono';
}

/** Texto legible sin forzar mayúsculas (conceptos, nombres en caja). */
export function capTexto(_v?: string | null): string {
  return 'cap cap-text cap-sm';
}

export function capFormaPago(label?: string | null): string {
  const t = String(label ?? '').toLowerCase();
  if (!t || t === '—') return 'cap cap-slate cap-sm cap-text';
  if (t.includes('efect')) return 'cap cap-emerald cap-text';
  if (t.includes('nequi') || t.includes('davi')) return 'cap cap-pink cap-text';
  if (t.includes('transf')) return 'cap cap-blue cap-text';
  if (t.includes('tarj') || t.includes('créd') || t.includes('cred')) return 'cap cap-purple cap-text';
  if (t.includes('cheq')) return 'cap cap-amber cap-text';
  return 'cap cap-cyan cap-text';
}

export function capTipoEgreso(descr?: string | null): string {
  const t = String(descr ?? '').toLowerCase();
  if (!t || t === '—') return 'cap cap-slate cap-sm cap-text';
  if (t.includes('retiro')) return 'cap cap-amber cap-text';
  if (/pr[eé]st|adelant|anticip/.test(t)) return 'cap cap-orange cap-text';
  if (/n[oó]min/.test(t)) return 'cap cap-violet cap-text';
  if (/gast|compr|serv|proveed/.test(t)) return 'cap cap-red cap-text';
  return 'cap cap-indigo cap-text';
}

export function capRecibo(v?: string | null): string {
  if (!v || v === '—') return 'cap cap-slate cap-sm cap-mono';
  return 'cap cap-indigo cap-mono cap-sm';
}

export function capTipoAbono(tipo?: string | null, descr?: string | null): string {
  const t = String(tipo ?? descr ?? '').toLowerCase();
  if (t.includes('total')) return 'cap cap-emerald cap-sm';
  if (t.includes('abono')) return 'cap cap-amber cap-sm';
  return 'cap cap-slate cap-sm';
}

export function capConceptoCaja(v?: string | null): string {
  if (!v || v === '—') return 'cap cap-slate cap-sm cap-text';
  return 'cap cap-blue cap-sm cap-text';
}

export function capBeneficiario(v?: string | null): string {
  if (!v || v === '—') return 'cap cap-slate cap-sm cap-text';
  return 'cap cap-violet cap-sm cap-text';
}

export function capCuentaBancaria(v?: string | null): string {
  if (!v || v === '—') return 'cap cap-slate cap-sm cap-text';
  return 'cap cap-teal cap-sm cap-text';
}

export function capValorIngreso(): string {
  return 'cap cap-emerald cap-money';
}

export function capValorEgreso(): string {
  return 'cap cap-red cap-money';
}

export function capTipoIngreso(descr?: string | null): string {
  const t = String(descr ?? '').toUpperCase();
  if (!t || t === '—') return 'cap cap-slate cap-sm cap-text';
  if (t.includes('CURSO')) return 'cap cap-blue cap-text';
  if (t.includes('DIPLOM')) return 'cap cap-purple cap-text';
  if (t.includes('TECNIC')) return 'cap cap-orange cap-text';
  if (t.includes('SEGURO')) return 'cap cap-pink cap-text';
  if (t.includes('CEA')) return 'cap cap-teal cap-text';
  if (t.includes('CRC')) return 'cap cap-indigo cap-text';
  if (t.includes('ASESOR')) return 'cap cap-violet cap-text';
  if (t.includes('TRAMIT')) return 'cap cap-amber cap-text';
  if (t.includes('TRANSITO')) return 'cap cap-red cap-text';
  if (t.includes('RUNT')) return 'cap cap-cyan cap-text';
  if (t.includes('FNSV')) return 'cap cap-emerald cap-text';
  if (t.includes('CONTRATO')) return 'cap cap-purple cap-text';
  if (t.includes('APROVISION')) return 'cap cap-amber cap-text';
  if (t.includes('OTROS')) return 'cap cap-indigo cap-text';
  return 'cap cap-teal cap-sm cap-text';
}

export function capRefComprobante(_v?: string | null): string {
  return 'cap cap-slate cap-sm cap-mono cap-text';
}
