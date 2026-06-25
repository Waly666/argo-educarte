import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { ScaledText } from './ScaledText';
import { MoneyText } from './MoneyText';
import { SurfaceCard } from './SurfaceCard';
import type { LiquidacionConSaldoItem } from '../api/domain';
import { inicialesAlumno } from '../utils/format';
import { esLiquidacionVirtual } from '../utils/pago';
import { useAccessibility } from '../context/AccessibilityContext';
import { themeColors } from '../theme/colors';

type Props = {
  item: LiquidacionConSaldoItem;
  onPress?: () => void;
  disabled?: boolean;
};

export function CobroPendienteCard({ item, onPress, disabled }: Props) {
  const { highContrast } = useAccessibility();
  const c = themeColors(highContrast);
  const virtual = esLiquidacionVirtual(item);
  const nombre = item.alumnoNombre?.trim() || `Doc ${item.alumnoDoc ?? item.numDoc}`;
  const doc = String(item.alumnoDoc ?? item.numDoc ?? '').trim();
  const ini = inicialesAlumno({ nombreCompleto: item.alumnoNombre });
  const valor = Number(item.valor) || 0;
  const abonado = Number(item.abonado) || 0;
  const saldo = Number(item.saldo) || 0;
  const pct = valor > 0 ? Math.min(100, Math.round((abonado / valor) * 100)) : 0;
  const parcial = abonado > 0 && saldo > 0;

  const body = (
    <>
      <View style={styles.topRow}>
        <LinearGradient
          colors={virtual ? ['#0891b2', '#06b6d4'] : highContrast ? [c.bgAlt, c.card] : ['#ea580c', '#f97316']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.avatar}
        >
          <ScaledText baseSize={14} style={{ color: highContrast ? c.primary : '#fff', fontWeight: '800' }}>
            {ini || '?'}
          </ScaledText>
        </LinearGradient>

        <View style={styles.main}>
          <View style={styles.titleRow}>
            <ScaledText baseSize={15} style={{ color: c.text, fontWeight: '800', flex: 1 }} numberOfLines={2}>
              {nombre}
            </ScaledText>
            <View style={[styles.saldoPill, { backgroundColor: c.warnBg, borderColor: c.warn }]}>
              <MoneyText value={saldo} baseSize={12} style={{ color: c.warn }} bold />
            </View>
          </View>

          {doc ? (
            <View style={styles.metaLine}>
              <Ionicons name="card-outline" size={13} color={c.textSoft} />
              <ScaledText baseSize={12} style={{ color: c.textSoft, fontWeight: '600' }}>
                Doc. {doc}
              </ScaledText>
            </View>
          ) : null}

          <View style={[styles.servicioRow, { backgroundColor: c.bgAlt, borderColor: c.border }]}>
            <Ionicons name="document-text-outline" size={14} color={c.primary} />
            <ScaledText baseSize={12} style={{ color: c.text, fontWeight: '600', flex: 1 }} numberOfLines={2}>
              {item.descripcion || 'Servicio'}
            </ScaledText>
          </View>

          {valor > 0 ? (
            <View style={styles.progressBlock}>
              <View style={styles.progressLabels}>
                <ScaledText baseSize={11} style={{ color: c.textSoft }}>
                  Abonado {pct}%
                </ScaledText>
                <ScaledText baseSize={11} style={{ color: c.textSoft }}>
                  Total {valor.toLocaleString('es-CO')}
                </ScaledText>
              </View>
              <View style={[styles.progressTrack, { backgroundColor: c.border }]}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${pct}%`,
                      backgroundColor: parcial ? c.primary : c.ok,
                    },
                  ]}
                />
              </View>
            </View>
          ) : null}

          <View style={styles.chipsRow}>
            {virtual ? (
              <View style={[styles.chip, { backgroundColor: '#ecfeff', borderColor: '#a5f3fc' }]}>
                <Ionicons name="laptop-outline" size={12} color="#0e7490" />
                <ScaledText baseSize={10} style={{ color: '#0e7490', fontWeight: '700' }}>
                  VIRTUAL · PAGO TOTAL
                </ScaledText>
              </View>
            ) : parcial ? (
              <View style={[styles.chip, { backgroundColor: c.accentSoft, borderColor: c.border }]}>
                <Ionicons name="pie-chart-outline" size={12} color={c.primary} />
                <ScaledText baseSize={10} style={{ color: c.primary, fontWeight: '700' }}>
                  ABONO PARCIAL
                </ScaledText>
              </View>
            ) : (
              <View style={[styles.chip, { backgroundColor: c.okBg, borderColor: c.ok }]}>
                <Ionicons name="checkmark-circle-outline" size={12} color={c.ok} />
                <ScaledText baseSize={10} style={{ color: c.ok, fontWeight: '700' }}>
                  PENDIENTE DE COBRO
                </ScaledText>
              </View>
            )}
          </View>
        </View>

        {onPress ? (
          <Ionicons name="chevron-forward" size={20} color={c.textSoft} style={{ alignSelf: 'center' }} />
        ) : null}
      </View>
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [{ opacity: disabled ? 0.55 : pressed ? 0.94 : 1 }]}
      >
        <SurfaceCard
          style={{
            ...styles.card,
            ...(virtual ? { borderColor: '#06b6d4', borderWidth: 1.5 } : { borderColor: c.warn, borderWidth: 1 }),
          }}
          elevated={!highContrast}
        >
          {body}
        </SurfaceCard>
      </Pressable>
    );
  }

  return (
    <SurfaceCard style={styles.card} elevated={!highContrast}>
      {body}
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, marginBottom: 12 },
  topRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  main: { flex: 1, gap: 6, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  saldoPill: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  metaLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  servicioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  progressBlock: { gap: 4, marginTop: 2 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  progressTrack: { height: 6, borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
});
