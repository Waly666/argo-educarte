import { certificadoHtmlPath } from '../api/certificadosApi';
import { reciboEgresoHtmlPath } from '../api/egresosApi';
import { facturaHtmlPath } from '../api/facturacionApi';
import { reciboIngresoHtmlPath } from '../api/ingresosApi';
import type { ComprobanteHoyTipo } from '../api/types';
import * as alertRuntime from './alertRuntime';

export type AlertaDocumento = {
  title: string;
  htmlPath: string;
};

export type AlertaItem = {
  id: string;
  clave: string;
  titulo: string;
  detalle: string;
  critico?: boolean;
  mostradaAt: number;
  route?: string;
  documento?: AlertaDocumento;
};

type Listener = () => void;

let items: AlertaItem[] = [];
const listeners = new Set<Listener>();
const conocidos = new Set<string>();

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function bump(): void {
  for (const fn of listeners) fn();
}

export function getAlertas(): AlertaItem[] {
  const now = Date.now();
  return items.filter((a) => {
    const ms = alertRuntime.duracionMs(a.clave);
    if (ms <= 0) return true;
    return now - a.mostradaAt < ms;
  });
}

export function dismiss(id: string): void {
  items = items.filter((a) => a.id !== id);
  bump();
}

export function clearAll(): void {
  items = [];
  bump();
}

export function marcarConocido(key: string): void {
  conocidos.add(key);
}

export function marcarConocidos(keys: string[]): void {
  for (const k of keys) conocidos.add(k);
}

/** true si es nueva y debe sonar/vibrar */
export function pushAlerta(
  item: Omit<AlertaItem, 'mostradaAt'> & { mostradaAt?: number },
  opts?: { silencioso?: boolean },
): boolean {
  const id = item.id;
  const esNueva = !conocidos.has(id);
  if (!esNueva && items.some((x) => x.id === id)) return false;

  if (esNueva && !opts?.silencioso) {
    conocidos.add(id);
  } else if (!esNueva) {
    return false;
  }

  const row: AlertaItem = { ...item, mostradaAt: item.mostradaAt ?? Date.now() };
  items = [row, ...items.filter((x) => x.id !== id)].slice(0, 16);
  bump();
  return esNueva && !opts?.silencioso;
}

export function syncCajaCerrada(abierta: boolean, habilitada: boolean): boolean {
  const id = 'caja:cerrada';
  if (!habilitada || abierta) {
    items = items.filter((a) => a.id !== id);
    bump();
    return false;
  }
  return pushAlerta({
    id,
    clave: 'alarmas.caja.cerrada',
    titulo: 'Caja personal cerrada',
    detalle: 'Abra su caja para registrar movimientos.',
    critico: true,
    route: 'Caja',
  });
}

export function syncComprobante(
  row: { tipo?: string; id?: string; valor?: number; nombreCompleto?: string; numRecibo?: string | null; numeroFactura?: string | null },
  habilitada: (t: ComprobanteHoyTipo) => boolean,
): boolean {
  const tipo = String(row.tipo || '') as ComprobanteHoyTipo;
  if (tipo !== 'ingreso' && tipo !== 'egreso' && tipo !== 'factura') return false;
  if (!habilitada(tipo)) return false;
  const clave = alertRuntime.claveComprobante(tipo);
  const id = `${tipo}:${row.id}`;
  const valor = Number(row.valor) || 0;
  const nombre = String(row.nombreCompleto || '').trim();
  const label =
    tipo === 'factura'
      ? `Factura ${row.numeroFactura || ''}`.trim()
      : `${tipo === 'ingreso' ? 'Ingreso' : 'Egreso'} ${row.numRecibo || ''}`.trim();
  const docId = String(row.id || '');
  let documento: AlertaDocumento | undefined;
  if (docId) {
    if (tipo === 'factura') {
      documento = {
        title: label || 'Factura electrónica',
        htmlPath: facturaHtmlPath(docId),
      };
    } else if (tipo === 'ingreso') {
      documento = {
        title: label || 'Recibo de ingreso',
        htmlPath: reciboIngresoHtmlPath(docId),
      };
    } else {
      documento = {
        title: label || 'Recibo de egreso',
        htmlPath: reciboEgresoHtmlPath(docId),
      };
    }
  }
  return pushAlerta({
    id,
    clave,
    titulo: label,
    detalle: `${nombre || 'Movimiento'} — $${valor.toLocaleString('es-CO')}`,
    route: tipo === 'factura' ? 'Facturacion' : 'Caja',
    documento,
  });
}

export function syncCertificadoNuevo(cert: Record<string, unknown>, habilitada: boolean): boolean {
  if (!habilitada) return false;
  const id = String(cert._id || cert.id || '');
  if (!id) return false;
  const nombre = String(cert.nombreCompleto || '').trim();
  const encabezado = String(cert.encabezado || cert.nomCert || cert.programaDescr || '').trim();
  const codigo = String(cert.codigoCert || '').trim();
  const detallePartes = [nombre, encabezado || codigo].filter(Boolean);
  const docTitulo = codigo ? `Certificado ${codigo}` : encabezado ? `Certificado ${encabezado}` : 'Certificado';
  return pushAlerta({
    id: `cert:${id}`,
    clave: 'alarmas.jornadas.certificado_nuevo',
    titulo: 'Certificado emitido',
    detalle: detallePartes.join(' · ') || 'Nuevo certificado',
    route: 'Home',
    documento: {
      title: docTitulo,
      htmlPath: certificadoHtmlPath(id),
    },
  });
}

export function syncCertVencimiento(total: number, habilitada: boolean): boolean {
  const id = 'cert:vencimiento';
  if (!habilitada || total <= 0) {
    items = items.filter((a) => a.id !== id);
    bump();
    return false;
  }
  return pushAlerta({
    id,
    clave: 'alarmas.certificados.vencimiento',
    titulo: 'Certificados por vencer',
    detalle: `${total} certificado(s) próximos a vencer`,
    route: 'Home',
  });
}

export function syncCertVencidos(total: number, habilitada: boolean): boolean {
  const id = 'cert:vencidos';
  if (!habilitada || total <= 0) {
    items = items.filter((a) => a.id !== id);
    bump();
    return false;
  }
  return pushAlerta({
    id,
    clave: 'alarmas.certificados.vencidos',
    titulo: 'Certificados vencidos',
    detalle: `${total} certificado(s) vencidos`,
    critico: true,
    route: 'Home',
  });
}

export function syncDescuadres(count: number, habilitada: boolean): boolean {
  const id = 'caja:descuadres';
  if (!habilitada || count <= 0) {
    items = items.filter((a) => a.id !== id);
    bump();
    return false;
  }
  return pushAlerta({
    id,
    clave: 'alarmas.caja.descuadres',
    titulo: 'Descuadres de caja',
    detalle: `${count} descuadre(s) pendiente(s)`,
    critico: true,
    route: 'Caja',
  });
}
