import React, { useMemo } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../context/ThemeContext';
import { radius, space } from '../theme/spacing';

type Props = {
  children?: React.ReactNode;
  minHeight?: number;
  style?: ViewStyle;
  roundedBottom?: boolean;
  /** Si false, no suma safe-area (p. ej. cuando hay InstBar arriba). */
  includeSafeTop?: boolean;
};

/** Hero Educarte — gradiente índigo oscuro con brillo suave. */
export function StarfieldHero({
  children,
  minHeight = 220,
  style,
  roundedBottom = true,
  includeSafeTop = true,
}: Props) {
  const c = useTheme();
  const insets = useSafeAreaInsets();

  const stars = useMemo(
    () =>
      Array.from({ length: 20 }, (_, i) => ({
        key: i,
        left: `${(i * 17 + 7) % 100}%`,
        top: `${(i * 23 + 11) % 85}%`,
        size: i % 3 === 0 ? 2 : 1.5,
        opacity: 0.18 + (i % 5) * 0.1,
      })),
    [],
  );

  const heroColors = c.gradientHero.length >= 3 ? c.gradientHero : [c.gradientHero[0], c.gradientHero[1], c.bg];

  return (
    <LinearGradient
      colors={heroColors as [string, string, ...string[]]}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={[
        styles.wrap,
        {
          paddingTop: (includeSafeTop ? insets.top : 0) + space.md,
          minHeight: minHeight + (includeSafeTop ? insets.top : 0),
          borderBottomLeftRadius: roundedBottom ? radius.xl : 0,
          borderBottomRightRadius: roundedBottom ? radius.xl : 0,
        },
        style,
      ]}
    >
      <View style={[styles.glow, { backgroundColor: c.starGlow }]} pointerEvents="none" />
      {stars.map((s) => (
        <View
          key={s.key}
          pointerEvents="none"
          style={[
            styles.star,
            {
              left: s.left as `${number}%`,
              top: s.top as `${number}%`,
              width: s.size,
              height: s.size,
              opacity: s.opacity,
            },
          ]}
        />
      ))}
      <View style={styles.decoRing} pointerEvents="none" />
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: space.lg,
    paddingBottom: space.xxl,
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(99, 102, 241, 0.18)',
  },
  glow: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    top: -70,
    right: -50,
    opacity: 0.5,
  },
  star: {
    position: 'absolute',
    borderRadius: 99,
    backgroundColor: '#fff',
  },
  decoRing: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1,
    borderColor: 'rgba(20, 184, 166, 0.14)',
    bottom: -36,
    left: -40,
  },
});
