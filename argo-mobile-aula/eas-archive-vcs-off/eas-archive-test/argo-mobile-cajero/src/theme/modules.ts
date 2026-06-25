import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';

import type { RootStackParamList } from '../navigation/types';

export type IonName = ComponentProps<typeof Ionicons>['name'];

export type ModuleMeta = {
  key: keyof RootStackParamList;
  label: string;
  icon: IonName;
  color: string;
  tint: string;
  permiso?: string | string[];
};

export const APP_MODULES: ModuleMeta[] = [
  {
    key: 'Caja',
    label: 'Caja',
    icon: 'cash-outline',
    color: '#059669',
    tint: '#ecfdf5',
    permiso: ['caja.turno', 'caja.cobros', 'caja.admin'],
  },
  {
    key: 'Alumnos',
    label: 'Alumnos',
    icon: 'school-outline',
    color: '#2563eb',
    tint: '#eff6ff',
    permiso: ['alumnos.ver', 'alumnos.gestionar'],
  },
  {
    key: 'Certificados',
    label: 'Certificados',
    icon: 'ribbon-outline',
    color: '#0d9488',
    tint: '#ecfdf5',
    permiso: 'alumnos.certificados',
  },
  {
    key: 'Facturacion',
    label: 'Facturación',
    icon: 'receipt-outline',
    color: '#d97706',
    tint: '#fffbeb',
    permiso: 'facturacion',
  },
  {
    key: 'Programas',
    label: 'Programas',
    icon: 'library-outline',
    color: '#7c3aed',
    tint: '#f5f3ff',
    permiso: ['programas.ver', 'programas.gestionar', 'programas.agregar'],
  },
  {
    key: 'Servicios',
    label: 'Servicios',
    icon: 'construct-outline',
    color: '#db2777',
    tint: '#fdf2f8',
    permiso: ['servicios.ver', 'servicios.gestionar'],
  },
  {
    key: 'Ajustes',
    label: 'Lectura y alertas',
    icon: 'accessibility-outline',
    color: '#475569',
    tint: '#f1f5f9',
  },
];

export function moduleMeta(name: keyof RootStackParamList): ModuleMeta | undefined {
  return APP_MODULES.find((m) => m.key === name);
}
