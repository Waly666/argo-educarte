import type { AsistenteTip } from '../constants/asistente.types';

/** Tip de contexto para mostrar primero en Mia al abrir un formulario. */
export function tipFormulario(titulo: string, cuerpo: string, id = 'form-ctx'): AsistenteTip {
  return { id, titulo, cuerpo: cuerpo.trim() };
}
