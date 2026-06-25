import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import { ScaledText } from './ScaledText';
import { useAccessibility } from '../context/AccessibilityContext';
import { themeColors } from '../theme/colors';

type IonName = ComponentProps<typeof Ionicons>['name'];

type Props = {
  title: string;
  subtitle?: string;
  icon: IonName;
  tone?: 'primary' | 'accent' | 'neutral';
  children: React.ReactNode;
};

export function FormSection({ title, subtitle, icon, tone = 'primary', children }: Props) {
  const { highContrast } = useAccessibility();
  const c = themeColors(highContrast);
  const toneBg =
    tone === 'accent' ? c.accentSoft : tone === 'neutral' ? (highContrast ? c.bgAlt : '#f8fafc') : '#eef2ff';
  const toneIcon = tone === 'accent' ? c.accent : c.primary;

  return (
    <View style={[styles.wrap, { borderColor: c.border, backgroundColor: c.card }]}>
      <View style={styles.head}>
        <View style={[styles.iconBox, { backgroundColor: toneBg }]}>
          <Ionicons name={icon} size={20} color={toneIcon} />
        </View>
        <View style={{ flex: 1 }}>
          <ScaledText baseSize={16} style={{ color: c.text, fontWeight: '800' }}>{title}</ScaledText>
          {subtitle ? (
            <ScaledText baseSize={12} style={{ color: c.textSoft, marginTop: 2, lineHeight: 17 }}>
              {subtitle}
            </ScaledText>
          ) : null}
        </View>
      </View>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 14,
    overflow: 'hidden',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 10,
  },
});
