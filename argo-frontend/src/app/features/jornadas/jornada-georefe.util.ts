/** Origen de lat/lng — alineado con backend jornadasCap.deteGeorefe */
export type DeteGeorefe = 'MAPA' | 'DISPOSITIVO_MOVIL' | 'MANUAL' | '';

export interface CoordsGeorefEvent {
  lat: number;
  lng: number;
  deteGeorefe: DeteGeorefe;
}

export function etiquetaDeteGeorefe(v?: string | null): string {
  switch (v) {
    case 'MAPA':
      return 'Mapa (clic o arrastre)';
    case 'DISPOSITIVO_MOVIL':
      return 'Dispositivo móvil (GPS)';
    case 'MANUAL':
      return 'Divipola o coordenadas digitadas';
    default:
      return 'Sin georreferenciar';
  }
}
