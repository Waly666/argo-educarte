import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { ScaledText } from './ScaledText';
import { useTheme } from '../context/ThemeContext';
import { radius, space } from '../theme/spacing';

type Props = {
  pct: number;
  label?: string;
  height?: number;
  showPct?: boolean;
};

export function ProgressBar({ pct, label, height = 8, showPct = true }: Props) {
  const c = useTheme();
  const v = Math.min(100, Math.max(0, pct));

  return (
    <View>
      {label || showPct ? (
        <View style={styles.top}>
          {label ? (
            <ScaledText baseSize={12} style={{ color: c.textSoft, fontWeight: '600' }}>
              {label}
            </ScaledText>
          ) : (
            <View />
          )}
          {showPct ? (
            <ScaledText baseSize={12} style={{ color: c.violet, fontWeight: '700' }}>
              {Math.round(v)}%
            </ScaledText>
          ) : null}
        </View>
      ) : null}
      <View style={[styles.track, { height, backgroundColor: c.borderLight }]}>
        <LinearGradient
          colors={c.gradientSky}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[styles.fill, { width: `${v}%`, height, borderRadius: radius.pill }]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: space.xs,
  },
  track: { borderRadius: radius.pill, overflow: 'hidden' },
  fill: {},
});
