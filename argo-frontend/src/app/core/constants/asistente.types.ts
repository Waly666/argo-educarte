export interface AsistenteTip {
  id: string;
  titulo: string;
  cuerpo: string;
}

export type AsistenteModulo =
  | 'inicio'
  | 'dashboard'
  | 'alumnos'
  | 'certificados'
  | 'programas'
  | 'servicios'
  | 'jornadas'
  | 'facturacion'
  | 'instructores'
  | 'programacion_cea'
  | 'cohortes'
  | 'aula_virtual'
  | 'informes'
  | 'sistema'
  | 'caja'
  | 'rrhh'
  | 'vehiculos'
  | 'config'
  | 'general';

export interface AsistenteContexto {
  id: string;
  modulo: AsistenteModulo;
  saludo: string;
  tips: AsistenteTip[];
}

export const ASISTENTE_MODULO_LABELS: Record<AsistenteModulo, string> = {
  inicio: 'Inicio',
  dashboard: 'Dashboard',
  alumnos: 'Alumnos',
  certificados: 'Certificados',
  programas: 'Programas',
  servicios: 'Servicios',
  jornadas: 'Jornadas',
  facturacion: 'Facturación',
  instructores: 'Instructores',
  programacion_cea: 'Programación CEA',
  cohortes: 'Cohortes académicas',
  aula_virtual: 'Aula virtual',
  informes: 'Informes',
  sistema: 'Sistema',
  caja: 'Caja',
  rrhh: 'RRHH',
  vehiculos: 'Vehículos',
  config: 'Configuración',
  general: 'ARGO',
};
