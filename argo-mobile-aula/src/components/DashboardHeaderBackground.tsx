import React from 'react';
import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from '../context/ThemeContext';

/** Fondo del header del aula logueada. */
export function DashboardHeaderBackground() {
  const c = useTheme();
  return (
    <LinearGradient
      colors={c.gradientHero.length >= 2 ? [c.gradientHero[0], c.gradientHero[1] ?? c.primary] : [c.headerBg, c.primaryDark]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={StyleSheet.absoluteFill}
    />
  );
}
