const VPS_IP = '72.60.175.120';
const API_PORT = 5002;

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

function serverBase(): string {
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const { hostname, origin } = window.location;
    if (isPrivateIpv4(hostname)) {
      return `http://${hostname}:3000`;
    }
    return origin;
  }
  return `http://${VPS_IP}:8083`;
}

const base = serverBase();

export const environment = {
  production: true,
  apiUrl: `${base}/api`,
  uploadsUrl: `${base}/uploads`,
};
