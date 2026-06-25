import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import { ScaledText } from './ScaledText';
import { useTheme } from '../context/ThemeContext';
import { radius, space } from '../theme/spacing';

type IonName = ComponentProps<typeof Ionicons>['name'];

type Props = { title: string; subtitle?: string; icon?: IonName };

export function EmptyState({ title, subtitle, icon = 'folder-open-outline' }: Props) {
  const c = useTheme();
  return (
    <View style={styles.wrap}>
      <View style={[styles.circle, { backgroundColor: c.accentSoft }]}>
        <Ionicons name={icon} size={40} color={c.primary} />
      </View>
      <ScaledText baseSize={17} style={{ color: c.text, fontWeight: '800', marginTop: space.lg, textAlign: 'center' }}>
        {title}
      </ScaledText>
      {subtitle ? (
        <ScaledText baseSize={14} style={{ color: c.textSoft, marginTop: space.sm, textAlign: 'center', lineHeight: 20 }}>
          {subtitle}
        </ScaledText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', padding: space.xxxl },
  circle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
