import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../context/ThemeContext';
import { radius, space } from '../theme/spacing';

type Props = {
  children?: React.ReactNode;
  /** Altura mínima del bloque azul; crece si el contenido es más alto. */
  height?: number;
  style?: ViewStyle;
  roundedBottom?: boolean;
};

export function GradientHeader({ children, height = 120, style, roundedBottom = true }: Props) {
  const c = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={c.gradientHero}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.wrap,
        {
          paddingTop: insets.top + space.md,
          minHeight: height + insets.top,
          borderBottomLeftRadius: roundedBottom ? radius.xl : 0,
          borderBottomRightRadius: roundedBottom ? radius.xl : 0,
        },
        style,
      ]}
    >
      <View style={styles.deco1} pointerEvents="none" />
      <View style={styles.deco2} pointerEvents="none" />
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: space.lg,
    paddingBottom: space.xxl,
  },
  deco1: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.08)',
    top: -40,
    right: -50,
    overflow: 'hidden',
  },
  deco2: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.05)',
    bottom: 10,
    left: -20,
  },
});
