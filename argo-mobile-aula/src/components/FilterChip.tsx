import React from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { ScaledText } from './ScaledText';
import { useTheme } from '../context/ThemeContext';
import { accentSwatch } from '../theme/colors';
import { radius, space } from '../theme/spacing';

type Props = {
  label: string;
  active?: boolean;
  onPress: () => void;
  /** Índice para variar el color activo (0 = índigo, 1 = morado, 2 = cielo…). */
  tone?: number;
};

export function FilterChip({ label, active, onPress, tone = 0 }: Props) {
  const c = useTheme();
  const sw = accentSwatch(tone, c);
  const activeColor = sw.color;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        shadowIf(active),
        {
          backgroundColor: active ? activeColor : c.card,
          borderColor: active ? activeColor : c.border,
          opacity: pressed ? 0.88 : 1,
        },
      ]}
    >
      <ScaledText
        baseSize={13}
        style={{ color: active ? '#fff' : c.text, fontWeight: active ? '700' : '500' }}
      >
        {label}
      </ScaledText>
    </Pressable>
  );
}

function shadowIf(active?: boolean) {
  return active
    ? {
        shadowColor: '#000',
        shadowOpacity: 0.12,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 3,
      }
    : {};
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm + 2,
    marginRight: space.sm,
  },
});
