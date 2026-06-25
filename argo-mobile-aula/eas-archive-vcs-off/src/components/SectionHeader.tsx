import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import { ScaledText } from './ScaledText';
import { useTheme } from '../context/ThemeContext';
import { space } from '../theme/spacing';
import { type } from '../theme/typography';

type IonName = ComponentProps<typeof Ionicons>['name'];

type Props = {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  icon?: IonName;
  iconColor?: string;
  iconBg?: string;
};

export function SectionHeader({ title, subtitle, action, icon, iconColor, iconBg }: Props) {
  const c = useTheme();
  const ic = iconColor ?? c.primary;
  const bg = iconBg ?? c.accentSoft;
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        {icon ? (
          <View style={[styles.iconWrap, { backgroundColor: bg }]}>
            <Ionicons name={icon} size={18} color={ic} />
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          <ScaledText baseSize={type.h2.fontSize} style={{ color: c.text, fontWeight: '700' }}>
            {title}
          </ScaledText>
          {subtitle ? (
            <ScaledText baseSize={type.caption.fontSize} style={{ color: c.textSoft, marginTop: 2 }}>
              {subtitle}
            </ScaledText>
          ) : null}
        </View>
      </View>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.md,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: space.md, flex: 1 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
