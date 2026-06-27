import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import { ScaledText } from './ScaledText';
import { useTheme } from '../context/ThemeContext';
import { radius, space } from '../theme/spacing';
import { shadow } from '../theme/shadows';

type IonName = ComponentProps<typeof Ionicons>['name'];

type Props = {
  label: string;
  onPress: () => void;
  icon?: IonName;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'light' | 'accent' | 'warm';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  size?: 'md' | 'lg';
};

export function PrimaryButton({
  label,
  onPress,
  icon,
  variant = 'primary',
  disabled,
  loading,
  fullWidth,
  size = 'md',
}: Props) {
  const c = useTheme();
  const py = size === 'lg' ? 16 : 14;
  const fs = size === 'lg' ? 16 : 15;

  const isGhost = variant === 'ghost';
  const isLight = variant === 'light';
  const isDanger = variant === 'danger';
  const isSecondary = variant === 'secondary';
  const isAccent = variant === 'accent';
  const isWarm = variant === 'warm';

  const textColor =
    isGhost || isSecondary ? c.primary : isLight ? '#fff' : isAccent ? '#042f2e' : '#fff';

  const content = loading ? (
    <ActivityIndicator color={textColor} />
  ) : (
    <View style={styles.row}>
      {icon ? <Ionicons name={icon} size={18} color={textColor} /> : null}
      <ScaledText baseSize={fs} style={{ color: textColor, fontWeight: '700' }}>
        {label}
      </ScaledText>
    </View>
  );

  const pressedStyle = ({ pressed }: { pressed: boolean }) => [
    fullWidth && styles.full,
    { opacity: pressed || disabled || loading ? 0.86 : 1 },
  ];

  if ((variant === 'primary' || variant === 'accent' || variant === 'warm') && !disabled && !loading) {
    const colors =
      variant === 'accent' ? c.gradientAccent : variant === 'warm' ? c.gradientWarm : c.gradientPrimary;
    return (
      <Pressable onPress={onPress} disabled={disabled || loading} style={pressedStyle}>
        <LinearGradient
          colors={colors}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[styles.btn, { paddingVertical: py }, shadow.sm]}
        >
          {content}
        </LinearGradient>
      </Pressable>
    );
  }

  const bg = isDanger
    ? c.danger
    : isSecondary
      ? c.accentSoft
      : isLight
        ? 'rgba(255,255,255,0.14)'
        : isGhost
          ? 'transparent'
          : c.primary;

  const borderColor = isGhost ? c.primary : isLight ? 'rgba(255,255,255,0.45)' : 'transparent';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        fullWidth && styles.full,
        shadow.sm,
        {
          paddingVertical: py,
          backgroundColor: bg,
          borderColor,
          borderWidth: isGhost || isLight ? 1.5 : 0,
          opacity: pressed || disabled || loading ? 0.82 : 1,
        },
      ]}
    >
      {loading ? <ActivityIndicator color={textColor} /> : (
        <View style={styles.row}>
          {icon ? <Ionicons name={icon} size={18} color={textColor} /> : null}
          <ScaledText baseSize={fs} style={{ color: textColor, fontWeight: '700' }}>
            {label}
          </ScaledText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingHorizontal: space.xl,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  full: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
