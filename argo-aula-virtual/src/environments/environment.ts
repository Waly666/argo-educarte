/** En LAN usa la misma IP/host del navegador para el socket (puerto 3000). */
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

function socketBase(): string {
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const { hostname, origin } = window.location;
    if (isPrivateIpv4(hostname)) {
      return `http://${hostname}:3000`;
    }
    return origin;
  }
  return 'http://localhost:3000';
}

/** Desarrollo: API por proxy; socket directo al backend en LAN. */
export const environment = {
  production: false,
  forceEducarteSkin: false,
  apiUrl: '/api',
  uploadsUrl: '/uploads',
  socketUrl: socketBase(),
};
