import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import { ScaledText } from './ScaledText';
import { useTheme } from '../context/ThemeContext';
import { radius, space } from '../theme/spacing';
import { shadow } from '../theme/shadows';

type IonName = ComponentProps<typeof Ionicons>['name'];

type Props = {
  label: string;
  value: string | number;
  icon: IonName;
  color?: string;
  softColor?: string;
};

export function StatTile({ label, value, icon, color, softColor }: Props) {
  const c = useTheme();
  const main = color ?? c.primary;
  const soft = softColor ?? c.accentSoft;

  return (
    <View style={[styles.tile, shadow.sm, { backgroundColor: c.card, borderColor: c.borderLight, borderLeftColor: main, borderLeftWidth: 3 }]}>
      <View style={[styles.icon, { backgroundColor: soft }]}>
        <Ionicons name={icon} size={20} color={main} />
      </View>
      <ScaledText baseSize={24} style={{ color: main, fontWeight: '800', marginTop: space.sm }}>
        {value}
      </ScaledText>
      <ScaledText baseSize={11} style={{ color: c.textSoft, marginTop: 2, fontWeight: '600' }}>
        {label}
      </ScaledText>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: '47%',
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.lg,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
