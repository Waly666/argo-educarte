import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from '../context/ThemeContext';
import { radius, space } from '../theme/spacing';
import { shadow } from '../theme/shadows';

type Props = {
  children: React.ReactNode;
  style?: ViewStyle;
};

/** Tarjeta hero índigo + morado + menta (misma que el tablero tras login). */
export function EducarteHeroCard({ children, style }: Props) {
  const c = useTheme();

  return (
    <LinearGradient
      colors={c.gradientDashHero}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.card, shadow.lg, style]}
    >
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    padding: space.xl,
    overflow: 'hidden',
  },
});
