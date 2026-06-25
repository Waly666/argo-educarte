export interface AuthUser {
  _id: string;
  username: string;
  nombres?: string;
  apellidos?: string;
  rol?: string;
  rolNombre?: string;
  permisos?: string[];
  alarmas?: string[];
  permisosRev?: string | null;
  sedes?: { idSede: string; nombre: string; codigo?: string; esPrincipal?: boolean }[];
  sedesPermitidas?: string[];
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

export type StaffLoginStep = 'complete' | 'mfa_verify' | 'mfa_setup';

/** Respuesta real de POST /auth/login (ERP y móvil). */
export interface StaffLoginResponse {
  step: StaffLoginStep;
  token?: string;
  user?: AuthUser;
  mfaToken?: string;
  setupToken?: string;
  username?: string;
  message?: string;
}

export interface ReglaAlerta {
  key: string;
  label: string;
  activo: boolean;
  ventanaInicio: 'desde_registro' | 'desde_inicio_dia';
  duracionMinutos: number;
  intervaloPollSegundos: number;
  antelacionMinutos?: number;
  diasAntelacion?: number;
  diasGracia?: number;
}

export type ComprobanteHoyTipo = 'ingreso' | 'egreso' | 'factura';

export interface ComprobanteRecienteRow {
  tipo: ComprobanteHoyTipo;
  id: string;
  numRecibo?: string | null;
  numeroFactura?: string | null;
  valor: number;
  numDoc?: number | string;
  nombreCompleto?: string;
  alumnoId?: string | null;
}

export interface CajaActivaResponse {
  abierta: boolean;
  sesion?: { idSesion?: number; nombreCaja?: string; saldoTeorico?: number };
}
