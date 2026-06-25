/** Valores de catTipServicio.claseServ — espejo de argo-backend/src/constants/claseServicio.js */
export const CLASES_SERVICIO = ['Educativo', 'Consultoria', 'Asistencia Tecnica', 'Otro'] as const;

export type ClaseServicio = (typeof CLASES_SERVICIO)[number];

export const CLASE_SERV_DEFAULT: ClaseServicio = 'Otro';
