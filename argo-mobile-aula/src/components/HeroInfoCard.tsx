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
  icon: IonName;
  title: string;
  text: string;
  tint?: string;
  tintSoft?: string;
};

export function HeroInfoCard({ icon, title, text, tint, tintSoft }: Props) {
  const c = useTheme();
  const iconColor = tint ?? c.violet;
  const iconBg = tintSoft ?? c.violetSoft;

  return (
    <View
      style={[
        styles.card,
        shadow.md,
        {
          backgroundColor: c.cardElevated,
          borderColor: c.borderLight,
        },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <ScaledText baseSize={14} style={{ color: c.text, fontWeight: '800', marginBottom: 4 }}>
        {title}
      </ScaledText>
      <ScaledText baseSize={12} style={{ color: c.textSoft, lineHeight: 18 }}>
        {text}
      </ScaledText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: '30%',
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: space.md,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
});
