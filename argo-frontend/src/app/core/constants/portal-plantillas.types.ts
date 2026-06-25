import { PortalDisenoPack } from '../utils/portal-diseno.helpers';
import { PortalTemaConfig } from './portal-site-defaults';

export type PortalPlantillaFamilia =
  | 'cliente'
  | 'azul'
  | 'azul-claro'
  | 'rojo'
  | 'ambar'
  | 'verde'
  | 'violeta'
  | 'neutro';

export const PORTAL_PLANTILLA_FAMILIAS: { id: PortalPlantillaFamilia | 'todos'; label: string }[] = [
  { id: 'todos', label: 'Todas' },
  { id: 'cliente', label: 'Clientes' },
  { id: 'azul', label: 'Azul' },
  { id: 'azul-claro', label: 'Azul claro' },
  { id: 'rojo', label: 'Rojo' },
  { id: 'ambar', label: 'Ámbar' },
  { id: 'verde', label: 'Verde' },
  { id: 'violeta', label: 'Violeta' },
  { id: 'neutro', label: 'Neutro' },
];

export interface PortalPlantilla {
  id: string;
  nombre: string;
  descripcion: string;
  familia: PortalPlantillaFamilia;
  diseno: PortalDisenoPack;
}

export type PortalTemaPreset = Pick<
  PortalTemaConfig,
  | 'colorPrimario'
  | 'colorPrimarioOscuro'
  | 'colorAcento'
  | 'colorFondo'
  | 'colorSuperficie'
  | 'colorTexto'
  | 'colorTextoSecundario'
  | 'fuente'
>;
