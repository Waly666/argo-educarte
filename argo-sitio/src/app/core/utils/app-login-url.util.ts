/** IP del VPS de producción (sin dominio). */
export const ARGO_VPS_IP = '72.60.175.120';

/** Puerto del ERP Angular en Docker (argo-frontend). */
export const ARGO_ERP_PORT = 8083;

function isPrivateIpv4(host: string): boolean {
  if (host === 'localhost' || host === '127.0.0.1') return true;
  const parts = host.split('.').map((n) => parseInt(n, 10));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return false;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

/**
 * URL del login del ERP según dónde se abre el sitio:
 * - local / LAN → :4200
 * - VPS por IP pública → http://{IP}:8083/login
 */
export function resolveAppLoginUrl(): string {
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const { hostname } = window.location;
    if (isPrivateIpv4(hostname)) {
      return `http://${hostname === 'localhost' || hostname === '127.0.0.1' ? 'localhost' : hostname}:4200/login`;
    }
    return `http://${hostname}:${ARGO_ERP_PORT}/login`;
  }
  return `http://${ARGO_VPS_IP}:${ARGO_ERP_PORT}/login`;
}
