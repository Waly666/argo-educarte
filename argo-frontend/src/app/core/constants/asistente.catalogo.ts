import { ASISTENTE_ALUMNOS } from './catalogos/asistente-alumnos.catalogo';
import { ASISTENTE_CAJA } from './catalogos/asistente-caja.catalogo';
import { ASISTENTE_ADMIN } from './catalogos/asistente-admin.catalogo';
import { ASISTENTE_OPERACION } from './catalogos/asistente-operacion.catalogo';
import { ASISTENTE_FACTURACION } from './catalogos/asistente-facturacion.catalogo';
import { ASISTENTE_CORE } from './catalogos/asistente-core.catalogo';
import { ASISTENTE_COHORTES } from './catalogos/asistente-cohortes.catalogo';
import { ASISTENTE_SISTEMA } from './catalogos/asistente-sistema.catalogo';
import type { AsistenteContexto } from './asistente.types';

/** Catálogo unificado de ayuda contextual — Mia en toda la aplicación. */
export const ASISTENTE_CATALOGO: Record<string, AsistenteContexto> = {
  ...ASISTENTE_CORE,
  ...ASISTENTE_ALUMNOS,
  ...ASISTENTE_OPERACION,
  ...ASISTENTE_CAJA,
  ...ASISTENTE_ADMIN,
  ...ASISTENTE_FACTURACION,
  ...ASISTENTE_COHORTES,
  ...ASISTENTE_SISTEMA,
};

export function contextoAsistente(id: string | null | undefined): AsistenteContexto | null {
  if (!id) return null;
  return ASISTENTE_CATALOGO[id] ?? null;
}
