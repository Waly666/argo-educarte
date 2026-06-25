import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ScaledText } from './ScaledText';
import { MoneyText } from './MoneyText';
import { SurfaceCard } from './SurfaceCard';
import type { ResumenCaja } from '../api/domain';
import { useAccessibility } from '../context/AccessibilityContext';
import { themeColors } from '../theme/colors';

type Props = {
  resumen: ResumenCaja;
};

function StatTile({
  label,
  value,
  icon,
  color,
  bg,
  c,
}: {
  label: string;
  value: number;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
  c: ReturnType<typeof themeColors>;
}) {
  return (
    <View style={[styles.tile, { backgroundColor: bg, borderColor: c.border }]}>
      <View style={[styles.tileIcon, { backgroundColor: `${color}22` }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <ScaledText baseSize={11} style={{ color: c.textSoft, fontWeight: '600', marginTop: 8 }}>
        {label}
      </ScaledText>
      <MoneyText value={value} baseSize={15} style={{ color, marginTop: 2 }} bold />
    </View>
  );
}

export function CajaResumenPanel({ resumen }: Props) {
  const { highContrast } = useAccessibility();
  const c = themeColors(highContrast);

  return (
    <SurfaceCard style={styles.card} elevated={!highContrast}>
      <View style={styles.header}>
        <Ionicons name="analytics-outline" size={18} color={c.primary} />
        <ScaledText baseSize={16} style={{ color: c.text, fontWeight: '800' }}>
          Resumen del turno
        </ScaledText>
      </View>
      <View style={styles.grid}>
        <StatTile
          label="Ingresos"
          value={resumen.totalIngresos}
          icon="arrow-down-circle-outline"
          color={c.ok}
          bg={highContrast ? c.bgAlt : c.okBg}
          c={c}
        />
        <StatTile
          label="Egresos"
          value={resumen.totalEgresos}
          icon="arrow-up-circle-outline"
          color={c.danger}
          bg={highContrast ? c.bgAlt : c.dangerBg}
          c={c}
        />
        <StatTile
          label="Saldo teórico"
          value={resumen.saldoTeorico}
          icon="calculator-outline"
          color={c.primary}
          bg={highContrast ? c.bgAlt : c.accentSoft}
          c={c}
        />
        <StatTile
          label="Efectivo esperado"
          value={resumen.efectivoEsperado ?? 0}
          icon="cash-outline"
          color={c.accent}
          bg={highContrast ? c.bgAlt : '#ecfeff'}
          c={c}
        />
      </View>
      <View style={[styles.counts, { borderTopColor: c.border }]}>
        <View style={styles.countItem}>
          <Ionicons name="receipt-outline" size={14} color={c.textSoft} />
          <ScaledText baseSize={12} style={{ color: c.textSoft }}>
            {resumen.cantidadIngresos} ingreso{resumen.cantidadIngresos === 1 ? '' : 's'}
          </ScaledText>
        </View>
        <View style={styles.countItem}>
          <Ionicons name="exit-outline" size={14} color={c.textSoft} />
          <ScaledText baseSize={12} style={{ color: c.textSoft }}>
            {resumen.cantidadEgresos} egreso{resumen.cantidadEgresos === 1 ? '' : 's'}
          </ScaledText>
        </View>
      </View>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, marginBottom: 14, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    width: '47%',
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    minWidth: '46%',
  },
  tileIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counts: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  countItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
