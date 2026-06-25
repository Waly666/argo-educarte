import * as L from 'leaflet';

export interface MapaTilesConfig {
  proveedor?: string;
  hereApiKey?: string;
}

export function crearCapaMapa(cfg: MapaTilesConfig): L.TileLayer {
  const proveedor = String(cfg.proveedor || 'nominatim').toLowerCase();
  const key = String(cfg.hereApiKey || '').trim();

  if (proveedor === 'here' && key) {
    return L.tileLayer(
      `https://maps.hereapi.com/v3/base/mc/{z}/{x}/{y}/png?apiKey=${encodeURIComponent(key)}&style=explore.day&lang=es`,
      {
        attribution: '&copy; HERE',
        maxZoom: 20,
      },
    );
  }

  return L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap',
    maxZoom: 19,
  });
}

export function etiquetaProveedorMapa(cfg: MapaTilesConfig): string {
  const proveedor = String(cfg.proveedor || 'nominatim').toLowerCase();
  const key = String(cfg.hereApiKey || '').trim();
  if (proveedor === 'here' && key) return 'HERE';
  return 'OpenStreetMap';
}
