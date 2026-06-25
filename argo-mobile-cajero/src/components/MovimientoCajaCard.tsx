import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { ScaledText } from './ScaledText';
import { MoneyText } from './MoneyText';
import { SurfaceCard } from './SurfaceCard';
import { useAccessibility } from '../context/AccessibilityContext';
import { themeColors } from '../theme/colors';

export type MovimientoCaja = {
  id: string;
  tipo: 'ingreso' | 'egreso';
  label: string;
  valor: number;
  fecha?: string;
  detalle?: string;
};

function fmtFecha(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function MovimientoCajaCard({ mov }: { mov: MovimientoCaja }) {
  const { highContrast } = useAccessibility();
  const c = themeColors(highContrast);
  const ingreso = mov.tipo === 'ingreso';
  const color = ingreso ? c.ok : c.danger;
  const gradient: [string, string] = ingreso
    ? highContrast
      ? [c.bgAlt, c.card]
      : ['#059669', '#10b981']
    : highContrast
      ? [c.bgAlt, c.card]
      : ['#dc2626', '#ef4444'];

  return (
    <SurfaceCard style={styles.card} elevated={!highContrast}>
      <View style={styles.row}>
        <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.iconWrap}>
          <Ionicons
            name={ingreso ? 'arrow-down' : 'arrow-up'}
            size={20}
            color={highContrast ? color : '#fff'}
          />
        </LinearGradient>

        <View style={styles.main}>
          <View style={styles.titleRow}>
            <View style={[styles.badge, { backgroundColor: ingreso ? c.okBg : c.dangerBg, borderColor: color }]}>
              <ScaledText baseSize={10} style={{ color, fontWeight: '800' }}>
                {ingreso ? 'INGRESO' : 'EGRESO'}
              </ScaledText>
            </View>
            {mov.fecha ? (
              <ScaledText baseSize={11} style={{ color: c.textSoft }}>
                {fmtFecha(mov.fecha)}
              </ScaledText>
            ) : null}
          </View>

          <ScaledText baseSize={15} style={{ color: c.text, fontWeight: '700' }} numberOfLines={2}>
            {mov.label}
          </ScaledText>

          {mov.detalle ? (
            <ScaledText baseSize={12} style={{ color: c.textSoft, marginTop: 2 }} numberOfLines={1}>
              {mov.detalle}
            </ScaledText>
          ) : null}
        </View>

        <MoneyText value={mov.valor} baseSize={16} style={{ color }} bold />
      </View>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  main: { flex: 1, gap: 6, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
});
