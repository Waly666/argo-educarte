import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import { ScaledText } from './ScaledText';
import { useTheme } from '../context/ThemeContext';
import { radius, space } from '../theme/spacing';
import { shadow } from '../theme/shadows';

type IonName = ComponentProps<typeof Ionicons>['name'];

type Props = {
  label: string;
  subtitle?: string;
  icon: IonName;
  onPress: () => void;
  tint?: string;
};

export function QuickAction({ label, subtitle, icon, onPress, tint }: Props) {
  const c = useTheme();
  const color = tint ?? c.primary;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        shadow.sm,
        {
          backgroundColor: c.cardElevated,
          borderColor: c.border,
          opacity: pressed ? 0.92 : 1,
        },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <ScaledText baseSize={14} style={{ color: c.text, fontWeight: '700', marginTop: space.sm }}>
        {label}
      </ScaledText>
      {subtitle ? (
        <ScaledText baseSize={11} style={{ color: c.textSoft, marginTop: 2 }} numberOfLines={2}>
          {subtitle}
        </ScaledText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '47%',
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.lg,
    minHeight: 108,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
