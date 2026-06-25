import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

import { useTheme } from '../context/ThemeContext';
import { radius, space } from '../theme/spacing';
import { shadow } from '../theme/shadows';

type Props = {
  children: React.ReactNode;
  style?: ViewStyle;
  elevated?: boolean;
  padding?: 'md' | 'lg';
  /** Fondo suave de acento (sin cambiar el layout). */
  tint?: string;
  /** Borde izquierdo de color. */
  accentLeft?: string;
};

export function SurfaceCard({ children, style, elevated = true, padding = 'lg', tint, accentLeft }: Props) {
  const c = useTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: tint ?? c.card,
          borderWidth: 1,
          borderColor: accentLeft ? `${accentLeft}40` : c.borderLight,
          ...(accentLeft ? { borderLeftWidth: 4, borderLeftColor: accentLeft } : {}),
          padding: padding === 'lg' ? space.lg : space.md,
        },
        elevated && shadow.md,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.xl },
});
