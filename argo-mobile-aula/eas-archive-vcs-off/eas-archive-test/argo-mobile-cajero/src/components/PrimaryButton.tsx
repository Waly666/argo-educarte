import React from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import { ScaledText } from './ScaledText';
import { useAccessibility } from '../context/AccessibilityContext';
import { themeColors } from '../theme/colors';

type IonName = ComponentProps<typeof Ionicons>['name'];

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'danger' | 'ghost';
  disabled?: boolean;
  style?: ViewStyle;
  icon?: IonName;
  fullWidth?: boolean;
};

export function PrimaryButton({
  label,
  onPress,
  variant = 'primary',
  disabled,
  style,
  icon,
  fullWidth,
}: Props) {
  const { buttonMultiplier, highContrast } = useAccessibility();
  const c = themeColors(highContrast);
  const minH = 50 * buttonMultiplier;
  const padH = 20 * buttonMultiplier;
  const bg =
    variant === 'danger' ? c.danger : variant === 'ghost' ? 'transparent' : c.primary;
  const color = variant === 'ghost' ? c.primary : '#fff';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: minH,
          paddingHorizontal: padH,
          backgroundColor: bg,
          opacity: disabled ? 0.5 : pressed ? 0.9 : 1,
          borderWidth: variant === 'ghost' ? 2 : 0,
          borderColor: variant === 'ghost' ? c.primary : 'transparent',
          alignSelf: fullWidth ? 'stretch' : 'center',
        },
        variant === 'primary' && !highContrast && styles.primaryShadow,
        style,
      ]}
      accessibilityRole="button"
    >
      <View style={styles.inner}>
        {icon ? <Ionicons name={icon} size={20} color={color} style={{ marginRight: 8 }} /> : null}
        <ScaledText baseSize={17} style={{ color, textAlign: 'center', fontWeight: '700' }}>
          {label}
        </ScaledText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryShadow: {
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 5,
  },
});
