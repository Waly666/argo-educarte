import {
  fetchCajaActiva,
  fetchCertificadosPorVencer,
  fetchCertificadosRecientes,
  fetchCertificadosVencidos,
  fetchComprobantesRecientes,
  fetchConfigAlertas,
  fetchDescuadresCaja,
} from '../api/client';
import type { AuthUser, ComprobanteHoyTipo } from '../api/types';
import { alarmaPermitidaEnMovil, tieneAlarma, tienePermiso } from '../utils/permisos';
import * as alertRuntime from './alertRuntime';
import { playAlertFeedback } from './alertSound';
import * as alertStore from './alertStore';

type PollCtx = {
  user: AuthUser;
  sound: boolean;
  vibration: boolean;
};

let timer: ReturnType<typeof setInterval> | null = null;
let ctx: PollCtx | null = null;
let pollInicial = true;

function habilitada(key: string): boolean {
  if (!ctx) return false;
  if (!alarmaPermitidaEnMovil(key)) return false;
  if (!tieneAlarma(ctx.user.alarmas, key, ctx.user.rol)) return false;
  if (!alertRuntime.activaGlobal(key)) return false;
  return true;
}

function habilitadaComprobante(tipo: ComprobanteHoyTipo): boolean {
  return habilitada(alertRuntime.claveComprobante(tipo));
}

async function notificarSiNueva(nueva: boolean, critico?: boolean): Promise<void> {
  if (!nueva || !ctx) return;
  await playAlertFeedback({
    sound: ctx.sound,
    vibration: ctx.vibration,
    critico,
  });
}

async function pollOnce(): Promise<void> {
  if (!ctx) return;

  if (tienePermiso(ctx.user.permisos, 'caja.turno', ctx.user.rol) && habilitada('alarmas.caja.cerrada')) {
    try {
      const caja = await fetchCajaActiva();
      const n = alertStore.syncCajaCerrada(!!caja.abierta, true);
      await notificarSiNueva(n, true);
    } catch {
      /* sin permiso o red */
    }
  }

  if (tienePermiso(ctx.user.permisos, 'caja.admin', ctx.user.rol) && habilitada('alarmas.caja.descuadres')) {
    try {
      const rows = await fetchDescuadresCaja();
      const n = alertStore.syncDescuadres(Array.isArray(rows) ? rows.length : 0, true);
      await notificarSiNueva(n, true);
    } catch {
      /* ignore */
    }
  }

  const puedeComp =
    habilitadaComprobante('ingreso') ||
    habilitadaComprobante('egreso') ||
    habilitadaComprobante('factura');
  if (puedeComp) {
    const inicioHoy = new Date();
    inicioHoy.setHours(0, 0, 0, 0);
    const desde = inicioHoy.toISOString();
    try {
      const rows = await fetchComprobantesRecientes(desde);
      for (const row of rows || []) {
        const clave = alertRuntime.claveComprobante(String(row.tipo));
        const id = `${row.tipo}:${row.id}`;
        if (pollInicial && !alertRuntime.ventanaInicioDia(clave)) {
          alertStore.marcarConocido(id);
          continue;
        }
        const n = alertStore.syncComprobante(row, habilitadaComprobante);
        await notificarSiNueva(n);
      }
    } catch {
      /* ignore */
    }
  }

  if (habilitada('alarmas.jornadas.certificado_nuevo')) {
    const desde = new Date(Date.now() - 60 * 60_000).toISOString();
    try {
      const rows = await fetchCertificadosRecientes(desde);
      for (const c of rows || []) {
        const n = alertStore.syncCertificadoNuevo(c, true);
        await notificarSiNueva(n);
      }
    } catch {
      /* ignore */
    }
  }

  if (habilitada('alarmas.certificados.vencimiento')) {
    const dias = alertRuntime.regla('alarmas.certificados.vencimiento').diasAntelacion || 15;
    try {
      const data = await fetchCertificadosPorVencer(dias);
      const total = Number((data as { total?: number })?.total ?? (data as { items?: unknown[] })?.items?.length ?? 0);
      const n = alertStore.syncCertVencimiento(total, true);
      await notificarSiNueva(n);
    } catch {
      /* ignore */
    }
  }

  if (habilitada('alarmas.certificados.vencidos')) {
    const dias = alertRuntime.regla('alarmas.certificados.vencidos').diasGracia || 3;
    try {
      const data = await fetchCertificadosVencidos(dias);
      const total = Number((data as { total?: number })?.total ?? (data as { items?: unknown[] })?.items?.length ?? 0);
      const n = alertStore.syncCertVencidos(total, true);
      await notificarSiNueva(n, true);
    } catch {
      /* ignore */
    }
  }
}

const POLL_KEYS = [
  'alarmas.caja.cerrada',
  'alarmas.caja.descuadres',
  'alarmas.alumnos.comprobante_ingreso',
  'alarmas.alumnos.comprobante_egreso',
  'alarmas.alumnos.factura',
  'alarmas.jornadas.certificado_nuevo',
  'alarmas.certificados.vencimiento',
  'alarmas.certificados.vencidos',
  'alarmas.jornadas.en_proceso',
  'alarmas.empleados.docs_vencidos',
  'alarmas.empleados.docs_faltantes',
];

export async function startAlertPoller(c: PollCtx): Promise<void> {
  stopAlertPoller();
  ctx = c;
  try {
    const cfg = await fetchConfigAlertas();
    alertRuntime.aplicarReglasAlertas(cfg.reglas || []);
  } catch {
    alertRuntime.aplicarReglasAlertas([]);
  }
  await pollOnce();
  pollInicial = false;
  const ms = alertRuntime.pollIntervalMs(POLL_KEYS, habilitada);
  timer = setInterval(() => {
    void pollOnce();
  }, ms);
}

export function stopAlertPoller(): void {
  if (timer) clearInterval(timer);
  timer = null;
  ctx = null;
  pollInicial = true;
  alertStore.clearAll();
}

export function refreshPollInterval(): void {
  if (!timer || !ctx) return;
  clearInterval(timer);
  const ms = alertRuntime.pollIntervalMs(POLL_KEYS, habilitada);
  timer = setInterval(() => {
    void pollOnce();
  }, ms);
}
